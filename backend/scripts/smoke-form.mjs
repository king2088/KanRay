// 表单功能 端到端 HTTP smoke（临时脚本，不入库）
// 启动真实后端 → admin 登录 → 建表单 → 设计字段 → 发布建表/注册数据集 → 内部分发提交 → mine 列表
// → 分享(密码) → 公开 meta → 密码校验(错/对) → 公开取填表视图 → 匿名提交 → 关闭后禁填 → 数据表可被数据集查询
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);

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
const DB_PATH = path.join(os.tmpdir(), `smoke-form-${Date.now()}.db`);
const results = [];
const admin = { email: 'admin@kanray.local', password: 'admin123' };

function ok(name, cond, extra = '') {
  results.push({ name, pass: !!cond });
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
  ok('P1  admin 登录', true, '');

  const authH = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // 建表单
  let r = await fetch(`${BASE}/api/forms`, {
    method: 'POST', headers: authH,
    body: JSON.stringify({ name: 'smoke 员工反馈', description: '冒烟' }),
  });
  let d = await j(r);
  if (r.status !== 200 || !d.data?.id) throw new Error('创建表单失败: ' + JSON.stringify(d).slice(0, 300));
  const formId = d.data.id;
  ok('P2  创建表单', true, `id=${formId}`);

  // 设计字段 + 提交配置
  const fields = [
    { key: 'name', label: '姓名', type: 'text', required: true, span: 1 },
    { key: 'age', label: '年龄', type: 'number', required: false, span: 1 },
    { key: 'level', label: '满意度', type: 'select', required: true, span: 2, options: [{ label: '满意', value: 'good' }, { label: '一般', value: 'ok' }] },
    { key: 'memo', label: '备注', type: 'textarea', required: false, span: 2 },
  ];
  r = await fetch(`${BASE}/api/forms/${formId}`, {
    method: 'PATCH', headers: authH,
    body: JSON.stringify({
      name: 'smoke 员工反馈',
      description: '冒烟',
      submitConfig: { successText: '已收到', allowRepeat: true },
      schemaJson: { version: 1, fields },
    }),
  });
  d = await j(r);
  if (r.status !== 200 || (d.data?.schema?.fields || []).length !== 4) throw new Error('保存 schema 失败: ' + JSON.stringify(d).slice(0, 300));
  ok('P3  保存字段 schema(4)', true, `len=${d.data.schema.fields.length}`);

  // 发布 → 建表 + 注册数据集
  r = await fetch(`${BASE}/api/forms/${formId}/publish`, { method: 'POST', headers: authH });
  d = await j(r);
  if (r.status !== 200 || !d.data?.tableName || !d.data?.datasetId) throw new Error('发布失败: ' + JSON.stringify(d).slice(0, 400));
  ok('P4  发布建表并注册数据集', true, `table=${d.data.tableName} ds=${d.data.datasetId}`);

  r = await fetch(`${BASE}/api/datasets/${d.data.datasetId}`, { headers: authH });
  const ds = await j(r);
  ok('P5  数据集可读 source_type=form', ds.data?.source_type === 'form' || ds.data?.sourceType === 'form', JSON.stringify(ds.data).slice(0, 120));

  // 内部分发提交
  r = await fetch(`${BASE}/api/forms/${formId}/submissions`, {
    method: 'POST', headers: authH,
    body: JSON.stringify({ values: { name: '张三', age: 28, level: 'good', memo: '挺好' } }),
  });
  d = await j(r);
  if (r.status !== 200 || !d.data?.id) throw new Error('内部分发表交失败: ' + JSON.stringify(d).slice(0, 300));
  ok('P6  内部分发表交', true, `subId=${d.data.id}`);

  // mine 列表
  r = await fetch(`${BASE}/api/forms/${formId}/submissions?mine=1`, { headers: authH });
  d = await j(r);
  const mineRows = d.data || [];
  ok('P7  mine 列表命中且值正确', mineRows.length === 1 && mineRows[0].name === '张三' && mineRows[0].level === 'good', JSON.stringify(mineRows[0]).slice(0, 160));

  // 部分更新提交（PATCH 单字段合并）
  r = await fetch(`${BASE}/api/forms/${formId}/submissions/${mineRows[0].id}`, {
    method: 'PATCH', headers: authH,
    body: JSON.stringify({ values: { memo: '补一句' } }),
  });
  d = await j(r);
  r = await fetch(`${BASE}/api/forms/${formId}/submissions?mine=1`, { headers: authH });
  d = await j(r);
  const updRow = (d.data || [])[0];
  ok('P8  部分更新合并保留原值', updRow.memo === '补一句' && updRow.name === '张三', JSON.stringify(updRow).slice(0, 160));

  // 必填校验失败
  r = await fetch(`${BASE}/api/forms/${formId}/submissions`, {
    method: 'POST', headers: authH,
    body: JSON.stringify({ values: { age: 1 } }),
  });
  d = await j(r);
  ok('P9  必填缺失被拒', r.status === 400, `${r.status} ${d.message}`);

  // 创建分享（带密码）
  r = await fetch(`${BASE}/api/forms/${formId}/shares`, {
    method: 'POST', headers: authH,
    body: JSON.stringify({ password: '1234', expiresAt: null }),
  });
  d = await j(r);
  if (r.status !== 200 || !d.data?.token) throw new Error('创建分享失败: ' + JSON.stringify(d).slice(0, 300));
  const shareToken = d.data.token;
  ok('P10 创建带密码分享', d.data.hasPassword === true || d.data.hasPassword === 1, `token=${shareToken.slice(0, 8)}…`);

  // 公开 meta
  r = await fetch(`${BASE}/api/public/forms/${shareToken}/meta`);
  d = await j(r);
  ok('P11 公开 meta 发现且需密码', d.data?.found === true && d.data?.requiresPassword === true, JSON.stringify(d.data).slice(0, 120));

  // 错误密码
  r = await fetch(`${BASE}/api/public/forms/${shareToken}/verify`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'xxxx' }),
  });
  d = await j(r);
  ok('P12 错误密码被拒(40101)', r.status === 401 && d.code === 40101, `${r.status} code=${d.code}`);

  // 正确密码
  r = await fetch(`${BASE}/api/public/forms/${shareToken}/verify`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: '1234' }),
  });
  d = await j(r);
  const shareJwt = d.data?.accessToken;
  if (r.status !== 200 || !shareJwt) throw new Error('验证密码失败: ' + JSON.stringify(d).slice(0, 300));
  ok('P13 正确密码发放入场凭证', true, 'jwt');

  const pubH = { 'Content-Type': 'application/json', Authorization: `Bearer ${shareJwt}` };

  // 公开取填表视图
  r = await fetch(`${BASE}/api/public/forms/${shareToken}/form`, { headers: pubH });
  d = await j(r);
  const fillView = d.data?.form;
  ok('P14 公开填表视图可用', fillView?.name === 'smoke 员工反馈' && (fillView?.schema?.fields || []).length === 4, JSON.stringify(fillView).slice(0, 140));

  // 匿名提交
  r = await fetch(`${BASE}/api/public/forms/${shareToken}/submissions`, {
    method: 'POST', headers: pubH,
    body: JSON.stringify({ values: { name: '路人', age: 30, level: 'ok' } }),
  });
  d = await j(r);
  if (r.status !== 200 || !d.data?.id) throw new Error('匿名提交失败: ' + JSON.stringify(d).slice(0, 300));
  ok('P15 匿名提交成功返回序号', true, `subId=${d.data.id}`);

  // 全部列表 2 条；mine 仍 1 条
  r = await fetch(`${BASE}/api/forms/${formId}/submissions`, { headers: authH });
  d = await j(r);
  const allRows = d.data || [];
  r = await fetch(`${BASE}/api/forms/${formId}/submissions?mine=1`, { headers: authH });
  d = await j(r);
  ok('P16 全部2条 / mine隔离1条', allRows.length === 2 && (d.data || []).length === 1, `all=${allRows.length} mine=${(d.data || []).length}`);

  // 数据表可被图表配置查询（数据集 lineage 可解析）
  r = await fetch(`${BASE}/api/forms/${formId}`, { headers: authH });
  d = await j(r);
  ok('P17 表单含 tableName/datasetId', !!d.data?.tableName && !!d.data?.datasetId, JSON.stringify({ t: d.data?.tableName, ds: d.data?.datasetId }));

  // 关闭表单
  r = await fetch(`${BASE}/api/forms/${formId}/close`, { method: 'POST', headers: authH });
  d = await j(r);
  ok('P18 关闭表单', d.data?.status === 'closed', d.data?.status);

  // 关闭后公开提交被拒
  r = await fetch(`${BASE}/api/public/forms/${shareToken}/submissions`, {
    method: 'POST', headers: pubH,
    body: JSON.stringify({ values: { name: '再来', level: 'ok' } }),
  });
  d = await j(r);
  ok('P19 关闭后提交被拒(400)', r.status === 400, `${r.status} ${d.message}`);
} catch (e) {
  console.error('SMOKE EXCEPTION: ' + (e.stack || e.message));
} finally {
  srv.kill('SIGTERM');
  try { fs.rmSync(DB_PATH, { force: true }); } catch {}
}

const failed = results.filter((x) => !x.pass).length;
console.log(`\n表单 smoke：${results.length - failed}/${results.length} 通过`);
process.exit(failed ? 1 : 0);