const HttpError = require('../utils/http-error');

// 统一成功响应
function ok(res, data, message = 'success') {
  res.json({ code: 0, data, message });
}

// Express 5 统一错误中间件：异步 throw 会自动汇入此处
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = 500;
  let message = '服务器内部错误';
  let details;

  if (err instanceof HttpError) {
    status = err.status;
    message = err.message;
    details = err.details;
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = '上传内容过大';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = '请求体不是合法 JSON';
  } else if (err.name === 'MulterError') {
    status = 400;
    message = `文件上传错误: ${err.message}`;
  } else {
    // 兜底日志，避免吞掉未知错误
    console.error('[error]', err);
  }

  const body = { code: (err && err.code !== undefined) ? err.code : status, message, data: null };
  if (details !== undefined) body.details = details;
  res.status(status).json(body);
}

// 未匹配路由
function notFound(req, res) {
  res.status(404).json({ code: 404, message: `请求路径不存在: ${req.originalUrl}`, data: null });
}

module.exports = { ok, errorHandler, notFound, HttpError };
