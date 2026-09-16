const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const config = require('../config');
const HttpError = require('./http-error');

// 访问令牌有效期（秒）：支持 'us' 前缀（微秒数，如 mcp 场景）或 'Nm'（N 分钟），默认 900s
const ACCESS_MAX_AGE_SEC = ((exp) => {
  if (exp.startsWith('us')) return parseInt(exp.slice(2), 10) / 1000;
  const m = /^(\d+)\s*m$/.exec(exp);
  if (m) return parseInt(m[1], 10) * 60;
  return 900;
})(config.auth.accessTtl);

// 签发访问令牌
function signAccess(payload, expiresInOverride) {
  return jwt.sign({ ...payload, type: 'access' }, config.auth.jwtSecret, {
    expiresIn: expiresInOverride !== undefined ? expiresInOverride : ACCESS_MAX_AGE_SEC,
  });
}

// 校验访问令牌，失败统一抛出 401 HttpError（区分过期/无效，便于错误提示）
function verifyAccess(token) {
  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret);
    if (decoded.type !== 'access') throw new HttpError(401, '令牌无效');
    return decoded;
  } catch (e) {
    if (e.name === 'TokenExpiredError') throw new HttpError(401, '令牌已过期');
    throw new HttpError(401, '令牌无效');
  }
}

const REFRESH_TTL_MS = config.auth.refreshTtlDays * 24 * 3600 * 1000;

// 签发刷新令牌：携带唯一 jti 便于服务端注销/轮换，返回 token 与过期时间
function signRefresh(payload, ttlMs = REFRESH_TTL_MS) {
  const jti = randomUUID();
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + Math.floor(ttlMs / 1000);
  const token = jwt.sign({ ...payload, jti }, config.auth.jwtSecret);
  return { token, jti, expiresAt: Date.now() + ttlMs, exp, iat };
}

// 校验刷新令牌
function verifyRefresh(token) {
  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret);
    if (decoded.type !== 'refresh') throw new HttpError(401, '刷新令牌无效');
    return decoded;
  } catch (e) {
    throw new HttpError(401, '刷新令牌无效');
  }
}

// 分享态令牌有效期（秒）：24h
const SHARE_MAX_AGE_SEC = 24 * 3600;

// 签发分享态访问令牌（typ:'share'，载荷含 shareId/dashboardId/token）
function signShare(payload) {
  return jwt.sign({ ...payload, type: 'share' }, config.auth.jwtSecret, { expiresIn: SHARE_MAX_AGE_SEC });
}

// 校验分享态令牌，失败统一 401
function verifyShare(token) {
  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret);
    if (decoded.type !== 'share') throw new HttpError(401, '分享凭证无效');
    return decoded;
  } catch (e) {
    if (e.name === 'TokenExpiredError') throw new HttpError(401, '分享凭证已过期');
    if (e instanceof HttpError) throw e;
    throw new HttpError(401, '分享凭证无效');
  }
}

module.exports = { jwt, signAccess, verifyAccess, signRefresh, verifyRefresh, signShare, verifyShare, ACCESS_MAX_AGE_SEC, REFRESH_TTL_MS, SHARE_MAX_AGE_SEC };