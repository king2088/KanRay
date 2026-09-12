const { verifyAccess } = require('../utils/jwt');
const HttpError = require('../utils/http-error');

function requireUser(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, '未登录');
  const payload = verifyAccess(token);
  req.user = { id: payload.sub, email: payload.email, roles: payload.roles || [] };
  next();
}

function optionalUser(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = verifyAccess(token);
    req.user = { id: payload.sub, email: payload.email, roles: payload.roles || [] };
  } catch (e) { /* 忽略无效令牌 */ }
  next();
}

module.exports = { requireUser, optionalUser };