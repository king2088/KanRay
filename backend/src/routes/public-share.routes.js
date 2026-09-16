const express = require('express');
const { z } = require('zod');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const HttpError = require('../utils/http-error');
const { ok } = require('../middleware/response');
const { signShare } = require('../utils/jwt');
const shareService = require('../services/share.service');
const { requireShareJwt } = require('../middleware/share-auth');

const router = express.Router();

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '密码尝试次数过多，请稍后再试', data: null },
});

// GET /api/public/shares/:token/meta
router.get('/:token/meta', async (req, res) => {
  const share = await shareService.getShareByToken(String(req.params.token || ''));
  if (!share) {
    ok(res, { found: false, dashboardName: null, requiresPassword: true, expired: false, inactive: false });
    return;
  }
  const st = shareService.shareState(share);
  const dash = await shareService.getDashboardName(share.dashboardId);
  ok(res, { found: true, dashboardName: dash?.name || '看板', requiresPassword: true, expired: st === 'expired', inactive: st === 'inactive' });
});

// POST /api/public/shares/:token/verify
router.post('/:token/verify', verifyLimiter, async (req, res) => {
  const s = z.object({ password: z.string().min(1).max(128) }).strict();
  const p = s.safeParse(req.body || {});
  if (!p.success) throw new HttpError(400, '请输入分享密码');
  const share = await shareService.getShareByToken(String(req.params.token || ''));
  shareService.assertShareUsable(share);
  const okPwd = await bcrypt.compare(p.data.password, share.passwordHash);
  if (!okPwd) throw new HttpError(401, '密码错误', null, 40101);
  const accessToken = signShare({ shareId: share.id, dashboardId: share.dashboardId, token: share.token });
  ok(res, { accessToken });
});

// GET /api/public/shares/:token/dashboard
router.get('/:token/dashboard', requireShareJwt, async (req, res) => {
  ok(res, await shareService.getDashboardRenderView(req.share.dashboardId));
});

// POST /api/public/shares/:token/charts/:chartId/data
const dataSchema = z.object({ filters: z.array(z.any()).optional().default([]) }).strict();
router.post('/:token/charts/:chartId/data', requireShareJwt, async (req, res) => {
  const parsed = dataSchema.safeParse(req.body || {});
  if (!parsed.success) throw new HttpError(400, '参数不正确');
  const data = await shareService.getChartData(req.share, Number(req.params.chartId));
  ok(res, { data });
});

module.exports = router;