// 首行设置 DB_PATH（先于 src 加载）
process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDb } = require('./helpers/db');
const app = require('../src/app');
const authService = require('../src/services/auth.service');
const jwtUtil = require('../src/utils/jwt');
const rbac = require('../src/services/rbac.service');

let server; let base;
before(async () => {
  await resetDb();
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

test('未带 token 访问 /api/admin/users 返回 401', async () => {
  const res = await fetch(`${base}/api/admin/users`, { headers: { 'content-type': 'application/json' } });
  assert.equal(res.status, 401);
});

test('无权限用户访问 /api/admin/users 返回 403', async () => {
  const u = await authService.register({ email: 'plain@x.com', password: 'Password123!', name: 'Plain' });
  const token = jwtUtil.signAccess({ sub: u.id });
  const res = await fetch(`${base}/api/admin/users`, { headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  assert.equal(res.status, 403);
});

test('管理员可创建用户并分配角色', async () => {
  const editor = db.prepare("SELECT id FROM roles WHERE code = 'editor'").get();
  const admin = await authService.login('admin@kanray.local', 'admin123');
  const res = await fetch(`${base}/api/admin/users`, {
    method: 'POST',
    headers: { authorization: `Bearer ${admin.accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'newuser@x.com', password: 'Password123!', name: 'New', roleIds: [editor.id] }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.code, 0);
  assert.ok(body.data.roles.includes('editor'));
});

test('管理员可创建自定义角色', async () => {
  const admin = await authService.login('admin@kanray.local', 'admin123');
  const res = await fetch(`${base}/api/admin/roles`, {
    method: 'POST',
    headers: { authorization: `Bearer ${admin.accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ code: 'finance', name: '财务', permissions: ['dashboard:read', 'chart:read'] }),
  });
  assert.equal(res.status, 200);
});

test('列表 GET /api/admin/roles 返回 permissions 数组', async () => {
  const admin = await authService.login('admin@kanray.local', 'admin123');
  const res = await fetch(`${base}/api/admin/roles`, { headers: { authorization: `Bearer ${admin.accessToken}` } });
  const body = await res.json();
  assert.equal(body.code, 0);
  assert.ok(body.data.length >= 4);
  assert.ok(Array.isArray(body.data[0].permissions));
});

test('PATCH /api/admin/users/:id 禁用后 login 403', async () => {
  const admin = await authService.login('admin@kanray.local', 'admin123');
  const u = await authService.register({ email: 'dis@x.com', password: 'Password123!', name: 'D' });
  const res = await fetch(`${base}/api/admin/users/${u.id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${admin.accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ is_active: false }),
  });
  assert.equal(res.status, 200);
  await assert.rejects(authService.login('dis@x.com', 'Password123!'), /已禁用/);
});

test('管理员可查看用户列表 GET /api/admin/users', async () => {
  const admin = await authService.login('admin@kanray.local', 'admin123');
  const res = await fetch(`${base}/api/admin/users?page=1&pageSize=5`, { headers: { authorization: `Bearer ${admin.accessToken}` } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.code, 0);
  assert.ok(Array.isArray(body.data.list));
  assert.ok(body.data.total >= 1);
});

test('PATCH /api/admin/users/:id 改名与调整角色', async () => {
  const admin = await authService.login('admin@kanray.local', 'admin123');
  const u = await authService.register({ email: 'ren@x.com', password: 'Password123!', name: 'Old' });
  const editor = db.prepare("SELECT id FROM roles WHERE code = 'editor'").get();
  const res = await fetch(`${base}/api/admin/users/${u.id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${admin.accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'NewName', roleIds: [editor.id] }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.code, 0);
  assert.equal(body.data.name, 'NewName');
  assert.ok(body.data.roles.includes('editor'));
});

test('PATCH /api/admin/users/:id 重置密码后原密码登录失败', async () => {
  const admin = await authService.login('admin@kanray.local', 'admin123');
  const u = await authService.register({ email: 'pw@x.com', password: 'Password123!', name: 'P' });
  const res = await fetch(`${base}/api/admin/users/${u.id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${admin.accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'NewPass123!' }),
  });
  assert.equal(res.status, 200);
  await assert.rejects(authService.login('pw@x.com', 'Password123!'), /失败|错误|不正确/);
  const again = await authService.login('pw@x.com', 'NewPass123!');
  assert.ok(again.accessToken);
});

test('DELETE /api/admin/users/:id 禁止删除当前登录账号', async () => {
  const admin = await authService.login('admin@kanray.local', 'admin123');
  const adminRow = db.prepare("SELECT id FROM users WHERE email = 'admin@kanray.local'").get();
  const res = await fetch(`${base}/api/admin/users/${adminRow.id}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${admin.accessToken}` },
  });
  assert.equal(res.status, 400);
});

test('管理员可删除普通用户', async () => {
  const admin = await authService.login('admin@kanray.local', 'admin123');
  const u = await authService.register({ email: 'del@x.com', password: 'Password123!', name: 'Del' });
  const res = await fetch(`${base}/api/admin/users/${u.id}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${admin.accessToken}` },
  });
  assert.equal(res.status, 200);
  await assert.rejects(authService.login('del@x.com', 'Password123!'), /失败|错误|不正确|不存在|禁用/);
});

test('PATCH /api/admin/roles/:id 更新角色', async () => {
  const admin = await authService.login('admin@kanray.local', 'admin123');
  const role = await rbac.createRole('tmp' + Date.now(), '临时', ['dashboard:read']);
  const res = await fetch(`${base}/api/admin/roles/${role.id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${admin.accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name: '临时改', permissions: ['dashboard:read', 'chart:read'] }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.code, 0);
  assert.equal(body.data.name, '临时改');
  assert.deepEqual([...body.data.permissions].sort(), ['chart:read', 'dashboard:read']);
});

test('DELETE /api/admin/roles/:id 删除自定义角色', async () => {
  const admin = await authService.login('admin@kanray.local', 'admin123');
  const role = await rbac.createRole('tmpdel' + Date.now(), '待删', ['chart:read']);
  const res = await fetch(`${base}/api/admin/roles/${role.id}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${admin.accessToken}` },
  });
  assert.equal(res.status, 200);
  const roles = (await rbac.listRoles()).filter((r) => r.id === role.id);
  assert.equal(roles.length, 0);
});

test('GET /api/admin/audit 返回审计列表', async () => {
  const admin = await authService.login('admin@kanray.local', 'admin123');
  const res = await fetch(`${base}/api/admin/audit?page=1&pageSize=20`, { headers: { authorization: `Bearer ${admin.accessToken}` } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.code, 0);
  assert.ok(Array.isArray(body.data.list));
  assert.ok(body.data.total >= 1);
});

test('关闭临时 HTTP 服务', () => {
  server?.close();
});