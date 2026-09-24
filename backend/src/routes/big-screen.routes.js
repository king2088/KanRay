const express = require('express');
const { z } = require('zod');
const HttpError = require('../utils/http-error');
const { ok } = require('../middleware/response');
const { requireUser } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const bigScreenService = require('../services/big-screen.service');
const access = require('../services/access.service');
const rbac = require('../services/rbac.service');
const { parsePageQuery, paginate } = require('../utils/pagination');

const bigScreensRouter = express.Router();
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

const createMockSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).optional(),
  thumbnail: z.string().optional(),
  config: z.any().optional(),
  components: z.array(z.any()).optional(),
}).strict();

// GET /api/big-screens  (可选 page/pageSize -> {list,total}，否则返回全量数组)
bigScreensRouter.get('/', requireUser, requirePermission('big_screen', 'read'), async (req, res) => {
  const items = await bigScreenService.listBigScreens(await access.scopedWhere('big_screen', req.user, rbac));
  const page = parsePageQuery(req.query);
  ok(res, page ? paginate(items, page.page, page.pageSize) : items);
});

// GET /api/big-screens/:id
bigScreensRouter.get('/:id', requireUser, requirePermission('big_screen', 'read'), async (req, res) => {
  const id = req.params.id;
  await access.assertResource('big_screen', id, req.user, rbac);
  ok(res, await bigScreenService.getBigScreenOrThrow(id));
});

// POST /api/big-screens  { name, description?, thumbnail?, config?, components? }
bigScreensRouter.post('/', requireUser, requirePermission('big_screen', 'create'), async (req, res) => {
  const schema = z.object({
    name: z.string().trim().min(1).max(100),
    description: z.string().max(500).optional(),
    thumbnail: z.string().optional(),
    config: z.any().optional(),
    components: z.any().optional(),
  }).strict();
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) throw new HttpError(400, '大屏名称不能为空且不超过 100 字符');
  ok(res, await bigScreenService.createBigScreen(parsed.data, req.user.id), '大屏创建成功');
});

// POST /api/big-screens/mock  (mock 模板创建)
bigScreensRouter.post('/mock', requireUser, requirePermission('big_screen', 'create'), async (req, res) => {
  const parsed = createMockSchema.safeParse(req.body || {});
  if (!parsed.success) throw new HttpError(400, '大屏参数不正确', parsed.error.flatten());
  ok(res, await bigScreenService.createBigScreen(parsed.data, req.user.id), '大屏创建成功');
});

// PATCH /api/big-screens/:id
bigScreensRouter.patch('/:id', requireUser, requirePermission('big_screen', 'update'), async (req, res) => {
  const id = req.params.id;
  await access.assertResource('big_screen', id, req.user, rbac);
  const schema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    thumbnail: z.string().optional(),
    config: z.any().optional(),
    components: z.any().optional(),
  }).strict();
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) throw new HttpError(400, '大屏参数不正确', parsed.error.flatten());
  ok(res, await bigScreenService.updateBigScreen(id, parsed.data), '大屏更新成功');
});

// DELETE /api/big-screens/:id
bigScreensRouter.delete('/:id', requireUser, requirePermission('big_screen', 'delete'), async (req, res) => {
  const id = req.params.id;
  await access.assertResource('big_screen', id, req.user, rbac);
  await bigScreenService.deleteBigScreen(id);
  ok(res, true, '删除成功');
});

// POST /api/big-screens/:id/shares
bigScreensRouter.post('/:id/shares', requireUser, requirePermission('big_screen', 'share'), async (req, res) => {
  const id = req.params.id;
  await access.assertResource('big_screen', id, req.user, rbac);
  const p = createSchema.safeParse(req.body || {});
  if (!p.success) throw new HttpError(400, '分享参数不正确', p.error.flatten());
  const share = await bigScreenService.createShare({ bigScreenId: id, password: p.data.password, expiresAt: p.data.expiresAt, userId: req.user.id });
  ok(res, share, '分享创建成功');
});

// GET /api/big-screens/:id/shares
bigScreensRouter.get('/:id/shares', requireUser, requirePermission('big_screen', 'share'), async (req, res) => {
  const id = req.params.id;
  await access.assertResource('big_screen', id, req.user, rbac);
  ok(res, await bigScreenService.listShares(id));
});

// PATCH /api/big-screen-shares/:shareId
sharesRouter.patch('/:shareId', requireUser, requirePermission('big_screen', 'share'), async (req, res) => {
  const shareId = req.params.shareId;
  const share = await bigScreenService.getShareOrThrow(shareId);
  await access.assertResource('big_screen', share.bigScreenId, req.user, rbac);
  const p = patchSchema.safeParse(req.body || {});
  if (!p.success) throw new HttpError(400, '分享参数不正确', p.error.flatten());
  ok(res, await bigScreenService.updateShare(shareId, p.data), '分享更新成功');
});

// DELETE /api/big-screen-shares/:shareId
sharesRouter.delete('/:shareId', requireUser, requirePermission('big_screen', 'share'), async (req, res) => {
  const shareId = req.params.shareId;
  const share = await bigScreenService.getShareOrThrow(shareId);
  await access.assertResource('big_screen', share.bigScreenId, req.user, rbac);
  await bigScreenService.deleteShare(shareId);
  ok(res, true, '分享删除成功');
});

module.exports = { bigScreensRouter, sharesRouter };