const express = require('express');
const { z } = require('zod');
const HttpError = require('../utils/http-error');
const { ok } = require('../middleware/response');
const { requireUser } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const apiKeyService = require('../services/api-key.service');
const audit = require('../services/audit.service');
const { isValidUuid7 } = require('../utils/uuidv7');

// 两个子路由：/api/admin/api-keys（需 apikey:manage）与 /api/auth/tokens（本人 PAT）
const adminRouter = express.Router();
const tokenRouter = express.Router();

adminRouter.use(requireUser, requirePermission('apikey', 'manage'));
tokenRouter.use(requireUser);

function zodErr() { return new HttpError(400, '参数不正确'); }
const idUuid = (raw) => (isValidUuid7(String(raw)) ? String(raw) : null);

// ---------------- 管理端：API Key ----------------

// GET /api/admin/api-keys
adminRouter.get('/', async (req, res) => {
  const type = ['static', 'pat'].includes(String(req.query.type)) ? String(req.query.type) : undefined;
  const userId = isValidUuid7(String(req.query.userId || '')) ? String(req.query.userId) : undefined;
  const list = await apiKeyService.list({ type, userId });
  ok(res, { list, total: list.length });
});

// POST /api/admin/api-keys
const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.enum(['static', 'pat']).optional().default('static'),
  userId: z.string().refine((v) => isValidUuid7(v), '用户 id 须为 uuid7'),
  scopes: z.array(z.string()).optional().default([]),
  expiresAt: z.string().optional().nullable().default(null),
}).strict();

adminRouter.post('/', async (req, res) => {
  const p = createSchema.safeParse(req.body || {});
  if (!p.success) throw zodErr();
  const r = await apiKeyService.create({ name: p.data.name, type: p.data.type, userId: p.data.userId, scopes: p.data.scopes, expiresAt: p.data.expiresAt, createdBy: req.user.id });
  await audit.log(
    { userId: req.user.id, email: req.user.email, action: 'api_key:create', resourceType: 'api_key', resourceId: r.key.id, detail: { keyType: r.key.type, keyName: r.key.name, userId: r.key.userId, scopes: r.key.scopes } },
    req
  );
  ok(res, r, 'API Key 创建成功');
});

// GET /api/admin/api-keys/:id
adminRouter.get('/:id', async (req, res) => {
  const id = idUuid(req.params.id);
  if (!id) throw new HttpError(404, 'API Key 不存在');
  ok(res, await apiKeyService.stripSecret(await apiKeyService.getOrThrow(id)));
});

// PATCH /api/admin/api-keys/:id
const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  scopes: z.array(z.string()).optional(),
  expiresAt: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
}).strict();

adminRouter.patch('/:id', async (req, res) => {
  const id = idUuid(req.params.id);
  if (!id) throw new HttpError(404, 'API Key 不存在');
  const p = updateSchema.safeParse(req.body || {});
  if (!p.success) throw zodErr();
  const key = await apiKeyService.updateMeta(id, p.data);
  await audit.log({ userId: req.user.id, email: req.user.email, action: 'api_key:update', resourceType: 'api_key', resourceId: id, detail: { changes: p.data } }, req);
  ok(res, key, 'API Key 已更新');
});

// DELETE /api/admin/api-keys/:id
adminRouter.delete('/:id', async (req, res) => {
  const id = idUuid(req.params.id);
  if (!id) throw new HttpError(404, 'API Key 不存在');
  await apiKeyService.hardDelete(id);
  await audit.log({ userId: req.user.id, email: req.user.email, action: 'api_key:delete', resourceType: 'api_key', resourceId: id }, req);
  ok(res, true, 'API Key 已删除');
});

// POST /api/admin/api-keys/:id/rotate
adminRouter.post('/:id/rotate', async (req, res) => {
  const id = idUuid(req.params.id);
  if (!id) throw new HttpError(404, 'API Key 不存在');
  const r = await apiKeyService.rotate(id);
  await audit.log({ userId: req.user.id, email: req.user.email, action: 'api_key:rotate', resourceType: 'api_key', resourceId: id }, req);
  ok(res, r, 'API Key 已滚动，请立即保存新的 Key');
});

// ---------------- 个人中心：PAT ----------------

async function loadOwnToken(id, userId) {
  const key = await apiKeyService.getOrThrow(id);
  if (String(key.user_id) !== String(userId)) throw new HttpError(404, '令牌不存在');
  if (key.type !== 'pat') throw new HttpError(404, '令牌不存在');
  return key;
}

// GET /api/auth/tokens
tokenRouter.get('/', async (req, res) => {
  const list = await apiKeyService.list({ type: 'pat', userId: req.user.id });
  ok(res, { list, total: list.length });
});

// POST /api/auth/tokens
tokenRouter.post('/', async (req, res) => {
  const p = z.object({
    name: z.string().trim().min(1).max(100),
    expiresAt: z.string().optional().nullable().default(null),
  }).strict().safeParse(req.body || {});
  if (!p.success) throw zodErr();
  const r = await apiKeyService.create({ name: p.data.name, type: 'pat', userId: req.user.id, expiresAt: p.data.expiresAt, createdBy: req.user.id });
  await audit.log({ userId: req.user.id, email: req.user.email, action: 'api_key:create', resourceType: 'api_key', resourceId: r.key.id, detail: { keyType: 'pat', keyName: r.key.name } }, req);
  ok(res, r, '访问令牌已创建');
});

// PATCH /api/auth/tokens/:id
tokenRouter.patch('/:id', async (req, res) => {
  const id = idUuid(req.params.id);
  if (!id) throw new HttpError(404, '令牌不存在');
  await loadOwnToken(id, req.user.id);
  const p = z.object({ name: z.string().trim().min(1).max(100).optional(), isActive: z.boolean().optional() }).strict().safeParse(req.body || {});
  if (!p.success) throw zodErr();
  const key = await apiKeyService.updateMeta(id, p.data);
  await audit.log({ userId: req.user.id, email: req.user.email, action: 'api_key:update', resourceType: 'api_key', resourceId: id, detail: { changes: p.data } }, req);
  ok(res, key, '令牌已更新');
});

// DELETE /api/auth/tokens/:id
tokenRouter.delete('/:id', async (req, res) => {
  const id = idUuid(req.params.id);
  if (!id) throw new HttpError(404, '令牌不存在');
  await loadOwnToken(id, req.user.id);
  await apiKeyService.hardDelete(id);
  await audit.log({ userId: req.user.id, email: req.user.email, action: 'api_key:delete', resourceType: 'api_key', resourceId: id }, req);
  ok(res, true, '令牌已删除');
});

// POST /api/auth/tokens/:id/rotate
tokenRouter.post('/:id/rotate', async (req, res) => {
  const id = idUuid(req.params.id);
  if (!id) throw new HttpError(404, '令牌不存在');
  await loadOwnToken(id, req.user.id);
  const r = await apiKeyService.rotate(id, { userId: req.user.id });
  await audit.log({ userId: req.user.id, email: req.user.email, action: 'api_key:rotate', resourceType: 'api_key', resourceId: id }, req);
  ok(res, r, '令牌已滚动，请立即保存新令牌');
});

module.exports = { adminApiKeysRouter: adminRouter, tokenRouter };