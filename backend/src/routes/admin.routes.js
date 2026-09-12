const express = require('express');
const { z } = require('zod');
const HttpError = require('../utils/http-error');
const { ok } = require('../middleware/response');
const { requireUser } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const rbac = require('../services/rbac.service');
const audit = require('../services/audit.service');
const { parsePageQuery } = require('../utils/pagination');

const router = express.Router();

// 后台模块统一鉴权
router.use(requireUser);

// -------- 用户管理 --------
router.get('/users', requirePermission('user', 'read'), (req, res) => {
  const page = parsePageQuery(req.query);
  const r = rbac.listUsers(page ? { page: page.page, pageSize: page.pageSize } : undefined);
  if (page) {
    ok(res, r, '用户列表');
  } else {
    ok(res, { list: r.list, total: r.total }, '用户列表');
  }
});

router.post('/users', requirePermission('user', 'create'), (req, res) => {
  const schema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(8),
    name: z.string().trim().min(1).max(50),
    roleIds: z.array(z.number().int().positive()).optional().default([]),
  }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, '参数不完整');
  const user = rbac.createUser(parsed.data.email, parsed.data.password, parsed.data.name, parsed.data.roleIds);
  audit.log(
    { userId: req.user.id, email: req.user.email, action: 'admin_user_create', resourceType: 'user', resourceId: user.id, detail: { email: user.email, roleIds: parsed.data.roleIds } },
    req
  );
  ok(res, user, '用户创建成功');
});

router.patch('/users/:id', requirePermission('user', 'update'), (req, res) => {
  const schema = z.object({
    name: z.string().trim().min(1).max(50).optional(),
    is_active: z.boolean().optional(),
    password: z.string().min(8).optional(),
    roleIds: z.array(z.number().int().positive()).optional(),
  }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, '参数不完整');
  const id = Number(req.params.id);
  rbac.rbacUser(id);
  if (parsed.data.name !== undefined) rbac.updateUserProfile(id, { name: parsed.data.name });
  if (parsed.data.is_active !== undefined) rbac.setUserActive(id, parsed.data.is_active);
  if (parsed.data.roleIds !== undefined) rbac.assignRoles(id, parsed.data.roleIds);
  if (parsed.data.password !== undefined) rbac.resetPassword(id, parsed.data.password);
  audit.log(
    { userId: req.user.id, email: req.user.email, action: 'admin_user_update', resourceType: 'user', resourceId: id, detail: parsed.data },
    req
  );
  ok(res, rbac.rbacUser(id), '用户已更新');
});

router.delete('/users/:id', requirePermission('user', 'delete'), (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) throw new HttpError(400, '不能删除当前登录账号');
  rbac.deleteUser(id);
  audit.log(
    { userId: req.user.id, email: req.user.email, action: 'admin_user_delete', resourceType: 'user', resourceId: id },
    req
  );
  ok(res, true, '用户已删除');
});

// -------- 角色管理 --------
router.get('/roles', requirePermission('role', 'read'), (req, res) => {
  ok(res, rbac.listRoles(), '角色列表');
});

router.post('/roles', requirePermission('role', 'create'), (req, res) => {
  const schema = z.object({
    code: z.string().trim(),
    name: z.string().trim().min(1).max(50),
    description: z.string().trim().max(200).optional().default(''),
    permissions: z.array(z.string()).optional().default([]),
  }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, '参数不完整');
  const role = rbac.createRole(parsed.data.code, parsed.data.name, parsed.data.permissions, parsed.data.description);
  audit.log(
    { userId: req.user.id, email: req.user.email, action: 'admin_role_create', resourceType: 'role', resourceId: role.id, detail: { code: role.code, permissions: parsed.data.permissions } },
    req
  );
  ok(res, role, '角色创建成功');
});

router.patch('/roles/:id', requirePermission('role', 'update'), (req, res) => {
  const schema = z.object({
    name: z.string().trim().min(1).max(50).optional(),
    description: z.string().trim().max(200).optional(),
    permissions: z.array(z.string()).optional(),
  }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, '参数不完整');
  const role = rbac.updateRole(Number(req.params.id), parsed.data);
  audit.log(
    { userId: req.user.id, email: req.user.email, action: 'admin_role_update', resourceType: 'role', resourceId: role.id, detail: parsed.data },
    req
  );
  ok(res, role, '角色已更新');
});

router.delete('/roles/:id', requirePermission('role', 'delete'), (req, res) => {
  const id = Number(req.params.id);
  rbac.deleteRole(id);
  audit.log(
    { userId: req.user.id, email: req.user.email, action: 'admin_role_delete', resourceType: 'role', resourceId: id },
    req
  );
  ok(res, true, '角色已删除');
});

// -------- 权限列表 --------
router.get('/permissions', requirePermission('user', 'read'), (req, res) => {
  ok(res, rbac.listPermissions(), '权限列表');
});

// -------- 审计 --------
router.get('/audit', requirePermission('audit', 'read'), (req, res) => {
  const page = parsePageQuery(req.query);
  const p = page || { page: 1, pageSize: 20 };
  ok(res, audit.list({ page: p.page, pageSize: p.pageSize }), '审计日志');
});

module.exports = router;