// backend/test/task32-sync-delete.test.js
// 主键对账删除：增量同步把源端已删除的行从本地表删掉，并支持开关与复合主键。
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

process.env.DB_PATH = `/tmp/kanban-syncdel-${process.pid}.db`;
process.env.DATA_DIR = `/tmp/kanban-syncdel-data-${process.pid}`;
const db = require('../src/db');
const sync = require('../src/services/sync.service');
const providersApi = require('../src/datasources/providers');
const { uuidv7 } = require('../src/utils/uuidv7');
const { seed } = require('../src/seeds');

const DEFAULT_COLS = [
  { name: 'id', type: 'int' },
  { name: 'amt', type: 'decimal' },
  { name: 'updated_at', type: 'timestamp' },
];

const FAKE = {
  cols: DEFAULT_COLS,
  src: [],
  listColumns: () => FAKE.cols,
  async runQuery(cfg, sql, params) {
    const m = sql.match(/LIMIT (\d+)/);
    const limit = m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
    const o = sql.match(/OFFSET (\d+)/);
    const offset = o ? Number(o[1]) : 0;
    let rows = FAKE.src || [];
    const wm = sql.match(/WHERE ([\w.]+) > \?/);
    if (wm && params[0] != null) rows = rows.filter((r) => r[wm[1]] > params[0]);
    return rows.slice(offset, offset + limit);
  },
};

const REAL_GET_PROVIDER = providersApi.getProvider;
let dsId;
let ADMIN;

function insertDs() {
  const id = uuidv7();
  db.prepare("INSERT INTO data_sources (id, name, type, config, mode, is_active, owner_id) VALUES (?, 'ds-syncdel', 'mysql', ?, 'sync', 1, ?)")
    .run(id, JSON.stringify({ host: 'h', port: 3306, database: 'db', user: 'u', password: 'p', password_masked: true }), ADMIN);
  return id;
}

function q(t) { return db.dialect.quoteIdent(t); }
function ids(local) { return db.prepare(`SELECT id FROM ${q(local)} ORDER BY id`).all().map((r) => r.id); }

test.before(async () => {
  db.initSchema();
  await seed();
  ADMIN = db.prepare("SELECT id FROM users WHERE email = 'admin@kanray.local'").get().id;
  dsId = insertDs();
  providersApi.getProvider = () => FAKE;
});

test.after(() => {
  providersApi.getProvider = REAL_GET_PROVIDER;
  try { db.close(); } catch (e) { /* ignore */ }
  fs.rmSync(process.env.DB_PATH, { force: true });
  fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});

test('增量同步：源端删除行后，本地表对账删除该行，单主键', async () => {
  FAKE.cols = DEFAULT_COLS;
  const c = await sync.createConfig(dsId, { sourceTable: 't', strategy: 'incremental', watermarkField: 'updated_at' });
  FAKE.src = [
    { id: 1, amt: 10, updated_at: '2024-01-01 00:00:00' },
    { id: 2, amt: 20, updated_at: '2024-01-02 00:00:00' },
    { id: 3, amt: 30, updated_at: '2024-01-03 00:00:00' },
  ];
  await sync.runSync(c.id);
  const local = sync.nextLocalTable(dsId, 't');
  assert.deepEqual(ids(local), [1, 2, 3]);

  FAKE.src = [
    { id: 1, amt: 10, updated_at: '2024-01-01 00:00:00' },
    { id: 3, amt: 30, updated_at: '2024-01-03 00:00:00' },
  ];
  const res = await sync.runSync(c.id);
  assert.equal(res.deleted, 1);
  assert.deepEqual(ids(local), [1, 3]);
});

test('createConfig 默认开启删除对账，updateConfig 可开可关', async () => {
  FAKE.cols = DEFAULT_COLS;
  const c = await sync.createConfig(dsId, { sourceTable: 't2', strategy: 'incremental', watermarkField: 'updated_at' });
  assert.equal((await sync.getConfig(c.id)).reconcile_delete, 1);
  assert.equal((await sync.updateConfig(c.id, { reconcileDelete: false })).reconcile_delete, 0);
  assert.equal((await sync.updateConfig(c.id, { reconcileDelete: true })).reconcile_delete, 1);
});

test('增量同步：关闭删除对账后本地不删行', async () => {
  FAKE.cols = DEFAULT_COLS;
  const c = await sync.createConfig(dsId, { sourceTable: 't3', strategy: 'incremental', watermarkField: 'updated_at', reconcileDelete: false });
  FAKE.src = [
    { id: 1, amt: 1, updated_at: '2024-01-01 00:00:00' },
    { id: 2, amt: 2, updated_at: '2024-01-02 00:00:00' },
  ];
  await sync.runSync(c.id);
  FAKE.src = [{ id: 1, amt: 1, updated_at: '2024-01-01 00:00:00' }];
  await sync.runSync(c.id);
  const local = sync.nextLocalTable(dsId, 't3');
  assert.deepEqual(ids(local), [1, 2]);
});

test('增量同步：复合主键对账删除', async () => {
  FAKE.cols = [
    { name: 'a', type: 'int' },
    { name: 'b', type: 'int' },
    { name: 'amt', type: 'decimal' },
    { name: 'updated_at', type: 'timestamp' },
  ];
  const c = await sync.createConfig(dsId, { sourceTable: 't4', strategy: 'incremental', watermarkField: 'updated_at', primaryKey: ['a', 'b'] });
  FAKE.src = [
    { a: 1, b: 1, amt: 1, updated_at: '2024-01-01 00:00:00' },
    { a: 1, b: 2, amt: 2, updated_at: '2024-01-01 00:00:00' },
  ];
  const first = await sync.runSync(c.id);
  assert.equal(first.rows, 2);

  FAKE.src = [{ a: 1, b: 2, amt: 2, updated_at: '2024-01-01 00:00:00' }];
  const res = await sync.runSync(c.id);
  const local = sync.nextLocalTable(dsId, 't4');
  const rows = db.prepare(`SELECT a, b FROM ${q(local)} ORDER BY a, b`).all();
  assert.equal(res.deleted, 1);
  assert.deepEqual(rows, [{ a: 1, b: 2 }]);
});

test('对账删除次数写入同步日志 message', async () => {
  FAKE.cols = DEFAULT_COLS;
  const c = await sync.createConfig(dsId, { sourceTable: 't5', strategy: 'incremental', watermarkField: 'updated_at' });
  FAKE.src = [
    { id: 1, amt: 1, updated_at: '2024-01-01 00:00:00' },
    { id: 2, amt: 2, updated_at: '2024-01-02 00:00:00' },
    { id: 3, amt: 3, updated_at: '2024-01-03 00:00:00' },
  ];
  await sync.runSync(c.id);
  FAKE.src = [{ id: 1, amt: 1, updated_at: '2024-01-01 00:00:00' }];
  const res = await sync.runSync(c.id);
  assert.equal(res.deleted, 2);
  const logs = await sync.logsOf(c.id);
  assert.ok(logs.some((l) => l.message && l.message.includes('删除 2 行')), 'succeed 日志应记录对账删除行数');
});