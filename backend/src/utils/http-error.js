class HttpError extends Error {
  // messageEn 为可选第 5 参：英文文案，缺失时响应层回退中文 message
  constructor(status, message, details, code, messageEn) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code !== undefined ? code : status;
    this.messageEn = messageEn;
  }
}

module.exports = HttpError;
