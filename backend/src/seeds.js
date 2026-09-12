const bcrypt = require('bcryptjs');
const db = require('./db');

const PERMISSIONS = [
  ['dataset:read', '查看数据集'], ['dataset:create', '创建数据集'], ['dataset:update', '编辑数据集'], ['dataset:delete', '删除数据集'],
  ['chart:read', '查看图表'], ['chart:create', '创建图表'], ['chart:update', '编辑图表'], ['chart:delete', '删除图表'],
  ['dashboard:read', '查看看板'], ['dashboard:create', '创建看板'], ['dashboard:update', '编辑看板'], ['dashboard:delete', '删除看板'],
  ['datasource:read', '查看数据源'], ['datasource:create', '创建数据源'], ['datasource:update', '编辑数据源'], ['datasource:delete', '删除数据源'],
  ['sqllab:execute', '执行 SQL'],
  ['user:read', '查看用户'], ['user:create', '创建用户'], ['user:update', '编辑用户'], ['user:delete', '删除用户'],
  ['role:read', '查看角色'], ['role:create', '创建角色'], ['role:update', '编辑角色'], ['role:delete', '删除角色'],
  ['audit:read', '查看审计日志'],
  ['system:config', '系统配置'],
];

const ALL = PERMISSIONS.map((p) => p[0]);

const ROLES = [
  { code: 'admin', name: '管理员', description: '全部权限', isBuiltin: 1, permissions: ALL },
  { code: 'analyst', name: '数据工程师/分析师', description: '管理数据源/数据集/图表/看板，可执行 SQL', isBuiltin: 1, permissions: ALL.filter((p) => !p.startsWith('user:') && !p.startsWith('role:') && !p.startsWith('audit:') && p !== 'system:config') },
  { code: 'editor', name: '看板编辑者', description: '构建图表与排版看板，可看数据集', isBuiltin: 1, permissions: ['dataset:read', 'chart:read', 'chart:create', 'chart:update', 'chart:delete', 'dashboard:read', 'dashboard:create', 'dashboard:update', 'dashboard:delete'] },
  { code: 'viewer', name: '查看者', description: '只读', isBuiltin: 1, permissions: ['dataset:read', 'chart:read', 'dashboard:read'] },
];

function seedPermissions() {
  const ins = db.prepare('INSERT OR IGNORE INTO permissions (code, name) VALUES (?, ?)');
  const get = db.prepare('SELECT id FROM permissions WHERE code = ?');
  PERMISSIONS.forEach(([code, name]) => { ins.run(code, name); });
  const map = {};
  PERMISSIONS.forEach(([code]) => { map[code] = get.get(code).id; });
  return map;
}

function seedRoles(permIds) {
  const ins = db.prepare('INSERT OR IGNORE INTO roles (code, name, description, is_builtin) VALUES (?, ?, ?, ?)');
  const getId = db.prepare('SELECT id FROM roles WHERE code = ?');
  const link = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
  const clearLinks = db.prepare('DELETE FROM role_permissions WHERE role_id = ?');
  const roles = {};
  ROLES.forEach((r) => {
    ins.run(r.code, r.name, r.description, r.isBuiltin);
    const id = getId.get(r.code).id;
    roles[r.code] = id;
    const current = db.prepare(
      'SELECT p.code FROM permissions p JOIN role_permissions rp ON rp.permission_id = p.id WHERE rp.role_id = ? ORDER BY p.code'
    ).all(id).map((x) => x.code);
    const target = [...r.permissions].sort();
    if (JSON.stringify(current) !== JSON.stringify(target)) {
      clearLinks.run(id);
      r.permissions.forEach((code) => link.run(id, permIds[code]));
    }
  });
  return roles;
}

function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@kanban.local';
  const password = process.env.ADMIN_INITIAL_PASSWORD || 'admin123';
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  let uid;
  if (existing) {
    uid = existing.id;
  } else {
    const hash = bcrypt.hashSync(password, 10);
    const r = db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)').run(email, hash, '管理员');
    uid = r.lastInsertRowid;
  }
  const adminRole = db.prepare("SELECT id FROM roles WHERE code = 'admin'").get()?.id;
  if (adminRole) db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(uid, adminRole);
  return uid;
}

function backfillOwner(adminId) {
  ['datasets', 'charts', 'dashboards'].forEach((t) => {
    db.prepare(`UPDATE ${t} SET owner_id = ? WHERE owner_id IS NULL`).run(adminId);
  });
}

function seed() {
  const permIds = seedPermissions();
  const roles = seedRoles(permIds);
  const adminId = seedAdmin();
  backfillOwner(adminId);
  return { roles, adminId, permIds };
}

module.exports = { seed, PERMISSIONS, ROLES };
