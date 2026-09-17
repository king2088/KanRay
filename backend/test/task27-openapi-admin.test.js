// T6：管理面 API —— /api/admin/api-keys(需 apikey:manage) + /api/auth/tokens(本人 PAT)
process.env.DB_PATH = `/tmp/kanban-test-openapi-admin-${process.pid}.db`;
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { db, resetDb } = require('./helpers/db');
const authService = require('../src/services/auth.service');
const apiKeyService = require('../src/services/api-key.service');
const app = require('../src/app');

function listen() {
  const server = http.createServer(app);
  return new Promise((r) => server.listen(0, () => r(server)));
}
function req(server, { method = 'GET', path, headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const h = { ...headers };
    if (payload) { h['Content-Type'] = 'application/json'; h['Content-Length'] = payload.length; }
    const r = http.request({ method, path, host: '127.0.0.1', port: server.address().port, headers: h }, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(chunks); } catch { /* ignore */ }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

let server, jAdmin, jCust, custId, otherId;

async function login(email, password) {
  return req(server, { method: 'POST', path: '/api/auth/login', body: { email, password } });
}

async function boot() {
  await resetDb();
  const cust = await authService.register({ email: 'cust@x.com', password: 'Password123!', name: 'C' });
  custId = cust.id;
  const other = await authService.register({ email: 'other@x.com', password: 'Password123!', name: 'O' });
  otherId = other.id;
  server = await listen();
  jAdmin = (await login('admin@kanban.local', 'admin123')).body.data.accessToken;
  jCust = (await login('cust@x.com', 'Password123!')).body.data.accessToken;
}
test.before(async () => await boot());
test.after(() => server.close());
const A = (t) => ({ authorization: `Bearer ${t}` });

test('未登录访问管理端点 → 401', async () => {
  assert.equal((await req(server, { path: '/api/admin/api-keys' })).status, 401);
  assert.equal((await req(server, { path: '/api/auth/tokens' })).status, 401);
});

test('viewer 调用 /api/admin/api-keys → 403（无 apikey:manage）', async () => {
  const r = await req(server, { method: 'POST', path: '/api/admin/api-keys', headers: A(jCust), body: { name: 'x', userId: custId } });
  assert.equal(r.status, 403);
  assert.match(r.body.message, /apitankey:manage|apikey/);
});

test('admin 创建 static Key → 明文仅一次 + 落审计', async () => {
  const r = await req(server, { method: 'POST', path: '/api/admin/api-keys', headers: A(jAdmin), body: { name: '客户大屏', userId: custId, scopes: ['chart:read', 'dataset:read'] } });
  assert.equal(r.status, 200);
  assert.match(r.body.data.plaintext, /^kan_live_/);
  assert.equal(r.body.data.key.userId, custId);
  const auditRow = db.prepare("SELECT * FROM audit_logs WHERE action='api_key:create' ORDER BY id DESC LIMIT 1").get();
  assert.equal(JSON.parse(auditRow.detail).keyName, '客户大屏');
});

test('admin 列表 + 详情掩码', async () => {
  const list = await req(server, { path: '/api/admin/api-keys', headers: A(jAdmin) });
  assert.equal(list.status, 200);
  assert.ok(list.body.data.list.length >= 1);
  const one = list.body.data.list[0];
  assert.equal(one.keyHash, undefined);
  const detail = await req(server, { path: `/api/admin/api-keys/${one.id}`, headers: A(jAdmin) });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.keyHash, undefined);
});

test('admin PATCH 停用 / 恢复 + rotate 换明文', async () => {
  const created = await req(server, { method: 'POST', path: '/api/admin/api-keys', headers: A(jAdmin), body: { name: 'R', userId: custId, scopes: ['dashboard:read'] } });
  const id = created.body.data.key.id;
  const off = await req(server, { method: 'PATCH', path: `/api/admin/api-keys/${id}`, headers: A(jAdmin), body: { isActive: false } });
  assert.equal(off.body.data.status, 'revoked');
  const rot = await req(server, { method: 'POST', path: `/api/admin/api-keys/${id}/rotate`, headers: A(jAdmin) });
  assert.match(rot.body.data.plaintext, /^kan_live_/);
  assert.notEqual(rot.body.data.plaintext, created.body.data.plaintext);
  assert.equal(await apiKeyService.getByHash(apiKeyService.hashKey(created.body.data.plaintext)), null, '旧明文应失效');
  assert.ok(await apiKeyService.getByHash(apiKeyService.hashKey(rot.body.data.plaintext)));
});

test('admin DELETE → 后续 404', async () => {
  const created = await req(server, { method: 'POST', path: '/api/admin/api-keys', headers: A(jAdmin), body: { name: 'D', userId: custId, scopes: [] } });
  const id = created.body.data.key.id;
  const del = await req(server, { method: 'DELETE', path: `/api/admin/api-keys/${id}`, headers: A(jAdmin) });
  assert.equal(del.status, 200);
  const after = await req(server, { path: `/api/admin/api-keys/${id}`, headers: A(jAdmin) });
  assert.equal(after.status, 404);
});

test('本人 PAT：create/list/rotate/delete', async () => {
  const c = await req(server, { method: 'POST', path: '/api/auth/tokens', headers: A(jCust), body: { name: '我的令牌' } });
  assert.equal(c.status, 200);
  assert.match(c.body.data.plaintext, /^kan_pat_/);
  assert.deepEqual(c.body.data.key.scopes, []);
  const id = c.body.data.key.id;
  const list = await req(server, { path: '/api/auth/tokens', headers: A(jCust) });
  assert.equal(list.body.data.total, 1);
  assert.deepEqual(list.body.data.list.map((k) => k.id), [id]);
  const rot = await req(server, { method: 'POST', path: `/api/auth/tokens/${id}/rotate`, headers: A(jCust) });
  assert.match(rot.body.data.plaintext, /^kan_pat_/);
  const del = await req(server, { method: 'DELETE', path: `/api/auth/tokens/${id}`, headers: A(jCust) });
  assert.equal(del.status, 200);
});

test('不可操作他人令牌（4×404 掩盖）', async () => {
  const pat = await apiKeyService.create({ name: '别人', type: 'pat', userId: otherId, createdBy: otherId });
  const id = pat.key.id;
  assert.equal((await req(server, { method: 'PATCH', path: `/api/auth/tokens/${id}`, headers: A(jCust), body: { name: '改你' } })).status, 404);
  assert.equal((await req(server, { method: 'POST', path: `/api/auth/tokens/${id}/rotate`, headers: A(jCust) })).status, 404);
  assert.equal((await req(server, { method: 'DELETE', path: `/api/auth/tokens/${id}`, headers: A(jCust) })).status, 404);
  const still = await req(server, { path: '/api/auth/tokens', headers: A(await (async () => (await login('other@x.com', 'Password123!')).body.data.accessToken)()) });
  assert.ok(still.body.data.list.some((k) => k.id === id), '他人令牌不受影响');
});

test('Key 生命周期操作均落审计', async () => {
  const actions = db.prepare('SELECT DISTINCT action FROM audit_logs WHERE action LIKE ? ORDER BY action').all('api_key:%');
  const codes = actions.map((a) => a.action);
  for (const expect of ['api_key:create', 'api_key:update', 'api_key:delete', 'api_key:rotate']) assert.ok(codes.includes(expect), `缺少审计 ${expect}`);
});