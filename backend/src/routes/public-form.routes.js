const express = require('express');
const { z } = require('zod');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const HttpError = require('../utils/http-error');
const { ok } = require('../middleware/response');
const { signShare } = require('../utils/jwt');
const formShareService = require('../services/form-share.service');
const { requireFormShareJwt } = require('../middleware/form-share-auth');
const formService = require('../services/form.service');
const submissionService = require('../services/form-submission.service');

const router = express.Router();

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '密码尝试次数过多，请稍后再试', data: null },
});

// GET /api/public/forms/:token/meta
router.get('/:token/meta', async (req, res) => {
  const share = await formShareService.getShareByToken(String(req.params.token || ''));
  if (!share) {
    ok(res, { found: false, formName: null, requiresPassword: false, expired: false, inactive: false });
    return;
  }
  const st = formShareService.shareState(share);
  const form = await formService.getForm(String(share.formId));
  ok(res, {
    found: true,
    formId: share.formId,
    formName: form?.name || '表单',
    published: form?.status === 'published',
    requiresPassword: !!share.passwordHash,
    expired: st === 'expired',
    inactive: st === 'inactive',
  });
});

// POST /api/public/forms/:token/verify
router.post('/:token/verify', async (req, res, next) => {
  let share;
  try {
    share = await formShareService.getShareByToken(String(req.params.token || ''));
    formShareService.assertShareUsable(share);
  } catch (e) {
    return next(e);
  }
  const issueToken = () => {
    const accessToken = signShare({ shareId: share.id, formId: share.formId, token: share.token });
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

// GET /api/public/forms/:token/form  填写页数据（精简 schema）
router.get('/:token/form', requireFormShareJwt, async (req, res) => {
  ok(res, await formShareService.getFillView(req.share));
});

// POST /api/public/forms/:token/submissions  匿名提交
const submitSchema = z.object({ values: z.record(z.any()).optional().default({}) }).strict();
router.post('/:token/submissions', requireFormShareJwt, async (req, res) => {
  const parsed = submitSchema.safeParse(req.body || {});
  if (!parsed.success) throw new HttpError(400, '提交参数不正确', parsed.error.flatten());
  const form = await formService.getForm(String(req.share.formId));
  if (!form) throw new HttpError(404, '表单不存在或已被删除');
  const row = await submissionService.insert(form, parsed.data.values, null);
  ok(res, row, '提交成功');
});

module.exports = router;