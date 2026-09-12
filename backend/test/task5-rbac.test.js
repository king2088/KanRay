// 首行设置 DB_PATH
process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDb } = require('./helpers/db');
const rbac = require('../src/services/rbac.service');
const access = require('../src/services/access.service');
const authService = require('../src/services/auth.service');

test('permissionsOf：admin 含所有权限点', () => {
  resetDb();
  const admin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@kanban.local');
  const perms = rbac.permissionsOf(admin.id);
  assert.ok(perms.includes('dashboard:delete'));
  assert.ok(perms.includes('user:read'));
});

test('permissionsOf：viewer 只读', () => {
  resetDb();
  const u = authService.register({ email: 'v@x.com', password: 'Password123!', name: 'V' });
  const perms = rbac.permissionsOf(u.id);
  assert.ok(perms.includes('dashboard:read') && !perms.includes('dashboard:update'));
  assert.ok(!perms.includes('user:read'));
});

test('hasPermission 受角色影响', () => {
  resetDb();
  const u = authService.register({ email: 'e@x.com', password: 'Password123!', name: 'E' });
  assert.equal(rbac.hasPermission(u.id, 'dashboard', 'update'), false);
  const r = db.prepare("SELECT id FROM roles WHERE code = 'editor'").get();
  db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(u.id, r.id);
  assert.equal(rbac.hasPermission(u.id, 'dashboard', 'update'), true);
});

test('access.assertResource：管理员可访问他人资源，非管理员只可访问自己资源', () => {
  resetDb();
  const admin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@kanban.local');
  const u1 = authService.register({ email: 'u1@x.com', password: 'Password123!', name: 'U1' });
  const u2 = authService.register({ email: 'u2@x.com', password: 'Password123!', name: 'U2' });
  db.exec(`INSERT INTO dashboards (name, layout, owner_id) VALUES ('d1','[]',${u1.id})`);
  access.assertResource('dashboard', 1, { id: admin.id, roles: [] }, rbac);
  access.assertResource('dashboard', 1, { id: u1.id, roles: [] }, rbac);
  assert.throws(() => access.assertResource('dashboard', 1, { id: u2.id, roles: [] }, rbac), /无权访问/);
});

test('scopedWhere：admin 无过滤，其余加 owner_id', () => {
  resetDb();
  const admin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@kanban.local');
  assert.equal(access.scopedWhere('dashboards', { id: admin.id }, rbac), '');
  const u = authService.register({ email: 's@x.com', password: 'Password123!', name: 'S' });
  const w = access.scopedWhere('dashboards', { id: u.id }, rbac);
  assert.match(w, /owner_id\s*=\s*\d+/);
});

test('rbac.createRole / updateRole / deleteRole 基本流程', () => {
  resetDb();
  const r = rbac.createRole('ops', '运维', ['dashboard:read', 'chart:read']);
  assert.ok(r.id);
  const saved = rbac.listRoles().find((x) => x.code === 'ops');
  assert.deepEqual([...saved.permissions].sort(), ['chart:read', 'dashboard:read']);
  rbac.updateRole(r.id, { name: '运维改', permissions: ['chart:read'] });
  const upd = rbac.listRoles().find((x) => x.code === 'ops');
  assert.deepEqual([...upd.permissions], ['chart:read']);
  rbac.deleteRole(r.id);
  assert.equal(rbac.listRoles().find((x) => x.code === 'ops'), undefined);
});

test('rbac.deleteRole 拒绝删除内置角色', () => {
  resetDb();
  const admin = db.prepare("SELECT id FROM roles WHERE code = 'admin'").get();
  assert.throws(() => rbac.deleteRole(admin.id), /内置角色/);
});

test('listUsers 附带角色 codes', () => {
  resetDb();
  authService.register({ email: 'list@x.com', password: 'Password123!', name: 'L' });
  const r = rbac.listUsers({ page: 1, pageSize: 20 });
  assert.equal(r.total >= 2, true);
  const me = r.list.find((x) => x.email === 'list@x.com');
  assert.ok(Array.isArray(me.roles) && me.roles.some((x) => x === 'viewer'));
});

test('assignRoles 替换用户角色', () => {
  resetDb();
  const u = authService.register({ email: 'as@x.com', password: 'Password123!', name: 'AS' });
  const editor = db.prepare("SELECT id FROM roles WHERE code = 'editor'").get();
  rbac.assignRoles(u.id, [editor.id]);
  const perms = rbac.permissionsOf(u.id);
  assert.ok(perms.includes('dashboard:update'));
});

test('createUser（管理员建号）支持指定角色', () => {
  resetDb();
  const editor = db.prepare("SELECT id FROM roles WHERE code = 'editor'").get();
  const u = rbac.createUser('op1@x.com', 'Password123!', 'Op1', [editor.id]);
  assert.ok(u.id);
  assert.deepEqual(rbac.rolesOf(u.id).map((x) => x.code), ['editor']);
});

test('setUserActive 启停', () => {
  resetDb();
  const u = authService.register({ email: 'tog@x.com', password: 'Password123!', name: 'T' });
  rbac.setUserActive(u.id, false);
  assert.equal(db.prepare('SELECT is_active FROM users WHERE id = ?').get(u.id).is_active, 0);
});