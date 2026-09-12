const db = require('../db');
const HttpError = require('../utils/http-error');

const RESOURCE_TABLES = {
  dataset: 'datasets', datasets: 'datasets',
  chart: 'charts', charts: 'charts',
  dashboard: 'dashboards', dashboards: 'dashboards',
};

function isAdmin(reqUser, rbac) {
  return rbac.hasPermission(reqUser.id, 'user', 'read') && rbac.hasPermission(reqUser.id, 'role', 'read');
}

function scopedWhere(resource, user, rbac) {
  const table = RESOURCE_TABLES[resource];
  if (!table) throw new HttpError(500, `未知资源: ${resource}`);
  if (isAdmin(user, rbac)) return '';
  return `owner_id = ${Number(user.id)}`;
}

function assertResource(resource, id, user, rbac) {
  const table = RESOURCE_TABLES[resource];
  if (!table) throw new HttpError(500, `未知资源: ${resource}`);
  const row = db.prepare(`SELECT id, owner_id FROM ${table} WHERE id = ?`).get(id);
  if (!row) throw new HttpError(404, '资源不存在');
  if (isAdmin(user, rbac)) return true;
  if (Number(row.owner_id) === Number(user.id)) return true;
  throw new HttpError(403, '无权访问该资源');
}

function scopedList(resource, user, rbac, extraWhere = '', params = []) {
  const table = RESOURCE_TABLES[resource];
  const cond = scopedWhere(resource, user, rbac);
  const where = [cond, extraWhere].filter(Boolean).join(' AND ');
  const rows = db.prepare(`SELECT * FROM ${table}${where ? ' WHERE ' + where : ''} ORDER BY id DESC`).all(...params);
  return rows;
}

module.exports = { RESOURCE_TABLES, isAdmin, scopedWhere, assertResource, scopedList };