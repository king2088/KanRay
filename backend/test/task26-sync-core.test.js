// backend/test/task26-sync-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const { buildUpsert } = require('../src/datasources/build-sql');
const d = require('../src/datasources/dialects');

const COLS = ['id', 'amt'];
const CASES = [
  ['mysql', d.mysql, 'INSERT INTO `t` (`id`, `amt`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `amt` = VALUES(`amt`)'],
  ['mariadb', d.mariadb, 'INSERT INTO `t` (`id`, `amt`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `amt` = VALUES(`amt`)'],
  ['pg', d.pg, 'INSERT INTO "t" ("id", "amt") VALUES ($1, $2) ON CONFLICT ("id") DO UPDATE SET "amt" = EXCLUDED."amt"'],
  ['sqlite', d.sqlite, 'INSERT INTO "t" ("id", "amt") VALUES (?, ?) ON CONFLICT("id") DO UPDATE SET "amt" = excluded."amt"'],
  ['mssql', d.mssql, 'MERGE INTO [t] AS T USING (VALUES (@p0, @p1)) AS S ([id], [amt]) ON T.[id] = S.[id] WHEN MATCHED THEN UPDATE SET [amt] = S.[amt] WHEN NOT MATCHED THEN INSERT ([id], [amt]) VALUES (S.[id], S.[amt]);'],
  ['oracle', d.oracle, 'MERGE INTO "t" T USING (SELECT :1 AS "id", :2 AS "amt" FROM DUAL) S ON (T."id" = S."id") WHEN MATCHED THEN UPDATE SET "amt" = S."amt" WHEN NOT MATCHED THEN INSERT ("id", "amt") VALUES (S."id", S."amt")'],
];
for (const [name, dialect, expected] of CASES) {
  test(`buildUpsert ${name}`, () => assert.equal(buildUpsert('t', COLS, ['id'], dialect).replace(/\s+/g, ' ').trim(), expected.replace(/\s+/g, ' ').trim()));
}
test('buildUpsert 无主键时报错', () => assert.throws(() => buildUpsert('t', COLS, [], d.mysql), /primary|主键/i));

// ─── Task 13: sync.service.js 执行引擎 ──────────────────────────
const path = require('node:path');
const fs = require('node:fs');
process.env.DB_PATH = `/tmp/kanban-sync-${process.pid}.db`;
process.env.DATA_DIR = `/tmp/kanban-sync-data-${process.pid}`;
const config = require('../src/config');
const db = require('../src/db');
const sync = require('../src/services/sync.service');
const providersApi = require('../src/datasources/providers');

const FAKE = {
  lastRunQuery: null,
  queryLog: [],
  src: [],
  listColumns: () => [
    { name: 'id', type: 'int' },
    { name: 'amt', type: 'decimal' },
    { name: 'updated_at', type: 'timestamp' },
  ],
  async runQuery(cfg, sql, params) {
    FAKE.lastRunQuery = { sql, params };
    FAKE.queryLog.push({ sql, params });
    const m = sql.match(/LIMIT (\d+)/);
    const limit = m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
    let rows = FAKE.src || [];
    const wm = sql.match(/WHERE ([\w.]+) > \?/);
    if (wm && params[0] != null) rows = rows.filter((r) => r[wm[1]] > params[0]);
    return rows.slice(0, limit);
  },
};

const REAL_GET_PROVIDER = providersApi.getProvider;
let dsId = null;
let cfgId = null;

function insertDs() {
  return Number(db.prepare("INSERT INTO data_sources (name, type, config, mode, is_active, owner_id) VALUES ('ds-sync-t13', 'mysql', ?, 'sync', 1, 1)")
    .run(JSON.stringify({ host: 'h', port: 3306, database: 'db', user: 'u', password: 'p', password_masked: true })).lastInsertRowid);
}

function fakeProviderPaged(srcRows) {
  FAKE.src = Array.isArray(srcRows) ? srcRows : [];
  providersApi.getProvider = () => FAKE;
}

test.before(async () => {
  db.initSchema();
  dsId = insertDs();
  fakeProviderPaged();
  cfgId = (await sync.createConfig(dsId, { sourceTable: 't', strategy: 'full' })).id;
  assert.ok(cfgId);
});

test.after(() => {
  providersApi.getProvider = REAL_GET_PROVIDER;
  try { db.close(); } catch (e) { /* ignore */ }
  fs.rmSync(process.env.DB_PATH, { force: true });
  fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});

test('sync createConfig 校验水印字段类型', async () => {
  fakeProviderPaged();
  await assert.rejects(() => sync.createConfig(dsId, { sourceTable: 't2', strategy: 'incremental', watermarkField: 'nope' }), /水印字段不存在/);
});

test('同步引擎：全量策略 truncate + insert', async () => {
  fakeProviderPaged([
    { id: 1, amt: 10, updated_at: '2024-01-01 00:00:00' },
    { id: 2, amt: 20, updated_at: '2024-01-02 00:00:00' },
  ]);
  const res = await sync.runSync(cfgId);
  assert.equal(res.rows, 2);
  assert.equal(res.localTable, sync.nextLocalTable(dsId, 't'));
  const rows = db.prepare(`SELECT id, amt, updated_at FROM ${db.dialect.quoteIdent(res.localTable)} ORDER BY id`).all();
  assert.deepEqual(rows.map((r) => r.id), [1, 2]);
  const sc = db.prepare('SELECT * FROM sync_configs WHERE id = ?').get(cfgId);
  assert.equal(sc.last_sync_status, 'success');
  assert.equal(sc.last_watermark, null);
});

test('同步引擎：增量水印推进 + upsert 幂等', async () => {
  await sync.updateConfig(cfgId, { strategy: 'incremental', watermarkField: 'updated_at' });
  fakeProviderPaged([{ id: 1, amt: 10, updated_at: '2024-01-01 00:00:00' }]);
  const res = await sync.runSync(cfgId);
  assert.equal(res.rows, 1);
  const sc = db.prepare('SELECT * FROM sync_configs WHERE id = ?').get(cfgId);
  assert.equal(sc.last_watermark, '2024-01-01 00:00:00');
  assert.deepEqual(FAKE.lastRunQuery.params, []);
  assert.doesNotMatch(FAKE.lastRunQuery.sql, /WHERE/);

  fakeProviderPaged([]);
  FAKE.queryLog = [];
  await sync.runSync(cfgId);
  const wmQuery = FAKE.queryLog.find((q) => /WHERE/.test(q.sql)) || FAKE.queryLog[0];
  assert.match(wmQuery.sql, /updated_at > \?/);
  assert.match(wmQuery.sql, /LIMIT 5000/);
  assert.equal(wmQuery.params[0], '2024-01-01 00:00:00');
});

test('sync logs 写入与 running 互斥', async () => {
  await db.prepare("UPDATE sync_configs SET last_sync_status = 'running' WHERE id = ?").run(cfgId);
  const skipped = await sync.runSync(cfgId);
  assert.equal(skipped.skipped, true);
  await db.prepare("UPDATE sync_configs SET last_sync_status = 'success' WHERE id = ?").run(cfgId);
  fakeProviderPaged([]);
  await sync.runSync(cfgId);
  const logs = await sync.logsOf(cfgId);
  assert.ok(logs.length >= 1);
  assert.equal(logs[0].status, 'success');
});

test('同步超过 maxRows 中止并标记 failed', async () => {
  const origMax = config.upload.maxRows;
  config.upload.maxRows = 5;
  fakeProviderPaged(Array.from({ length: 5000 }, (_, i) => ({ id: i, amt: i, updated_at: `2024-02-01 00:00:0${i % 10}` })));
  await assert.rejects(() => sync.runSync(cfgId), /超过上限/);
  const sc = db.prepare('SELECT * FROM sync_configs WHERE id = ?').get(cfgId);
  assert.equal(sc.last_sync_status, 'failed');
  config.upload.maxRows = origMax;
});

test('updateConfig 切 full 清空水印', async () => {
  const updated = await sync.updateConfig(cfgId, { strategy: 'full' });
  assert.equal(updated.strategy, 'full');
  const sc = db.prepare('SELECT * FROM sync_configs WHERE id = ?').get(cfgId);
  assert.equal(sc.watermark_field, null);
});

test('同步引擎：Date 值落库转为可绑定字符串', async () => {
  const cfg2 = await sync.createConfig(dsId, { sourceTable: 'dt', strategy: 'incremental', watermarkField: 'updated_at' });
  fakeProviderPaged([{ id: 7, amt: 1, updated_at: new Date(2024, 0, 5, 12, 30, 45) }]);
  const r = await sync.runSync(cfg2.id);
  assert.equal(r.rows, 1);
  const row = db.prepare(`SELECT updated_at FROM ${db.dialect.quoteIdent(r.localTable)} WHERE id = 7`).get();
  assert.equal(row.updated_at, '2024-01-05 12:30:45');
  const sc = db.prepare('SELECT * FROM sync_configs WHERE id = ?').get(cfg2.id);
  assert.equal(sc.last_watermark, '2024-01-05 12:30:45');
});

test('configsOf 按数据源过滤', async () => {
  const list = await sync.configsOf(dsId);
  assert.ok(Array.isArray(list) && list.length >= 1);
  assert.ok(list.every((c) => c.datasource_id === dsId));
  assert.ok(list.map((c) => c.id).includes(cfgId));
  assert.deepEqual(await sync.configsOf(999999), []);
});

test('调度器: 到期配置被 tick 执行', async () => {
  const sched = require('../src/jobs/sync-scheduler');
  const before = db.prepare('SELECT last_sync_at FROM sync_configs WHERE id = ?').get(cfgId).last_sync_at;
  assert.ok(before, '前置: last_sync_at 非空');
  await db.prepare("UPDATE sync_configs SET last_sync_at = datetime('now', '-30 day') WHERE id = ?").run(cfgId);
  fakeProviderPaged([]);
  await sched.tick();
  await new Promise((r) => setTimeout(r, 120));
  const sc = db.prepare('SELECT * FROM sync_configs WHERE id = ?').get(cfgId);
  assert.ok(sc.last_sync_at >= before, 'last_sync_at 应被推进');
  assert.equal(sched.running.size, 0);
});

test('同步型数据源浏览降级到本地表', async () => {
  const datasourceService = require('../src/services/datasource.service');
  const schemas = await datasourceService.listSchemas(dsId);
  assert.deepEqual(schemas, [{ name: 'local' }]);
  const localTable = sync.nextLocalTable(dsId, 't');
  const tables = await datasourceService.listTables(dsId, 'local');
  assert.ok(tables.map(String).includes(localTable), `应含本地表 ${localTable}`);
  const cols = await datasourceService.listColumns(dsId, 'local', localTable);
  assert.ok(cols.length >= 3, '本地表应能读列');
});