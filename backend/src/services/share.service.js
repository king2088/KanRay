const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const HttpError = require('../utils/http-error');
const { getDashboardOrThrow } = require('./dashboard.service');
const { getChartOrThrow, listCharts } = require('./chart.service');
const queryEngine = require('../engines/query-engine');

const SELECT_SHARE = `
  SELECT s.id, s.dashboard_id AS dashboardId, s.dashboard_id AS dashboard_id, s.token,
         s.password_hash AS passwordHash, s.password_hash AS password_hash,
         s.expires_at AS expiresAt, s.expires_at AS expires_at, s.is_active AS isActive,
         s.is_active AS is_active, s.created_by AS createdBy, s.created_by AS created_by,
         s.created_at AS createdAt, s.created_at AS created_at, s.updated_at AS updatedAt,
         s.updated_at AS updated_at
  FROM dashboard_shares s
`;

function generateToken() {
  return crypto.randomBytes(16).toString('base64url');
}

function stripPassword(row) {
  if (!row) return row;
  const { passwordHash, password_hash, ...rest } = row;
  return { ...rest, hasPassword: !!passwordHash, isActive: Number(row.isActive !== undefined ? row.isActive : row.is_active) };
}

function validatePassword(password) {
  if (password === null || password === undefined || password === '') return '';
  const v = String(password);
  if (v.length < 4 || v.length > 64) throw new HttpError(400, '分享密码需为 4-64 位');
  return v;
}

async function hashPassword(password) {
  const v = validatePassword(password);
  return v ? await bcrypt.hash(v, 10) : '';
}

function parseExpiresAt(value) {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) throw new HttpError(400, '过期时间格式不正确');
  if (d.getTime() <= Date.now()) throw new HttpError(400, '过期时间必须晚于当前时间');
  return d.toISOString();
}

async function getShare(id) {
  return (await db.prepare(`${SELECT_SHARE} WHERE s.id = ?`).get(Number(id))) || null;
}

async function getShareOrThrow(id) {
  const s = await getShare(id);
  if (!s) throw new HttpError(404, '分享不存在');
  return s;
}

async function getShareByToken(token) {
  return (await db.prepare(`${SELECT_SHARE} WHERE s.token = ?`).get(String(token || ''))) || null;
}

async function createShare({ dashboardId, password, expiresAt, userId }) {
  const hash = await hashPassword(password);
  const info = await db.prepare(
    'INSERT INTO dashboard_shares (dashboard_id, token, password_hash, expires_at, created_by) VALUES (?, ?, ?, ?, ?)'
  ).run(Number(dashboardId), generateToken(), hash, parseExpiresAt(expiresAt), Number(userId));
  return stripPassword(await getShare(Number(info.lastInsertRowid)));
}

async function listShares(dashboardId) {
  return (await db.prepare(`${SELECT_SHARE} WHERE s.dashboard_id = ? ORDER BY s.id DESC`).all(Number(dashboardId)))
    .map(stripPassword);
}

async function updateShare(id, body = {}) {
  await getShareOrThrow(id);
  const fields = [];
  const params = [];
  if (body.password !== undefined) {
    fields.push('password_hash = ?');
    params.push(await hashPassword(body.password));
  }
  if (body.expiresAt !== undefined) {
    fields.push('expires_at = ?');
    params.push(parseExpiresAt(body.expiresAt));
  }
  if (body.isActive !== undefined) {
    fields.push('is_active = ?');
    params.push(body.isActive ? 1 : 0);
  }
  if (fields.length) {
    params.push(id);
    await db.prepare(`UPDATE dashboard_shares SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...params);
  }
  return stripPassword(await getShare(id));
}

async function deleteShare(id) {
  await getShareOrThrow(id);
  await db.prepare('DELETE FROM dashboard_shares WHERE id = ?').run(Number(id));
  return true;
}

function shareState(share, now = Date.now()) {
  if (!share) return 'not_found';
  if (!Number(share.isActive !== undefined ? share.isActive : share.is_active)) return 'inactive';
  const exp = share.expiresAt !== undefined ? share.expiresAt : share.expires_at;
  if (exp && new Date(exp).getTime() <= now) return 'expired';
  return 'active';
}

function assertShareUsable(share, now = Date.now()) {
  const st = shareState(share, now);
  if (st === 'inactive') throw new HttpError(403, '分享已被关闭', null, 40302);
  if (st === 'expired') throw new HttpError(403, '分享链接已过期', null, 40301);
  if (st === 'not_found') throw new HttpError(404, '分享不存在或已被删除');
  return share;
}

async function getDashboardName(id) {
  return (await db.prepare('SELECT id, name FROM dashboards WHERE id = ?').get(Number(id))) || null;
}

function collectChartIds(layout) {
  const out = [];
  const walk = (arr) => {
    (arr || []).forEach((it) => {
      if (!it || typeof it !== 'object') return;
      if (it.type === 'chart' && it.chartId !== undefined && it.chartId !== null) out.push(Number(it.chartId));
      if (Array.isArray(it.children)) walk(it.children);
    });
  };
  walk(layout);
  return out;
}

async function getDashboardRenderView(dashboardId) {
  const dash = await getDashboardOrThrow(dashboardId);
  const ids = collectChartIds(dash.layout);
  const charts = ids.length ? await listCharts({ ids }) : [];
  return {
    id: dash.id,
    name: dash.name,
    layout: dash.layout,
    gap: dash.gap,
    cardStyle: dash.cardStyle,
    charts: charts.map((c) => ({ id: c.id, name: c.name, chartType: c.chartType, config: c.config })),
  };
}

async function getDashboardLayoutInShare(share) {
  const dash = await getDashboardOrThrow(Number(share.dashboardId));
  return dash.layout;
}

async function getChartData(share, chartId) {
  const ids = collectChartIds(await getDashboardLayoutInShare(share));
  if (!ids.includes(Number(chartId))) throw new HttpError(404, '图表不存在');
  const chart = await getChartOrThrow(Number(chartId));
  return queryEngine.aggregate({
    datasetId: chart.datasetId,
    ...chart.config,
    filters: chart.config.filters || [],
  });
}

module.exports = {
  generateToken,
  stripPassword,
  getShare,
  getShareOrThrow,
  getShareByToken,
  createShare,
  listShares,
  updateShare,
  deleteShare,
  shareState,
  assertShareUsable,
  getDashboardName,
  getDashboardRenderView,
  getChartData,
  collectChartIds,
};