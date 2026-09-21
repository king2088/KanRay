// 首行设置 DB_PATH（先于 src 加载）
process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDb } = require('./helpers/db');
const authService = require('../src/services/auth.service');

test('admin 登录返回全部权限', async () => {
  await resetDb();
  const r = await authService.login('admin@kanray.local', 'admin123');
  assert.ok(Array.isArray(r.user.permissions));
  assert.equal(r.user.permissions.length, 29);
  assert.ok(r.user.permissions.includes('dataset:create'));
  assert.ok(r.user.permissions.includes('user:read'));
  assert.ok(r.user.permissions.includes('audit:read'));
});

test('默认 viewer 仅返回播放权限', async () => {
  await resetDb();
  const u = await authService.register({ email: 'v@x.com', password: 'Password123!', name: 'V' });
  assert.ok(u.permissions.includes('dataset:read'));
  assert.equal(u.permissions.includes('dataset:create'), false);
});

test('userWithRoles 返回 permissions', async () => {
  await resetDb();
  const adminRow = db.prepare("SELECT id FROM users WHERE email = 'admin@kanray.local'").get();
  const u = await authService.userWithRoles(adminRow.id);
  assert.equal(u.permissions.length, 29);
});