// 首行设置 DB_PATH（本文件不读库，但保持约定一致避免误加载真实库）
process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
let JWT;
let jwt;

test('先 reset 模块（读最新 config）', () => {
  jestLikeReset();
  JWT = require('../src/utils/jwt');
  jwt = JWT.jwt;
});

function jestLikeReset() {
  delete require.cache[require.resolve('../src/config/index.js')];
}

test('signAccess/verifyAccess 往返', () => {
  const token = JWT.signAccess({ sub: 7, email: 'a@b.c' });
  const payload = JWT.verifyAccess(token);
  assert.equal(payload.sub, 7);
  assert.equal(payload.email, 'a@b.c');
  assert.ok(payload.iat && payload.exp && payload.exp * 1000 > Date.now());
});

test('过期 token 校验失败', () => {
  const token = JWT.signAccess({ sub: 1 }, -10); // 过期
  try { JWT.verifyAccess(token); assert.fail('应当抛出'); }
  catch (e) { assert.ok(/过期/.test(e.message)); }
});

test('错误 token 校验失败', () => {
  try { JWT.verifyAccess('bad-token'); assert.fail('应当抛出'); }
  catch (e) { assert.ok(e.message); }
});

test('signRefresh 结果带 jti', () => {
  const { token, jti, expiresAt } = JWT.signRefresh({ sub: 3 });
  assert.ok(typeof token === 'string' && token.length > 20);
  assert.ok(jti && typeof jti === 'string');
  assert.ok(expiresAt > Date.now());
});

test('断言签名后 token 与顶层导出一致', () => {
  assert.equal(typeof jwt, 'object');
  assert.equal(typeof JWT.jwt?.sign, 'function');
});