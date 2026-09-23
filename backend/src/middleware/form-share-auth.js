const HttpError = require('../utils/http-error');
const { verifyShare } = require('../utils/jwt');
const formShareService = require('../services/form-share.service');

// 校验 Bearer 表单分享态 JWT：typ='share'、token 与路径一致、分享仍可用
async function requestLoad(payload, req) {
  if (payload.token !== String(req.params.token || '')) {
    throw new HttpError(401, '访问凭证与链接不匹配', null, 40102);
  }
  const share = await formShareService.getShare(payload.shareId);
  if (!share || share.token !== payload.token) throw new HttpError(401, '访问凭证已失效', null, 40102);
  formShareService.assertShareUsable(share);
  req.share = share;
  return share;
}

async function requireFormShareJwt(req, res, next) {
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

module.exports = { requireFormShareJwt, requestLoad };