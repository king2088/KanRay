const { test } = require('node:test');
const assert = require('node:assert/strict');
const HttpError = require('../src/utils/http-error');
const { signShare, verifyShare } = require('../src/utils/jwt');

test('HttpError 支持自定义 code（默认=status）', () => {
  const a = new HttpError(403, '已过期', null, 40301);
  assert.equal(a.status, 403);
  assert.equal(a.code, 40301);
  const b = new HttpError(404, '不存在');
  assert.equal(b.code, 404);
});

test('signShare/verifyShare 签发与校验（24h）', () => {
  const tok = signShare({ shareId: 7, dashboardId: 9, token: 'abc123' });
  const p = verifyShare(tok);
  assert.equal(p.type, 'share');
  assert.equal(p.shareId, 7);
  assert.equal(p.dashboardId, 9);
  assert.equal(p.token, 'abc123');
});

test('verifyShare 拒绝非 share 类型令牌', () => {
  const { signAccess } = require('../src/utils/jwt');
  const tok = signAccess({ sub: 1 });
  assert.throws(() => verifyShare(tok), (e) => e.status === 401);
});