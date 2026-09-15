const db = require('../db');
const HttpError = require('../utils/http-error');

const RESOURCE_TABLES = {
  dataset: 'datasets', datasets: 'datasets',
  chart: 'charts', charts: 'charts',
  dashboard: 'dashboards', dashboards: 'dashboards',
  datasource: 'data_sources', datasources: 'data_sources',
};

async function isAdmin(user, rbac) {
  // 仅内置 admin 角色视为管理员；自定义角色即使拥有 user:read+role:read 也不放行数据访问
  if (!user || !Number.isFinite(Number(user.id))) return false;
  return !!await db.prepare(
    `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ? AND r.code = 'admin' LIMIT 1`
  ).get(Number(user.id));
}

function assertValidUser(user) {
  if (!user || !Number.isFinite(Number(user.id))) throw new HttpError(401, '用户信息无效');
}

async function scopedWhere(resource, user, rbac) {
  const table = RESOURCE_TABLES[resource];
  if (!table) throw new HttpError(500, `未知资源: ${resource}`);
  assertValidUser(user);
  if (await isAdmin(user, rbac)) return '';
  return `owner_id = ${Number(user.id)}`;
}

async function assertResource(resource, id, user, rbac) {
  const table = RESOURCE_TABLES[resource];
  if (!table) throw new HttpError(500, `未知资源: ${resource}`);
  assertValidUser(user);
  const row = await db.prepare(`SELECT id, owner_id FROM ${table} WHERE id = ?`).get(id);
  if (!row) throw new HttpError(404, '资源不存在');
  if (await isAdmin(user, rbac)) return true;
  if (Number(row.owner_id) === Number(user.id)) return true;
  throw new HttpError(403, '无权访问该资源');
}

async function scopedList(resource, user, rbac, extraWhere = '', params = []) {
  const table = RESOURCE_TABLES[resource];
  const cond = await scopedWhere(resource, user, rbac);
  const where = [cond, extraWhere].filter(Boolean).join(' AND ');
  const rows = await db.prepare(`SELECT * FROM ${table}${where ? ' WHERE ' + where : ''} ORDER BY id DESC`).all(...params);
  return rows;
}

module.exports = { RESOURCE_TABLES, isAdmin, scopedWhere, assertResource, scopedList };