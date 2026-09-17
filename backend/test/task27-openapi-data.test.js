// T5：开放 API 取数/聚合/导出（含 CSV、双重归属、白名单、truncated、数据出口审计）
process.env.DB_PATH = `/tmp/kanban-test-openapi-data-${process.pid}.db`;
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
function req(server, { method = 'GET', path, headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const h = { ...headers };
    if (payload) {
      h['Content-Type'] = 'application/json';
      h['Content-Length'] = payload.length;
    }
    const r = http.request({ method, path, host: '127.0.0.1', port: server.address().port, headers: h }, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(chunks); } catch { /* text/csv 保留原文 */ }
        resolve({ status: res.statusCode, body: parsed, raw: chunks, contentType: res.headers['content-type'] || '' });
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

let server, cust, other, custKey, otherKey, dsOwn, chartOwn, chartLeak, dashOwn;

async function boot() {
  await resetDb();
  cust = await authService.register({ email: 'd@x.com', password: 'Password123!', name: 'D' });
  other = await authService.register({ email: 'e@x.com', password: 'Password123!', name: 'E' });
  const header = [{ key: 'category', label: '类别', type: 'string' }, { key: 'amount', label: '金额', type: 'number' }];
  const rows = ['A', 'A', 'B'].map((c, i) => ({ category: c, amount: String((i + 1) * 10) }));
  dsOwn = await datasetService.createDataset('D数据集', header, rows, cust.id);
  const dsOther = await datasetService.createDataset('E数据集', header, rows.slice(0, 1), other.id);
  chartOwn = await chartService.createChart({
    name: 'D销售额', chartType: 'bar', datasetId: dsOwn.id,
    config: { dimensions: [{ field: 'category', label: '类别' }], metrics: [{ field: 'amount', agg: 'sum', label: '金额' }], filters: [] },
  }, cust.id);
  chartLeak = await chartService.createChart({
    name: '越权', chartType: 'bar', datasetId: dsOther.id,
    config: { dimensions: [{ field: 'category', label: '类别' }], metrics: [{ field: 'amount', agg: 'count', label: '数' }], filters: [] },
  }, cust.id);
  dashOwn = await dashboardService.createDashboard('D看板', cust.id);
  await dashboardService.updateDashboard(dashOwn.id, { layout: [{ x: 0, y: 0, w: 6, h: 4, type: 'chart', chartId: chartOwn.id }] });
  const scopes = ['chart:read', 'dataset:read', 'dashboard:read'];
  custKey = await apiKeyService.create({ name: 'DATA', type: 'static', userId: cust.id, scopes, createdBy: cust.id });
  otherKey = await apiKeyService.create({ name: 'EKEY', type: 'static', userId: other.id, scopes, createdBy: other.id });
  server = await listen();
}
test.before(async () => await boot());
test.after(() => server.close());
const hdr = (k, extra = {}) => ({ authorization: `Bearer ${k.plaintext}`, ...extra });

test('GET /charts/:id/data：columns+rows，无 sql/elapsedMs', async () => {
  const r = await req(server, { path: `/api/open/v1/charts/${chartOwn.id}/data`, headers: hdr(custKey) });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.chart.id, chartOwn.id);
  assert.deepEqual(r.body.data.columns.map((c) => c.field), ['category', 'amount']);
  assert.equal(r.body.data.rows.length, 2);
  assert.equal(r.body.data.truncated, false);
  assert.equal(r.body.data.sql, undefined);
  assert.equal(r.body.data.elapsedMs, undefined);
});

test('GET /charts/:id/data?format=csv：BOM 文本，无 JSON 外壳', async () => {
  const r = await req(server, { path: `/api/open/v1/charts/${chartOwn.id}/data?format=csv`, headers: hdr(custKey) });
  assert.equal(r.status, 200);
  assert.match(r.contentType, /text\/csv/);
  assert.ok(r.raw.startsWith('\uFEFF'));
  assert.match(r.raw, /类别,金额/);
  assert.equal(r.body, null, '应为纯文本而非 JSON');
});

test('GET /charts/:id/data：非本人图表 404（掩盖）', async () => {
  const foreign = await chartService.createChart({
    name: 'F', chartType: 'bar', datasetId: dsOwn.id,
    config: { metrics: [{ field: 'amount', agg: 'count', label: 'n' }], dimensions: [], filters: [] },
  }, other.id);
  const r = await req(server, { path: `/api/open/v1/charts/${foreign.id}/data`, headers: hdr(custKey) });
  assert.equal(r.status, 404);
  assert.match(r.body.message, /不存在|无权/);
});

test('GET /charts/:id/data：图表归属本人但其数据集归他人 → 404（防绕读）', async () => {
  const r = await req(server, { path: `/api/open/v1/charts/${chartLeak.id}/data`, headers: hdr(custKey) });
  assert.equal(r.status, 404, '图表引用他人数据集必须被拦截');
});

test('POST /datasets/:id/aggregate：自定义聚合 200', async () => {
  const r = await req(server, {
    method: 'POST', path: `/api/open/v1/datasets/${dsOwn.id}/aggregate`, headers: hdr(custKey),
    body: { dimensions: [{ field: 'category' }], metrics: [{ field: 'amount', agg: 'sum' }] },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.columns.length, 2);
  assert.equal(r.body.data.rows.length, 2);
  assert.equal(r.body.data.sql, undefined);
});

test('aggregate 未知字段 → 422 白名单拦截', async () => {
  const r = await req(server, {
    method: 'POST', path: `/api/open/v1/datasets/${dsOwn.id}/aggregate`, headers: hdr(custKey),
    body: { metrics: [{ field: 'secret_col', agg: 'sum' }] },
  });
  assert.equal(r.status, 422);
  assert.match(r.body.message, /未注册字段.*secret_col/);
});

test('aggregate 非法输入（非白名单操作的 strict） → 400', async () => {
  const r = await req(server, {
    method: 'POST', path: `/api/open/v1/datasets/${dsOwn.id}/aggregate`, headers: hdr(custKey),
    body: { metrics: [], extra: true },
  });
  assert.equal(r.status, 400);
});

test('aggregate 他人数据集 → 404', async () => {
  const otherDs = await datasetService.createDataset('EOther', [{ key: 'v', label: 'V', type: 'number' }], [{ v: '1' }], other.id);
  const r = await req(server, {
    method: 'POST', path: `/api/open/v1/datasets/${otherDs.id}/aggregate`, headers: hdr(custKey),
    body: { metrics: [{ field: 'v', agg: 'count' }] },
  });
  assert.equal(r.status, 404);
});

test('GET /dashboards/:id/export：元信息 + cards，逐卡无 sql', async () => {
  const r = await req(server, { path: `/api/open/v1/dashboards/${dashOwn.id}/export`, headers: hdr(custKey) });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.dashboard.id, dashOwn.id);
  assert.equal(r.body.data.cards.length, 1);
  assert.equal(r.body.data.cards[0].chart.datasetName, 'D数据集');
  assert.ok(!r.body.data.cards[0].rows.some((row) => row && Object.keys(row).some((k) => k.includes('sql'))));
});

test('export?format=csv：文本 CSV，含图表标题行', async () => {
  const r = await req(server, { path: `/api/open/v1/dashboards/${dashOwn.id}/export?format=csv`, headers: hdr(custKey) });
  assert.equal(r.status, 200);
  assert.match(r.contentType, /text\/csv/);
  assert.ok(r.raw.startsWith('\uFEFF'));
  assert.match(r.raw, /# D销售额/);
});

test('export 他人看板 → 404', async () => {
  const otherDash = await dashboardService.createDashboard('E看板', other.id);
  const r = await req(server, { path: `/api/open/v1/dashboards/${otherDash.id}/export`, headers: hdr(custKey) });
  assert.equal(r.status, 404);
});

test('数据出口三类调用均落审计（detail.keyId 且无 sql）', async () => {
  await req(server, { path: `/api/open/v1/charts/${chartOwn.id}/data`, headers: hdr(custKey) });
  await req(server, {
    method: 'POST', path: `/api/open/v1/datasets/${dsOwn.id}/aggregate`, headers: hdr(custKey),
    body: { metrics: [{ field: 'amount', agg: 'sum' }] },
  });
  await req(server, { path: `/api/open/v1/dashboards/${dashOwn.id}/export`, headers: hdr(custKey) });
  const actions = db.prepare('SELECT DISTINCT action FROM audit_logs WHERE action IN (?,?,?)')
    .all('api:chart.data', 'api:dataset.aggregate', 'api:dashboard.export');
  assert.deepEqual(actions.map((a) => a.action).sort(), ['api:chart.data', 'api:dataset.aggregate', 'api:dashboard.export'].sort());
  const row = db.prepare("SELECT * FROM audit_logs WHERE action='api:dataset.aggregate' LIMIT 1").get();
  assert.equal(JSON.parse(row.detail).keyId, custKey.key.id);
  assert.equal(row.resource_id, String(dsOwn.id));
});