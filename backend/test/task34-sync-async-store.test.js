// backend/test/task34-sync-async-store.test.js
// 回归：同步链路的本地表引导必须兼容异步元数据存储（Postgres/MySQL 等 remote 驱动
// 的 listTables/ensureDatasetTable 返回 Promise），避免在生产遥测库上出现
// "db.listTables(...).map is not a function"。
const test = require('node:test');
const assert = require('node:assert');

process.env.DB_PATH = `/tmp/kanban-asyncstore-${process.pid}.db`;
process.env.DATA_DIR = `/tmp/kanban-asyncstore-data-${process.pid}`;
const db = require('../src/db');
const sync = require('../src/services/sync.service');

const COLS = [{ name: 'id', type: 'int' }, { name: 'amount', type: 'decimal' }];

test('ensureLocalTable：异步存储（Promise 返回）时正确 await 并建表', async () => {
  const origList = db.listTables;
  const origEnsure = db.ensureDatasetTable;
  let ensured = null;
  db.listTables = () => Promise.resolve([]);
  db.ensureDatasetTable = (name, fields, pks) => { ensured = { name, fields, pks }; return Promise.resolve(); };
  try {
    const t = await sync._internals.ensureLocalTable(1, 'demo_orders', COLS, ['id']);
    assert.strictEqual(t, 'sync_1_demo_orders');
    assert.ok(ensured, '应调用 ensureDatasetTable');
    assert.strictEqual(ensured.name, 'sync_1_demo_orders');
    assert.deepStrictEqual(ensured.pks, ['id']);
  } finally {
    db.listTables = origList;
    db.ensureDatasetTable = origEnsure;
  }
});

test('ensureLocalTable：本地表已存在时不重复建表', async () => {
  const origList = db.listTables;
  const origEnsure = db.ensureDatasetTable;
  let ensuredCount = 0;
  db.listTables = () => Promise.resolve(['sync_2_orders']);
  db.ensureDatasetTable = () => { ensuredCount += 1; return Promise.resolve(); };
  try {
    const t = await sync._internals.ensureLocalTable(2, 'orders', COLS, ['id']);
    assert.strictEqual(t, 'sync_2_orders');
    assert.strictEqual(ensuredCount, 0);
  } finally {
    db.listTables = origList;
    db.ensureDatasetTable = origEnsure;
  }
});
