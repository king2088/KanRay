process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');

const prestoProvider = require('../src/datasources/providers/presto');
const oracleProvider = require('../src/datasources/providers/oracle');
const mssqlProvider = require('../src/datasources/providers/mssql');
const mysqlFamily = require('../src/datasources/providers/mysql-family');

function reachable(host, port, timeout = 1500) {
  return new Promise((resolve) => {
    const s = net.connect({ host, port });
    s.setTimeout(timeout);
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('error', () => { s.destroy(); resolve(false); });
    s.on('timeout', () => { s.destroy(); resolve(false); });
  });
}

// GBase 8a 复用 MySQL 协议 → 用 live mysql:8.0 容器验证该协议路径
test('gbase: mysql-family 协议路径全链路 (live mysql:8.0)', { skip: !process.env.RUN_LIVE }, async (t) => {
  if (!(await reachable('127.0.0.1', 13306))) return t.skip('live mysql 未运行');
  const cfg = { host: '127.0.0.1', port: 13306, database: 'testdb', user: 'root', password: 'Kanban@123' };
  const conn = await mysqlFamily.testConnection(cfg);
  assert.equal(conn.ok, true, conn.message);
  const schemas = await mysqlFamily.listSchemas(cfg);
  assert.ok(schemas.some((s) => s.name === 'testdb'));
  const tables = await mysqlFamily.listTables(cfg, 'gbase', 'testdb');
  assert.ok(tables.some((t) => t.name === 'sales'), `missing sales, got ${tables.map((t) => t.name).join(',')}`);
  const cols = await mysqlFamily.listColumns(cfg, 'gbase', 'testdb', 'sales');
  assert.ok(cols.length > 0);
  assert.ok(cols.some((c) => ['id', 'amount'].includes(c.name)));
  const rows = await mysqlFamily.runQuery(cfg, 'SELECT COUNT(*) AS cnt FROM `sales`');
  assert.ok(Number(rows[0].cnt) >= 0);
});

test('presto: live trino 全链路 test/browse/query', async (t) => {
  if (!(await reachable('127.0.0.1', 18080))) return t.skip('live trino 未运行');
  const cfg = { host: '127.0.0.1', port: 18080, user: 'trino', catalog: 'tpch', schema: 'sf1' };
  const conn = await prestoProvider.testConnection(cfg);
  assert.equal(conn.ok, true, conn.message);
  const schemas = await prestoProvider.listSchemas(cfg);
  assert.ok(schemas.some((s) => s.name === 'sf1'), `missing sf1, got ${schemas.map((s) => s.name).join(',')}`);
  const tables = await prestoProvider.listTables(cfg, 'presto', 'sf1');
  assert.ok(tables.some((t) => t.name === 'nation'), `missing nation, got ${tables.map((t) => t.name).join(',')}`);
  const cols = await prestoProvider.listColumns(cfg, 'presto', 'sf1', 'nation');
  assert.ok(cols.some((c) => c.name === 'nationkey'), cols.map((c) => c.name).join(','));
  // 方言关键点：双引号标识符 + date_trunc + LIMIT
  const rows = await prestoProvider.runQuery(
    cfg,
    `SELECT date_trunc('month', "orderdate") AS "m", count(*) AS "c" FROM "sf1"."orders" GROUP BY 1 ORDER BY 1 LIMIT 3`,
  );
  assert.ok(rows.length === 3, `expected 3 rows, got ${JSON.stringify(rows)}`);
  assert.ok(rows[0].c > 0);
});

test('oracle: live Oracle Free 全链路 test/browse/query', { timeout: 180000 }, async (t) => {
  if (!(await reachable('127.0.0.1', 11521))) return t.skip('live oracle 未运行');
  const cfg = { host: '127.0.0.1', port: 11521, service_name: 'FREEPDB1', user: 'SYSTEM', password: 'Kanban@123' };
  const conn = await oracleProvider.testConnection(cfg);
  assert.equal(conn.ok, true, conn.message);
  const schemas = await oracleProvider.listSchemas(cfg);
  assert.ok(schemas.some((s) => s.name === 'SYSTEM'), schemas.map((s) => s.name).join(','));
  const tbl = `KB_LIVE_${Date.now() % 100000}`;
  await oracleProvider.runQuery(cfg, `CREATE TABLE ${tbl} (id NUMBER PRIMARY KEY, name VARCHAR2(50), amount NUMBER)`, []);
  await oracleProvider.runQuery(cfg, `INSERT INTO ${tbl} (id, name, amount) VALUES (:1, :2, :3)`, [1, 'a', 10.5]);
  await oracleProvider.runQuery(cfg, `INSERT INTO ${tbl} (id, name, amount) VALUES (:1, :2, :3)`, [2, 'b', 20.5]);
  await oracleProvider.runQuery(cfg, 'COMMIT', []);
  try {
    const tables = await oracleProvider.listTables(cfg, 'oracle', (cfg.user || '').toUpperCase());
    assert.ok(tables.some((t) => t.name === tbl), tables.map((t) => t.name).join(','));
    const cols = await oracleProvider.listColumns(cfg, 'oracle', (cfg.user || '').toUpperCase(), tbl);
    // 列名归一化为小写，与 runQuery 的行键一致（Oracle 未加引号列名默认大写）
    assert.ok(cols.some((c) => c.name === 'amount' && c.role === 'metric'), JSON.stringify(cols));
    // 方言关键点：双引号标识符 + :n 位置绑定 + FETCH FIRST + TRUNC
    const agg = await oracleProvider.runQuery(
      cfg,
      `SELECT SUM("AMOUNT") AS "m" FROM "${tbl}" FETCH FIRST 5 ROWS ONLY`,
      [],
    );
    assert.equal(Number(agg[0].m), 31);
    // 同步引擎可移植 SQL：? 占位符 + LIMIT/OFFSET → :1 与 OFFSET/FETCH
    const portable = await oracleProvider.runQuery(
      cfg,
      `SELECT "AMOUNT" FROM "${tbl}" WHERE "ID" > ? ORDER BY "ID" ASC LIMIT 1 OFFSET 0`,
      [0],
    );
    assert.equal(Number(portable[0].amount), 10.5, JSON.stringify(portable));
  } finally {
    await oracleProvider.runQuery(cfg, `DROP TABLE ${tbl}`, []).catch(() => {});
  }
});

test('mssql: live SQL Server 全链路 + 同步可移植 SQL（? / LIMIT）', { timeout: 180000 }, async (t) => {
  if (!(await reachable('127.0.0.1', 11433))) return t.skip('live mssql 未运行');
  const cfg = { host: '127.0.0.1', port: 11433, database: 'live_store_test', user: 'sa', password: 'Kanban@123', schema: 'dbo' };
  const conn = await mssqlProvider.testConnection(cfg);
  assert.equal(conn.ok, true, conn.message);
  const tbl = `kb_live_${Date.now() % 100000}`;
  await mssqlProvider.runQuery(cfg, `CREATE TABLE dbo.${tbl} (id INT PRIMARY KEY, amount DECIMAL(18,2))`, []);
  await mssqlProvider.runQuery(cfg, `INSERT INTO dbo.${tbl} (id, amount) VALUES (?, ?), (?, ?), (?, ?)`, [1, 10.5, 2, 20.5, 3, 30.5]);
  try {
    const cols = await mssqlProvider.listColumns(cfg, 'sqlserver', 'dbo', tbl);
    assert.ok(cols.some((c) => c.name === 'amount' && c.role === 'metric'), JSON.stringify(cols));
    // 同步引擎可移植 SQL：? → @p0，LIMIT → TOP，LIMIT/OFFSET → OFFSET/FETCH
    const filtered = await mssqlProvider.runQuery(cfg, `SELECT id, amount FROM dbo.${tbl} WHERE id > ? ORDER BY id ASC LIMIT 500`, [1]);
    assert.equal(filtered.length, 2, JSON.stringify(filtered));
    const page = await mssqlProvider.runQuery(cfg, `SELECT id FROM dbo.${tbl} ORDER BY id ASC LIMIT 1 OFFSET 1`, []);
    assert.equal(Number(page[0].id), 2, JSON.stringify(page));
  } finally {
    await mssqlProvider.runQuery(cfg, `DROP TABLE dbo.${tbl}`, []).catch(() => {});
  }
});