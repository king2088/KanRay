const HttpError = require('../utils/http-error');
const rbac = require('../services/rbac.service');

function requirePermission(resource, action) {
  return async (req, res, next) => {
    if (!req.user) throw new HttpError(401, '未登录');
    if (!await rbac.hasPermission(req.user.id, resource, action)) throw new HttpError(403, `无权限执行该操作: ${resource}:${action}`);
    next();
  };
}

module.exports = { requirePermission };