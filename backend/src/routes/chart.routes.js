const express = require('express');
const { z } = require('zod');
const HttpError = require('../utils/http-error');
const { ok } = require('../middleware/response');
const chartService = require('../services/chart.service');
const queryEngine = require('../engines/query-engine');
const { parsePageQuery } = require('../utils/pagination');

const router = express.Router();

// GET /api/charts
//   支持：keyword(名称/数据源模糊) · datasetId(数据源) · ids=1,2,3(白名单) · excludeIds=1,2(排除)
//   可选 page/pageSize -> {list,total}；未传分页返回全量数组
router.get('/', (req, res) => {
  const parseIds = (raw) =>
    String(raw || '').split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
  const filter = {
    keyword: String(req.query.keyword || ''),
    datasetId: Number(req.query.datasetId) > 0 ? Number(req.query.datasetId) : undefined,
    ids: parseIds(req.query.ids),
    excludeIds: parseIds(req.query.excludeIds),
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
router.get('/:id', (req, res) => {
  ok(res, chartService.getChartOrThrow(Number(req.params.id)));
});

// POST /api/charts
router.post('/', (req, res) => {
  const chart = chartService.createChart(req.body);
  ok(res, chart, '图表创建成功');
});

// PATCH /api/charts/:id
router.patch('/:id', (req, res) => {
  const chart = chartService.updateChart(Number(req.params.id), req.body);
  ok(res, chart, '图表更新成功');
});

// DELETE /api/charts/:id
router.delete('/:id', (req, res) => {
  chartService.deleteChart(Number(req.params.id));
  ok(res, true, '删除成功');
});

// POST /api/charts/:id/data  (实时运行图表配置，返回数据)
const dataSchema = z.object({
  filters: z.array(z.object({ field: z.string(), op: z.string(), value: z.any() })).optional().default([]),
}).strict();

router.post('/:id/data', (req, res) => {
  const chart = chartService.getChartOrThrow(Number(req.params.id));
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
