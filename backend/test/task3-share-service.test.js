process.env.DB_PATH = `/tmp/kanban-test-share-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDb, adminId, uuidv7 } = require('./helpers/db');
const shareService = require('../src/services/share.service');

let dashId; let dsId; let chartId;

test('service 准备物料', async () => {
  await resetDb();
  dashId = uuidv7();
  await db.prepare('INSERT INTO dashboards (id, name, layout, owner_id) VALUES (?, ?, ?, ?)').run(dashId, '分享看板', '[]', adminId());
});

test('createShare 校验 password 长度与过期时间', async () => {
  await assert.rejects(() => shareService.createShare({ dashboardId: dashId, password: '12', expiresAt: null, userId: adminId() }), (e) => e.status === 400);
  await assert.rejects(() => shareService.createShare({ dashboardId: dashId, password: '1234', expiresAt: '2000-01-01T00:00:00.000Z', userId: adminId() }), (e) => e.status === 400);
});

test('createShare/listShares/updateShare/deleteShare 全链路', async () => {
  const s = await shareService.createShare({ dashboardId: dashId, password: 'pass1234', expiresAt: null, userId: adminId() });
  assert.ok(s.id);
  assert.equal(s.token.length, 22); // 16 字节 base64url
  assert.equal(s.passwordHash, undefined); // 管理视图不应含哈希
  assert.equal(s.isActive, 1);

  const list = await shareService.listShares(dashId);
  assert.equal(list.length, 1);
  assert.equal(list[0].passwordHash, undefined);

  const updated = await shareService.updateShare(s.id, { expiresAt: '2099-01-01T00:00:00.000Z', isActive: false });
  assert.equal(updated.isActive, 0);
  assert.equal(updated.expiresAt, '2099-01-01T00:00:00.000Z');

  const byToken = await shareService.getShareByToken(s.token);
  assert.equal(byToken.token, s.token);
  assert.ok(byToken.passwordHash);

  // shareState 判定
  assert.equal(shareService.shareState(byToken), 'inactive');
  await shareService.updateShare(s.id, { isActive: true });
  const active = await shareService.getShareByToken(s.token);
  assert.equal(shareService.shareState(active), 'active');

  await shareService.deleteShare(s.id);
  assert.equal((await shareService.listShares(dashId)).length, 0);
});

test('getDashboardRenderView 返回布局与图表元信息且不含敏感字段', async () => {
  await db.prepare('CREATE TABLE di_share_demo (category TEXT, sales REAL)').run();
  await db.prepare('INSERT INTO di_share_demo (category, sales) VALUES (?, ?)').run('A', 10);
  dsId = uuidv7();
  await db.prepare('INSERT INTO datasets (id, name, original_file, row_count, column_count, table_name, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(dsId, '演示', 'x', 1, 2, 'di_share_demo', adminId());
  await db.prepare('INSERT INTO dataset_fields (id, dataset_id, name, label, type, position) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv7(), dsId, 'category', '类别', 'string', 0);
  await db.prepare('INSERT INTO dataset_fields (id, dataset_id, name, label, type, position) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv7(), dsId, 'sales', '销售额', 'number', 1);
  const cfg = JSON.stringify({ dimensions: [{ field: 'category', label: '类别' }], metrics: [{ field: 'sales', agg: 'sum', label: '销售额' }] });
  chartId = uuidv7();
  await db.prepare('INSERT INTO charts (id, name, dataset_id, chart_type, config, owner_id) VALUES (?, ?, ?, ?, ?, ?)').run(chartId, '柱状图', dsId, 'bar', cfg, adminId());
  const layout = JSON.stringify([{ id: 'c1', type: 'chart', chartId, w: 6, h: 2, hPx: 300, col: 1, top: 0 }]);
  await db.prepare('UPDATE dashboards SET layout = ? WHERE id = ?').run(layout, dashId);

  const s = await shareService.createShare({ dashboardId: dashId, password: 'pass1234', expiresAt: null, userId: adminId() });
  const view = await shareService.getDashboardRenderView(dashId);
  assert.equal(view.name, '分享看板');
  assert.equal(view.charts.length, 1);
  assert.equal(view.charts[0].config.metrics[0].field, 'sales');
  const raw = JSON.stringify(view);
  assert.equal(raw.includes('password_hash'), false);
  assert.equal(raw.includes('data_sources'), false);

  const data = await shareService.getChartData({ dashboardId: dashId, token: s.token }, chartId);
  assert.equal(data.rows.length, 1);
  assert.deepEqual(data.rows[0]['metric:sales'].value, 10);

  // chart 不在布局中 -> 404
  await assert.rejects(() => shareService.getChartData({ dashboardId: dashId, token: s.token }, 99999), (e) => e.status === 404);
});