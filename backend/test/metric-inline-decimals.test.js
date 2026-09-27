// 图表配置里的内联指标不许带 decimals（走真实 HTTP 路由）。
//
// decimals 归指标库所有：库指标的显示精度只在指标库配置一次，经指标表校验后下发。
// 而图表 config.metrics 是客户端原样存库的（chart.service 的 validateChartPayload
// 只检查 metrics 是不是非空数组），于是内联指标可以自己夹带一个 decimals 键，
// expandSavedMetrics 的 { ...m } 又会把它原样带进引擎——响应层是靠「有没有这个键」
// 区分库指标/内联指标的（见 engines/metrics.js 的 projectMetrics），所以客户端一旦
// 夹带，这个判别式就被说谎了：内联指标静默按某个精度渲染，且没有任何 UI 能解释。
// /datasets/:id/query 那条路天生没有这个洞（zod 会剥掉未知键），两个入口不该不一致。
//
// 独立成文件而不并进 task50：task50 刻意不引 src/app.js（免得为字段契约把
// swagger-ui-express/限流/整份 schema 初始化都拖进来），而这条必须过真实路由。
process.env.DB_PATH = `/tmp/kanban-test-inline-decimals-${process.pid}.db`;
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { resetDb } = require('./helpers/db');
const app = require('../src/app');
const authService = require('../src/services/auth.service');
const datasetService = require('../src/services/dataset.service');
const lib = require('../src/services/metrics-library.service');

const CJK = /[\u4e00-\u9fff]/;

let server;
let base;
let token;
let dsId;
let libMetricId;

async function http(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

before(async () => {
  await resetDb();
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  token = (await authService.login('admin@kanray.local', 'admin123')).accessToken;

  const ds = await datasetService.createDataset(
    'inline-decimals-fixture',
    [
      { key: 'name', label: '名称', type: 'string' },
      { key: 'rate', label: '负荷率', type: 'number' },
    ],
    [
      { name: 'a', rate: 76.989306 },
      { name: 'b', rate: 90 },
    ],
    null,
  );
  dsId = ds.id;
  libMetricId = (await lib.createMetric(dsId, {
    name: '库负荷率', kind: 'base', definition: { field: 'rate', agg: 'avg' }, decimals: 3,
  })).id;
});

const chartBody = (metrics) => ({
  name: '内联 decimals 守卫',
  chartType: 'line',
  datasetId: dsId,
  config: { dimensions: [{ field: 'name' }], metrics },
});

test('POST /api/charts：内联指标带 decimals 直接 400', async () => {
  const r = await http('POST', '/api/charts', chartBody([
    { field: 'rate', agg: 'avg', label: '内联负荷率', decimals: 2 },
  ]));
  assert.equal(r.status, 400, JSON.stringify(r.body));
  assert.match(r.body.message, /第 1 个指标不能带 decimals/,
    `报错应指明是第几个指标，实际: ${r.body.message}`);
  // 这条文案是插值模板，en-messages.js 必须登记（task47 也会查孤儿键）；
  // 顺带钉住英文侧真的查得到、且不含中文。
  assert.ok(r.body.messageEn && !CJK.test(r.body.messageEn),
    `英文文案缺失或含中文: ${r.body.messageEn}`);
  assert.match(r.body.messageEn, /must not carry decimals/, `英文文案不对: ${r.body.messageEn}`);
});

test('PATCH /api/charts/:id：内联指标带 decimals 同样 400（create 不是唯一入口）', async () => {
  // validateChartPayload 被 createChart/updateChart 共用，但两个入口都断言一次，
  // 才不会有人日后只在一个上面挂校验。
  const created = await http('POST', '/api/charts', chartBody([
    { field: 'rate', agg: 'avg', label: '内联负荷率' },
  ]));
  assert.equal(created.status, 200, JSON.stringify(created.body));

  const bad = await http('PATCH', `/api/charts/${created.body.data.id}`, chartBody([
    { field: 'rate', agg: 'avg', label: '内联负荷率', decimals: 0 },
  ]));
  assert.equal(bad.status, 400, JSON.stringify(bad.body));
  // decimals=0 也得拒：它是库指标的默认值，放进来照样能让判别式说谎
  assert.match(bad.body.message, /第 1 个指标不能带 decimals/, bad.body.message);

  // 被拒的配置不应落库：更新前的配置还在
  const after = await http('GET', `/api/charts/${created.body.data.id}`);
  assert.ok(!('decimals' in after.body.data.config.metrics[0]),
    `拒绝后不应写入带 decimals 的配置，实际: ${JSON.stringify(after.body.data.config.metrics[0])}`);
});

test('混合图表里内联指标夹带 decimals 也 400（expandSavedMetrics 的 { ...m } 会留下它）', async () => {
  const created = await http('POST', '/api/charts', chartBody([{ type: 'saved', metricId: libMetricId }]));
  assert.equal(created.status, 200, JSON.stringify(created.body));

  const mixed = await http('PATCH', `/api/charts/${created.body.data.id}`, chartBody([
    { type: 'saved', metricId: libMetricId },
    { field: 'rate', agg: 'max', label: '内联峰值', decimals: 4 },
  ]));
  assert.equal(mixed.status, 400, JSON.stringify(mixed.body));
  // 索引是它在 config.metrics 里的位置（0 起算，报错里 1 起算）
  assert.match(mixed.body.message, /第 2 个指标不能带 decimals/, mixed.body.message);
});

test('库指标照常可用：mixed 图表仍能跑，且响应里两类指标可分辨', async () => {
  const created = await http('POST', '/api/charts', chartBody([
    { type: 'saved', metricId: libMetricId },
    { field: 'rate', agg: 'max', label: '内联峰值' },
  ]));
  assert.equal(created.status, 200, JSON.stringify(created.body));

  const data = await http('POST', `/api/charts/${created.body.data.id}/data`, {});
  assert.equal(data.status, 200, JSON.stringify(data.body));
  const metrics = data.body.data.data.metrics;
  const byLabel = new Map(metrics.map((m) => [m.label, m]));
  // 被守住的正是这个不变量：库指标带 decimals（指标库配的 3 位），内联指标没有这个键
  assert.equal(byLabel.get('库负荷率').decimals, 3, '库指标应带指标库配置的小数位');
  assert.ok(!('decimals' in byLabel.get('内联峰值')),
    `内联指标不应有 decimals，实际: ${JSON.stringify(byLabel.get('内联峰值'))}`);
});

test('config.metrics 里的非对象脏配置不因这条校验变成 500', async () => {
  // config.metrics 是客户端原样送进来的 JSON，元素类型不受约束。字符串上用 `in`
  // 会抛 TypeError → 500，把它挡在保存这一步反而比现状更差：它今天的归宿是
  // /data 时 normalizeMetrics 报「指标字段不存在」的 400。
  const r = await http('POST', '/api/charts', chartBody(['rate']));
  assert.equal(r.status, 200, `非对象的脏配置不该在这里 500/400，实际: ${JSON.stringify(r.body)}`);
});

test('收尾：关闭临时 HTTP 服务', () => {
  server?.close();
});
