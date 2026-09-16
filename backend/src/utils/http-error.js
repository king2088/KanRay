class HttpError extends Error {
  constructor(status, message, details, code) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code !== undefined ? code : status;
  }
}

module.exports = HttpError;
