const bcrypt = require('bcryptjs');
const db = require('../db');
const HttpError = require('../utils/http-error');
const { rolesOf, userWithRoles } = require('./auth.service');
const { ROLES } = require('../seeds');

const BUILTIN_CODES = ROLES.map((r) => r.code);

function permissionCodesOfUser(userId) {
  return db.prepare(
    `SELECT DISTINCT p.code FROM permissions p
     JOIN role_permissions rp ON rp.permission_id = p.id
     JOIN user_roles ur ON ur.role_id = rp.role_id
     WHERE ur.user_id = ?`
  ).all(userId).map((r) => r.code);
}

function permissionsOf(userId) {
  return permissionCodesOfUser(userId);
}

function hasPermission(userId, resource, action) {
  return permissionsOf(userId).includes(`${resource}:${action}`);
}

function listPermissions() {
  return db.prepare('SELECT * FROM permissions ORDER BY id').all();
}

function listRoles() {
  const roles = db.prepare('SELECT * FROM roles ORDER BY id').all();
  const perms = db.prepare(
    `SELECT rp.role_id, p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id`
  ).all();
  const map = new Map();
  perms.forEach((p) => { if (!map.has(p.role_id)) map.set(p.role_id, []); map.get(p.role_id).push(p.code); });
  return roles.map((r) => ({ ...r, is_builtin: !!r.is_builtin, permissions: map.get(r.id) || [] }));
}

function createRole(code, name, permissionCodes, description = '') {
  const c = String(code || '').trim();
  if (!/^[a-z0-9_-]{2,32}$/.test(c)) throw new HttpError(400, '角色标识不合法（小写字母/数字/下划线）');
  if (!String(name || '').trim()) throw new HttpError(400, '角色名称不能为空');
  if (db.prepare('SELECT id FROM roles WHERE code = ?').get(c)) throw new HttpError(409, '角色标识已存在');
  const r = db.prepare('INSERT INTO roles (code, name, description, is_builtin) VALUES (?, ?, ?, 0)').run(c, String(name).slice(0, 50), String(description || '').slice(0, 200));
  const id = Number(r.lastInsertRowid);
  setRolePermissions(id, permissionCodes);
  return listRoles().find((x) => x.id === id);
}

function updateRole(id, { name, description, permissions }) {
  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(id);
  if (!role) throw new HttpError(404, '角色不存在');
  if (role.is_builtin && (name !== undefined || permissions !== undefined)) {
    throw new HttpError(400, '内置角色权限由系统管理，如需自定义请新建角色');
  }
  if (name !== undefined) db.prepare('UPDATE roles SET name = ? WHERE id = ?').run(String(name).slice(0, 50), id);
  if (description !== undefined) db.prepare('UPDATE roles SET description = ? WHERE id = ?').run(String(description).slice(0, 200), id);
  if (permissions !== undefined) setRolePermissions(id, permissions);
  return listRoles().find((x) => x.id === id);
}

function deleteRole(id) {
  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(id);
  if (!role) throw new HttpError(404, '角色不存在');
  if (role.is_builtin) throw new HttpError(400, '内置角色不允许删除');
  const used = db.prepare('SELECT COUNT(*) n FROM user_roles WHERE role_id = ?').get(id).n;
  if (used > 0) throw new HttpError(400, '该角色已分配给用户，请先解除');
  db.prepare('DELETE FROM roles WHERE id = ?').run(id);
  return true;
}

function setRolePermissions(roleId, codes) {
  db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(roleId);
  const valid = db.prepare('SELECT id, code FROM permissions').all();
  const map = new Map(valid.map((p) => [p.code, p.id]));
  const ins = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
  (codes || []).forEach((code) => { if (map.has(code)) ins.run(roleId, map.get(code)); });
}

function listUsers({ page = 1, pageSize = 20 } = {}) {
  const total = db.prepare('SELECT COUNT(*) n FROM users').get().n;
  const rows = db.prepare('SELECT * FROM users ORDER BY id DESC LIMIT ? OFFSET ?').all(pageSize, (page - 1) * pageSize);
  const roleRows = db.prepare('SELECT ur.user_id, r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id').all();
  const map = new Map();
  roleRows.forEach((rr) => { if (!map.has(rr.user_id)) map.set(rr.user_id, []); map.get(rr.user_id).push(rr.code); });
  return { total, list: rows.map((u) => ({ id: u.id, email: u.email, name: u.name, is_active: !!u.is_active, created_at: u.created_at, roles: map.get(u.id) || [] })) };
}

function createUser(email, password, name, roleIds = []) {
  const mail = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new HttpError(400, '邮箱格式不正确');
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(mail)) throw new HttpError(409, '该邮箱已注册');
  const hash = bcrypt.hashSync(String(password || ''), 10);
  const r = db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)').run(mail, hash, String(name || '').slice(0, 50));
  const uid = Number(r.lastInsertRowid);
  assignRoles(uid, roleIds);
  return rbacUser(uid);
}

function rbacUser(userId) {
  const u = db.prepare('SELECT id, email, name, is_active, created_at FROM users WHERE id = ?').get(userId);
  if (!u) throw new HttpError(404, '用户不存在');
  return { ...u, is_active: !!u.is_active, roles: rolesOf(userId).map((x) => x.code) };
}

function assignRoles(userId, roleIds) {
  if (!db.prepare('SELECT id FROM users WHERE id = ?').get(userId)) throw new HttpError(404, '用户不存在');
  db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(userId);
  const ins = db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)');
  (roleIds || []).forEach((rid) => ins.run(userId, rid));
  return rbacUser(userId);
}

function setUserActive(userId, active) {
  if (!db.prepare('SELECT id FROM users WHERE id = ?').get(userId)) throw new HttpError(404, '用户不存在');
  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(active ? 1 : 0, userId);
  if (!active) db.prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL").run(new Date().toISOString(), userId);
  return rbacUser(userId);
}

module.exports = { permissionsOf, hasPermission, listPermissions, listRoles, createRole, updateRole, deleteRole, listUsers, createUser, assignRoles, setUserActive, rolesOf, rbacUser, BUILTIN_CODES };