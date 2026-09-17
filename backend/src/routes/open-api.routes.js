const express = require('express');
const HttpError = require('../utils/http-error');
const { ok } = require('../middleware/response');
const rbac = require('../services/rbac.service');
const access = require('../services/access.service');
const chartService = require('../services/chart.service');
const datasetService = require('../services/dataset.service');
const dashboardService = require('../services/dashboard.service');
const { openAuth, requireScope, openRateLimit } = require('../middleware/open-auth');

const router = express.Router();

// 开放 API 统一入口：先验凭证，再按 key 限流
router.use(openAuth, openRateLimit);

// 开放 API 分页：limit 默认 50、上限 200
function openPage(query = {}) {
  const page = Math.max(1, parseInt(query.page || '', 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit || '', 10) || 50));
  return { page, limit, offset: (page - 1) * limit };
}
function slice(items, { page, limit }) {
  const start = (page - 1) * limit;
  return { items: items.slice(start, start + limit), total: items.length };
}

const MASK_CHART = ({ id, name, chartType, datasetId, datasetName, createdAt, updatedAt }) => ({ id, name, chartType, datasetId, datasetName, createdAt, updatedAt });
const MASK_DATASET = (r) => ({ id: r.id, name: r.name, sourceType: r.source_type, rowCount: r.row_count, columnCount: r.column_count, createdAt: r.created_at });
const MASK_DASHBOARD = ({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt });

// GET /api/open/v1/charts  发现：本人可读图表（默认按更新时间倒序）
router.get('/charts', requireScope('chart:read'), async (req, res) => {
  const scope = await access.scopedWhere('chart', req.principal.user, rbac);
  const page = openPage(req.query);
  const filter = { scope: scope ? `c.${scope}` : '', limit: page.limit, offset: page.offset };
  const kw = String(req.query.keyword || '').trim();
  if (kw) filter.keyword = kw;
  const list = (await chartService.listCharts(filter)).map(MASK_CHART);
  const total = await chartService.countCharts(filter);
  ok(res, { items: list, total });
});

// GET /api/open/v1/datasets  发现：本人可读数据集
router.get('/datasets', requireScope('dataset:read'), async (req, res) => {
  const where = await access.scopedWhere('dataset', req.principal.user, rbac);
  const items = await datasetService.listDatasets(where);
  ok(res, slice(items.map(MASK_DATASET), openPage(req.query)));
});

// GET /api/open/v1/dashboards  发现：本人可读看板
router.get('/dashboards', requireScope('dashboard:read'), async (req, res) => {
  const where = await access.scopedWhere('dashboard', req.principal.user, rbac);
  const items = await dashboardService.listDashboards(where);
  ok(res, slice(items.map(MASK_DASHBOARD), openPage(req.query)));
});

module.exports = router;