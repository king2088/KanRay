// 首行设置 DB_PATH
process.env.DB_PATH = `/tmp/kanban-test-metrics-lib-edge-${process.pid}.db`;
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDb } = require('./helpers/db');
const app = require('../src/app');
const authService = require('../src/services/auth.service');
const datasetService = require('../src/services/dataset.service');
const chartService = require('../src/services/chart.service');
const queryEngine = require('../src/engines/query-engine');
const lib = require('../src/services/metrics-library.service');

let server;
let base;
let token;
let dsId;
let fAmount;
let fQty;
let mAmount;
let mQty;
let mMid;
let mExpr;

function auth() {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

async function http(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: auth(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

before(async () => {
  await resetDb();
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  token = (await authService.login('admin@kanray.local', 'admin123')).accessToken;

  const ds = await datasetService.createDataset(
    'metrics-lib-edge',
    [
      { key: 'region', label: '区域', type: 'string' },
      { key: 'amount', label: '金额', type: 'integer' },
      { key: 'qty', label: '数量', type: 'integer' },
    ],
    [
      { region: 'r1', amount: 10, qty: 2 },
      { region: 'r2', amount: 20, qty: 4 },
      { region: 'r3', amount: 30, qty: 6 },
    ],
    null
  );
  dsId = ds.id;

  mAmount = await lib.createMetric(dsId, { name: '销售额', kind: 'base', definition: { field: 'amount', agg: 'sum' } });
  mQty = await lib.createMetric(dsId, { name: '销量', kind: 'base', definition: { field: 'qty', agg: 'sum' } });
  mMid = await lib.createMetric(dsId, { name: '中间量', kind: 'base', definition: { field: 'qty', agg: 'max' } });
  mExpr = await lib.createMetric(dsId, { name: '客单价', kind: 'expr', definition: { expr: `$${mAmount.id} / $${mQty.id}` } });
});

test('路由 CRUD：create/list/update/delete + 越权数据集 404', async () => {
  const created = await http('POST', `/api/datasets/${dsId}/metrics`, {
    name: '路由明细', kind: 'base', definition: { field: 'amount', agg: 'avg' },
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  assert.equal(created.body.data.kind, 'base');
  const mid = created.body.data.id;

  const list = await http('GET', `/api/datasets/${dsId}/metrics`);
  assert.equal(list.status, 200);
  assert.ok(list.body.data.some((m) => m.id === mid));
  assert.equal(list.body.data.find((m) => m.id === mid).definition.field, 'amount');

  const upd = await http('PUT', `/api/datasets/${dsId}/metrics/${mid}`, { name: '路由明细2', definition: { field: 'amount', agg: 'min' } });
  assert.equal(upd.status, 200);
  assert.equal(upd.body.data.name, '路由明细2');
  assert.equal(upd.body.data.definition.agg, 'min');

  // 非法 body 400
  const bad = await http('POST', `/api/datasets/${dsId}/metrics`, { name: 'x', kind: 'hack', definition: {} });
  assert.equal(bad.status, 400);

  await http('DELETE', `/api/datasets/${dsId}/metrics/${mid}`);
  const gone = await http('GET', `/api/datasets/${dsId}/metrics`);
  assert.equal(gone.body.data.some((m) => m.id === mid), false);

  // 不存在的数据集/指标 404
  const nf = await http('GET', `/api/datasets/999999/metrics`);
  assert.equal(nf.status, 404);
});

test('路由：图表查询引用库内 base/expr/derived 混排', async () => {
  const share = await lib.createMetric(dsId, { name: '销售占比', kind: 'derived', definition: { derivative: 'share', refId: mAmount.id } });
  const res = await http('POST', `/api/datasets/${dsId}/query`, {
    dimensions: [{ field: 'region' }],
    metrics: [
      { type: 'saved', metricId: mAmount.id },
      { type: 'saved', metricId: share.id },
    ],
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.rows.length, 3);
  const r1 = res.body.data.rows.find((x) => x.region === 'r1');
  const r2 = res.body.data.rows.find((x) => x.region === 'r2');
  // savedKeys 应为 { mAmount: 'm0', share: 'm1' }
  assert.equal(res.body.data.savedKeys[mAmount.id], 'm0');
  assert.equal(res.body.data.savedKeys[share.id], 'm1');
  assert.equal(r1['metric:m0'].value, 10);
  assert.equal(r1['metric:m1'].value, 10 / 60);
  assert.equal(r2['metric:m1'].value, 20 / 60);
});

test('deleteMetric：$919 公式仅引用 919，不应因包含 $91 误伤 91', async () => {
  await db
    .prepare('INSERT INTO metrics (id, dataset_id, name, kind, definition, owner_id) VALUES (?, ?, ?, ?, ?, NULL)')
    .run(9191, dsId, '小ID-91', 'base', JSON.stringify({ field: 'qty', agg: 'max' }));
  await db
    .prepare('INSERT INTO metrics (id, dataset_id, name, kind, definition, owner_id) VALUES (?, ?, ?, ?, ?, NULL)')
    .run(91919, dsId, '大ID-919', 'base', JSON.stringify({ field: 'amount', agg: 'max' }));
  await db
    .prepare('INSERT INTO metrics (id, dataset_id, name, kind, definition, owner_id) VALUES (?, ?, ?, ?, ?, NULL)')
    .run(919191, dsId, '公式引用919', 'expr', JSON.stringify({ expr: '$91919 / 2' }));

  // 91 未被引用（$919 子串恰好包含 $91），应可删除；旧版子串匹配会误拒
  await assert.doesNotReject(lib.deleteMetric(dsId, 9191));
  // 919 被公式引用，应拒绝删除
  await assert.rejects(lib.deleteMetric(dsId, 91919), /被指标库其他指标/);
  await lib.deleteMetric(dsId, 919191);
  await lib.deleteMetric(dsId, 91919);
});

test('deleteMetric：被图表 saved 引用时应拒绝删除（前端文案承诺）', async () => {
  const target = await lib.createMetric(dsId, { name: '图表引用我', kind: 'base', definition: { field: 'amount', agg: 'max' } });
  await chartService.createChart({
    name: '引用指标库的图表',
    chartType: 'bar',
    datasetId: dsId,
    config: {
      dimensions: [{ field: 'region' }],
      metrics: [{ type: 'saved', key: 'm1', metricId: target.id }],
    },
  }, 1);
  await assert.rejects(lib.deleteMetric(dsId, target.id), /被图表/);
  // 无引用后允许删除
  await chartService.deleteChart(1);
  const del = await lib.deleteMetric(dsId, target.id);
  assert.equal(del.deleted, true);
});

test('expandSavedMetrics：同一库指标被两张表引用只展开一次（去重）', async () => {
  const { metrics: defs } = await lib.expandSavedMetrics(dsId, [
    { type: 'saved', metricId: mAmount.id, key: 'm1' },
    { type: 'saved', metricId: mExpr.id, key: 'm2' },
    { type: 'saved', metricId: mAmount.id, key: 'm3' },
  ]);
  // mAmount 只出现一次；mExpr 依赖 mAmount/mQty
  assert.deepEqual(defs.map((d) => d.label), ['销售额', '销量', '客单价']);
  assert.deepEqual(defs.map((d) => d.key), ['m0', 'm1', 'm2']);
});

test('expandSavedMetrics：内联 expr/derived 引用 saved 时按最终 key 重写', async () => {
  const { metrics: defs } = await lib.expandSavedMetrics(dsId, [
    { type: 'saved', metricId: mAmount.id, key: 'm1' },
    { type: 'expr', key: 'm2', expr: '$m1 * 2', label: '双倍额' },
    { type: 'derived', key: 'm3', kind: 'share', ref: 'm1', label: '占比' },
  ]);
  assert.deepEqual(defs.map((d) => d.key), ['m0', 'm1', 'm2']);
  assert.equal(defs[1].expr, '$m0 * 2');
  assert.equal(defs[2].ref, 'm0');
});

test('expandSavedMetrics：内联公式引用 saved 后置的内联指标重编号正确', async () => {
  const { metrics: defs } = await lib.expandSavedMetrics(dsId, [
    { type: 'saved', metricId: mQty.id, key: 'm1' },
    { type: 'base', key: 'm2', field: 'amount', agg: 'sum' },
    { type: 'expr', key: 'm3', expr: '$m2 * 2', label: '双倍额' },
  ]);
  // saved(mQty)=m0；内联 amount=m1；内联 expr 引用 $m2 → 重写为 $m1
  assert.deepEqual(defs.map((d) => d.key), ['m0', 'm1', 'm2']);
  assert.equal(defs[2].expr, '$m1 * 2');
});

test('expandSavedMetrics：无 saved 时原样返回', async () => {
  const metrics = [{ type: 'base', key: 'm0', field: 'amount', agg: 'sum' }];
  const res = await lib.expandSavedMetrics(dsId, metrics);
  assert.equal(res.metrics, metrics);
  assert.deepEqual(res.savedKeys, {});
});

test('集成查询：saved 复合(expr)被内联衍生引用', async () => {
  const r = await queryEngine.aggregate({
    datasetId: dsId,
    dimensions: [{ field: 'region' }],
    metrics: [
      { type: 'saved', key: 'm1', metricId: mExpr.id },
      { type: 'derived', key: 'm2', kind: 'share', ref: 'm1' },
    ],
  });
  assert.deepEqual(r.metrics.map((m) => m.label), ['销售额', '销量', '客单价', '客单价 · 占比']);
  const r1 = r.rows.find((x) => x.region === 'r1');
  assert.equal(r1['metric:m2'].value, 5); // 客单价 r1 = 10/2
  assert.equal(r1['metric:m3'].value, 5 / 15); // 全量客单价共 15
});

test('updateMetric：改名与换定义重新校验（非法聚合 400）', async () => {
  const upd = await lib.updateMetric(dsId, mQty.id, { definition: { field: 'qty', agg: 'avg' } });
  assert.equal(upd.definition.agg, 'avg');
  await assert.rejects(lib.updateMetric(dsId, mQty.id, { definition: { field: 'nope', agg: 'avg' } }), /指标字段不存在/);
  await lib.updateMetric(dsId, mQty.id, { definition: { field: 'qty', agg: 'sum' } });
});

test('循环引用防护：图表同时引用自身（人为构造环）返回 400', async () => {
  // 直接篡改库内定义制造 expr→expr 环（绕过创建校验），防御 emitRef 死循环
  const evil = await lib.createMetric(dsId, { name: 'evil', kind: 'expr', definition: { expr: `${mAmount.id} + 1` } });
  await db
    .prepare("UPDATE metrics SET definition = ? WHERE id = ?")
    .run(JSON.stringify({ expr: `$${evil.id} + 1` }), evil.id);
  await assert.rejects(lib.expandSavedMetrics(dsId, [{ type: 'saved', metricId: evil.id }]), /循环引用/);
  await lib.deleteMetric(dsId, evil.id);
});

test('收尾：关闭临时 HTTP 服务', () => {
  server?.close();
});