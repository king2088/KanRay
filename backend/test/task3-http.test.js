// 首行设置 DB_PATH（先于 src 加载）
process.env.DB_PATH = `/tmp/kanban-test-http-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resetDb } = require('./helpers/db');
const authService = require('../src/services/auth.service');

let server;
let base;

test('启动临时 HTTP 服务', async () => {
  await resetDb();
  const app = require('../src/app');
  await new Promise((resolve) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); }); });
});

async function api(path, { method = 'POST', token, body } = {}) {
  const isBodied = method !== 'GET' && method !== 'HEAD';
  const res = await fetch(base + path, {
    method,
    headers: { ...(isBodied ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(isBodied ? { body: JSON.stringify(body ?? {}) } : {}),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

test('注册→登录→/me 全链路', async () => {
  const reg = await api('/api/auth/register', { body: { email: 'http@x.com', password: 'Password123!', name: 'HTTP' } });
  assert.equal(reg.status, 200, JSON.stringify(reg.json));
  const login = await api('/api/auth/login', { body: { email: 'http@x.com', password: 'Password123!' } });
  assert.equal(login.json.code, 0);
  assert.ok(login.json.data.accessToken && login.json.data.refreshToken);
  const me = await api('/api/auth/me', { method: 'GET', token: login.json.data.accessToken });
  assert.equal(me.status, 200);
  assert.equal(me.json.data.email, 'http@x.com');
});

test('API 登出吊销刷新令牌（真实链路，C1 回归）', async () => {
  const login = await api('/api/auth/login', { body: { email: 'http@x.com', password: 'Password123!' } });
  const { accessToken, refreshToken } = login.json.data;
  const out = await api('/api/auth/logout', { token: accessToken });
  assert.equal(out.status, 200);
  await assert.rejects(authService.refresh(refreshToken), /无效/);
});

test('刷新令牌不得作为访问令牌使用（C2 回归）', async () => {
  const login = await api('/api/auth/login', { body: { email: 'http@x.com', password: 'Password123!' } });
  const me = await api('/api/auth/me', { method: 'GET', token: login.json.data.refreshToken });
  assert.equal(me.status, 401);
});

test('无 token 访问受保护路由抛 401', async () => {
  const me = await api('/api/auth/me', { method: 'GET' });
  assert.equal(me.status, 401);
});

test('关闭临时 HTTP 服务', () => {
  server?.close();
});