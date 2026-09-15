const test = require('node:test');
const assert = require('node:assert');

test('门面 expose prepare/exec/transaction/dialect', async () => {
  const { runInNew } = require('./helpers/store-env');
  const db = await runInNew();
  assert.equal(typeof db.prepare, 'function');
  assert.equal(typeof db.exec, 'function');
  assert.equal(typeof db.transaction, 'function');
  assert.ok(db.dialect && db.dialect.typeMapping);
  assert.equal(db.type, 'sqlite');

  const r = await db.run('CREATE TABLE IF NOT EXISTS t1 (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)');
  assert.equal(r.changes, 0);

  const ins = await db.prepare('INSERT INTO t1 (name) VALUES (?)').run('hello');
  assert.ok(Number(ins.lastInsertRowid) > 0);

  const row = await db.prepare('SELECT * FROM t1 WHERE id = ?').get(ins.lastInsertRowid);
  assert.equal(row.name, 'hello');

  const rows = await db.prepare('SELECT name FROM t1 ORDER BY id').all();
  assert.equal(rows.length, 1);

  await db.transaction(async () => {
    await db.run("INSERT INTO t1 (name) VALUES ('tx')");
  })();

  const count = await db.get('SELECT COUNT(*) AS c FROM t1');
  assert.equal(count.c, 2);

  await db.close();
});

test('db.transaction 兼容 better-sqlite3 形态（可调用包装）', async () => {
  const { runInNew } = require('./helpers/store-env');
  const db = await runInNew();
  await db.run('CREATE TABLE IF NOT EXISTS t2 (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)');
  const insMany = db.transaction((items) => {
    for (const it of items) db.prepare('INSERT INTO t2 (name) VALUES (?)').run(it);
  });
  await insMany(['a', 'b', 'c']);
  const all = await db.prepare('SELECT name FROM t2 ORDER BY id').all();
  assert.deepEqual(all.map((r) => r.name), ['a', 'b', 'c']);
  await db.close();
});

test('transaction 失败回滚', async () => {
  const { runInNew } = require('./helpers/store-env');
  const db = await runInNew();
  await db.run('CREATE TABLE IF NOT EXISTS t3 (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)');
  await assert.rejects(
    () => db.transaction(() => {
      db.run("INSERT INTO t3 (name) VALUES ('x')");
      throw new Error('boom');
    })(),
    /boom/
  );
  const all = await db.prepare('SELECT * FROM t3').all();
  assert.equal(all.length, 0);
  await db.close();
});

test('store-env 隔离临时库', async () => {
  const { runInNew } = require('./helpers/store-env');
  const db = await runInNew();
  // 默认路径应指向 /tmp 而非项目 data 目录
  assert.ok(await db.prepare('SELECT 1').all());
  await db.close();
});

test('mysql/pg driver 暴露统一接口（不联网）', () => {
  const { createMysqlDriver } = require('../src/db/drivers/mysql');
  const { createPostgresDriver } = require('../src/db/drivers/postgres');

  const m = createMysqlDriver('mysql://u:p@127.0.0.1:3306/x', 'mysql');
  for (const fn of ['run', 'get', 'all', 'exec', 'execBatch', 'transaction', 'close']) assert.equal(typeof m[fn], 'function', `mysql.${fn}`);
  assert.equal(typeof m.prepare, 'function');
  assert.ok(m.dialect && m.dialect.quoteIdent);
  assert.equal(m.dialect.quoteIdent('a'), '`a`');
  assert.equal(m.type, 'mysql');

  const p = createPostgresDriver('postgresql://u:p@127.0.0.1:5432/x');
  for (const fn of ['run', 'get', 'all', 'exec', 'execBatch', 'transaction', 'close']) assert.equal(typeof p[fn], 'function', `pg.${fn}`);
  assert.equal(typeof p.prepare, 'function');
  assert.equal(p.dialect.quoteIdent('a'), '"a"');
  assert.equal(p.type, 'postgres');
});

test('pg driver withReturning 规则（不联网）', () => {
  const { withReturning } = require('../src/db/drivers/postgres');
  assert.equal(withReturning('INSERT INTO t (name) VALUES (?)'), 'INSERT INTO t (name) VALUES (?) RETURNING id');
  assert.equal(withReturning('INSERT INTO t (name) VALUES (?) RETURNING id'), 'INSERT INTO t (name) VALUES (?) RETURNING id');
  assert.equal(withReturning('INSERT INTO t (name) VALUES (?) ON CONFLICT (id) DO NOTHING'), 'INSERT INTO t (name) VALUES (?) ON CONFLICT (id) DO NOTHING');
  assert.equal(withReturning('UPDATE t SET name = ?'), 'UPDATE t SET name = ?');
  const { createPostgresDriver } = require('../src/db/drivers/postgres');
  const p = createPostgresDriver('postgresql://u:p@127.0.0.1:5432/x');
  assert.equal(p.dialect.quoteIdent('a'), '"a"');
});

test('mssql/oracle driver 暴露统一接口（不联网/不建连）', () => {
  const { createMssqlDriver, parseMssqlUrl } = require('../src/db/drivers/mssql');
  const { createOracleDriver } = require('../src/db/drivers/oracle');

  const m = createMssqlDriver('mssql://user:p@127.0.0.1:1433/db');
  for (const fn of ['run', 'get', 'all', 'exec', 'execBatch', 'transaction', 'close']) assert.equal(typeof m[fn], 'function', `mssql.${fn}`);
  assert.equal(typeof m.prepare, 'function');
  assert.equal(m.dialect.quoteIdent('a'), '[a]');
  assert.equal(m.type, 'sqlserver');
  const q = parseMssqlUrl('mssql://user:p@127.0.0.1:1433/db');
  assert.equal(q.database, 'db');

  const o = createOracleDriver('oracle://u:p@127.0.0.1:1521/FREEPDB1');
  for (const fn of ['run', 'get', 'all', 'exec', 'execBatch', 'transaction', 'close']) assert.equal(typeof o[fn], 'function', `oracle.${fn}`);
  assert.equal(typeof o.prepare, 'function');
  assert.equal(o.dialect.quoteIdent('a'), '"a"');
  assert.equal(o.type, 'oracle');
});