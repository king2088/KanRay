const express = require('express');
const { z } = require('zod');
const HttpError = require('../utils/http-error');
const { ok } = require('../middleware/response');
const chartService = require('../services/chart.service');
const queryEngine = require('../engines/query-engine');

const router = express.Router();

// GET /api/charts
router.get('/', (req, res) => {
  ok(res, chartService.listCharts());
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
