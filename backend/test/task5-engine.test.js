// 首行设置 DB_PATH
process.env.DB_PATH = `/tmp/kanban-test-eng-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDb } = require('./helpers/db');
const queryEngine = require('../src/engines/query-engine');
const datasetService = require('../src/services/dataset.service');

let dsId;

// createDataset 实际签名：createDataset(name, header, rows, ownerId)
// header 为 [{ key, label, type }]，rows 为按 key 组成的对象数组（与 parseExcelFile 输出一致）
async function makeFixture() {
  const ds = await datasetService.createDataset(
    'engine-fixture',
    [
      { key: 'name', label: '名称', type: 'string' },
      { key: 'amount', label: '金额', type: 'integer' },
    ],
    [
      { name: 'a', amount: 10 },
      { name: 'b', amount: 20 },
    ],
    null
  );
  dsId = ds.id;
}

test('sortBy：合法整数指标下标可排序', async () => {
  await resetDb();
  await makeFixture();
  const r = await queryEngine.aggregate({ datasetId: dsId, dimensions: [{ field: 'name' }], metrics: [{ field: 'amount', agg: 'sum' }], sortBy: 0, sortOrder: 'desc' });
  assert.equal(r.rows[0].name, 'b');
});

test('sortBy：字符串 dim 按首维度排序', async () => {
  const r = await queryEngine.aggregate({ datasetId: dsId, dimensions: [{ field: 'name' }], metrics: [{ field: 'amount', agg: 'sum' }], sortBy: 'dim' });
  assert.equal(r.rows[0].name, 'a');
  assert.equal(r.rows[1].name, 'b');
});

test('sortBy：数组内恶意字符串被拒绝', async () => {
  await assert.rejects(() => queryEngine.aggregate({ datasetId: dsId, dimensions: [{ field: 'name' }], metrics: [{ field: 'amount', agg: 'sum' }], sortBy: ['(SELECT 1)'] }), /不支持的排序字段/);
});

test('sortBy：未知字符串被拒绝', async () => {
  await assert.rejects(() => queryEngine.aggregate({ datasetId: dsId, dimensions: [{ field: 'name' }], metrics: [{ field: 'amount', agg: 'sum' }], sortBy: 'amount' }), /不支持的排序字段/);
});