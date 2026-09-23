const bcrypt = require('bcryptjs');
const db = require('./db');

const PERMISSIONS = [
  ['dataset:read', '查看数据集'], ['dataset:create', '创建数据集'], ['dataset:update', '编辑数据集'], ['dataset:delete', '删除数据集'],
  ['chart:read', '查看图表'], ['chart:create', '创建图表'], ['chart:update', '编辑图表'], ['chart:delete', '删除图表'],
  ['dashboard:read', '查看看板'], ['dashboard:create', '创建看板'], ['dashboard:update', '编辑看板'], ['dashboard:delete', '删除看板'], ['dashboard:share', '分享看板'],
  ['big_screen:read', '查看大屏'], ['big_screen:create', '创建大屏'], ['big_screen:update', '编辑大屏'], ['big_screen:delete', '删除大屏'], ['big_screen:share', '分享大屏'],
  ['datasource:read', '查看数据源'], ['datasource:create', '创建数据源'], ['datasource:update', '编辑数据源'], ['datasource:delete', '删除数据源'],
  ['sqllab:execute', '执行 SQL'],
  ['form:read', '查看表单'], ['form:create', '创建表单'], ['form:update', '编辑表单'], ['form:delete', '删除表单'], ['form:publish', '发布表单'], ['form:share', '分享表单'], ['form:submit', '填报表单'],
  ['form:submission:read', '查看提交记录'], ['form:submission:update', '编辑提交记录'], ['form:submission:delete', '删除提交记录'],
  ['user:read', '查看用户'], ['user:create', '创建用户'], ['user:update', '编辑用户'], ['user:delete', '删除用户'],
  ['role:read', '查看角色'], ['role:create', '创建角色'], ['role:update', '编辑角色'], ['role:delete', '删除角色'],
  ['audit:read', '查看审计日志'],
  ['system:config', '系统配置'],
  ['apikey:manage', '管理 API Key'],
];

const ALL = PERMISSIONS.map((p) => p[0]);

const ROLES = [
  { code: 'admin', name: '管理员', description: '全部权限', isBuiltin: 1, permissions: ALL },
  { code: 'analyst', name: '数据工程师/分析师', description: '管理数据源/数据集/图表/看板，可执行 SQL', isBuiltin: 1, permissions: ALL.filter((p) => !p.startsWith('user:') && !p.startsWith('role:') && !p.startsWith('audit:') && p !== 'system:config' && !p.startsWith('apikey:')) },
  { code: 'editor', name: '看板编辑者', description: '构建图表与排版看板，可看数据集', isBuiltin: 1, permissions: ['dataset:read', 'chart:read', 'chart:create', 'chart:update', 'chart:delete', 'dashboard:read', 'dashboard:create', 'dashboard:update', 'dashboard:delete', 'dashboard:share', 'big_screen:read', 'big_screen:create', 'big_screen:update', 'big_screen:delete', 'big_screen:share', 'form:read', 'form:create', 'form:update', 'form:delete', 'form:publish', 'form:share', 'form:submit', 'form:submission:read', 'form:submission:update', 'form:submission:delete'] },
  { code: 'viewer', name: '查看者', description: '只读', isBuiltin: 1, permissions: ['dataset:read', 'chart:read', 'dashboard:read', 'form:read', 'form:submit'] },
];

async function seedPermissions() {
  const ins = await db.prepare('INSERT OR IGNORE INTO permissions (code, name) VALUES (?, ?)');
  const get = await db.prepare('SELECT id FROM permissions WHERE code = ?');
  for (const [code, name] of PERMISSIONS) await ins.run(code, name);
  const map = {};
  for (const [code] of PERMISSIONS) map[code] = (await get.get(code)).id;
  return map;
}

async function seedRoles(permIds) {
  const ins = await db.prepare('INSERT OR IGNORE INTO roles (code, name, description, is_builtin) VALUES (?, ?, ?, ?)');
  const getId = await db.prepare('SELECT id FROM roles WHERE code = ?');
  const link = await db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
  const clearLinks = await db.prepare('DELETE FROM role_permissions WHERE role_id = ?');
  const roles = {};
  const currentQ = await db.prepare(
    'SELECT p.code FROM permissions p JOIN role_permissions rp ON rp.permission_id = p.id WHERE rp.role_id = ? ORDER BY p.code'
  );
  for (const r of ROLES) {
    await ins.run(r.code, r.name, r.description, r.isBuiltin);
    const id = (await getId.get(r.code)).id;
    roles[r.code] = id;
    const current = (await currentQ.all(id)).map((x) => x.code);
    const target = [...r.permissions].sort();
    if (JSON.stringify(current) !== JSON.stringify(target)) {
      await clearLinks.run(id);
      for (const code of r.permissions) await link.run(id, permIds[code]);
    }
  }
  return roles;
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@kanray.local';
  const password = process.env.ADMIN_INITIAL_PASSWORD || 'admin123';
  const existing = (await db.prepare('SELECT id FROM users WHERE email = ?').get(email));
  let uid;
  if (existing) {
    uid = existing.id;
  } else {
    const hash = bcrypt.hashSync(password, 10);
    const r = await db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)').run(email, hash, '管理员');
    uid = r.lastInsertRowid;
  }
  const adminRole = (await db.prepare("SELECT id FROM roles WHERE code = 'admin'").get())?.id;
  if (adminRole) await db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(uid, adminRole);
  return uid;
}

async function backfillOwner(adminId) {
  for (const t of ['datasets', 'charts', 'dashboards', 'big_screens']) {
    await db.prepare(`UPDATE ${t} SET owner_id = ? WHERE owner_id IS NULL`).run(adminId);
  }
}

async function seed() {
  const permIds = await seedPermissions();
  const roles = await seedRoles(permIds);
  const adminId = await seedAdmin();
  await backfillOwner(adminId);
  return { roles, adminId, permIds };
}

module.exports = { seed, PERMISSIONS, ROLES };