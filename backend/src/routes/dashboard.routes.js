const express = require('express');
const { z } = require('zod');
const HttpError = require('../utils/http-error');
const { ok } = require('../middleware/response');
const dashboardService = require('../services/dashboard.service');
const { parsePageQuery, paginate } = require('../utils/pagination');

const router = express.Router();

// GET /api/dashboards  (可选 page/pageSize -> {list,total}，否则返回全量数组)
router.get('/', (req, res) => {
  const items = dashboardService.listDashboards();
  const page = parsePageQuery(req.query);
  ok(res, page ? paginate(items, page.page, page.pageSize) : items);
});

// GET /api/dashboards/:id
router.get('/:id', (req, res) => {
  ok(res, dashboardService.getDashboardOrThrow(Number(req.params.id)));
});

// POST /api/dashboards  { name }
router.post('/', (req, res) => {
  const schema = z.object({ name: z.string().trim().min(1).max(100) }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, '看板名称不能为空且不超过 100 字符');
  ok(res, dashboardService.createDashboard(parsed.data.name), '看板创建成功');
});

// PATCH /api/dashboards/:id  { name?, layout?, gap?, cardStyle? }
router.patch('/:id', (req, res) => {
  const schema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    layout: z.array(z.any()).optional(),
    gap: z
      .object({
        x: z.number().min(0).max(96).optional(),
        y: z.number().min(0).max(96).optional(),
      })
      .optional(),
    cardStyle: z
      .object({
        border: z.boolean().optional(),
        radius: z.number().min(0).max(20).optional(),
        titleHeight: z.number().min(24).max(52).optional(),
        titleFontSize: z.number().min(12).max(20).optional(),
        titleUnderline: z.boolean().optional(),
        showTitle: z.boolean().optional(),
      })
      .optional(),
  }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, '看板参数不正确', parsed.error.flatten());
  ok(res, dashboardService.updateDashboard(Number(req.params.id), parsed.data), '看板更新成功');
});

// DELETE /api/dashboards/:id
router.delete('/:id', (req, res) => {
  dashboardService.deleteDashboard(Number(req.params.id));
  ok(res, true, '删除成功');
});

module.exports = router;
