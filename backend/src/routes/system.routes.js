const { ok } = require('../middleware/response');
const config = require('../config');

// GET /api/config — 无需登录，返回系统配置
exports.configRouter = (req, res) => {
  ok(res, { timezone: config.timezone }, 'success');
};
