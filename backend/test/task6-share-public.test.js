process.env.DB_PATH = `/tmp/kanban-test-pub-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDb } = require('./helpers/db');
const chartService = require('../src/services/chart.service');
const dashboardService = require('../src/services/dashboard.service');
const shareService = require('../src/services/share.service');

let server; let base; let dashId; let chartId; let token;

test('启动临时服务并准备一个带分享的看板', async () => {
  await resetDb();
  const app = require('../src/app');
  await new Promise((resolve) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); }); });

  await db.prepare('CREATE TABLE di_share_pub (category TEXT, sales REAL)').run();
  await db.prepare('INSERT INTO di_share_pub (category, sales) VALUES (?, ?), (?, ?)').run('A', 10, 'B', 20);
  const ds = await db.prepare('INSERT INTO datasets (name, original_file, row_count, column_count, table_name, owner_id) VALUES (?, ?, ?, ?, ?, ?)').run('公开展示', 'x', 2, 2, 'di_share_pub', 1);
  const dsId = Number(ds.lastInsertRowid);
  await db.prepare('INSERT INTO dataset_fields (dataset_id, name, label, type, position) VALUES (?, ?, ?, ?, ?)').run(dsId, 'category', '类别', 'string', 0);
  await db.prepare('INSERT INTO dataset_fields (dataset_id, name, label, type, position) VALUES (?, ?, ?, ?, ?)').run(dsId, 'sales', '销售额', 'number', 1);
  const chart = await chartService.createChart({
    name: '柱状图', chartType: 'bar', datasetId: dsId,
    config: { dimensions: [{ field: 'category', label: '类别' }], metrics: [{ field: 'sales', agg: 'sum', label: '销售额' }], options: {} },
  }, 1);
  chartId = chart.id;
  const dash = await dashboardService.createDashboard('公开看板', 1);
  dashId = dash.id;
  await dashboardService.updateDashboard(dash.id, {
    layout: [{ id: 'c1', type: 'chart', chartId: chart.id, w: 6, h: 2, hPx: 300, col: 1, top: 0 }],
  });
  const s = await shareService.createShare({ dashboardId: dash.id, password: 'pass1234', expiresAt: null, userId: 1 });
  token = s.token;
});

async function api(path, { method = 'POST', auth, body } = {}) {
  const headers = {};
  if (auth) headers.Authorization = `Bearer ${auth}`;
  const opts = { method, headers };
  if (body !== undefined && !['GET', 'HEAD'].includes(method)) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(base + path, opts);
  return { status: res.status, json: await res.json().catch(() => null) };
}

test('meta 无需凭证返回看板名与状态', async () => {
  const r = await api(`/api/public/shares/${token}/meta`, { method: 'GET' });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.found, true);
  assert.equal(r.json.data.dashboardName, '公开看板');
  const miss = await api('/api/public/shares/notexist/meta', { method: 'GET' });
  assert.equal(miss.json.data.found, false);
});

test('verify 密码错误 401 / 正确签发 share JWT', async () => {
  const wrong = await api(`/api/public/shares/${token}/verify`, { body: { password: 'wrong1' } });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.json.code, 40101);

  const okR = await api(`/api/public/shares/${token}/verify`, { body: { password: 'pass1234' } });
  assert.equal(okR.status, 200);
  assert.ok(okR.json.data.accessToken);
  global.__shareJwt = okR.json.data.accessToken;
});

test('无 share JWT 访问 dashboard 被拒 401', async () => {
  const r = await api(`/api/public/shares/${token}/dashboard`, { method: 'GET' });
  assert.equal(r.status, 401);
});

test('dashboard 载荷含图表元信息、不含敏感字段', async () => {
  const r = await api(`/api/public/shares/${token}/dashboard`, { method: 'GET', auth: global.__shareJwt });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.name, '公开看板');
  assert.equal(r.json.data.charts.length, 1);
  assert.equal(r.json.data.charts[0].chartType, 'bar');
  const raw = JSON.stringify(r.json.data);
  assert.equal(raw.includes('password_hash'), false);
  assert.equal(raw.includes('data_sources'), false);
});

test('chart data 正常返回且越权 404', async () => {
  const r = await api(`/api/public/shares/${token}/charts/${chartId}/data`, { method: 'POST', auth: global.__shareJwt, body: { filters: [] } });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.data.rows.length, 2);

  const bad = await api(`/api/public/shares/${token}/charts/99999/data`, { method: 'POST', auth: global.__shareJwt, body: { filters: [] } });
  assert.equal(bad.status, 404);
});

test('share JWT 与 token 不匹配被拒', async () => {
  const other = await shareService.createShare({ dashboardId: dashId, password: 'pass1234', expiresAt: null, userId: 1 });
  const r1 = await api(`/api/public/shares/${other.token}/dashboard`, { method: 'GET', auth: global.__shareJwt });
  assert.equal(r1.status, 401);
  await shareService.deleteShare(other.id);
});

test('过期分享 verify 失败 40301', async () => {
  const s = await shareService.createShare({ dashboardId: dashId, password: 'pass1234', expiresAt: null, userId: 1 });
  await db.prepare("UPDATE dashboard_shares SET expires_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run(s.id);
  const r = await api(`/api/public/shares/${s.token}/verify`, { body: { password: 'pass1234' } });
  assert.equal(r.status, 403);
  assert.equal(r.json.code, 40301);
  await shareService.deleteShare(s.id);
});

test('停用分享 verify 失败 40302', async () => {
  const s = await shareService.createShare({ dashboardId: dashId, password: 'pass1234', expiresAt: null, userId: 1 });
  await db.prepare('UPDATE dashboard_shares SET is_active = 0 WHERE id = ?').run(s.id);
  const r = await api(`/api/public/shares/${s.token}/verify`, { body: { password: 'pass1234' } });
  assert.equal(r.status, 403);
  assert.equal(r.json.code, 40302);
  await shareService.deleteShare(s.id);
});

test('verify 频繁尝试被限流 429', async () => {
  const s = await shareService.createShare({ dashboardId: dashId, password: 'pass1234', expiresAt: null, userId: 1 });
  let last = 0;
  for (let i = 0; i < 12; i += 1) {
    const r = await api(`/api/public/shares/${s.token}/verify`, { body: { password: 'nope' } });
    last = r.status;
  }
  assert.equal(last, 429);
  await shareService.deleteShare(s.id);
});

test('无密码分享：meta 标记免密，verify 无需密码直接签发', async () => {
  const s = await shareService.createShare({ dashboardId: dashId, password: null, expiresAt: null, userId: 1 });
  const m = await api(`/api/public/shares/${s.token}/meta`, { method: 'GET' });
  assert.equal(m.status, 200);
  assert.equal(m.json.data.found, true);
  assert.equal(m.json.data.requiresPassword, false);

  const r = await api(`/api/public/shares/${s.token}/verify`, { body: {} });
  assert.equal(r.status, 200);
  assert.ok(r.json.data.accessToken);

  const dash = await api(`/api/public/shares/${s.token}/dashboard`, { method: 'GET', auth: r.json.data.accessToken });
  assert.equal(dash.status, 200);
  assert.equal(dash.json.data.name, '公开看板');
  await shareService.deleteShare(s.id);
});

test('清理', async () => {
  await new Promise((r) => server.close(r));
});