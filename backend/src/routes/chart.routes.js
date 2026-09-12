const express = require('express');
const { z } = require('zod');
const HttpError = require('../utils/http-error');
const { ok } = require('../middleware/response');
const { requireUser } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const chartService = require('../services/chart.service');
const access = require('../services/access.service');
const rbac = require('../services/rbac.service');
const queryEngine = require('../engines/query-engine');
const { parsePageQuery } = require('../utils/pagination');

const router = express.Router();

// GET /api/charts
//   支持：keyword(名称/数据源模糊) · datasetId(数据源) · ids=1,2,3(白名单) · excludeIds=1,2(排除)
//   可选 page/pageSize -> {list,total}；未传分页返回全量数组
//   管理员全量；其余仅可见自己的图表（与既有筛选 AND 叠加）
router.get('/', requireUser, requirePermission('chart', 'read'), (req, res) => {
  const parseIds = (raw) =>
    String(raw || '').split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
  const scope = access.scopedWhere('chart', req.user, rbac);
  const filter = {
    keyword: String(req.query.keyword || ''),
    datasetId: Number(req.query.datasetId) > 0 ? Number(req.query.datasetId) : undefined,
    ids: parseIds(req.query.ids),
    excludeIds: parseIds(req.query.excludeIds),
    scope: scope ? `c.${scope}` : '',
  };
  const page = parsePageQuery(req.query);
  if (!page) {
    ok(res, chartService.listCharts(filter));
    return;
  }
  const list = chartService.listCharts({ ...filter, limit: page.pageSize, offset: (page.page - 1) * page.pageSize });
  const total = chartService.countCharts(filter);
  ok(res, { list, total, page: page.page, pageSize: page.pageSize });
});

// GET /api/charts/:id
router.get('/:id', requireUser, requirePermission('chart', 'read'), (req, res) => {
  const id = Number(req.params.id);
  access.assertResource('chart', id, req.user, rbac);
  const chart = chartService.getChartOrThrow(id);
  // 图表引用的数据集必须同样可访问，防止越权读取外部数据集
  access.assertResource('dataset', chart.datasetId, req.user, rbac);
  ok(res, chart);
});

// POST /api/charts
router.post('/', requireUser, requirePermission('chart', 'create'), (req, res) => {
  const c = chartService.validateChartPayload(req.body);
  access.assertResource('dataset', c.datasetId, req.user, rbac);
  const chart = chartService.createChart(c, req.user.id);
  ok(res, chart, '图表创建成功');
});

// PATCH /api/charts/:id
router.patch('/:id', requireUser, requirePermission('chart', 'update'), (req, res) => {
  const id = Number(req.params.id);
  access.assertResource('chart', id, req.user, rbac);
  const c = chartService.validateChartPayload(req.body);
  access.assertResource('dataset', c.datasetId, req.user, rbac);
  const chart = chartService.updateChart(id, c);
  ok(res, chart, '图表更新成功');
});

// DELETE /api/charts/:id
router.delete('/:id', requireUser, requirePermission('chart', 'delete'), (req, res) => {
  const id = Number(req.params.id);
  access.assertResource('chart', id, req.user, rbac);
  chartService.deleteChart(id);
  ok(res, true, '删除成功');
});

// POST /api/charts/:id/data  (实时运行图表配置，返回数据)
const dataSchema = z.object({
  filters: z.array(z.object({ field: z.string(), op: z.string(), value: z.any() })).optional().default([]),
}).strict();

router.post('/:id/data', requireUser, requirePermission('chart', 'read'), (req, res) => {
  const id = Number(req.params.id);
  access.assertResource('chart', id, req.user, rbac);
  const chart = chartService.getChartOrThrow(id);
  // 数据出口：图表引用的数据集必须可访问，防止经 /data 越权读取外部数据集
  access.assertResource('dataset', chart.datasetId, req.user, rbac);
  const parsed = dataSchema.safeParse(req.body || {});
  if (!parsed.success) throw new HttpError(400, '参数不正确');
  const result = queryEngine.aggregate({
    datasetId: chart.datasetId,
    ...chart.config,
    filters: parsed.data.filters.concat(chart.config.filters || []),
  });
  ok(res, { chart, data: result });
});

module.exports = router;
