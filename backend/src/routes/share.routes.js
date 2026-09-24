const express = require('express');
const { z } = require('zod');
const HttpError = require('../utils/http-error');
const { ok } = require('../middleware/response');
const { requireUser } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const shareService = require('../services/share.service');
const access = require('../services/access.service');
const rbac = require('../services/rbac.service');

const dashSharesRouter = express.Router({ mergeParams: true });
const sharesRouter = express.Router();

const createSchema = z.object({
  password: z.string().min(4).max(64).optional().nullable(),
  expiresAt: z.string().optional().nullable(),
}).strict();

const patchSchema = z.object({
  password: z.string().min(4).max(64).optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
}).strict();

// POST /api/dashboards/:id/shares
dashSharesRouter.post('/:id/shares', requireUser, requirePermission('dashboard', 'share'), async (req, res) => {
  const id = req.params.id;
  await access.assertResource('dashboard', id, req.user, rbac);
  const p = createSchema.safeParse(req.body || {});
  if (!p.success) throw new HttpError(400, '分享参数不正确', p.error.flatten());
  const share = await shareService.createShare({ dashboardId: id, password: p.data.password, expiresAt: p.data.expiresAt, userId: req.user.id });
  ok(res, share, '分享创建成功');
});

// GET /api/dashboards/:id/shares
dashSharesRouter.get('/:id/shares', requireUser, requirePermission('dashboard', 'share'), async (req, res) => {
  const id = req.params.id;
  await access.assertResource('dashboard', id, req.user, rbac);
  ok(res, await shareService.listShares(id));
});

// PATCH /api/shares/:shareId
sharesRouter.patch('/:shareId', requireUser, requirePermission('dashboard', 'share'), async (req, res) => {
  const shareId = req.params.shareId;
  const share = await shareService.getShareOrThrow(shareId);
  await access.assertResource('dashboard', share.dashboardId, req.user, rbac);
  const p = patchSchema.safeParse(req.body || {});
  if (!p.success) throw new HttpError(400, '分享参数不正确', p.error.flatten());
  ok(res, await shareService.updateShare(shareId, p.data), '分享更新成功');
});

// DELETE /api/shares/:shareId
sharesRouter.delete('/:shareId', requireUser, requirePermission('dashboard', 'share'), async (req, res) => {
  const shareId = req.params.shareId;
  const share = await shareService.getShareOrThrow(shareId);
  await access.assertResource('dashboard', share.dashboardId, req.user, rbac);
  await shareService.deleteShare(shareId);
  ok(res, true, '分享删除成功');
});

module.exports = { dashSharesRouter, sharesRouter };