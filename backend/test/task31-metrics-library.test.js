// 首行设置 DB_PATH
process.env.DB_PATH = `/tmp/kanban-test-metrics-lib-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resetDb } = require('./helpers/db');
const queryEngine = require('../src/engines/query-engine');
const datasetService = require('../src/services/dataset.service');
const lib = require('../src/services/metrics-library.service');

let dsId;
let b1; // 销售额 sum(amount)
let b2; // 销量 sum(qty)
let b3; // 未引用基础指标（用于删除测试）
let e1; // 客单价 = $b1 / $b2
let d1; // 客单价占比 share(ref e1)
let d2; // 销售额排名 rank(ref b1)

test('setup：建数据集与指标库样本', async () => {
  await resetDb();
  const ds = await datasetService.createDataset(
    'metrics-lib-fixture',
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
  b1 = await lib.createMetric(dsId, { name: '销售额', kind: 'base', definition: { field: 'amount', agg: 'sum' } });
  b2 = await lib.createMetric(dsId, { name: '销量', kind: 'base', definition: { field: 'qty', agg: 'sum' } });
  b3 = await lib.createMetric(dsId, { name: '未引用', kind: 'base', definition: { field: 'qty', agg: 'max' } });
  e1 = await lib.createMetric(dsId, { name: '客单价', kind: 'expr', definition: { expr: `$${b1.id} / $${b2.id}` } });
  d1 = await lib.createMetric(dsId, { name: '客单价占比', kind: 'derived', definition: { derivative: 'share', refId: e1.id } });
  d2 = await lib.createMetric(dsId, { name: '销售额排名', kind: 'derived', definition: { derivative: 'rank', refId: b1.id } });
  assert.ok(b1.id > 0);
  assert.equal(e1.kind, 'expr');
  assert.equal(d1.kind, 'derived');
});

test('createMetric：基础指标校验（字段不存在/未知聚合 400）', async () => {
  await assert.rejects(
    lib.createMetric(dsId, { name: 'x', kind: 'base', definition: { field: 'nope', agg: 'sum' } }),
    /指标字段不存在/
  );
  await assert.rejects(
    lib.createMetric(dsId, { name: 'x', kind: 'base', definition: { field: 'amount', agg: 'median' } }),
    /不支持的聚合/
  );
  await assert.rejects(lib.createMetric(dsId, { name: '', kind: 'base', definition: { field: 'amount', agg: 'sum' } }), /名称不能为空/);
  await assert.rejects(lib.createMetric(dsId, { name: 'x', kind: 'bad', definition: {} }), /仅支持 base\/expr\/derived/);
  assert.ok((await lib.listMetrics(dsId)).length >= 3);
});

test('createMetric：公式指标校验（非法语法/悬空引用/嵌套引用 400）', async () => {
  await assert.rejects(
    lib.createMetric(dsId, { name: 'x', kind: 'expr', definition: { expr: `$${b1.id} && 1` } }),
    /公式仅支持引用指标库指标/
  );
  await assert.rejects(
    lib.createMetric(dsId, { name: 'x', kind: 'expr', definition: { expr: '$9999 + 1' } }),
    /指标不存在/
  );
  // 公式不能引用衍生指标
  await assert.rejects(
    lib.createMetric(dsId, { name: 'x', kind: 'expr', definition: { expr: `$${d2.id} + 1` } }),
    /只能引用基础指标/
  );
  await assert.rejects(
    lib.createMetric(dsId, { name: 'x', kind: 'expr', definition: { expr: '(' } }),
    /括号不匹配/
  );
});

test('createMetric：衍生指标校验（禁止衍生套衍生/未知衍生类型）', async () => {
  await assert.rejects(
    lib.createMetric(dsId, { name: 'x', kind: 'derived', definition: { derivative: 'share', refId: d1.id } }),
    /不能引用另一个衍生指标/
  );
  await assert.rejects(
    lib.createMetric(dsId, { name: 'x', kind: 'derived', definition: { derivative: 'pct', refId: b1.id } }),
    /不支持的衍生类型/
  );
  await assert.rejects(
    lib.createMetric(dsId, { name: 'x', kind: 'derived', definition: { derivative: 'share' } }),
    /缺少 refId/
  );
});

test('expandSavedMetrics：保存的 base 指标直接展开', async () => {
  const { metrics: defs, savedKeys } = await lib.expandSavedMetrics(dsId, [{ type: 'saved', metricId: b1.id, key: 'm0' }]);
  assert.equal(defs.length, 1);
  assert.equal(defs[0].type, 'base');
  assert.equal(defs[0].field, 'amount');
  assert.equal(defs[0].agg, 'sum');
  assert.equal(defs[0].label, '销售额');
  assert.equal(defs[0].key, 'm0');
  assert.equal(savedKeys[b1.id], 'm0');
});

test('expandSavedMetrics：链表式展开（base←expr←derived）标签与顺序正确', async () => {
  const { metrics: defs, savedKeys } = await lib.expandSavedMetrics(dsId, [{ type: 'saved', metricId: d1.id, key: 'm0' }]);
  // b1, b2, e1, d1 —— refs 先于引用方入列
  assert.equal(defs.length, 4);
  assert.deepEqual(
    defs.map((d) => d.label),
    ['销售额', '销量', '客单价', '客单价占比']
  );
  assert.equal(defs[2].type, 'expr');
  assert.equal(defs[2].expr, `$m0 / $m1`);
  assert.equal(defs[3].type, 'derived');
  assert.equal(defs[3].kind, 'share');
  assert.equal(defs[3].ref, 'm2');
  assert.equal(savedKeys[d1.id], 'm3');
});

test('expandSavedMetrics：与内联指标混用并按图表顺序编号', async () => {
  const { metrics: defs } = await lib.expandSavedMetrics(dsId, [
    { type: 'base', field: 'amount', agg: 'sum' },
    { type: 'saved', metricId: b2.id },
    { type: 'saved', metricId: d2.id },
  ]);
  // 内联 base 无 label（由 normalizeMetrics 兜底）；d2 的 ref 是库内 b1(销售额)
  assert.deepEqual(defs.map((d) => d.label), [undefined, '销量', '销售额', '销售额排名']);
  assert.equal(defs[0].key, 'm0');
  assert.equal(defs[1].key, 'm1');
  assert.equal(defs[2].type, 'base');
  assert.equal(defs[3].type, 'derived');
  assert.equal(defs[3].ref, 'm2');
});

test('expandSavedMetrics：内联派生指标引用缩重排后 key 正确重写', async () => {
  const { metrics: defs } = await lib.expandSavedMetrics(dsId, [
    { type: 'saved', metricId: b1.id, key: 'm0' },
    { type: 'base', key: 'm1', field: 'qty', agg: 'sum' },
    { type: 'derived', key: 'm2', kind: 'mom', ref: 'm1' },
  ]);
  // b1 -> m0；内联 qty -> m1；内部派生 ref 从 m1 保持 m1
  assert.equal(defs[0].key, 'm0');
  assert.equal(defs[1].key, 'm1');
  assert.equal(defs[2].type, 'derived');
  assert.equal(defs[2].ref, 'm1');
});

test('expandSavedMetrics：未知 metricId 404', async () => {
  await assert.rejects(lib.expandSavedMetrics(dsId, [{ type: 'saved', metricId: 99999 }]), /指标不存在/);
  await assert.rejects(lib.expandSavedMetrics(dsId, [{ type: 'saved' }]), /缺少有效 metricId/);
});

test('集成查询：图表引用库内衍生指标（占比）', async () => {
  const r = await queryEngine.aggregate({
    datasetId: dsId,
    dimensions: [{ field: 'name' }],
    metrics: [{ type: 'saved', metricId: d1.id }],
  });
  assert.equal(r.rows.length, 2);
  const a = r.rows.find((x) => x.name === 'a');
  const b = r.rows.find((x) => x.name === 'b');
  // 客单价 a=5,b=5 → 各占比 0.5
  assert.equal(a['metric:m0'].label, '销售额');
  assert.equal(a['metric:m2'].value, 5);
  assert.equal(a['metric:m3'].value, 0.5);
  assert.equal(b['metric:m3'].value, 0.5);
  assert.deepEqual(r.metrics.map((m) => m.label), ['销售额', '销量', '客单价', '客单价占比']);
  assert.equal(r.savedKeys[d1.id], 'm3');
});

test('集成查询：图表引用库内排名指标', async () => {
  const r = await queryEngine.aggregate({
    datasetId: dsId,
    dimensions: [{ field: 'name' }],
    metrics: [{ type: 'saved', metricId: d2.id }],
  });
  const a = r.rows.find((x) => x.name === 'a');
  const b = r.rows.find((x) => x.name === 'b');
  assert.equal(a['metric:m1'].value, 2);
  assert.equal(b['metric:m1'].value, 1);
});

test('updateMetric：改名生效', async () => {
  const upd = await lib.updateMetric(dsId, b1.id, { name: '销售额(元)' });
  assert.equal(upd.name, '销售额(元)');
  assert.equal(upd.definition.field, 'amount');
  const { metrics: defs } = await lib.expandSavedMetrics(dsId, [{ type: 'saved', metricId: b1.id }]);
  assert.equal(defs[0].label, '销售额(元)');
  await lib.updateMetric(dsId, b1.id, { name: '销售额' });
});

test('deleteMetric：被引用（派生 refId 与公式 $id）拒绝删除，未引用可删', async () => {
  await assert.rejects(lib.deleteMetric(dsId, b1.id), /被指标库其他指标.*引用/);
  await assert.rejects(lib.deleteMetric(dsId, e1.id), /被指标库其他指标.*引用/);
  const del = await lib.deleteMetric(dsId, b3.id);
  assert.equal(del.deleted, true);
  await assert.rejects(lib.getMetricRecord(dsId, b3.id), /指标不存在/);
});