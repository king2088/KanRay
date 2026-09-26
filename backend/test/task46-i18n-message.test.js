const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ok, errorHandler, notFound, HttpError } = require('../src/middleware/response');

function fakeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

test('ok 未传 messageEn 时省略该字段，由前端回退 message', () => {
  const res = fakeRes();
  ok(res, { id: 1 });
  assert.equal(res.body.code, 0);
  assert.equal(res.body.message, 'success');
  assert.equal('messageEn' in res.body, false);
  assert.deepEqual(res.body.data, { id: 1 });
});

test('ok 接受显式中英文文案', () => {
  const res = fakeRes();
  ok(res, null, '创建成功', 'Created');
  assert.equal(res.body.message, '创建成功');
  assert.equal(res.body.messageEn, 'Created');
});

test('HttpError 缺省 messageEn 时省略该字段，不把中文塞进英文位', () => {
  const err = new HttpError(400, '参数错误');
  const res = fakeRes();
  errorHandler(err, {}, res, () => {});
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, '参数错误');
  assert.equal('messageEn' in res.body, false);
  assert.equal(res.body.code, 400);
});

test('HttpError 缺省 messageEn 时按映射表补英文', () => {
  const err = new HttpError(400, '数据源不存在');
  const res = fakeRes();
  errorHandler(err, {}, res, () => {});
  assert.equal(res.body.messageEn, 'Data source not found');
});

test('ok 的中文文案自动查到英文', () => {
  const res = fakeRes();
  ok(res, null, '数据集创建成功');
  assert.equal(res.body.message, '数据集创建成功');
  assert.equal(res.body.messageEn, 'Dataset created');
});

test('ok 显式给出的 messageEn 优先于映射表', () => {
  const res = fakeRes();
  ok(res, null, '数据集创建成功', 'Custom English');
  assert.equal(res.body.messageEn, 'Custom English');
});

test('映射表未收录的文案省略 messageEn，不报错', () => {
  const res = fakeRes();
  ok(res, null, '某个从未出现过的文案');
  assert.equal(res.body.message, '某个从未出现过的文案');
  assert.equal('messageEn' in res.body, false);
});

test('插值错误消息按映射表模板回填英文', () => {
  const err = new HttpError(404, '数据集不存在: id=ds_9');
  const res = fakeRes();
  errorHandler(err, {}, res, () => {});
  assert.equal(res.body.message, '数据集不存在: id=ds_9');
  assert.equal(res.body.messageEn, 'Dataset not found: id=ds_9');
});

test('插值消息未收录时省略 messageEn', () => {
  const err = new HttpError(404, '未收录的插值消息: id=xyz');
  const res = fakeRes();
  errorHandler(err, {}, res, () => {});
  assert.equal('messageEn' in res.body, false);
});

test('HttpError 携带 messageEn', () => {
  const err = new HttpError(400, '参数错误', undefined, 40001, 'Invalid parameter');
  const res = fakeRes();
  errorHandler(err, {}, res, () => {});
  assert.equal(res.body.messageEn, 'Invalid parameter');
  assert.equal(res.body.code, 40001);
});

test('未分类错误返回英文兜底文案', () => {
  const res = fakeRes();
  errorHandler(new Error('boom'), {}, res, () => {});
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.message, '服务器内部错误');
  assert.equal(res.body.messageEn, 'Internal server error');
});

test('body 过大错误双语', () => {
  const err = new Error('too large');
  err.type = 'entity.too.large';
  const res = fakeRes();
  errorHandler(err, {}, res, () => {});
  assert.equal(res.body.messageEn, 'Uploaded content is too large');
});

test('JSON 解析失败双语', () => {
  const err = new Error('bad json');
  err.type = 'entity.parse.failed';
  const res = fakeRes();
  errorHandler(err, {}, res, () => {});
  assert.equal(res.body.messageEn, 'Request body is not valid JSON');
});

test('Multer 上传错误双语', () => {
  const err = new Error('field error');
  err.name = 'MulterError';
  const res = fakeRes();
  errorHandler(err, {}, res, () => {});
  assert.equal(res.body.messageEn, 'File upload error: field error');
});

test('notFound 双语且保留原始路径', () => {
  const res = fakeRes();
  notFound({ originalUrl: '/api/nope' }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.message, '请求路径不存在: /api/nope');
  assert.equal(res.body.messageEn, 'Route not found: /api/nope');
});

test('details 透传不受影响', () => {
  const err = new HttpError(422, '校验失败', [{ path: 'name' }], 422, 'Validation failed');
  const res = fakeRes();
  errorHandler(err, {}, res, () => {});
  assert.deepEqual(res.body.details, [{ path: 'name' }]);
});
