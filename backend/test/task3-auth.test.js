// 首行设置 DB_PATH（先于 src 加载）
process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDb } = require('./helpers/db');
const authService = require('../src/services/auth.service');
const { hashToken } = require('../src/services/auth.service');

test('register：成功注册默认 viewer 角色，密码为 bcrypt', async () => {
  await resetDb();
  const u = await authService.register({ email: 'alice@x.com', password: 'Password123!', name: 'Alice' });
  assert.equal(u.email, 'alice@x.com');
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(u.id);
  const bcrypt = require('bcryptjs');
  assert.ok(bcrypt.compareSync('Password123!', row.password_hash));
  const roles = db.prepare('SELECT code FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ?').all(u.id);
  assert.ok(roles.some((x) => x.code === 'viewer'));
});

test('register：重复邮箱抛 409', async () => {
  await resetDb();
  await authService.register({ email: 'dup@x.com', password: 'Password123!', name: 'A' });
  await assert.rejects(authService.register({ email: 'dup@x.com', password: 'Password123!', name: 'B' }), /已存在/);
});

test('register：弱密码抛 400', async () => {
  await resetDb();
  await assert.rejects(authService.register({ email: 'w@x.com', password: '123', name: 'W' }), /至少 8 位/);
});

test('login：密码错误抛 401；正确返回双令牌', async () => {
  await resetDb();
  await authService.register({ email: 'bob@x.com', password: 'Password123!', name: 'Bob' });
  await assert.rejects(authService.login('bob@x.com', 'wrong'), /邮箱或密码不正确/);
  const r = await authService.login('bob@x.com', 'Password123!');
  assert.ok(r.accessToken && r.refreshToken);
  assert.ok(r.user.id);
  assert.ok(Array.isArray(r.user.roles) && r.user.roles.length > 0);
});

test('login：禁用用户抛 403', async () => {
  await resetDb();
  const u = await authService.register({ email: 'off@x.com', password: 'Password123!', name: 'Off' });
  db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(u.id);
  await assert.rejects(authService.login('off@x.com', 'Password123!'), /已禁用/);
});

test('refresh：轮换令牌，旧令牌一次有效', async () => {
  await resetDb();
  await authService.register({ email: 'r@x.com', password: 'Password123!', name: 'R' });
  const { refreshToken } = await authService.login('r@x.com', 'Password123!');
  const first = await authService.refresh(refreshToken);
  assert.ok(first.accessToken);
  await assert.rejects(authService.refresh(refreshToken), /无效/);
  const second = await authService.refresh(first.refreshToken);
  assert.ok(second.accessToken);
});

test('logout：吊销该用户全部刷新令牌', async () => {
  await resetDb();
  await authService.register({ email: 'l@x.com', password: 'Password123!', name: 'L' });
  const { refreshToken } = await authService.login('l@x.com', 'Password123!');
  await authService.logout({ sub: require('../src/utils/jwt').verifyRefresh(refreshToken).sub });
  await assert.rejects(authService.refresh(refreshToken), /无效/);
});

test('changePassword：旧密码校验、新密码生效、刷新令牌全部吊销', async () => {
  await resetDb();
  const u = await authService.register({ email: 'cp@x.com', password: 'Password123!', name: 'CP' });
  const { refreshToken } = await authService.login('cp@x.com', 'Password123!');
  await assert.rejects(authService.changePassword(u.id, 'Password123!', 'x'), /至少 8 位/);
  await authService.changePassword(u.id, 'Password123!', 'NewPass456!');
  assert.ok((await authService.login('cp@x.com', 'NewPass456!')).accessToken);
  await assert.rejects(authService.refresh(refreshToken), /无效/);
});

test('updateProfile：改名与基础资料', async () => {
  await resetDb();
  const u = await authService.register({ email: 'prof@x.com', password: 'Password123!', name: 'P' });
  const upd = await authService.updateProfile(u.id, { name: 'Profile New' });
  assert.equal(upd.name, 'Profile New');
  assert.equal(upd.email, 'prof@x.com');
});

test('hashToken 做 SHA-256', () => {
  const d = hashToken('abc');
  assert.match(d, /^[a-f0-9]{64}$/);
});