const HttpError = require('../utils/http-error');
const { verifyShare } = require('../utils/jwt');
const bigScreenShareService = require('../services/big-screen.service');

// 校验 Bearer 分享态 JWT（大屏）：typ='share'、token 与路径一致、分享仍可用
// Express 5 会捕获 async 中间件的 reject，故此处 await 装载完成后再 next()
async function requireBigScreenShareJwt(req, res, next) {
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!bearer) throw new HttpError(401, '缺少访问凭证', null, 40102);
  let payload;
  try {
    payload = verifyShare(bearer);
  } catch (e) {
    throw new HttpError(401, e.message || '访问凭证无效', null, 40102);
  }
  await requestLoad(payload, req);
  next();
}

async function requestLoad(payload, req) {
  if (payload.token !== String(req.params.token || '')) {
    throw new HttpError(401, '访问凭证与链接不匹配', null, 40102);
  }
  const share = payload.shareId == null ? null : await bigScreenShareService.getShare(payload.shareId);
  if (!share || share.token !== payload.token) throw new HttpError(401, '访问凭证已失效', null, 40102);
  bigScreenShareService.assertShareUsable(share);
  req.share = share;
}

module.exports = { requireBigScreenShareJwt };