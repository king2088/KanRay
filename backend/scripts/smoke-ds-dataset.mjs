// 数据源 + 数据集 端到端 HTTP smoke（临时脚本，不入库）
// 启动真实后端 → admin 登录 → 创建 mysql 数据源 → browse(库/表/列) → 切 sync → 建同步配置 → 全量同步 → 日志 → 本地表浏览降级
// 自主运行：mysql:13306 不可达时自动跳过（exit 0），端口随机避免占用冲突。
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);

const MYSQL_CFG = { host: '127.0.0.1', port: 13306, user: 'root', password: 'Kanban@123', database: 'sync_src' };

function reachable(host, port, timeout = 1500) {
  return new Promise((resolve) => {
    const s = net.connect({ host, port });
    s.setTimeout(timeout);
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('error', () => { s.destroy(); resolve(false); });
    s.on('timeout', () => { s.destroy(); resolve(false); });
  });
}

const mysqlUp = await reachable(MYSQL_CFG.host, MYSQL_CFG.port);
if (!mysqlUp) {
  console.log(`SKIP  smoke-ds-dataset: live mysql ${MYSQL_CFG.host}:${MYSQL_CFG.port} 未运行`);
  process.exit(0);
}

const getFreePort = () => new Promise((resolve, reject) => {
  const s = net.createServer();
  s.on('error', reject);
  s.listen(0, '127.0.0.1', () => {
    const p = s.address().port;
    s.close(() => resolve(p));
  });
});
const PORT = await getFreePort();
const BASE = `http://127.0.0.1:${PORT}`;
const DB_PATH = path.join(os.tmpdir(), `smoke-kanban-${Date.now()}.db`);
const results = [];
const admin = { email: 'admin@kanray.local', password: 'admin123' };

const awaitSourceCount = async () => {
  const mysql = require('mysql2/promise');
  const c = await mysql.createConnection(MYSQL_CFG);
  const [rows] = await c.query('SELECT COUNT(*) AS n FROM sales2');
  await c.end();
  return rows[0].n;
};

function ok(name, cond, extra = '') {
  results.push({ name, pass: !!cond, extra: cond ? '' : ` ${extra}` });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : `  ← ${extra}`}`);
}
async function j(res) {
  const t = await res.text();
  try { return JSON.parse(t); } catch { throw new Error(`非 JSON 响应 ${res.status}: ${t.slice(0, 200)}`); }
}

const srv = spawn('node', ['src/server.js'], {
  cwd: path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'),
  env: { ...process.env, PORT: String(PORT), DB_TYPE: 'sqlite', DB_PATH, DB_PASSWORD: '' },
  stdio: ['ignore', 'pipe', 'inherit'],
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitBoot() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(admin),
      });
      if (r.status < 500) return r;
    } catch {}
    await sleep(500);
  }
  throw new Error('后端启动超时');
}

let token;
try {
  let login = await waitBoot();
  login = await j(login);
  token = login.data?.accessToken || login.accessToken || login.data?.token || login.token;
  if (!token) throw new Error('登录响应无 token: ' + JSON.stringify(login).slice(0, 300));
  ok('P1 admin 登录', true, '');

  let r = await fetch(`${BASE}/api/datasources/drivers`, { headers: { Authorization: `Bearer ${token}` } });
  let d = await j(r);
  ok('P2 驱动列表 22 个', d.data?.length === 22, `got ${d.data?.length}`);

  r = await fetch(`${BASE}/api/datasources`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'smoke-live-mysql', type: 'mysql', mode: 'direct', config: MYSQL_CFG }),
  });
  d = await j(r);
  if (r.status !== 200 || !d.data?.id) { throw new Error('创建数据源失败: ' + JSON.stringify(d).slice(0, 300)); }
  const dsId = d.data.id;
  ok('P3 创建 mysql 数据源(direct)', true, `id=${dsId}`);

  r = await fetch(`${BASE}/api/datasources/${dsId}/test`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  d = await j(r);
  ok('P4 已存数据源连通性测试 ok', d.data?.ok === true, JSON.stringify(d.data).slice(0, 120));

  r = await fetch(`${BASE}/api/datasources/${dsId}/schemas`, { headers: { Authorization: `Bearer ${token}` } });
  d = await j(r);
  const schemas = (d.data || []).map((s) => s.name);
  ok('P5 直接浏览 schema 含 sync_src', schemas.includes('sync_src'), schemas.join(','));

  r = await fetch(`${BASE}/api/datasources/${dsId}/schemas/sync_src/tables`, { headers: { Authorization: `Bearer ${token}` } });
  d = await j(r);
  const tables = (d.data || []).map((t) => t.name);
  ok('P6 浏览表含 sales2', tables.includes('sales2'), tables.join(','));

  r = await fetch(`${BASE}/api/datasources/${dsId}/schemas/sync_src/tables/sales2/columns`, { headers: { Authorization: `Bearer ${token}` } });
  d = await j(r);
  const cols = (d.data || []).map((c) => c.name);
  ok('P7 浏览列 4 字段齐', ['id', 'regionkey', 'name', 'created_at'].every((c) => cols.includes(c)), cols.join(','));

  // 切 sync 模式 + 建同步配置
  r = await fetch(`${BASE}/api/datasources/${dsId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mode: 'sync' }),
  });
  d = await j(r);
  ok('P8 切换存储方式 sync', d.data?.mode === 'sync', JSON.stringify(d.data?.mode));

  r = await fetch(`${BASE}/api/datasources/${dsId}/sync-configs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sourceSchema: 'sync_src', sourceTable: 'sales2', strategy: 'full', primaryKey: 'id', runNow: false }),
  });
  d = await j(r);
  const cid = d.data?.id;
  if (r.status !== 200 || !cid) throw new Error('建同步配置失败: ' + JSON.stringify(d).slice(0, 300));
  ok('P9 创建同步配置(full) 返回 id', true, `cid=${cid}`);

  r = await fetch(`${BASE}/api/datasources/${dsId}/sync-configs`, { headers: { Authorization: `Bearer ${token}` } });
  d = await j(r);
  ok('P10 配置列表含新建项', (d.data || []).some((c) => c.id === cid), `count=${(d.data || []).length}`);

  const srcCount = await awaitSourceCount();

  r = await fetch(`${BASE}/api/datasources/${dsId}/sync-configs/${cid}/run`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  d = await j(r);
  ok('P11 手动全量同步执行成功', Number(d.data?.rows) === srcCount, JSON.stringify(d.data).slice(0, 150));

  r = await fetch(`${BASE}/api/datasources/${dsId}/sync-configs/${cid}/logs`, { headers: { Authorization: `Bearer ${token}` } });
  d = await j(r);
  const logs = d.data || [];
  ok('P12 同步日志已写入', logs.length > 0 && logs[0].status === 'success', `logs=${logs.length} first=${logs[0]?.status}`);

  const localTable = d.data?.localTable || `sync_${dsId}_sales2`;
  r = await fetch(`${BASE}/api/datasources/${dsId}/sync-configs`, { headers: { Authorization: `Bearer ${token}` } });
  d = await j(r);
  const scRow = (d.data || []).find((c) => c.id === cid);
  ok('P13 配置含 local_table', !!scRow?.local_table && scRow.local_table === localTable, `local=${scRow?.local_table}`);

  // sync 模式浏览降级到本地表
  r = await fetch(`${BASE}/api/datasources/${dsId}/schemas`, { headers: { Authorization: `Bearer ${token}` } });
  d = await j(r);
  const deg = (d.data || []).map((s) => s.name);
  ok('P14 sync 模式浏览降级为本地表', deg.includes('local') && !deg.includes('sync_src'), deg.join(','));

  r = await fetch(`${BASE}/api/datasources/${dsId}/schemas/local/tables`, { headers: { Authorization: `Bearer ${token}` } });
  d = await j(r);
  const degT = (d.data || []).map((t) => (typeof t === 'string' ? t : t.name));
  ok('P15 降级本地表含 sync 表', degT.includes(localTable), JSON.stringify(degT));

  r = await fetch(`${BASE}/api/datasources/${dsId}/schemas/local/tables/${localTable}/columns`, { headers: { Authorization: `Bearer ${token}` } });
  d = await j(r);
  const degC = (d.data || []).map((c) => c.name);
  ok('P16 降级本地表列齐', ['id', 'regionkey', 'name', 'created_at'].every((c) => degC.includes(c)), degC.join(','));
} catch (e) {
  ok('SMOKE 异常中断', false, e.message);
} finally {
  try { await fetch(`${BASE}/api/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {}); } catch {}
  srv.kill('SIGTERM');
  try { fs.unlinkSync(DB_PATH); } catch {}
  try { fs.unlinkSync(`${DB_PATH}-wal`); } catch {}
  try { fs.unlinkSync(`${DB_PATH}-shm`); } catch {}
}

const bad = results.filter((r) => !r.pass);
console.log(`\n===== 数据源+数据集 HTTP smoke: ${results.length - bad.length}/${results.length} PASS, ${bad.length} FAIL =====`);
process.exit(bad.length ? 1 : 0);