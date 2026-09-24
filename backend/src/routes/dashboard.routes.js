const express = require('express');
const { z } = require('zod');
const HttpError = require('../utils/http-error');
const { ok } = require('../middleware/response');
const { requireUser } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const dashboardService = require('../services/dashboard.service');
const access = require('../services/access.service');
const rbac = require('../services/rbac.service');
const { parsePageQuery, paginate } = require('../utils/pagination');

const router = express.Router();

// 校验看板布局中引用的图表均归当前用户所有（管理员放行）
async function assertLayoutOwnership(layout, user) {
  for (const comp of layout || []) {
    if (comp && typeof comp === 'object' && comp.type === 'chart' && comp.chartId !== undefined && comp.chartId !== null) {
      await access.assertResource('chart', String(comp.chartId), user, rbac);
    }
  }
}

// GET /api/dashboards  (可选 page/pageSize -> {list,total}，否则返回全量数组)
// 管理员全量；其余仅可见自己的看板
router.get('/', requireUser, requirePermission('dashboard', 'read'), async (req, res) => {
  const items = await dashboardService.listDashboards(await access.scopedWhere('dashboard', req.user, rbac));
  const page = parsePageQuery(req.query);
  ok(res, page ? paginate(items, page.page, page.pageSize) : items);
});

// GET /api/dashboards/:id
router.get('/:id', requireUser, requirePermission('dashboard', 'read'), async (req, res) => {
  const id = req.params.id;
  await access.assertResource('dashboard', id, req.user, rbac);
  ok(res, await dashboardService.getDashboardOrThrow(id));
});

// POST /api/dashboards  { name }
router.post('/', requireUser, requirePermission('dashboard', 'create'), async (req, res) => {
  const schema = z.object({ name: z.string().trim().min(1).max(100) }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, '看板名称不能为空且不超过 100 字符');
  ok(res, await dashboardService.createDashboard(parsed.data.name, req.user.id), '看板创建成功');
});

// PATCH /api/dashboards/:id  { name?, layout?, gap?, cardStyle? }
router.patch('/:id', requireUser, requirePermission('dashboard', 'update'), async (req, res) => {
  const id = req.params.id;
  await access.assertResource('dashboard', id, req.user, rbac);
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
  if (parsed.data.layout !== undefined) await assertLayoutOwnership(parsed.data.layout, req.user);
  ok(res, await dashboardService.updateDashboard(id, parsed.data), '看板更新成功');
});

// DELETE /api/dashboards/:id
router.delete('/:id', requireUser, requirePermission('dashboard', 'delete'), async (req, res) => {
  const id = req.params.id;
  await access.assertResource('dashboard', id, req.user, rbac);
  await dashboardService.deleteDashboard(id);
  ok(res, true, '删除成功');
});

module.exports = router;
