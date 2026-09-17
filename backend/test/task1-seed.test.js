// 首行设置 DB_PATH（node:test 每文件独立进程）
process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db, seed, resetDb } = require('./helpers/db');

test('seeds 内置权限点', async () => {
  await resetDb();
  const rows = db.prepare('SELECT code FROM permissions ORDER BY id').all();
  const codes = rows.map((r) => r.code);
  for (const c of ['dataset:read', 'chart:create', 'dashboard:delete', 'user:read', 'role:update', 'sqllab:execute']) {
    assert.ok(codes.includes(c), `缺少权限点 ${c}`);
  }
});

test('seeds 四个内置角色且 admin 拥有全部权限', async () => {
  await resetDb();
  const roles = db.prepare('SELECT code, is_builtin FROM roles').all();
  const codes = roles.map((r) => r.code);
  for (const c of ['admin', 'analyst', 'editor', 'viewer']) assert.ok(codes.includes(c), `缺少角色 ${c}`);
  const admin = db.prepare('SELECT id FROM roles WHERE code = ?').get('admin');
  const count = db.prepare('SELECT COUNT(*) n FROM role_permissions rp WHERE rp.role_id = ?').get(admin.id).n;
  const total = db.prepare('SELECT COUNT(*) n FROM permissions').get().n;
  assert.equal(count, total);
});

test('seeds 默认管理员：bcrypt 密码可校验', async () => {
  await resetDb();
  const admin = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@kanban.local');
  assert.ok(admin, '缺少默认管理员');
  const bcrypt = require('bcryptjs');
  assert.ok(bcrypt.compareSync('admin123', admin.password_hash));
  const r = db.prepare(`SELECT code FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ?`).all(admin.id);
  assert.ok(r.some((x) => x.code === 'admin'));
});

test('既有数据集/图表/看板回填 owner_id 为管理员', async () => {
  await resetDb();
  const admin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@kanban.local');
  db.exec("INSERT INTO datasets (name, original_file, row_count, column_count, table_name, owner_id) VALUES ('a','a.xlsx',1,1,'ds_x', NULL)");
  db.exec("INSERT INTO charts (name, dataset_id, chart_type, config) VALUES ('c', 1, 'bar', '{}')");
  db.exec("INSERT INTO dashboards (name, layout) VALUES ('d', '[]')");
  await seed();
  assert.equal(db.prepare('SELECT owner_id FROM datasets WHERE id = 1').get().owner_id, admin.id);
  assert.equal(db.prepare('SELECT owner_id FROM charts WHERE id = 1').get().owner_id, admin.id);
  assert.equal(db.prepare('SELECT owner_id FROM dashboards WHERE id = 1').get().owner_id, admin.id);
});

test('seeds 幂等：连续 seed() 不重复写入', async () => {
  await resetDb();
  await seed();
  const perms = db.prepare('SELECT COUNT(*) n FROM permissions').get().n;
  const roles = db.prepare('SELECT COUNT(*) n FROM roles').get().n;
  const users = db.prepare('SELECT COUNT(*) n FROM users WHERE email = ?').get('admin@kanban.local').n;
  assert.equal(perms, 29, '权限点应保持 29 个');
  assert.equal(roles, 4, '角色应保持 4 个');
  assert.equal(users, 1, '默认管理员应恰好存在一次');
});
