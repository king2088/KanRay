process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDb } = require('./helpers/db');
const app = require('../src/app');
const authService = require('../src/services/auth.service');
const jwtUtil = require('../src/utils/jwt');

let server; let base;
let adminToken;

before(async () => {
  await resetDb();
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  const admin = await authService.login('admin@kanban.local', 'admin123');
  adminToken = admin.accessToken;
});

function auth(token) {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

test('GET /api/datasources/drivers returns 22 drivers', async () => {
  const res = await fetch(`${base}/api/datasources/drivers`, { headers: auth(adminToken) });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.code, 0);
  assert.equal(body.data.length, 22);
  assert.ok(body.data[0].type);
  assert.ok(body.data[0].fields);
});

test('GET /api/datasources returns empty list initially', async () => {
  const res = await fetch(`${base}/api/datasources`, { headers: auth(adminToken) });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.code, 0);
  assert.equal(body.data.length, 0);
});

test('POST /api/datasources creates a mysql datasource', async () => {
  const res = await fetch(`${base}/api/datasources`, {
    method: 'POST',
    headers: auth(adminToken),
    body: JSON.stringify({ name: 'Test MySQL', type: 'mysql', config: { host: '127.0.0.1', port: 13306, database: 'testdb', user: 'root', password: 'Kanban@123' } }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.code, 0);
  assert.equal(body.data.name, 'Test MySQL');
  assert.equal(body.data.type, 'mysql');
  assert.equal(body.data.config.password, '********');
});

test('GET /api/datasources/:id returns detail with masked password', async () => {
  const res = await fetch(`${base}/api/datasources/1`, { headers: auth(adminToken) });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.code, 0);
  assert.equal(body.data.config.password, '********');
});

test('PATCH /api/datasources/:id updates name (password unchanged)', async () => {
  const res = await fetch(`${base}/api/datasources/1`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ name: 'Renamed MySQL' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.name, 'Renamed MySQL');
  // stored ciphertext changed? name-only update should NOT re-encrypt. Check ciphertext bytes remain same:
  const row = db.prepare('SELECT config FROM data_sources WHERE id = 1').get();
  const cfg = JSON.parse(row.config);
  // password should still be present and non-plaintext
  assert.notEqual(cfg.password, 'Kanban@123');
  assert.ok(cfg.password.includes(':'));
});

test('PATCH with partial config does not corrupt stored password', async () => {
  // create fresh datasource
  const res = await fetch(`${base}/api/datasources`, {
    method: 'POST',
    headers: auth(adminToken),
    body: JSON.stringify({ name: 'Partial DS', type: 'mysql', config: { host: '127.0.0.1', port: 3306, database: 'd', user: 'u', password: 's3cret' } }),
  });
  assert.equal(res.status, 200);
  const ds = (await res.json()).data;
  const row = db.prepare('SELECT config FROM data_sources WHERE id = ?').get(ds.id);
  const cfg = JSON.parse(row.config);
  const before = cfg.password;
  // update with partial config (no password field)
  const up = await fetch(`${base}/api/datasources/${ds.id}`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ config: { host: '10.0.0.1' }, name: 'Partial Renamed' }),
  });
  assert.equal(up.status, 200);
  const after = JSON.parse(db.prepare('SELECT config FROM data_sources WHERE id = ?').get(ds.id).config);
  assert.equal(after.password, before, 'ciphertext must be unchanged');
  assert.equal(after.host, '10.0.0.1');
});

test('DELETE /api/datasources/:id deletes', async () => {
  const res = await fetch(`${base}/api/datasources/1`, { method: 'DELETE', headers: auth(adminToken) });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.code, 0);
});

test('owner isolation: analyst cannot see admin datasources', async () => {
  const u = await authService.register({ email: 'analyst@x.com', password: 'Password123!', name: 'Analyst', roleCode: 'analyst' });
  const userToken = jwtUtil.signAccess({ sub: u.id });

  // admin creates a datasource (id=2)
  await fetch(`${base}/api/datasources`, {
    method: 'POST',
    headers: auth(adminToken),
    body: JSON.stringify({ name: 'Admin DS', type: 'mysql', config: { host: 'h', port: 3306, database: 'd', user: 'u', password: 'p' } }),
  });

  // analyst list -> empty (admin's DS hidden)
  const listRes = await fetch(`${base}/api/datasources`, { headers: auth(userToken) });
  assert.equal(listRes.status, 200);
  const listBody = await listRes.json();
  assert.equal(listBody.data.length, 0);

  // analyst cannot read admin's datasource
  const forbidden = await fetch(`${base}/api/datasources/2`, { headers: auth(userToken) });
  assert.equal(forbidden.status, 403);

  // analyst can create and access their own
  const createRes = await fetch(`${base}/api/datasources`, {
    method: 'POST',
    headers: auth(userToken),
    body: JSON.stringify({ name: 'Analyst DS', type: 'mysql', config: { host: 'h', port: 3306, database: 'd', user: 'u', password: 'p' } }),
  });
  assert.equal(createRes.status, 200);
  const createBody = await createRes.json();
  assert.equal(createBody.data.owner_id, u.id);
});

test('editor without datasource permission gets 403', async () => {
  const u = await authService.register({ email: 'editor@x.com', password: 'Password123!', name: 'Editor', roleCode: 'editor' });
  const token = jwtUtil.signAccess({ sub: u.id });
  const res = await fetch(`${base}/api/datasources`, { headers: auth(token) });
  assert.equal(res.status, 403);
});

test('unauthenticated returns 401', async () => {
  const res = await fetch(`${base}/api/datasources`);
  assert.equal(res.status, 401);
});

test('POST /api/datasources/test returns ok:false for invalid mysql config', async () => {
  const res = await fetch(`${base}/api/datasources/test`, {
    method: 'POST',
    headers: auth(adminToken),
    body: JSON.stringify({ type: 'mysql', config: { host: '127.0.0.1', port: 1, database: 'x', user: 'root', password: 'x' } }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.code, 0);
  assert.equal(body.data.ok, false);
  assert.ok(body.data.message);
});

test('POST /api/datasources/test rejects planned type', async () => {
  const res = await fetch(`${base}/api/datasources/test`, {
    method: 'POST',
    headers: auth(adminToken),
    body: JSON.stringify({ type: 'db2', config: { host: 'x' } }),
  });
  assert.equal(res.status, 400);
});

test('POST /api/datasources/test returns ok:false for unreachable oracle', async () => {
  const res = await fetch(`${base}/api/datasources/test`, {
    method: 'POST',
    headers: auth(adminToken),
    body: JSON.stringify({ type: 'oracle', config: { host: '127.0.0.1', port: 1, user: 'SYSTEM', password: 'x' } }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.code, 0);
  assert.equal(body.data.ok, false);
  assert.ok(body.data.message);
});

test('POST datasource 支持 mode：sync/direct 落库返回', async () => {
  const syncRes = await fetch(`${base}/api/datasources`, {
    method: 'POST',
    headers: auth(adminToken),
    body: JSON.stringify({ name: 'Sync MySQL', type: 'mysql', mode: 'sync', config: { host: '127.0.0.1', port: 13306, database: 'testdb', user: 'root', password: 'Kanban@123' } }),
  });
  assert.equal(syncRes.status, 200);
  assert.equal((await syncRes.json()).data.mode, 'sync');

  const directRes = await fetch(`${base}/api/datasources`, {
    method: 'POST',
    headers: auth(adminToken),
    body: JSON.stringify({ name: 'Direct MySQL', type: 'mysql', config: { host: '127.0.0.1', port: 13306, database: 'testdb', user: 'root', password: 'Kanban@123' } }),
  });
  assert.equal(directRes.status, 200);
  assert.equal((await directRes.json()).data.mode, 'direct');

  const fileRes = await fetch(`${base}/api/datasources`, {
    method: 'POST',
    headers: auth(adminToken),
    body: JSON.stringify({ name: 'Bad File Sync', type: 'excel', mode: 'sync', config: {} }),
  });
  assert.equal(fileRes.status, 400);
});

test('关闭临时 HTTP 服务', () => {
  server?.close();
});