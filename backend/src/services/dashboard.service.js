const db = require('../db');
const HttpError = require('../utils/http-error');
const { listCharts, getChartOrThrow } = require('../services/chart.service');

function listDashboards() {
  return db
    .prepare(`
      SELECT id, name, layout, created_at AS createdAt, updated_at AS updatedAt
      FROM dashboards ORDER BY updated_at DESC
    `)
    .all()
    .map((d) => ({ ...d, layout: JSON.parse(d.layout) }));
}

function getDashboard(id) {
  const d = db
    .prepare('SELECT id, name, layout, created_at AS createdAt, updated_at AS updatedAt FROM dashboards WHERE id = ?')
    .get(id);
  if (!d) return null;
  return { ...d, layout: JSON.parse(d.layout) };
}

function getDashboardOrThrow(id) {
  const d = getDashboard(id);
  if (!d) throw new HttpError(404, `看板不存在: id=${id}`);
  return d;
}

/** 校验看板组件列表 */
function validateLayout(layout) {
  if (!Array.isArray(layout)) throw new HttpError(400, '看板布局格式不正确');
  for (const comp of layout) {
    if (!comp || typeof comp !== 'object') throw new HttpError(400, '看板组件格式不正确');
    if (comp.type === 'chart') {
      if (comp.chartId === undefined || comp.chartId === null) throw new HttpError(400, '图表组件缺少 chartId');
      getChartOrThrow(Number(comp.chartId));
    }
  }
  return layout;
}

function createDashboard(name) {
  const n = String(name || '').trim().slice(0, 100);
  if (!n) throw new HttpError(400, '看板名称不能为空');
  const info = db
    .prepare('INSERT INTO dashboards (name, layout) VALUES (?, ?)')
    .run(n, '[]');
  return getDashboard(Number(info.lastInsertRowid));
}

function updateDashboard(id, body) {
  const existing = getDashboardOrThrow(id);
  const name = body.name !== undefined ? String(body.name || '').trim().slice(0, 100) : existing.name;
  if (!name) throw new HttpError(400, '看板名称不能为空');
  const layout = body.layout !== undefined ? validateLayout(body.layout) : existing.layout;
  db.prepare('UPDATE dashboards SET name = ?, layout = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(name, JSON.stringify(layout), id);
  return getDashboard(id);
}

function deleteDashboard(id) {
  getDashboardOrThrow(id);
  db.prepare('DELETE FROM dashboards WHERE id = ?').run(id);
  return true;
}

module.exports = {
  listDashboards,
  getDashboard,
  getDashboardOrThrow,
  createDashboard,
  updateDashboard,
  deleteDashboard,
};
