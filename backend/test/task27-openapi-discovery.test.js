// T4：开放 API 发现端点（/charts /datasets /dashboards）owner 过滤 + 分页
process.env.DB_PATH = `/tmp/kanban-test-openapi-disc-${process.pid}.db`;
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { db, resetDb } = require('./helpers/db');
const authService = require('../src/services/auth.service');
const apiKeyService = require('../src/services/api-key.service');
const chartService = require('../src/services/chart.service');
const datasetService = require('../src/services/dataset.service');
const dashboardService = require('../src/services/dashboard.service');
const app = require('../src/app');

function listen() {
  const server = http.createServer(app);
  return new Promise((r) => server.listen(0, () => r(server)));
}
function GET(server, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ method: 'GET', path, host: '127.0.0.1', port: server.address().port, headers }, (res) => {
      let c = '';
      res.on('data', (x) => (c += x));
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(c) }); } catch { resolve({ status: res.statusCode, raw: c }); } });
    });
    req.on('error', reject); req.end();
  });
}

let server, cust, other, custKey, custChartKey, otherKey, chartOwn, chartOther, datasetOther, dashOther;

async function boot() {
  await resetDb();
  cust = await authService.register({ email: 'disc@x.com', password: 'Password123!', name: 'C' });
  other = await authService.register({ email: 'other@x.com', password: 'Password123!', name: 'O' });
  const dsOwn = await datasetService.createDataset('C数据集', [{ key: 'age', label: '年龄', type: 'number' }], [{ age: '10' }], cust.id);
  datasetOther = await datasetService.createDataset('O数据集', [{ key: 'age', label: '年龄', type: 'number' }], [{ age: '20' }], other.id);
  const baseChart = { chartType: 'bar', config: { metrics: [{ field: 'age', agg: 'count', label: '人数' }], dimensions: [], filters: [] } };
  chartOwn = await chartService.createChart({ ...baseChart, name: 'C图表', datasetId: dsOwn.id }, cust.id);
  chartOther = await chartService.createChart({ ...baseChart, name: 'O图表', datasetId: datasetOther.id }, other.id);
  await dashboardService.createDashboard('C看板', cust.id);
  dashOther = await dashboardService.createDashboard('O看板', other.id);
  custKey = await apiKeyService.create({ name: 'Full', type: 'static', userId: cust.id, scopes: ['chart:read', 'dataset:read', 'dashboard:read'], createdBy: cust.id });
  custChartKey = await apiKeyService.create({ name: 'ChartOnly', type: 'static', userId: cust.id, scopes: ['chart:read'], createdBy: cust.id });
  otherKey = await apiKeyService.create({ name: 'OtherFull', type: 'static', userId: other.id, scopes: ['chart:read', 'dataset:read', 'dashboard:read'], createdBy: other.id });
  server = await listen();
}
test.before(async () => await boot());
test.after(() => server.close());

const hdr = (k) => ({ authorization: `Bearer ${k.plaintext}` });

test('/charts：仅返回本人图表 + 字段门面 + total', async () => {
  const r = await GET(server, '/api/open/v1/charts', hdr(custKey));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.data.items.map((c) => c.id), [chartOwn.id]);
  assert.equal(r.body.data.total, 1);
  assert.ok(!r.body.data.items[0].config, '不应返回 config');
  assert.equal(r.body.data.items[0].chartType, 'bar');
});

test('/charts 他人图表不在列表中（owner 过滤）', async () => {
  const r = await GET(server, '/api/open/v1/charts', hdr(otherKey));
  assert.deepEqual(r.body.data.items.map((c) => c.id), [chartOther.id]);
});

test('/charts limit=1 分页', async () => {
  const r = await GET(server, '/api/open/v1/charts?limit=1', hdr(custKey));
  assert.equal(r.body.data.items.length, 1);
  assert.equal(r.body.data.total, 1);
});

test('/datasets：仅返回本人数据集', async () => {
  const r = await GET(server, '/api/open/v1/datasets', hdr(custKey));
  assert.equal(r.body.data.items.length, 1);
  assert.equal(r.body.data.items[0].name, 'C数据集');
  assert.equal(typeof r.body.data.items[0].rowCount, 'number');
  assert.ok(!r.body.data.items[0].table_name, '不应暴露内部字段');
});

test('/dashboards：仅返回本人看板', async () => {
  const r = await GET(server, '/api/open/v1/dashboards', hdr(custKey));
  assert.equal(r.body.data.items.length, 1);
  assert.ok(!r.body.data.items[0].layout, '不应返回 layout');
  assert.equal(r.body.data.items[0].name, 'C看板');
});

test('scope 受限 key 访问 /datasets → 403', async () => {
  const r = await GET(server, '/api/open/v1/datasets', hdr(custChartKey));
  assert.equal(r.status, 403);
  assert.match(r.body.message, /无权/);
});

test('/charts?keyword=C 图表 关键词过滤', async () => {
  const r = await GET(server, `/api/open/v1/charts?keyword=${encodeURIComponent('C图表')}`, hdr(custKey));
  assert.equal(r.body.data.items.length, 1);
  assert.equal(r.body.data.items[0].name, 'C图表');
});

test('/charts?keyword=不存在 关键词命中 0', async () => {
  const r = await GET(server, `/api/open/v1/charts?keyword=${encodeURIComponent('不存在')}`, hdr(custKey));
  assert.equal(r.body.data.items.length, 0);
  assert.equal(r.body.data.total, 0);
});