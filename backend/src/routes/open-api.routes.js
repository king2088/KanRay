const express = require('express');
const { z } = require('zod');
const HttpError = require('../utils/http-error');
const { ok } = require('../middleware/response');
const config = require('../config');
const rbac = require('../services/rbac.service');
const access = require('../services/access.service');
const chartService = require('../services/chart.service');
const datasetService = require('../services/dataset.service');
const dashboardService = require('../services/dashboard.service');
const queryEngine = require('../engines/query-engine');
const { openAuth, requireScope, openRateLimit, auditExit } = require('../middleware/open-auth');

const router = express.Router();

// 开放 API 统一入口：先验凭证，再按 key 限流
router.use(openAuth, openRateLimit);

// 开放 API 分页：limit 默认 50、上限 200；offset 从 0 起
function openPage(query = {}) {
  const limit = Math.min(200, Math.max(1, parseInt(query.limit || '', 10) || 50));
  const offset = Math.max(0, parseInt(query.offset || '', 10) || 0);
  return { limit, offset };
}
function slice(items, { limit, offset }) {
  return { items: items.slice(offset, offset + limit), total: items.length };
}

const MASK_CHART = ({ id, name, chartType, datasetId, datasetName, createdAt, updatedAt }) => ({ id, name, chartType, datasetId, datasetName, createdAt, updatedAt });
const MASK_DATASET = (r) => ({ id: r.id, name: r.name, sourceType: r.source_type, rowCount: r.row_count, columnCount: r.column_count, createdAt: r.created_at });
const MASK_DASHBOARD = ({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt });

// ---------- CSV 与通用输出 ----------
function wantsCsv(req) {
  return String(req.query.format || '').toLowerCase() === 'csv' || (req.headers.accept || '').includes('text/csv');
}
function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function columnsToCsv(columns, rows) {
  if (!columns.length) return '';
  const cells = columns.map((c) => ({ key: c.field, label: c.label || c.field }));
  const lines = [cells.map((c) => csvEscape(c.label)).join(',')];
  for (const r of rows) lines.push(cells.map((c) => csvEscape(r[c.key])).join(','));
  return lines.join('\n');
}
function sendCsv(res, csv) {
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.send(`\uFEFF${csv}`);
}
// CSV 模式下数据端点错误 → 纯文本 + 状态码（非 {code,data} 外壳）
async function handleEither(req, res, fn) {
  try {
    return await fn(req, res);
  } catch (e) {
    if (wantsCsv(req) && e && Number.isFinite(e.status)) {
      res.status(e.status).set('Content-Type', 'text/plain; charset=utf-8').send(String(e.message || 'error'));
      return undefined;
    }
    throw e;
  }
}
function chartColumns(result) {
  return [
    ...(result.dimensions || []).map((d) => ({ field: d.field, label: d.label })),
    ...(result.metrics || []).map((m) => ({ field: m.field, label: m.label, agg: m.agg })),
  ];
}
// 开放 API 资源断言：无权(403)/不存在(404) 统一掩蔽为 404「资源不存在或无权访问」
async function assertOpenResource(resource, id, user) {
  try {
    await access.assertResource(resource, id, user, rbac);
  } catch (e) {
    if (Number(e.status) === 403 || Number(e.status) === 404) throw new HttpError(404, '资源不存在或无权访问');
    throw e;
  }
}
function capRows(rows = []) {
  const max = config.openApi.maxRows;
  if (rows.length <= max) return { rows, truncated: false };
  return { rows: rows.slice(0, max), truncated: true };
}

// ---------- 发现端点 ----------

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

// ---------- 数据消费端点 ----------

// GET /api/open/v1/charts/:id/data  按图表配置取数（双重归属断言）
router.get('/charts/:id/data', requireScope('chart:read'), (req, res) => handleEither(req, res, async () => {
  const id = Number(req.params.id);
  await assertOpenResource('chart', id, req.principal.user);
  const chart = await chartService.getChartOrThrow(id);
  await assertOpenResource('dataset', chart.datasetId, req.principal.user);
  const result = await queryEngine.aggregate({ datasetId: chart.datasetId, ...chart.config, filters: chart.config.filters || [] });
  const columns = chartColumns(result);
  const { rows, truncated } = capRows(result.rows);
  await auditExit(req, 'chart', id, 'api:chart.data');
  if (wantsCsv(req)) return sendCsv(res, columnsToCsv(columns, rows));
  ok(res, { chart: { id: chart.id, name: chart.name, chartType: chart.chartType }, columns, rows, truncated });
}));

const AGG_METRICS = z.object({ field: z.string().min(1), agg: z.enum(['sum', 'avg', 'count', 'count_distinct', 'max', 'min']), label: z.string().max(64).optional() });
const AGG_DIM = z.object({ field: z.string().min(1), label: z.string().max(64).optional(), granularity: z.string().max(16).optional() });
const aggregateSchema = z.object({
  metrics: z.array(AGG_METRICS).min(1).max(50),
  dimensions: z.array(AGG_DIM).optional().default([]),
  filters: z.array(z.object({ field: z.string().min(1), op: z.string().min(1), value: z.any() })).optional().default([]),
  timeGrain: z.string().max(16).optional(),
  sortBy: z.string().max(64).optional(),
  groupLimit: z.number().int().min(1).max(10000).optional(),
}).strict();

async function assertFieldsRegistered(datasetId, body) {
  const ds = await datasetService.getDatasetOrThrow(datasetId);
  const names = new Set((ds.fields || []).map((f) => f.name));
  const bad = new Set();
  for (const m of body.metrics || []) if (!names.has(m.field)) bad.add(m.field);
  for (const d of body.dimensions || []) if (!names.has(d.field)) bad.add(d.field);
  for (const f of body.filters || []) if (!names.has(f.field)) bad.add(f.field);
  if (bad.size) throw new HttpError(422, `聚合包含未注册字段: ${[...bad].join(', ')}`);
}

// POST /api/open/v1/datasets/:id/aggregate  自定义聚合（白名单字段）
router.post('/datasets/:id/aggregate', requireScope('dataset:read'), (req, res) => handleEither(req, res, async () => {
  const id = Number(req.params.id);
  await assertOpenResource('dataset', id, req.principal.user);
  const parsed = aggregateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    const why = parsed.error.issues.map((i) => `${i.path.join('.')}:${i.message}`).join('; ');
    throw new HttpError(400, `聚合参数不正确: ${why}`);
  }
  await assertFieldsRegistered(id, parsed.data);
  const result = await queryEngine.aggregate({ datasetId: id, ...parsed.data });
  const columns = chartColumns(result);
  const { rows, truncated } = capRows(result.rows);
  await auditExit(req, 'dataset', id, 'api:dataset.aggregate');
  if (wantsCsv(req)) return sendCsv(res, columnsToCsv(columns, rows));
  ok(res, { columns, rows, truncated });
}));

// GET /api/open/v1/dashboards/:id/export  看板元信息 + 全部图表数据
router.get('/dashboards/:id/export', requireScope('dashboard:read'), (req, res) => handleEither(req, res, async () => {
  const id = Number(req.params.id);
  await assertOpenResource('dashboard', id, req.principal.user);
  const dash = await dashboardService.getDashboardOrThrow(id);
  const cards = [];
  for (const comp of dash.layout || []) {
    if (!comp || comp.type !== 'chart' || comp.chartId == null) continue;
    const chart = await chartService.getChartOrThrow(Number(comp.chartId));
    await assertOpenResource('chart', chart.id, req.principal.user);
    await assertOpenResource('dataset', chart.datasetId, req.principal.user);
    const result = await queryEngine.aggregate({ datasetId: chart.datasetId, ...chart.config, filters: chart.config.filters || [] });
    const columns = chartColumns(result);
    const { rows, truncated } = capRows(result.rows);
    cards.push({ chart: { id: chart.id, name: chart.name, chartType: chart.chartType, datasetName: chart.datasetName }, columns, rows, truncated });
  }
  await auditExit(req, 'dashboard', id, 'api:dashboard.export');
  if (wantsCsv(req)) {
    const parts = cards.map((c) => `# ${c.chart.name}\n${columnsToCsv(c.columns, c.rows)}`);
    return sendCsv(res, parts.join('\n\n'));
  }
  ok(res, { dashboard: { id: dash.id, name: dash.name, createdAt: dash.createdAt, updatedAt: dash.updatedAt }, cards });
}));

module.exports = router;