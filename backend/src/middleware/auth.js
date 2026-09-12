const db = require('../db');
const { verifyAccess } = require('../utils/jwt');
const HttpError = require('../utils/http-error');

function requireUser(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, '未登录');
  const payload = verifyAccess(token);
  const user = db.prepare('SELECT is_active FROM users WHERE id = ?').get(String(payload.sub));
  if (!user) throw new HttpError(401, '账号不存在');
  if (!user.is_active) throw new HttpError(403, '账号已被禁用');
  req.user = { id: payload.sub, email: payload.email, roles: payload.roles || [] };
  next();
}

function optionalUser(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = verifyAccess(token);
    const user = db.prepare('SELECT is_active FROM users WHERE id = ?').get(String(payload.sub));
    if (!user || !user.is_active) return next(); // 账号缺失/禁用视为匿名
    req.user = { id: payload.sub, email: payload.email, roles: payload.roles || [] };
  } catch (e) { /* 忽略无效令牌 */ }
  next();
}

module.exports = { requireUser, optionalUser };