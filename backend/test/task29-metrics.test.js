// 首行设置 DB_PATH
process.env.DB_PATH = `/tmp/kanban-test-metrics-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDb } = require('./helpers/db');
const queryEngine = require('../src/engines/query-engine');
const datasetService = require('../src/services/dataset.service');
const { normalizeMetrics } = require('../src/engines/metrics');

let dsId;

const TEST_DIALECT = {
  agg: { sum: 'SUM', avg: 'AVG', count: 'COUNT', count_distinct: 'COUNT(DISTINCT', max: 'MAX', min: 'MIN' },
  quoteIdent: (x) => `"${x}"`,
};

async function makeFixture() {
  const ds = await datasetService.createDataset(
    'metrics-fixture',
    [
      { key: 'name', label: '名称', type: 'string' },
      { key: 'amount', label: '金额', type: 'integer' },
      { key: 'qty', label: '数量', type: 'integer' },
    ],
    [
      { name: 'a', amount: 10, qty: 2 },
      { name: 'b', amount: 20, qty: 4 },
    ],
    null
  );
  dsId = ds.id;
}

test('normalizeMetrics：普通指标默认 key/agg，count(*) 形态', () => {
  const out = normalizeMetrics([{ field: '*' }], { dialect: TEST_DIALECT, fieldsByName: {} });
  assert.equal(out[0].kind, 'base');
  assert.equal(out[0].key, 'm0');
  assert.equal(out[0].agg, 'count');
  assert.equal(out[0].sqlExpr, 'COUNT(*)');
});

test('normalizeMetrics：字段不存在时 400', () => {
  assert.throws(
    () => normalizeMetrics([{ field: 'nope', agg: 'sum' }], { dialect: TEST_DIALECT, fieldsByName: { amount: { name: 'amount' } } }),
    /指标字段不存在/
  );
});

test('normalizeMetrics：复合指标把 $key 展开为前序基础指标聚合 SQL', () => {
  const out = normalizeMetrics(
    [
      { key: 'sa', field: 'amount', agg: 'sum' },
      { key: 'sq', field: 'qty', agg: 'sum' },
      { key: 'ratio', type: 'expr', expr: '$sa / $sq * 100' },
    ],
    { dialect: TEST_DIALECT, fieldsByName: { amount: { name: 'amount', label: '金额' }, qty: { name: 'qty', label: '数量' } } }
  );
  assert.equal(out[2].kind, 'expr');
  assert.equal(out[2].field, 'ratio');
  assert.equal(out[2].sqlExpr, '(SUM("amount")) * 1.0 / (SUM("qty")) * 1.0 * 100');
  assert.equal(out[2].label, out[2].expr);
});

test('normalizeMetrics：公式包含字母/非白名单字符被 400', () => {
  assert.throws(
    () =>
      normalizeMetrics(
        [
          { key: 'm0', field: 'amount', agg: 'sum' },
          { key: 'm1', type: 'expr', expr: '$m0 OR 1=1' },
        ],
        { dialect: TEST_DIALECT, fieldsByName: { amount: { name: 'amount' } } }
      ),
    /复合指标公式仅支持引用原子指标/
  );
});

test('normalizeMetrics：未知或不可用指标引用被 400', () => {
  assert.throws(
    () =>
      normalizeMetrics(
        [
          { key: 'm0', field: 'amount', agg: 'sum' },
          { key: 'm1', type: 'expr', expr: '$m9 + 1' },
        ],
        { dialect: TEST_DIALECT, fieldsByName: { amount: { name: 'amount' } } }
      ),
    /不可用的原子指标/
  );
  // 自引用被拒
  assert.throws(
    () =>
      normalizeMetrics(
        [
          { key: 'm0', type: 'expr', expr: '$m0 + 1' },
        ],
        { dialect: TEST_DIALECT, fieldsByName: {} }
      ),
    /不可用的原子指标/
  );
  // 引用后置普通指标被拒
  assert.throws(
    () =>
      normalizeMetrics(
        [
          { key: 'm0', type: 'expr', expr: '$m3 + 1' },
          { key: 'm3', field: 'amount', agg: 'sum' },
        ],
        { dialect: TEST_DIALECT, fieldsByName: { amount: { name: 'amount' } } }
      ),
    /不可用的原子指标/
  );
});

test('normalizeMetrics：空指标列表 400', () => {
  assert.throws(() => normalizeMetrics([], { dialect: TEST_DIALECT, fieldsByName: {} }), /至少需要一个指标/);
});

test('集成：复合指标 SUM/SUM 比率计算正确', async () => {
  await resetDb();
  await makeFixture();
  const r = await queryEngine.aggregate({
    datasetId: dsId,
    dimensions: [{ field: 'name' }],
    metrics: [
      { key: 'm0', field: 'amount', agg: 'sum' },
      { key: 'm1', field: 'qty', agg: 'sum' },
      { key: 'm2', type: 'expr', expr: '$m0 / $m1', label: '客单价' },
    ],
  });
  assert.equal(r.rows.length, 2);
  const rowA = r.rows.find((x) => x.name === 'a');
  assert.equal(rowA.m2, 5);
  assert.equal(rowA['metric:m0'].value, 10);
  assert.equal(rowA['metric:m1'].value, 2);
  assert.equal(rowA['metric:m2'].value, 5);
  assert.equal(r.metrics[2].kind, 'expr');
  assert.equal(r.metrics[2].field, 'm2');
  assert.equal(r.metrics[2].label, '客单价');
});

test('集成：复合指标可与常量混合，count 指标可被引用', async () => {
  const r = await queryEngine.aggregate({
    datasetId: dsId,
    dimensions: [{ field: 'name' }],
    metrics: [
      { key: 'cnt', field: '*', agg: 'count' },
      { key: 'shared', type: 'expr', expr: '$cnt / 2', label: '半量' },
    ],
  });
  assert.equal(r.rows.find((x) => x.name === 'a')['shared'], 0.5);
  assert.equal(r.rows.find((x) => x.name === 'b')['shared'], 0.5);
});

test('集成：非法表达式的复合指标 400（不命中数据库）', async () => {
  await assert.rejects(
    () =>
      queryEngine.aggregate({
        datasetId: dsId,
        metrics: [{ key: 'm0', field: 'amount', agg: 'sum' }, { key: 'm1', type: 'expr', expr: '$m0 && 1' }],
      }),
    /复合指标公式仅支持引用原子指标/
  );
  await assert.rejects(
    () =>
      queryEngine.aggregate({
        datasetId: dsId,
        metrics: [{ key: 'm0', field: 'amount', agg: 'sum' }, { key: 'm1', type: 'expr', expr: 'ORDER BY 1' }],
      }),
    /复合指标公式仅支持引用原子指标/
  );
});