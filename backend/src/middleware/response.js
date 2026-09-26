const HttpError = require('../utils/http-error');
const { enOf } = require('../i18n');

// 统一成功响应。message 保持中文以兼容既有 API 消费者。
// messageEn 优先用调用方显式给出的值，否则按中文原文查表；查不到就省略该字段，
// 由前端回退中文——避免把中文写进名为 messageEn 的字段。
function ok(res, data, message = 'success', messageEn) {
  const body = { code: 0, data, message };
  const en = messageEn || enOf(message);
  if (en) body.messageEn = en;
  res.json(body);
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
    // 调用点显式给出的英文优先，否则按中文原文查表；都没有就省略
    messageEn = err.messageEn || enOf(message);
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

  const body = { code: (err && err.code !== undefined) ? err.code : status, message, data: null };
  if (messageEn) body.messageEn = messageEn;
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
