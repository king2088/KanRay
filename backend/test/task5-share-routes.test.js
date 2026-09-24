process.env.DB_PATH = `/tmp/kanban-test-shares-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDb, adminId, uuidv7 } = require('./helpers/db');
const authService = require('../src/services/auth.service');
const chartService = require('../src/services/chart.service');
const dashboardService = require('../src/services/dashboard.service');

let server; let base;

test('启动临时服务并准备数据', async () => {
  await resetDb();
  const app = require('../src/app');
  await new Promise((resolve) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); }); });

  await db.prepare('CREATE TABLE di_share_route (category TEXT, sales REAL)').run();
  await db.prepare('INSERT INTO di_share_route (category, sales) VALUES (?, ?)').run('A', 10);
  const dsId = uuidv7();
  await db.prepare('INSERT INTO datasets (id, name, original_file, row_count, column_count, table_name, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(dsId, '路由测试', 'x', 1, 2, 'di_share_route', adminId());
  await db.prepare('INSERT INTO dataset_fields (id, dataset_id, name, label, type, position) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv7(), dsId, 'category', '类别', 'string', 0);
  await db.prepare('INSERT INTO dataset_fields (id, dataset_id, name, label, type, position) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv7(), dsId, 'sales', '销售额', 'number', 1);
  const chart = await chartService.createChart({
    name: '柱状图', chartType: 'bar', datasetId: dsId,
    config: { dimensions: [{ field: 'category', label: '类别' }], metrics: [{ field: 'sales', agg: 'sum', label: '销售额' }], options: {} },
  }, adminId());
  const layout = [{ id: 'c1', type: 'chart', chartId: chart.id, w: 6, h: 2, hPx: 300, col: 1, top: 0 }];
  const dash = await dashboardService.createDashboard('分享看板', adminId());
  await dashboardService.updateDashboard(dash.id, { layout });
  global.__dashId = dash.id;
});

async function api(path, { method = 'POST', token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const opts = { method, headers };
  if (body !== undefined && !['GET', 'HEAD'].includes(method)) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(base + path, opts);
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function login(email, password) {
  const r = await api('/api/auth/login', { body: { email, password } });
  return r.json?.data?.accessToken;
}

test('viewer 无 dashboard:share 权限被拒', async () => {
  await authService.register({ email: 'viewer@t.com', password: 'pass1234', name: '观众' });
  const token = await login('viewer@t.com', 'pass1234');
  const r = await api(`/api/dashboards/${global.__dashId}/shares`, { method: 'POST', token, body: { password: 'pass1234' } });
  assert.equal(r.status, 403);
});

test('analyst 非 owner 创建他人分享被拒', async () => {
  const token = await login('admin@kanray.local', 'admin123');
  const r = await api(`/api/dashboards/${global.__dashId}/shares`, { method: 'POST', token, body: { password: 'pass1234' } });
  assert.equal(r.status, 200);
  assert.ok(r.json.data.token);
  global.__shareId = r.json.data.id;

  const u = await authService.register({ email: 'analyst@t.com', password: 'pass1234', name: '分析师' });
  await db.prepare('INSERT INTO user_roles SELECT ?, id FROM roles WHERE code = ?').run(u.id, 'analyst');
  const t2 = await login('analyst@t.com', 'pass1234');
  const r2 = await api(`/api/dashboards/9999/shares`, { method: 'POST', token: t2, body: { password: 'pass1234' } });
  assert.equal(r2.status, 404); // 不存在看板
  const r3 = await api(`/api/dashboards/${global.__dashId}/shares`, { method: 'POST', token: t2, body: { password: 'pass1234' } });
  assert.equal(r3.status, 403); // 非 owner
});

test('list/patch/delete 分享', async () => {
  const token = await login('admin@kanray.local', 'admin123');
  const list = await api(`/api/dashboards/${global.__dashId}/shares`, { method: 'GET', token });
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.json.data));

  const bad = await api(`/api/dashboards/${global.__dashId}/shares`, { method: 'POST', token, body: { password: '12' } });
  assert.equal(bad.status, 400);

  const patched = await api(`/api/shares/${global.__shareId}`, { method: 'PATCH', token, body: { expiresAt: '2099-01-01T00:00:00.000Z', isActive: false } });
  assert.equal(patched.status, 200);
  assert.equal(patched.json.data.isActive, 0);

  const del = await api(`/api/shares/${global.__shareId}`, { method: 'DELETE', token });
  assert.equal(del.status, 200);
});

test('无密码分享可创建/加密码/移除密码', async () => {
  const token = await login('admin@kanray.local', 'admin123');
  const open = await api(`/api/dashboards/${global.__dashId}/shares`, { method: 'POST', token, body: { password: null } });
  assert.equal(open.status, 200);
  assert.equal(open.json.data.hasPassword, false);

  const secured = await api(`/api/shares/${open.json.data.id}`, { method: 'PATCH', token, body: { password: 'newpass1' } });
  assert.equal(secured.status, 200);
  assert.equal(secured.json.data.hasPassword, true);

  const opened = await api(`/api/shares/${open.json.data.id}`, { method: 'PATCH', token, body: { password: null } });
  assert.equal(opened.status, 200);
  assert.equal(opened.json.data.hasPassword, false);

  await api(`/api/shares/${open.json.data.id}`, { method: 'DELETE', token });
});

test('清理', async () => {
  await new Promise((r) => server.close(r));
});