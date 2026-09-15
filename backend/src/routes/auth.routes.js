const express = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const HttpError = require('../utils/http-error');
const { ok } = require('../middleware/response');
const authService = require('../services/auth.service');
const { requireUser } = require('../middleware/auth');
const audit = require('../services/audit.service');

const router = express.Router();

// 认证接口限流：避免暴力破解/滥用（登录/注册/刷新，登出与个人中心不限制）
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '请求过于频繁，请稍后再试', data: null },
});

router.post('/register', authLimiter, async (req, res) => {
  const s = z.object({ email: z.string().min(1), password: z.string().min(1), name: z.string().optional().default('') }).strict();
  const p = s.safeParse(req.body);
  if (!p.success) throw new HttpError(400, '注册信息不完整');
  const user = await authService.register(p.data);
  await audit.log({ userId: user.id, email: user.email, action: 'register' }, req);
  ok(res, user, '注册成功');
});

router.post('/login', authLimiter, async (req, res) => {
  const s = z.object({ email: z.string().min(1), password: z.string().min(1) });
  const p = s.safeParse(req.body);
  if (!p.success) throw new HttpError(400, '请输入邮箱和密码');
  try {
    const r = await authService.login(p.data.email, p.data.password);
    await audit.log({ userId: r.user.id, email: r.user.email, action: 'login' }, req);
    ok(res, r, '登录成功');
  } catch (e) {
    if (e.status === 401 || e.status === 403) await audit.log({ email: String(p.data.email || ''), action: 'login_failed' }, req);
    throw e;
  }
});

router.post('/refresh', authLimiter, async (req, res) => {
  const s = z.object({ refreshToken: z.string().min(1) });
  const p = s.safeParse(req.body);
  if (!p.success) throw new HttpError(400, '缺少 refreshToken');
  const r = await authService.refresh(p.data.refreshToken);
  ok(res, r, '刷新成功');
});

router.post('/logout', requireUser, async (req, res) => {
  await authService.logout({ sub: req.user.id });
  await audit.log({ userId: req.user.id, action: 'logout' }, req);
  ok(res, true, '已退出登录');
});

router.get('/me', requireUser, async (req, res) => {
  ok(res, await authService.userWithRoles(req.user.id));
});

router.patch('/me', requireUser, async (req, res) => {
  const s = z.object({ name: z.string().trim().min(1).max(50) }).strict();
  const p = s.safeParse(req.body);
  if (!p.success) throw new HttpError(400, '昵称不合法');
  ok(res, await authService.updateProfile(req.user.id, p.data), '资料已更新');
});

router.put('/password', requireUser, async (req, res) => {
  const s = z.object({ oldPassword: z.string().min(1), newPassword: z.string().min(1) }).strict();
  const p = s.safeParse(req.body);
  if (!p.success) throw new HttpError(400, '参数不完整');
  await authService.changePassword(req.user.id, p.data.oldPassword, p.data.newPassword);
  await audit.log({ userId: req.user.id, action: 'change_password' }, req);
  ok(res, true, '密码已修改');
});

module.exports = router;