const express = require('express');
const { z } = require('zod');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const HttpError = require('../utils/http-error');
const { ok } = require('../middleware/response');
const { signShare } = require('../utils/jwt');
const bigScreenService = require('../services/big-screen.service');
const { requireBigScreenShareJwt } = require('../middleware/big-screen-share-auth');

const router = express.Router();

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '密码尝试次数过多，请稍后再试', data: null },
});

// GET /api/public/big-screens/:token/meta
router.get('/:token/meta', async (req, res) => {
  const share = await bigScreenService.getShareByToken(String(req.params.token || ''));
  if (!share) {
    ok(res, { found: false, name: null, requiresPassword: false, expired: false, inactive: false });
    return;
  }
  const st = bigScreenService.shareState(share);
  const screen = await bigScreenService.getBigScreen(share.bigScreenId);
  if (!screen) {
    ok(res, { found: false, name: null, requiresPassword: false, expired: false, inactive: false });
    return;
  }
  ok(res, { found: true, name: screen.name, requiresPassword: !!share.passwordHash, expired: st === 'expired', inactive: st === 'inactive' });
});

// POST /api/public/big-screens/:token/verify
router.post('/:token/verify', async (req, res, next) => {
  let share;
  try {
    share = await bigScreenService.getShareByToken(String(req.params.token || ''));
    bigScreenService.assertShareUsable(share);
  } catch (e) {
    return next(e);
  }
  const issueToken = () => {
    const accessToken = signShare({ shareId: share.id, bigScreenId: share.bigScreenId, token: share.token });
    ok(res, { accessToken });
  };
  if (!share.passwordHash) return issueToken();
  verifyLimiter(req, res, async (err) => {
    if (err) return next(err);
    try {
      const p = z.object({ password: z.string().min(1).max(128) }).strict().safeParse(req.body || {});
      if (!p.success) throw new HttpError(400, '请输入分享密码');
      const okPwd = await bcrypt.compare(p.data.password, share.passwordHash);
      if (!okPwd) throw new HttpError(401, '密码错误', null, 40101);
      issueToken();
    } catch (e) {
      next(e);
    }
  });
});

// GET /api/public/big-screens/:token/screen
router.get('/:token/screen', requireBigScreenShareJwt, async (req, res) => {
  ok(res, await bigScreenService.getBigScreenRenderView(req.share.bigScreenId));
});

module.exports = router;