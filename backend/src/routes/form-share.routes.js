const express = require('express');
const { z } = require('zod');
const HttpError = require('../utils/http-error');
const { ok } = require('../middleware/response');
const { requireUser } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const access = require('../services/access.service');
const rbac = require('../services/rbac.service');
const formShareService = require('../services/form-share.service');

// 管理路由：挂载于 /api/forms（路径 /api/forms/:formId/shares）
const router = express.Router();

// GET /api/forms/:formId/shares
router.get('/:formId/shares', requireUser, requirePermission('form', 'share'), async (req, res) => {
  const formId = Number(req.params.formId);
  await access.assertResource('form', formId, req.user, rbac);
  ok(res, await formShareService.listShares(formId));
});

// POST /api/forms/:formId/shares  { password?, expiresAt? }
router.post('/:formId/shares', requireUser, requirePermission('form', 'share'), async (req, res) => {
  const formId = Number(req.params.formId);
  await access.assertResource('form', formId, req.user, rbac);
  const schema = z.object({
    password: z.string().max(64).optional(),
    expiresAt: z.string().optional().nullable(),
  }).strict();
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) throw new HttpError(400, '分享参数不正确', parsed.error.flatten());
  ok(res, await formShareService.createShare({ formId, password: parsed.data.password ?? '', expiresAt: parsed.data.expiresAt, userId: req.user.id }), '分享创建成功');
});

// PATCH /api/forms/:formId/shares/:shareId  { password?, expiresAt?, isActive? }
router.patch('/:formId/shares/:shareId', requireUser, requirePermission('form', 'share'), async (req, res) => {
  const formId = Number(req.params.formId);
  await access.assertResource('form', formId, req.user, rbac);
  const schema = z.object({
    password: z.string().max(64).optional(),
    expiresAt: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
  }).strict();
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) throw new HttpError(400, '分享参数不正确', parsed.error.flatten());
  ok(res, await formShareService.updateShare(Number(req.params.shareId), parsed.data), '分享更新成功');
});

// DELETE /api/forms/:formId/shares/:shareId
router.delete('/:formId/shares/:shareId', requireUser, requirePermission('form', 'share'), async (req, res) => {
  const formId = Number(req.params.formId);
  await access.assertResource('form', formId, req.user, rbac);
  await formShareService.deleteShare(Number(req.params.shareId));
  ok(res, true, '删除成功');
});

module.exports = router;