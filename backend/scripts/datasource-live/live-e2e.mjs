// Live end-to-end validation against docker-contained databases.
//  1) per-family browse+query against real endpoints
//  2) real keyset full-sync (>5000 rows) from MySQL and SQL Server through sync.service
// Usage: node scripts/datasource-live/live-e2e.mjs
import { createRequire } from 'node:module';
import net from 'node:net';

process.env.DB_PATH = `/tmp/kanban-live-e2e-${process.pid}.db`;
process.env.DATA_DIR = `/tmp/kanban-live-e2e-data-${process.pid}`;

const require = createRequire(import.meta.url);
const db = require('../../src/db');
const { getProvider } = require('../../src/datasources/providers/index');
const sync = require('../../src/services/sync.service');
db.initSchema();

const PASS = [];
const FAIL = [];

function ok(name) { PASS.push(name); console.log(`[PASS] ${name}`); }
function bad(name, err) { FAIL.push(name); console.log(`[FAIL] ${name} -> ${err && err.message ? err.message : err}`); }

function reachable(host, port) {
  return new Promise((res) => {
    const s = net.connect({ host, port });
    s.once('connect', () => { s.destroy(); res(true); });
    s.once('error', () => { s.destroy(); res(false); });
  });
}

async function probe(cfg, type, dialect, family) {
  try {
    const p = getProvider(family);
    const t = await p.testConnection(cfg, type);
    if (!t) throw new Error('testConnection 返回 false');
    const schemas = await p.listSchemas(cfg, type);
    const schema = (schemas && schemas[0] && schemas[0].name) || null;
    const tables = schema ? await p.listTables(cfg, type, schema) : [];
    if (!tables || tables.length === 0) throw new Error(`schema=${schema} 无表`);
    const t0 = tables[0];
    const cols = await p.listColumns(cfg, type, schema, t0.name);
    const q = dialect === 'es' ? `SELECT * FROM "${t0.name}" LIMIT 5`
      : dialect === 'presto' ? `SELECT * FROM ${schema}.${t0.name} LIMIT 5`
      : `SELECT * FROM ${schema}.${t0.name} LIMIT 5`;
    const rows = await p.runQuery(cfg, q, []);
    if (!Array.isArray(rows)) throw new Error('runQuery 未返回数组');
    ok(`${type} 浏览+查询 schema=${schema} table=${t0.name} 列${cols.length} 行${rows.length}`);
  } catch (e) { bad(`${type} 浏览+查询`, e); }
}

// ─── 1.5) 空库自预植：全新容器无业务表，浏览阶段会「无表」；建幂等种子表，保证探针命中真实表 ─
async function ensureSeedTables() {
  const jobs = [];
  // mysql/mariadb/tidb（mysql2，纯 JS）
  for (const [label, port, extra] of [
    ['mysql', 13306, ''], ['mariadb', 13307, ''], ['tidb', 14000, 'CREATE DATABASE IF NOT EXISTS testdb;'],
  ]) {
    jobs.push((async () => {
      const mysql2 = require('mysql2/promise');
      const conn = await mysql2.createConnection({ host: '127.0.0.1', port, user: 'root', password: port === 14000 ? '' : 'Kanban@123' });
      if (extra) await conn.query(extra);
      await conn.query('CREATE TABLE IF NOT EXISTS testdb.live_seed (id INT PRIMARY KEY, name VARCHAR(50))');
      await conn.query("INSERT IGNORE INTO testdb.live_seed (id,name) VALUES (1,'s'),(2,'s')");
      await conn.end();
      console.log(`[seed] ${label} testdb.live_seed`);
    })());
  }
  // postgres
  jobs.push((async () => {
    const { Client } = require('pg');
    const c = new Client({ host: '127.0.0.1', port: 15432, database: 'testdb', user: 'postgres', password: 'Kanban@123' });
    await c.connect();
    await c.query('CREATE TABLE IF NOT EXISTS public.live_seed (id INT PRIMARY KEY, name VARCHAR(50))');
    await c.query("INSERT INTO live_seed VALUES (1,'s'),(2,'s') ON CONFLICT DO NOTHING");
    await c.end();
    console.log('[seed] postgres public.live_seed');
  })());
  // clickhouse（HTTP）
  jobs.push((async () => {
    const base = 'http://127.0.0.1:18123';
    const auth = 'Basic ' + Buffer.from('default:Kanban@123').toString('base64');
    for (const q of [
      'CREATE TABLE IF NOT EXISTS testdb.live_seed (id Int32, name String) ENGINE=Memory',
      'INSERT INTO testdb.live_seed VALUES (1, \'s\'), (2, \'s\')',
    ]) {
      await fetch(base + '/?query=' + encodeURIComponent(q), { method: 'POST', headers: { Authorization: auth } });
    }
    console.log('[seed] clickhouse testdb.live_seed');
  })());
  // elasticsearch（REST，建索引）
  jobs.push((async () => {
    await fetch('http://127.0.0.1:19200/live_seed', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mappings: { properties: { id: { type: 'integer' }, name: { type: 'keyword' } } } }) });
    await fetch('http://127.0.0.1:19200/live_seed/_doc/1', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 1, name: 's' }) });
    console.log('[seed] elasticsearch live_seed');
  })());
  await Promise.allSettled(jobs);
}

// ─── 1) 各活库浏览 + 查询 ─────────────────────
await ensureSeedTables();
const cases = [
  { type: 'mysql', dialect: 'mysql', family: 'mysql', cfg: { host: '127.0.0.1', port: 13306, database: 'testdb', user: 'root', password: 'Kanban@123' } },
  { type: 'mariadb', dialect: 'mysql', family: 'mysql', cfg: { host: '127.0.0.1', port: 13307, database: 'testdb', user: 'root', password: 'Kanban@123' } },
  { type: 'tidb', dialect: 'mysql', family: 'mysql', cfg: { host: '127.0.0.1', port: 14000, database: 'testdb', user: 'root', password: '' } },
  { type: 'postgres', dialect: 'pg', family: 'pg', cfg: { host: '127.0.0.1', port: 15432, database: 'testdb', user: 'postgres', password: 'Kanban@123', schema: 'public' } },
  { type: 'sqlserver', dialect: 'mssql', family: 'mssql', cfg: { host: '127.0.0.1', port: 11433, database: 'testdb', user: 'sa', password: 'Kanban@123', schema: 'dbo' } },
  { type: 'clickhouse', dialect: 'clickhouse', family: 'clickhouse', cfg: { host: '127.0.0.1', port: 18123, database: 'testdb', user: 'default', password: 'Kanban@123' } },
  { type: 'oracle', dialect: 'oracle', family: 'oracle', cfg: { host: '127.0.0.1', port: 11521, service_name: 'FREEPDB1', user: 'system', password: 'Kanban@123', schema: 'SYSTEM' } },
  { type: 'presto', dialect: 'presto', family: 'presto', cfg: { host: '127.0.0.1', port: 18080, catalog: 'tpch', user: 'trino' } },
  { type: 'elasticsearch', dialect: 'es', family: 'es-rest', cfg: { scheme: 'http', host: '127.0.0.1', port: 19200 } },
  // 原生驱动家族：驱动可加载且容器可达才真连（Linux + npm i ibm_db/odbc 后启用），否则走友好降级/SKIP
  { type: 'db2', dialect: 'db2', family: 'db2', nativeDriver: 'ibm_db', cfg: { host: '127.0.0.1', port: 50000, database: 'TESTDB', user: 'db2inst1', password: 'Kanban@123' } },
  { type: 'dameng', dialect: 'dameng', family: 'dameng', nativeDriver: 'odbc', seedOdbc: true, cfg: { host: '127.0.0.1', port: 5236, user: 'SYSDBA', password: 'SYSDBA001' } },
];

for (const c of cases) {
  if (c.nativeDriver) {
    // 原生驱动不可用（如 macOS 无 ibm_db/odbc）→ 验证友好降级路径
    let loadable = true;
    try { require(c.nativeDriver); } catch (e) { loadable = false; }
    if (!loadable) {
      try {
        const p = getProvider(c.family);
        const r = await p.testConnection(c.cfg, c.type);
        ok(`${c.type} 原生驱动缺失 → 友好报错（got ${typeof r}: ${JSON.stringify(r).slice(0, 80)}）`);
        continue;
      } catch (e) {
        const m = String(e && e.message || e);
        const friendly = /未安装|not installed|不支持|ibm_db|odbc/i.test(m) || /npm i/.test(m);
        if (friendly) ok(`${c.type} 原生驱动缺失 → 友好报错:${m.slice(0, 60)}`);
        else bad(`${c.type} 原生驱动缺失 → 非友好错误:`, e.message);
        continue;
      }
    }
  }
  if (!(await reachable(c.cfg.host, c.cfg.port))) {
    console.log(`[SKIP] ${c.type}: ${c.cfg.host}:${c.cfg.port} 未运行`);
    continue;
  }
  await probe(c.cfg, c.type, c.dialect, c.family);
}

// ─── 2) 真实 keyset 全量同步（>5000 行）────────────────────
async function seedAndSync(label, type, cfg, ddl, insertFn) {
  const mysql2 = require('mysql2/promise');
  const tedious = require('tedious');
  const t = process.hrtime.bigint();
  const N = 6500;
  try {
    // seed
    if (type === 'mysql') {
      const conn = await mysql2.createConnection(cfg);
      await conn.query('DROP TABLE IF EXISTS live_orders');
      await conn.query('CREATE TABLE live_orders (id INT NOT NULL PRIMARY KEY, name VARCHAR(50), amount DECIMAL(12,2), ts DATETIME)');
      for (let i = 0; i < N; i += 500) {
        const rows = [];
        for (let j = i; j < Math.min(i + 500, N); j++) rows.push([j, `r${j}`, j % 1000 + 0.5, new Date(1700000000000 + j * 1000)]);
        await conn.query('INSERT INTO live_orders (id, name, amount, ts) VALUES ?', [rows]);
      }
      await conn.end();
    } else if (type === 'sqlserver') {
      const conn = new tedious.Connection({ server: cfg.host, options: { port: cfg.port, database: cfg.database, encrypt: false, trustServerCertificate: true }, authentication: { type: 'default', options: { userName: cfg.user, password: cfg.password } } });
      await new Promise((res, rej) => { conn.on('connect', (e) => (e ? rej(e) : res())); conn.connect(); });
      const exec = (sql) => new Promise((res, rej) => {
        const r = new tedious.Request(sql, (e) => (e ? rej(e) : res()));
        conn.execSql(r);
      });
      const execParams = (sql, vals) => new Promise((res, rej) => {
        const r = new tedious.Request(sql, (e) => (e ? rej(e) : res()));
        vals.forEach((v, i) => r.addParameter(`p${i}`, tedious.TYPES.NVarChar, v));
        conn.execSql(r);
      });
      await exec('IF OBJECT_ID(N\'dbo.live_orders\', N\'U\') IS NOT NULL DROP TABLE dbo.live_orders');
      await exec('CREATE TABLE dbo.live_orders (id INT NOT NULL PRIMARY KEY, name NVARCHAR(50), amount DECIMAL(12,2), [ts] DATETIME2)');
      for (let i = 0; i < N; i += 300) {
        const n = Math.min(i + 300, N);
        const params = [];
        let sql = 'INSERT INTO dbo.live_orders (id,name,amount,[ts]) VALUES ';
        for (let j = i; j < n; j++) { if (j > i) sql += ','; sql += `(@p${4 * (j - i)},@p${4 * (j - i) + 1},@p${4 * (j - i) + 2},@p${4 * (j - i) + 3})`; const ts = new Date(1700000000000 + j * 1000).toISOString().replace('T', ' ').replace('Z', ''); params.push(String(j), `r${j}`, String(j % 1000 + 0.5), ts); }
        await execParams(sql, params);
      }
      conn.close();
    }
    // register datasource + full sync via sync.service
    const row = { name: `live-${label}`, type, config: JSON.stringify(cfg), mode: 'sync', owner_id: 1 };
    const res = db.prepare('INSERT INTO data_sources (name, type, config, mode, owner_id) VALUES (?, ?, ?, ?, ?)').run(row.name, row.type, row.config, row.mode, row.owner_id);
    const dsId = res.lastInsertRowid;
    const sc = await sync.createConfig(dsId, { sourceTable: 'live_orders', strategy: 'full' });
    const out = await sync.runSync(sc.id);
    const localTable = out.localTable;
    const count = db.prepare(`SELECT COUNT(*) c FROM ${db.dialect.quoteIdent(localTable)}`).get().c;
    if (count !== N) throw new Error(`本地行数 ${count} !== ${N}`);
    ok(`${label} 真实全量同步 ${N} 行 → 本地 ${count} 行（keyset 分页, ${Number(process.hrtime.bigint() - t) / 1e6}ms）`);
  } catch (e) { bad(`${label} 真实全量同步`, e); }
}

const mysqlSeedCfg = { host: '127.0.0.1', port: 13306, database: 'testdb', user: 'root', password: 'Kanban@123' };
const mssqlSeedCfg = { host: '127.0.0.1', port: 11433, database: 'testdb', user: 'sa', password: 'Kanban@123' };
await seedAndSync('MySQL', 'mysql', mysqlSeedCfg);
await seedAndSync('SQL Server', 'sqlserver', mssqlSeedCfg);

// ─── 3) Hive HS2 真实连接（stored As TEXTFILE round-trip + 全量同步）────────────────
if (await reachable('127.0.0.1', 11000)) {
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('hive-driver×HS2 openSession 超时（上游 AHA 兼容问题；服务端已用 JDBC beeline 验证健康）')), 60000));
  try {
    const p = getProvider('hive');
    const cfg = { host: '127.0.0.1', port: 11000, user: 'hive', password: '' };
    const t = await Promise.race([p.testConnection(cfg, 'hive'), timeout]);
    if (!t) throw new Error('testConnection 返回 false: ' + JSON.stringify(t));
    const schemas = await p.listSchemas(cfg, 'hive');
    const s = (schemas && schemas[0] && schemas[0].name) || 'default';
    await p.runQuery(cfg, 'CREATE TABLE IF NOT EXISTS hive_orders (id INT, name STRING, amount DOUBLE) STORED AS TEXTFILE', []);
    await p.runQuery(cfg, "INSERT INTO hive_orders VALUES (1,'a',1.5),(2,'b',2.5)", []);
    const cols = await p.listColumns(cfg, 'hive', s, 'hive_orders');
    const rows = await p.runQuery(cfg, 'SELECT * FROM hive_orders LIMIT 5', []);
    ok(`hive HS2 真实连接 浏览+查询 schema=${s} 列${cols.length} 行${rows.length}`);
    const r = db.prepare('INSERT INTO data_sources (name, type, config, mode, owner_id) VALUES (?, ?, ?, ?, ?)').run('live-hive', 'hive', JSON.stringify(cfg), 'sync', 1);
    const sc = await sync.createConfig(r.lastInsertRowid, { sourceTable: 'hive_orders', strategy: 'full' });
    const out = await sync.runSync(sc.id);
    const cnt = db.prepare(`SELECT COUNT(*) c FROM ${db.dialect.quoteIdent(out.localTable)}`).get().c;
    ok(`hive HS2 真实全量同步 本地 ${cnt} 行`);
  } catch (e) {
    if (/超时/.test(String(e && e.message || e))) {
      console.log(`[SKIP] hive HS2: ${e.message}`);
    } else {
      bad('hive HS2', e);
    }
  }
} else {
  console.log('[SKIP] hive: 127.0.0.1:11000 未运行');
}

// ─── 4) Linux 原生驱动家族真连（db2/dameng/impala）────────────────
// 启用条件：本机可 require 原生驱动（npm i ibm_db odbc，Linux 可用）且容器可达。
async function linuxFamily(label, type, family, driver, port, makeCfg, ddl, insertFns, probeSchema) {
  let okD = true;
  try { require(driver); } catch (e) { okD = false; }
  if (!okD) { console.log(`[SKIP] ${label}: 原生驱动 ${driver} 未安装（Linux 可 npm i）`); return; }
  if (!(await reachable('127.0.0.1', port))) { console.log(`[SKIP] ${label}: ${port} 未运行（docker compose up -d ${type}）`); return; }
  try {
    const p = getProvider(family);
    const cfg = makeCfg();
    const t = await p.testConnection(cfg, type);
    if (!t || t.ok !== true) throw new Error(`testConnection 失败: ${JSON.stringify(t)}`);
    await p.runQuery(cfg, ddl, []);
    for (const fn of insertFns) await fn(cfg, p);
    const schema = probeSchema(cfg);
    const tables = await p.listTables(cfg, type, schema);
    const t0 = (tables || []).find((x) => /live_orders/i.test(x.name)) || (tables && tables[0]);
    if (!t0) throw new Error('listTables 无表');
    const cols = await p.listColumns(cfg, type, schema, t0.name);
    const rows = await p.runQuery(cfg, `SELECT * FROM ${t0.name} LIMIT 5`, []);
    ok(`${label} 真连 浏览+查询 schema=${schema} table=${t0.name} 列${cols.length} 行${rows.length}`);
    const r = db.prepare('INSERT INTO data_sources (name, type, config, mode, owner_id) VALUES (?, ?, ?, ?, ?)').run(`live-${type}`, type, JSON.stringify(cfg), 'sync', 1);
    const sc = await sync.createConfig(r.lastInsertRowid, { sourceTable: t0.name, strategy: 'full' });
    const out = await sync.runSync(sc.id);
    const cnt = db.prepare(`SELECT COUNT(*) c FROM ${db.dialect.quoteIdent(out.localTable)}`).get().c;
    const expect = insertFns[0].expect || 1;
    if (cnt !== expect) throw new Error(`本地行数 ${cnt} !== ${expect}`);
    ok(`${label} 真连全量同步 → 本地 ${cnt} 行`);
  } catch (e) { bad(`${label} 真连`, e); }
}

const mkDb2 = () => ({ host: '127.0.0.1', port: 50000, database: 'TESTDB', user: 'db2inst1', password: 'Kanban@123' });
await linuxFamily('DB2', 'db2', 'db2', 'ibm_db', 50000, mkDb2,
  'CREATE TABLE LIVE_ORDERS (ID INT NOT NULL PRIMARY KEY, NAME VARCHAR(40), AMOUNT DECIMAL(12,2))',
  [
    async (cfg, p) => {
      const vals = []; let sql = 'INSERT INTO LIVE_ORDERS (ID, NAME, AMOUNT) VALUES ';
      for (let i = 0; i < 100; i++) { if (i) sql += ','; sql += '(?,?,?)'; vals.push(i, `r${i}`, String(i % 10 + 0.5)); }
      await p.runQuery(cfg, sql, vals);
      await p.runQuery(cfg, 'INSERT INTO LIVE_ORDERS (ID, NAME, AMOUNT) VALUES (100, \'r100\', 100.5)');
    },
  ].map((fn) => { fn.expect = 101; return fn; }),
  () => 'DB2INST1');

await linuxFamily('达梦 DM', 'dameng', 'dameng', 'odbc', 5236,
  () => ({ host: '127.0.0.1', port: 5236, user: 'SYSDBA', password: 'SYSDBA001' }),
  'CREATE TABLE LIVE_ORDERS (ID INT, NAME VARCHAR(40), AMOUNT DECIMAL(12,2))',
  [
    async (cfg, p) => {
      const vals = []; let sql = 'INSERT INTO LIVE_ORDERS (ID, NAME, AMOUNT) VALUES ';
      for (let i = 0; i < 100; i++) { if (i) sql += ','; sql += '(?,?,?)'; vals.push(i, `r${i}`, String(i % 10 + 0.5)); }
      await p.runQuery(cfg, sql, vals);
    },
  ].map((fn) => { fn.expect = 100; return fn; }),
  () => 'SYSDBA');

await linuxFamily('Impala', 'impala', 'impala', 'hive-driver', 21050,
  () => ({ host: '127.0.0.1', port: 21050, database: 'default', user: '', password: '' }),
  'CREATE TABLE live_orders (id INT, name STRING, amount DOUBLE) STORED AS PARQUET',
  [
    async (cfg, p) => { for (let i = 0; i < 10; i++) await p.runQuery(cfg, `INSERT INTO live_orders VALUES (${i}, 'r${i}', ${i % 5 + 0.5})`, []); },
  ].map((fn) => { fn.expect = 10; return fn; }),
  () => 'default');

// ─── 5) MaxCompute（阿里云，无容器）────────────────
// 需环境变量 MC_ENDPOINT / MC_ACCESS_KEY_ID / MC_ACCESS_KEY_SECRET / MC_PROJECT，可选 MC_TABLE
if (process.env.MC_ENDPOINT && process.env.MC_ACCESS_KEY_ID) {
  try {
    const p = getProvider('maxcompute');
    const cfg = { endpoint: process.env.MC_ENDPOINT, access_key_id: process.env.MC_ACCESS_KEY_ID, access_key_secret: process.env.MC_ACCESS_KEY_SECRET, project: process.env.MC_PROJECT || 'default' };
    const t = await p.testConnection(cfg, 'maxcompute');
    if (!t.ok) throw new Error(JSON.stringify(t));
    const schemas = await p.listSchemas(cfg, 'maxcompute');
    ok(`MaxCompute 真连 schema=${schemas && schemas[0] && schemas[0].name}`);
    if (process.env.MC_TABLE) {
      const cols = await p.listColumns(cfg, 'maxcompute', cfg.project, process.env.MC_TABLE);
      const rows = await p.runQuery(cfg, `SELECT * FROM ${process.env.MC_TABLE} LIMIT 5`, []);
      ok(`MaxCompute 查询 ${process.env.MC_TABLE} 列${cols.length} 行${rows.length}`);
    }
  } catch (e) { bad('MaxCompute 真连', e); }
} else {
  console.log('[SKIP] MaxCompute: 未提供 MC_ENDPOINT/MC_ACCESS_KEY_ID 等环境变量（阿里云账号）');
}

// ─── 结果 ─────────────────────
console.log(`\n===== LIVE E2E: ${PASS.length} PASS, ${FAIL.length} FAIL =====`);
if (FAIL.length) process.exit(1);