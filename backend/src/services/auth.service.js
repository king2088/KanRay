const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const HttpError = require('../utils/http-error');
const jwtUtil = require('../utils/jwt');
const { PERMISSIONS } = require('../seeds');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;

function assertStrongPassword(pw) {
  if (!PASSWORD_RULE.test(pw)) throw new HttpError(400, '密码至少 8 位且需同时包含字母和数字');
}

function publicUser(row) {
  return { id: row.id, email: row.email, name: row.name, is_active: !!row.is_active, created_at: row.created_at };
}

function rolesOf(userId) {
  return db.prepare(
    `SELECT r.code, r.name, r.is_builtin FROM roles r
     JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = ? ORDER BY r.id`
  ).all(userId);
}

function permissionsOf(userId) {
  const isAdmin = db.prepare(
    `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ? AND r.code = 'admin' LIMIT 1`
  ).get(userId);
  if (isAdmin) return PERMISSIONS.map((p) => p[0]);
  return db.prepare(
    `SELECT DISTINCT p.code FROM permissions p JOIN role_permissions rp ON rp.permission_id = p.id
     JOIN user_roles ur ON ur.role_id = rp.role_id WHERE ur.user_id = ? ORDER BY p.code`
  ).all(userId).map((r) => r.code);
}

function userWithRoles(userId) {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!row) throw new HttpError(404, '用户不存在');
  return { ...publicUser(row), roles: rolesOf(userId), permissions: permissionsOf(userId) };
}

function register({ email, password, name = '', roleCode }) {
  const mail = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new HttpError(400, '邮箱格式不正确');
  assertStrongPassword(password);
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(mail)) throw new HttpError(409, '该邮箱已存在');
  const hash = bcrypt.hashSync(password, 10);
  const r = db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)').run(mail, hash, String(name || '').slice(0, 50));
  const uid = Number(r.lastInsertRowid);
  const target = roleCode || 'viewer';
  const role = db.prepare('SELECT id FROM roles WHERE code = ?').get(target);
  if (role) db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(uid, role.id);
  return userWithRoles(uid);
}

function login(email, password) {
  const mail = String(email || '').trim().toLowerCase();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(mail);
  const fail = () => { throw new HttpError(401, '邮箱或密码不正确'); };
  if (!row) fail();
  if (!bcrypt.compareSync(String(password || ''), row.password_hash)) fail();
  if (!row.is_active) throw new HttpError(403, '账号已禁用');
  const issued = issueTokens(row.id);
  return { ...issued, user: userWithRoles(row.id) };
}

function issueTokens(userId) {
  const payload = { sub: userId };
  const accessToken = jwtUtil.signAccess(payload);
  const r = jwtUtil.signRefresh({ ...payload, type: 'refresh' });
  db.prepare('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
    .run(userId, hashToken(r.token), new Date(r.expiresAt).toISOString());
  return { accessToken, refreshToken: r.token };
}

function refresh(refreshToken) {
  let payload;
  try { payload = jwtUtil.verifyRefresh(refreshToken); } catch (e) { throw new HttpError(401, '刷新令牌无效'); }
  const userId = payload.sub;
  const hash = hashToken(refreshToken);
  const row = db.prepare('SELECT * FROM refresh_tokens WHERE user_id = ? AND token_hash = ?').get(userId, hash);
  if (!row || row.revoked_at || new Date(row.expires_at) < new Date()) throw new HttpError(401, '刷新令牌无效');
  db.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?').run(new Date().toISOString(), row.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user || !user.is_active) throw new HttpError(401, '账号不可用');
  return { ...issueTokens(userId), user: userWithRoles(userId) };
}

function logout(accessPayload) {
  const userId = accessPayload.sub;
  db.prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL")
    .run(new Date().toISOString(), userId);
  return true;
}

function changePassword(userId, oldPassword, newPassword) {
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
  if (!row) throw new HttpError(404, '用户不存在');
  if (!bcrypt.compareSync(String(oldPassword || ''), row.password_hash)) throw new HttpError(400, '原密码不正确');
  assertStrongPassword(newPassword);
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);
  logout({ sub: userId });
  return true;
}

function updateProfile(userId, { name }) {
  db.prepare("UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?").run(String(name || '').slice(0, 50), userId);
  return userWithRoles(userId);
}

module.exports = { register, login, refresh, logout, changePassword, updateProfile, userWithRoles, rolesOf, permissionsOf, hashToken, assertStrongPassword, publicUser };