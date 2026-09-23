const express = require('express');
const { z } = require('zod');
const HttpError = require('../utils/http-error');
const { ok } = require('../middleware/response');
const { requireUser } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const templateService = require('../services/big-screen-template.service');
const access = require('../services/access.service');
const rbac = require('../services/rbac.service');

const bigScreenTemplatesRouter = express.Router();

// GET /api/big-screen-templates  返回当前用户可见的大屏模板
bigScreenTemplatesRouter.get('/', requireUser, requirePermission('big_screen', 'read'), async (req, res) => {
  const where = await access.scopedWhere('big_screen_template', req.user, rbac);
  ok(res, await templateService.listTemplates(where));
});

// POST /api/big-screen-templates  { name, description?, thumbnail?, config?, components? }
bigScreenTemplatesRouter.post('/', requireUser, requirePermission('big_screen', 'create'), async (req, res) => {
  const schema = z.object({
    name: z.string().trim().min(1).max(100),
    description: z.string().max(500).optional(),
    thumbnail: z.string().optional(),
    config: z.any().optional(),
    components: z.any().optional(),
  }).strict();
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) throw new HttpError(400, '模板名称不能为空且不超过 100 字符');
  ok(res, await templateService.createTemplate(parsed.data, req.user.id), '模板保存成功');
});

// DELETE /api/big-screen-templates/:id
bigScreenTemplatesRouter.delete('/:id', requireUser, requirePermission('big_screen', 'delete'), async (req, res) => {
  const id = Number(req.params.id);
  await access.assertResource('big_screen_template', id, req.user, rbac);
  await templateService.deleteTemplate(id);
  ok(res, true, '删除成功');
});

module.exports = bigScreenTemplatesRouter;