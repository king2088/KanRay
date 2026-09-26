const HttpError = require('../utils/http-error');

// 统一成功响应。message 保持中文以兼容既有 API 消费者，messageEn 为英文文案。
function ok(res, data, message = 'success', messageEn = 'Success') {
  res.json({ code: 0, data, message, messageEn });
}

// Express 5 统一错误中间件：异步 throw 会自动汇入此处
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = 500;
  let message = '服务器内部错误';
  let messageEn = 'Internal server error';
  let details;

  if (err instanceof HttpError) {
    status = err.status;
    message = err.message;
    // 未提供英文文案时回退中文，保证前端在英文界面也有可读文本
    messageEn = err.messageEn || message;
    details = err.details;
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = '上传内容过大';
    messageEn = 'Uploaded content is too large';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = '请求体不是合法 JSON';
    messageEn = 'Request body is not valid JSON';
  } else if (err.name === 'MulterError') {
    status = 400;
    message = `文件上传错误: ${err.message}`;
    messageEn = `File upload error: ${err.message}`;
  } else {
    // 兜底日志，避免吞掉未知错误
    console.error('[error]', err);
  }

  const body = { code: (err && err.code !== undefined) ? err.code : status, message, messageEn, data: null };
  if (details !== undefined) body.details = details;
  res.status(status).json(body);
}

// 未匹配路由
function notFound(req, res) {
  res.status(404).json({
    code: 404,
    message: `请求路径不存在: ${req.originalUrl}`,
    messageEn: `Route not found: ${req.originalUrl}`,
    data: null,
  });
}

module.exports = { ok, errorHandler, notFound, HttpError };
