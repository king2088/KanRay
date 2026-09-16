process.env.DB_PATH = `/tmp/kanban-test-share-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDb } = require('./helpers/db');
const shareService = require('../src/services/share.service');

test('service 准备物料', async () => {
  await resetDb();
  await db.prepare('INSERT INTO dashboards (name, layout, owner_id) VALUES (?, ?, ?)').run('分享看板', '[]', 1);
});

test('createShare 校验 password 长度与过期时间', async () => {
  await assert.rejects(() => shareService.createShare({ dashboardId: 1, password: '12', expiresAt: null, userId: 1 }), (e) => e.status === 400);
  await assert.rejects(() => shareService.createShare({ dashboardId: 1, password: '1234', expiresAt: '2000-01-01T00:00:00.000Z', userId: 1 }), (e) => e.status === 400);
});

test('createShare/listShares/updateShare/deleteShare 全链路', async () => {
  const s = await shareService.createShare({ dashboardId: 1, password: 'pass1234', expiresAt: null, userId: 1 });
  assert.ok(s.id > 0);
  assert.equal(s.token.length, 22); // 16 字节 base64url
  assert.equal(s.passwordHash, undefined); // 管理视图不应含哈希
  assert.equal(s.isActive, 1);

  const list = await shareService.listShares(1);
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
  assert.equal((await shareService.listShares(1)).length, 0);
});

test('getDashboardRenderView 返回布局与图表元信息且不含敏感字段', async () => {
  await db.prepare('CREATE TABLE di_share_demo (category TEXT, sales REAL)').run();
  await db.prepare('INSERT INTO di_share_demo (category, sales) VALUES (?, ?)').run('A', 10);
  const ds = await db.prepare('INSERT INTO datasets (name, original_file, row_count, column_count, table_name, owner_id) VALUES (?, ?, ?, ?, ?, ?)').run('演示', 'x', 1, 2, 'di_share_demo', 1);
  const dsId = Number(ds.lastInsertRowid);
  await db.prepare('INSERT INTO dataset_fields (dataset_id, name, label, type, position) VALUES (?, ?, ?, ?, ?)').run(dsId, 'category', '类别', 'string', 0);
  await db.prepare('INSERT INTO dataset_fields (dataset_id, name, label, type, position) VALUES (?, ?, ?, ?, ?)').run(dsId, 'sales', '销售额', 'number', 1);
  const cfg = JSON.stringify({ dimensions: [{ field: 'category', label: '类别' }], metrics: [{ field: 'sales', agg: 'sum', label: '销售额' }] });
  const ch = await db.prepare('INSERT INTO charts (name, dataset_id, chart_type, config, owner_id) VALUES (?, ?, ?, ?, ?)').run('柱状图', dsId, 'bar', cfg, 1);
  const chartId = Number(ch.lastInsertRowid);
  const layout = JSON.stringify([{ id: 'c1', type: 'chart', chartId, w: 6, h: 2, hPx: 300, col: 1, top: 0 }]);
  await db.prepare('UPDATE dashboards SET layout = ? WHERE id = 1').run(layout);

  const s = await shareService.createShare({ dashboardId: 1, password: 'pass1234', expiresAt: null, userId: 1 });
  const view = await shareService.getDashboardRenderView(1);
  assert.equal(view.name, '分享看板');
  assert.equal(view.charts.length, 1);
  assert.equal(view.charts[0].config.metrics[0].field, 'sales');
  const raw = JSON.stringify(view);
  assert.equal(raw.includes('password_hash'), false);
  assert.equal(raw.includes('data_sources'), false);

  const data = await shareService.getChartData({ dashboardId: 1, token: s.token }, chartId);
  assert.equal(data.rows.length, 1);
  assert.deepEqual(data.rows[0]['metric:sales'].value, 10);

  // chart 不在布局中 -> 404
  await assert.rejects(() => shareService.getChartData({ dashboardId: 1, token: s.token }, 99999), (e) => e.status === 404);
});