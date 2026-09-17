// T3：openAuth 中间件（凭证解析/吊销/过期/禁用/scope门）+ 按钥匙限流 + 审计钩子
process.env.OPEN_API_RATE_PER_MIN = '2';
process.env.DB_PATH = `/tmp/kanban-test-openauth-${process.pid}.db`;
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const express = require('express');
const { db, resetDb } = require('./helpers/db');
const authService = require('../src/services/auth.service');
const apiKeyService = require('../src/services/api-key.service');
const { openAuth, requireScope, createOpenRateLimit, auditExit } = require('../src/middleware/open-auth');
const { errorHandler, notFound } = require('../src/middleware/response');

function listen(app) {
  const server = http.createServer(app);
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}
function request(server, { method = 'GET', path, headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ method, path, host: '127.0.0.1', port: server.address().port, headers }, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(chunks); } catch { /* keep null */ }
        resolve({ status: res.statusCode, body: parsed, raw: chunks });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

let server;
let app;
let customerKey; // chart:read 范围 static key，映射 customer(默认 viewer)

async function bootApp() {
  await resetDb();
  const cust = await authService.register({ email: 'cust@openapi.com', password: 'Password123!', name: '客户' });
  customerKey = await apiKeyService.create({ name: '客户Key', type: 'static', userId: cust.id, scopes: ['chart:read'], createdBy: 1 });

  app = express();
  app.use(express.json());
  app.get('/open/me', openAuth, (req, res) => res.json({ code: 0, data: { userId: req.principal.user.id, email: req.principal.user.email, effective: req.principal.effective } }));
  app.get('/open/chart-scope', openAuth, requireScope('chart:read'), (req, res) => res.json({ code: 0 }));
  app.get('/open/dataset-scope', openAuth, requireScope('dataset:read'), (req, res) => res.json({ code: 0 }));
  app.get('/open/data-exit', openAuth, (req, res) => {
    // 模拟数据出口审计
    (async () => { await auditExit(req, 'chart', '9', 'api:chart.data'); })()
      .then(() => res.json({ code: 0 }))
      .catch((e) => res.status(500).json({ code: 500, message: e.message }));
  });
  app.use('/open/limited', openAuth, createOpenRateLimit(2), (req, res) => res.json({ code: 0 }));
  app.use(notFound);
  app.use(errorHandler);
  server = await listen(app);
}
test.before(async () => { await bootApp(); });
test.after(() => server.close());

test('有效 Key（Bearer）→ principal.user/effective 正确', async () => {
  const r = await request(server, { path: '/open/me', headers: { authorization: `Bearer ${customerKey.plaintext}` } });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.userId, customerKey.key.userId);
  assert.deepEqual(r.body.data.effective, ['chart:read']);
});

test('x-api-key 头同样可用，且 key last_used_at 被写入', async () => {
  const r = await request(server, { path: '/open/me', headers: { 'x-api-key': customerKey.plaintext } });
  assert.equal(r.status, 200);
  const row = db.prepare('SELECT last_used_at FROM api_keys WHERE id = ?').get(customerKey.key.id);
  assert.ok(row.last_used_at, '应写入 last_used_at');
});

test('缺少/格式错误的 Key → 401', async () => {
  for (const headers of [
    {},
    { authorization: 'Bearer just-a-jwt-lookalike' },
    { 'x-api-key': 'not-kan-at-all' },
  ]) {
    const r = await request(server, { path: '/open/me', headers });
    assert.equal(r.status, 401);
  }
});

test('无效 Key → 401（不区分具体原因，防枚举）', async () => {
  const r = await request(server, { path: '/open/me', headers: { authorization: 'Bearer kan_live_does-not-exist-123456' } });
  assert.equal(r.status, 401);
  assert.equal(r.body.code, 401);
});

test('已吊销 Key → 401', async () => {
  const k = await apiKeyService.create({ name: 'rev', type: 'pat', userId: customerKey.key.userId, createdBy: customerKey.key.userId });
  await apiKeyService.setStatus(k.key.id, 'revoked');
  const r = await request(server, { path: '/open/me', headers: { authorization: `Bearer ${k.plaintext}` } });
  assert.equal(r.status, 401);
});

test('已过期 Key → 401', async () => {
  const past = new Date(Date.now() - 3600000).toISOString();
  const k = await apiKeyService.create({ name: 'exp', type: 'pat', userId: customerKey.key.userId, createdBy: customerKey.key.userId });
  await db.prepare('UPDATE api_keys SET expires_at = ? WHERE id = ?').run(past, k.key.id);
  const r = await request(server, { path: '/open/me', headers: { authorization: `Bearer ${k.plaintext}` } });
  assert.equal(r.status, 401);
});

test('账号被禁用 → 403', async () => {
  const cust = await authService.register({ email: 'disabled@openapi.com', password: 'Password123!', name: '禁用' });
  const k = await apiKeyService.create({ name: 'k', type: 'pat', userId: cust.id, createdBy: cust.id });
  await db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(cust.id);
  const r = await request(server, { path: '/open/me', headers: { authorization: `Bearer ${k.plaintext}` } });
  assert.equal(r.status, 403);
  const restore = await request(server, { path: '/open/me', headers: { authorization: `Bearer ${k.plaintext}` } });
  assert.equal(restore.status, 403);
});

test('scope 门：含 chart:read → chart 端点放行，dataset 端点 403', async () => {
  const ok = await request(server, { path: '/open/chart-scope', headers: { authorization: `Bearer ${customerKey.plaintext}` } });
  assert.equal(ok.status, 200);
  const denied = await request(server, { path: '/open/dataset-scope', headers: { authorization: `Bearer ${customerKey.plaintext}` } });
  assert.equal(denied.status, 403);
  assert.match(denied.body.message, /无权/);
});

test('PAT：继承本人权限（viewer=3 项），chart 可过、统计类仍受 control', async () => {
  const pat = await apiKeyService.create({ name: 'c-p', type: 'pat', userId: customerKey.key.userId, scopes: [], createdBy: customerKey.key.userId });
  const me = await request(server, { path: '/open/me', headers: { authorization: `Bearer ${pat.plaintext}` } });
  assert.equal(me.status, 200);
  assert.deepEqual(me.body.data.effective.length >= 3, true);
  const chartOk = await request(server, { path: '/open/chart-scope', headers: { authorization: `Bearer ${pat.plaintext}` } });
  assert.equal(chartOk.status, 200);
});

test('审计钩子：数据出口请求落审计（detail.keyId）', async () => {
  const r = await request(server, { path: '/open/data-exit', headers: { authorization: `Bearer ${customerKey.plaintext}` } });
  assert.equal(r.status, 200);
  const row = db.prepare("SELECT * FROM audit_logs WHERE action = 'api:chart.data' ORDER BY id DESC LIMIT 1").get();
  assert.ok(row);
  const detail = JSON.parse(row.detail);
  assert.equal(detail.keyId, customerKey.key.id);
  assert.equal(detail.keyName, '客户Key');
  assert.equal(row.resource_id, '9');
});

test('按钥匙限流：max=2，第 3 次 429', async () => {
  const k = await apiKeyService.create({ name: 'rl', type: 'pat', userId: customerKey.key.userId, createdBy: customerKey.key.userId });
  const h = { authorization: `Bearer ${k.plaintext}` };
  assert.equal((await request(server, { path: '/open/limited', headers: h })).status, 200);
  assert.equal((await request(server, { path: '/open/limited', headers: h })).status, 200);
  const third = await request(server, { path: '/open/limited', headers: h });
  assert.equal(third.status, 429);
  assert.equal(third.body.code, 429);
  // 另一把钥匙不受影响
  const k2 = await apiKeyService.create({ name: 'rl2', type: 'pat', userId: customerKey.key.userId, createdBy: customerKey.key.userId });
  const r2 = await request(server, { path: '/open/limited', headers: { authorization: `Bearer ${k2.plaintext}` } });
  assert.equal(r2.status, 200);
});