const express = require('express');
const { z } = require('zod');
const HttpError = require('../utils/http-error');
const { ok } = require('../middleware/response');
const { requireUser } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const formService = require('../services/form.service');
const submissionService = require('../services/form-submission.service');
const access = require('../services/access.service');
const rbac = require('../services/rbac.service');

const router = express.Router();

// GET /api/forms  (管理员看全部；普通用户仅本人创建；与数据集/图表列表同一套访问策略)
router.get('/', requireUser, requirePermission('form', 'read'), async (req, res) => {
  const items = await formService.listForms(await access.scopedWhere('form', req.user, rbac));
  ok(res, items);
});

// POST /api/forms  { name, description? }
router.post('/', requireUser, requirePermission('form', 'create'), async (req, res) => {
  const schema = z.object({
    name: z.string().trim().min(1).max(100),
    description: z.string().max(1000).optional().default(''),
  }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, '表单名称不能为空且不超过 100 字符');
  ok(res, await formService.createForm({ name: parsed.data.name, description: parsed.data.description, ownerId: req.user.id }), '表单创建成功');
});

// GET /api/forms/:id
router.get('/:id', requireUser, requirePermission('form', 'read'), async (req, res) => {
  const id = req.params.id;
  await access.assertResource('form', id, req.user, rbac);
  ok(res, await formService.getFormOrThrow(id));
});

// PATCH /api/forms/:id  { name?, description?, schemaJson?, submitConfig? }
router.patch('/:id', requireUser, requirePermission('form', 'update'), async (req, res) => {
  const id = req.params.id;
  await access.assertResource('form', id, req.user, rbac);
  const schema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().max(1000).optional(),
    schemaJson: z.any().optional(),
    submitConfig: z.any().optional(),
  }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, '表单参数不正确', parsed.error.flatten());
  ok(res, await formService.updateForm(id, parsed.data), '表单更新成功');
});

// POST /api/forms/:id/publish
router.post('/:id/publish', requireUser, requirePermission('form', 'publish'), async (req, res) => {
  const id = req.params.id;
  await access.assertResource('form', id, req.user, rbac);
  ok(res, await formService.publish(id, req.user.id, req), '表单发布成功');
});

// POST /api/forms/:id/close
router.post('/:id/close', requireUser, requirePermission('form', 'publish'), async (req, res) => {
  const id = req.params.id;
  await access.assertResource('form', id, req.user, rbac);
  ok(res, await formService.close(id, req.user.id, req), '表单已关闭');
});

// DELETE /api/forms/:id
router.delete('/:id', requireUser, requirePermission('form', 'delete'), async (req, res) => {
  const id = req.params.id;
  await access.assertResource('form', id, req.user, rbac);
  ok(res, await formService.deleteForm(id, req.user.id, req), '删除成功');
});

// POST /api/forms/:id/submissions  内部提交（登录用户）
router.post('/:id/submissions', requireUser, requirePermission('form', 'submit'), async (req, res) => {
  const id = req.params.id;
  const form = await formService.getFormOrThrow(id);
  const row = await submissionService.insert(form, req.body.values ?? {}, req.user.id);
  ok(res, row, '提交成功');
});

// GET /api/forms/:id/submissions?mine=1    管理员/owner 看全部；mine=1 只看本人
router.get('/:id/submissions', requireUser, requirePermission('form', 'submission:read'), async (req, res) => {
  const id = req.params.id;
  const mine = req.query.mine === '1' || req.query.mine === 'true';
  const form = await formService.getFormOrThrow(id);
  if (mine) {
    ok(res, await formService.listMySubmissions(form, req.user.id));
  } else {
    await access.assertResource('form', id, req.user, rbac);
    ok(res, await formService.listSubmissions(form));
  }
});

// PATCH /api/forms/:id/submissions/:subId
router.patch('/:id/submissions/:subId', requireUser, requirePermission('form', 'submission:update'), async (req, res) => {
  const id = req.params.id;
  const subId = Number(req.params.subId);
  await access.assertResource('form', id, req.user, rbac);
  const form = await formService.getFormOrThrow(id);
  ok(res, await submissionService.update(form, subId, req.body.values ?? {}), '更新成功');
});

// DELETE /api/forms/:id/submissions/:subId
router.delete('/:id/submissions/:subId', requireUser, requirePermission('form', 'submission:delete'), async (req, res) => {
  const id = req.params.id;
  const subId = Number(req.params.subId);
  await access.assertResource('form', id, req.user, rbac);
  const form = await formService.getFormOrThrow(id);
  ok(res, await submissionService.remove(form, subId), '删除成功');
});

module.exports = router;