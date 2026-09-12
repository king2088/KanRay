const express = require('express');
const { z } = require('zod');
const HttpError = require('../utils/http-error');
const { ok } = require('../middleware/response');
const authService = require('../services/auth.service');
const { requireUser } = require('../middleware/auth');
const audit = require('../services/audit.service');

const router = express.Router();

router.post('/register', (req, res) => {
  const s = z.object({ email: z.string().min(1), password: z.string().min(1), name: z.string().optional().default('') }).strict();
  const p = s.safeParse(req.body);
  if (!p.success) throw new HttpError(400, '注册信息不完整');
  const user = authService.register(p.data);
  audit.log({ userId: user.id, email: user.email, action: 'register' }, req);
  ok(res, user, '注册成功');
});

router.post('/login', (req, res) => {
  const s = z.object({ email: z.string().min(1), password: z.string().min(1) });
  const p = s.safeParse(req.body);
  if (!p.success) throw new HttpError(400, '请输入邮箱和密码');
  const r = authService.login(p.data.email, p.data.password);
  audit.log({ userId: r.user.id, email: r.user.email, action: 'login' }, req);
  ok(res, r, '登录成功');
});

router.post('/refresh', (req, res) => {
  const s = z.object({ refreshToken: z.string().min(1) });
  const p = s.safeParse(req.body);
  if (!p.success) throw new HttpError(400, '缺少 refreshToken');
  const r = authService.refresh(p.data.refreshToken);
  ok(res, r, '刷新成功');
});

router.post('/logout', requireUser, (req, res) => {
  authService.logout(req.user);
  audit.log({ userId: req.user.id, action: 'logout' }, req);
  ok(res, true, '已退出登录');
});

router.get('/me', requireUser, (req, res) => {
  ok(res, authService.userWithRoles(req.user.id));
});

router.patch('/me', requireUser, (req, res) => {
  const s = z.object({ name: z.string().trim().min(1).max(50) }).strict();
  const p = s.safeParse(req.body);
  if (!p.success) throw new HttpError(400, '昵称不合法');
  ok(res, authService.updateProfile(req.user.id, p.data), '资料已更新');
});

router.put('/password', requireUser, (req, res) => {
  const s = z.object({ oldPassword: z.string().min(1), newPassword: z.string().min(1) }).strict();
  const p = s.safeParse(req.body);
  if (!p.success) throw new HttpError(400, '参数不完整');
  authService.changePassword(req.user.id, p.data.oldPassword, p.data.newPassword);
  audit.log({ userId: req.user.id, action: 'change_password' }, req);
  ok(res, true, '密码已修改');
});

module.exports = router;