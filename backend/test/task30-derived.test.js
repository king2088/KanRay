// 首行设置 DB_PATH
process.env.DB_PATH = `/tmp/kanban-test-derived-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDb } = require('./helpers/db');
const queryEngine = require('../src/engines/query-engine');
const datasetService = require('../src/services/dataset.service');
const { normalizeMetrics } = require('../src/engines/metrics');

let simpleId;
let seriesId;

const TEST_DIALECT = {
  agg: { sum: 'SUM', avg: 'AVG', count: 'COUNT', count_distinct: 'COUNT(DISTINCT', max: 'MAX', min: 'MIN' },
  quoteIdent: (x) => `"${x}"`,
};

async function makeSimple() {
  const ds = await datasetService.createDataset(
    'derived-simple',
    [
      { key: 'region', label: '区域', type: 'string' },
      { key: 'prod', label: '产品', type: 'string' },
      { key: 'amount', label: '金额', type: 'integer' },
    ],
    [
      { region: 'r1', prod: 'p1', amount: 100 },
      { region: 'r1', prod: 'p2', amount: 300 },
      { region: 'r2', prod: 'p1', amount: 200 },
      { region: 'r2', prod: 'p2', amount: 300 },
    ],
    null
  );
  simpleId = ds.id;
}

async function makeSeries() {
  const months = [
    '2024-01-15', '2024-02-15', '2024-03-15', '2024-04-15', '2024-05-15', '2024-06-15',
    '2024-07-15', '2024-08-15', '2024-09-15', '2024-10-15', '2024-11-15', '2024-12-15',
    '2025-01-15',
  ];
  const rows = months.map((d, i) => ({ dt: d, v: (i + 1) * 10 }));
  const ds = await datasetService.createDataset(
    'derived-series',
    [
      { key: 'dt', label: '月份', type: 'date' },
      { key: 'v', label: '值', type: 'integer' },
    ],
    rows,
    null
  );
  seriesId = ds.id;
}

test('normalizeMetrics：未知衍生类型 400', () => {
  assert.throws(
    () => normalizeMetrics([{ key: 'm0', type: 'derived', kind: 'hover', ref: 'm0' }], { dialect: TEST_DIALECT, dimensionCount: 1 }),
    /不支持的衍生类型/
  );
});

test('normalizeMetrics：缺少 ref / 无维度 / 引用其他衍生 400', () => {
  assert.throws(
    () => normalizeMetrics([{ key: 'm0', type: 'derived', kind: 'share' }], { dialect: TEST_DIALECT, dimensionCount: 1 }),
    /需引用其前的原子\/复合指标/
  );
  assert.throws(
    () => normalizeMetrics([{ key: 'm0', field: 'amount', agg: 'sum' }, { key: 'sh', type: 'derived', kind: 'share', ref: 'm0' }], { dialect: TEST_DIALECT, fieldsByName: { amount: { name: 'amount', label: '金额' } }, dimensionCount: 0 }),
    /需要至少一个维度/
  );
  assert.throws(
    () =>
      normalizeMetrics(
        [
          { key: 'm0', field: 'amount', agg: 'sum' },
          { key: 'sh', type: 'derived', kind: 'share', ref: 'm0' },
          { key: 'rank', type: 'derived', kind: 'rank', ref: 'sh' },
        ],
        { dialect: TEST_DIALECT, fieldsByName: { amount: { name: 'amount', label: '金额' } }, dimensionCount: 1 }
      ),
    /不可用的指标/
  );
});

test('normalizeMetrics：公式不能引用衍生指标 400', () => {
  assert.throws(
    () =>
      normalizeMetrics(
        [
          { key: 'm0', field: 'amount', agg: 'sum' },
          { key: 'sh', type: 'derived', kind: 'share', ref: 'm0' },
          { key: 'm1', type: 'expr', expr: '$sh + 1' },
        ],
        { dialect: TEST_DIALECT, fieldsByName: { amount: { name: 'amount', label: '金额' } }, dimensionCount: 1 }
      ),
    /不可用的原子指标/
  );
});

test('normalizeMetrics：衍生条目 sqlExpr 为 null，默认标签取自源指标', () => {
  const out = normalizeMetrics(
    [
      { key: 'm0', field: 'amount', agg: 'sum' },
      { key: 'sh', type: 'derived', kind: 'share', ref: 'm0' },
    ],
    { dialect: TEST_DIALECT, fieldsByName: { amount: { name: 'amount', label: '金额' } }, dimensionCount: 1 }
  );
  assert.equal(out[0].sqlExpr, 'SUM("amount")');
  assert.equal(out[1].kind, 'derived');
  assert.equal(out[1].sqlExpr, null);
  assert.equal(out[1].derivedKind, 'share');
  assert.equal(out[1].field, 'sh');
  assert.ok(out[1].label.includes('占比'));
});

test('集成 share：1 维按全量分母占比', async () => {
  await resetDb();
  await makeSimple();
  const r = await queryEngine.aggregate({
    datasetId: simpleId,
    dimensions: [{ field: 'region' }],
    metrics: [
      { key: 'm0', field: 'amount', agg: 'sum' },
      { key: 'sh', type: 'derived', kind: 'share', ref: 'm0' },
    ],
  });
  const r1 = r.rows.find((x) => x.region === 'r1');
  const r2 = r.rows.find((x) => x.region === 'r2');
  assert.ok(Math.abs(r1.sh - 400 / 900) < 1e-9);
  assert.ok(Math.abs(r2.sh - 500 / 900) < 1e-9);
  assert.equal(r.metrics[1].kind, 'derived');
  assert.equal(r.metrics[1].derivedKind, 'share');
});

test('集成 share：2 维按第二维分组分母', async () => {
  const r = await queryEngine.aggregate({
    datasetId: simpleId,
    dimensions: [{ field: 'region' }, { field: 'prod' }],
    metrics: [
      { key: 'm0', field: 'amount', agg: 'sum' },
      { key: 'sh', type: 'derived', kind: 'share', ref: 'm0' },
    ],
  });
  const r1p1 = r.rows.find((x) => x.region === 'r1' && x.prod === 'p1');
  const r2p1 = r.rows.find((x) => x.region === 'r2' && x.prod === 'p1');
  assert.ok(Math.abs(r1p1.sh - 100 / 300) < 1e-9);
  assert.ok(Math.abs(r2p1.sh - 200 / 300) < 1e-9);
});

test('集成 rank：并列取值共享名次（竞争排名）', async () => {
  const r = await queryEngine.aggregate({
    datasetId: simpleId,
    dimensions: [{ field: 'region' }, { field: 'prod' }],
    metrics: [
      { key: 'm0', field: 'amount', agg: 'sum' },
      { key: 'rk', type: 'derived', kind: 'rank', ref: 'm0' },
    ],
  });
  const find = (region, prod) => r.rows.find((x) => x.region === region && x.prod === prod);
  assert.equal(find('r1', 'p2').rk, 1);
  assert.equal(find('r2', 'p2').rk, 1);
  assert.equal(find('r2', 'p1').rk, 3);
  assert.equal(find('r1', 'p1').rk, 4);
});

test('集成 cumsum：结果按首维度升序重排并累计', async () => {
  await makeSeries();
  const r = await queryEngine.aggregate({
    datasetId: seriesId,
    dimensions: [{ field: 'dt', granularity: 'month' }],
    metrics: [
      { key: 'm0', field: 'v', agg: 'sum' },
      { key: 'cs', type: 'derived', kind: 'cumsum', ref: 'm0' },
    ],
  });
  assert.equal(r.rows[0].dt, '2024-01');
  assert.equal(r.rows[12].dt, '2025-01');
  assert.equal(r.rows[0].cs, 10);
  assert.equal(r.rows[12].cs, 910);
  for (let i = 1; i < r.rows.length; i += 1) assert.ok(r.rows[i].cs > r.rows[i - 1].cs, `累计应递增 @${i}`);
});

test('集成 mom：shift=1，首行为空', async () => {
  const r = await queryEngine.aggregate({
    datasetId: seriesId,
    dimensions: [{ field: 'dt', granularity: 'month' }],
    metrics: [
      { key: 'm0', field: 'v', agg: 'sum' },
      { key: 'mo', type: 'derived', kind: 'mom', ref: 'm0' },
    ],
  });
  assert.equal(r.rows[0].mo, null);
  assert.equal(r.rows[1].mo, 1); // (20-10)/10
  assert.equal(r.rows[2].mo, 0.5); // (30-20)/20
});

test('集成 yoy：按月粒度 shift=12，前 12 行为空', async () => {
  const r = await queryEngine.aggregate({
    datasetId: seriesId,
    dimensions: [{ field: 'dt', granularity: 'month' }],
    metrics: [
      { key: 'm0', field: 'v', agg: 'sum' },
      { key: 'yo', type: 'derived', kind: 'yoy', ref: 'm0' },
    ],
  });
  for (let i = 0; i < 12; i += 1) assert.equal(r.rows[i].yo, null);
  assert.equal(r.rows[12].yo, 12); // (130-10)/10
});

test('集成 yoy：非时间粒度置空并返回警告', async () => {
  const r = await queryEngine.aggregate({
    datasetId: seriesId,
    dimensions: [{ field: 'dt' }],
    metrics: [
      { key: 'm0', field: 'v', agg: 'sum' },
      { key: 'yo', type: 'derived', kind: 'yoy', ref: 'm0' },
    ],
  });
  assert.ok(r.warnings && r.warnings.length > 0, '应返回同比适用性警告');
  assert.ok(r.rows.every((row) => row.yo === null));
});

test('集成：衍生指标可引用复合指标', async () => {
  const r = await queryEngine.aggregate({
    datasetId: simpleId,
    dimensions: [{ field: 'region' }],
    metrics: [
      { key: 'm0', field: 'amount', agg: 'sum' },
      { key: 'half', type: 'expr', expr: '$m0 * 0.5', label: '半额' },
      { key: 'sh', type: 'derived', kind: 'share', ref: 'half' },
    ],
  });
  const r1 = r.rows.find((x) => x.region === 'r1');
  const r2 = r.rows.find((x) => x.region === 'r2');
  assert.ok(Math.abs(r1.sh - 200 / 450) < 1e-9);
  assert.ok(Math.abs(r2.sh - 250 / 450) < 1e-9);
});