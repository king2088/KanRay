process.env.DB_PATH = `/tmp/kanban-test-bigscreen-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDb } = require('./helpers/db');
const authService = require('../src/services/auth.service');
const bigScreenService = require('../src/services/big-screen.service');

let server; let base; let screenId; let token;

test('启动临时服务并注册用户', async () => {
  await resetDb();
  const app = require('../src/app');
  await new Promise((resolve) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); }); });
  const owner = await authService.register({ email: 'owner@t.com', password: 'pass1234', name: '大屏主' });
  await db.prepare('INSERT INTO user_roles SELECT ?, id FROM roles WHERE code = ?').run(owner.id, 'editor');
});

async function api(path, { method = 'POST', auth, body } = {}) {
  const headers = {};
  if (auth) headers.Authorization = `Bearer ${auth}`;
  const opts = { method, headers };
  if (body !== undefined && !['GET', 'HEAD'].includes(method)) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(base + path, opts);
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function login(email, password) {
  const r = await api('/api/auth/login', { body: { email, password } });
  return r.json?.data?.accessToken;
}

test('大屏 CRUD：创建/获取/修改/列表/删除', async () => {
  token = await login('owner@t.com', 'pass1234');
  const c = await api('/api/big-screens', { auth: token, body: { name: '总览大屏', components: [{ id: 'w1', type: 'bar' }], config: { width: 1920, height: 1080 } } });
  assert.equal(c.status, 200);
  assert.ok(c.json.data.id);
  assert.equal(c.json.data.name, '总览大屏');
  screenId = c.json.data.id;

  const bad = await api('/api/big-screens', { auth: token, body: { name: ' ' } });
  assert.equal(bad.status, 400);

  const g = await api(`/api/big-screens/${screenId}`, { method: 'GET', auth: token });
  assert.equal(g.status, 200);
  assert.equal(g.json.data.name, '总览大屏');
  assert.equal(g.json.data.config.width, 1920);
  assert.equal(g.json.data.components.length, 1);

  const p = await api(`/api/big-screens/${screenId}`, { method: 'PATCH', auth: token, body: { name: '改造大屏', thumbnail: 'data:image/png;base64,xx' } });
  assert.equal(p.status, 200);
  assert.equal(p.json.data.name, '改造大屏');
  assert.equal(p.json.data.thumbnail, 'data:image/png;base64,xx');

  const l = await api('/api/big-screens', { method: 'GET', auth: token });
  assert.equal(l.status, 200);
  assert.ok(Array.isArray(l.json.data));
  assert.ok(l.json.data.some((x) => x.id === screenId));
});

test('非 owner 访问他人大屏被拒', async () => {
  const u = await authService.register({ email: 'analyst@t.com', password: 'pass1234', name: '分析师' });
  await db.prepare('INSERT INTO user_roles SELECT ?, id FROM roles WHERE code = ?').run(u.id, 'analyst');
  const t2 = await login('analyst@t.com', 'pass1234');
  const g = await api(`/api/big-screens/${screenId}`, { method: 'GET', auth: t2 });
  assert.equal(g.status, 403);
  const p = await api(`/api/big-screens/${screenId}`, { method: 'PATCH', auth: t2, body: { name: 'hack' } });
  assert.equal(p.status, 403);
  const d = await api(`/api/big-screens/${screenId}`, { method: 'DELETE', auth: t2 });
  assert.equal(d.status, 403);
});

test('大屏分享：创建/列表/改密/启停/删除', async () => {
  const s = await api(`/api/big-screens/${screenId}/shares`, { auth: token, body: { password: 'pass1234' } });
  assert.equal(s.status, 200);
  assert.ok(s.json.data.token);
  assert.equal(s.json.data.hasPassword, true);
  const shareId = s.json.data.id;

  const bad = await api(`/api/big-screens/${screenId}/shares`, { auth: token, body: { password: '12' } });
  assert.equal(bad.status, 400);

  const list = await api(`/api/big-screens/${screenId}/shares`, { method: 'GET', auth: token });
  assert.equal(list.status, 200);
  assert.ok(list.json.data.some((x) => x.id === shareId));

  const patched = await api(`/api/big-screen-shares/${shareId}`, { method: 'PATCH', auth: token, body: { isActive: false } });
  assert.equal(patched.status, 200);
  assert.equal(patched.json.data.isActive, 0);

  const opened = await api(`/api/big-screen-shares/${shareId}`, { method: 'PATCH', auth: token, body: { password: null } });
  assert.equal(opened.status, 200);
  assert.equal(opened.json.data.hasPassword, false);
});

test('公开分享：meta/verify/screen 全链路', async () => {
  const s = await bigScreenService.createShare({ bigScreenId: screenId, password: 'pass1234', expiresAt: null, userId: 1 });
  const tk = s.token;

  const m = await api(`/api/public/big-screens/${tk}/meta`, { method: 'GET' });
  assert.equal(m.status, 200);
  assert.equal(m.json.data.found, true);
  assert.equal(m.json.data.name, '改造大屏');
  assert.equal(m.json.data.requiresPassword, true);

  const miss = await api('/api/public/big-screens/notexist/meta', { method: 'GET' });
  assert.equal(miss.json.data.found, false);

  const wrong = await api(`/api/public/big-screens/${tk}/verify`, { body: { password: 'wrong1' } });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.json.code, 40101);

  const okR = await api(`/api/public/big-screens/${tk}/verify`, { body: { password: 'pass1234' } });
  assert.equal(okR.status, 200);
  assert.ok(okR.json.data.accessToken);
  const accessToken = okR.json.data.accessToken;

  const noAuth = await api(`/api/public/big-screens/${tk}/screen`, { method: 'GET' });
  assert.equal(noAuth.status, 401);

  const screen = await api(`/api/public/big-screens/${tk}/screen`, { method: 'GET', auth: accessToken });
  assert.equal(screen.status, 200);
  assert.equal(screen.json.data.name, '改造大屏');
  assert.equal(screen.json.data.components.length, 1);
  const raw = JSON.stringify(screen.json.data);
  assert.equal(raw.includes('password_hash'), false);

  await bigScreenService.deleteShare(s.id);
});

test('无密码公开分享免密直达', async () => {
  const s = await bigScreenService.createShare({ bigScreenId: screenId, password: null, expiresAt: null, userId: 1 });
  const m = await api(`/api/public/big-screens/${s.token}/meta`, { method: 'GET' });
  assert.equal(m.json.data.requiresPassword, false);
  const r = await api(`/api/public/big-screens/${s.token}/verify`, { body: {} });
  assert.equal(r.status, 200);
  assert.ok(r.json.data.accessToken);
  await bigScreenService.deleteShare(s.id);
});

test('share JWT 跨链接不匹配 / 过期 / 停用被拒', async () => {
  const a = await bigScreenService.createShare({ bigScreenId: screenId, password: 'pass1234', expiresAt: null, userId: 1 });
  const b = await bigScreenService.createShare({ bigScreenId: screenId, password: 'pass1234', expiresAt: null, userId: 1 });
  const ra = await api(`/api/public/big-screens/${a.token}/verify`, { body: { password: 'pass1234' } });
  assert.equal(ra.status, 200);

  const cross = await api(`/api/public/big-screens/${b.token}/screen`, { method: 'GET', auth: ra.json.data.accessToken });
  assert.equal(cross.status, 401);

  await db.prepare("UPDATE big_screen_shares SET expires_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run(a.id);
  const exp = await api(`/api/public/big-screens/${a.token}/verify`, { body: { password: 'pass1234' } });
  assert.equal(exp.status, 403);
  assert.equal(exp.json.code, 40301);

  await db.prepare('UPDATE big_screen_shares SET is_active = 0 WHERE id = ?').run(b.id);
  const off = await api(`/api/public/big-screens/${b.token}/verify`, { body: { password: 'pass1234' } });
  assert.equal(off.status, 403);
  assert.equal(off.json.code, 40302);

  await bigScreenService.deleteShare(a.id);
  await bigScreenService.deleteShare(b.id);
});

test('大屏删除后分享级联失效', async () => {
  const s = await bigScreenService.createShare({ bigScreenId: screenId, password: null, expiresAt: null, userId: 1 });
  const d = await api(`/api/big-screens/${screenId}`, { method: 'DELETE', auth: token });
  assert.equal(d.status, 200);
  const m = await api(`/api/public/big-screens/${s.token}/meta`, { method: 'GET' });
  assert.equal(m.json.data.found, false);
});

test('清理', async () => {
  await new Promise((r) => server.close(r));
});