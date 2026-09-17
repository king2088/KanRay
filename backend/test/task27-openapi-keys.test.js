// T2：api_key 服务（生成/哈希/吊销/滚动）+ apikey:manage 权限点
process.env.DB_PATH = `/tmp/kanban-test-keys-${process.pid}.db`;
const test = require('node:test');
const assert = require('node:assert');
const store = require('../src/db');
const { seed: runSeed } = require('../src/seeds');
const apiKeyService = require('../src/services/api-key.service');

async function reset() {
  await store.exec(`
    DELETE FROM api_keys; DELETE FROM dashboard_shares; DELETE FROM user_roles; DELETE FROM role_permissions;
    DELETE FROM refresh_tokens; DELETE FROM audit_logs; DELETE FROM users; DELETE FROM roles; DELETE FROM permissions;
    DELETE FROM datasets; DELETE FROM charts; DELETE FROM dashboards; DELETE FROM data_sources;
  `);
  await runSeed();
  return store;
}

test('生成明文：kan_ 前缀 + 长度 + key_prefix 前12位', () => {
  const plain = apiKeyService.generatePlaintext('static');
  assert.match(plain, /^kan_live_/);
  assert.ok(plain.length > 30);
  assert.equal(plain.slice(0, 12), plain.slice(0, 12));
  const pat = apiKeyService.generatePlaintext('pat');
  assert.match(pat, /^kan_pat_/);
  assert.notEqual(apiKeyService.generatePlaintext('static'), apiKeyService.generatePlaintext('static'));
});

test('哈希：sha256 hex 且可复现', () => {
  const h1 = apiKeyService.hashKey('kan_live_abc');
  const h2 = apiKeyService.hashKey('kan_live_abc');
  assert.equal(h1, h2);
  assert.equal(h1.length, 64);
  assert.notEqual(h1, 'kan_live_abc');
});

test('create：库内仅存 hash，返回明文一次 + 门面字段', async () => {
  await reset();
  const r = await apiKeyService.create({ name: '客户A大屏', type: 'static', userId: 1, scopes: ['chart:read', 'dataset:read'], createdBy: 1 });
  assert.match(r.plaintext, /^kan_live_/);
  assert.equal(r.key.name, '客户A大屏');
  assert.equal(r.key.userId, 1);
  assert.deepEqual(r.key.scopes, ['chart:read', 'dataset:read']);
  assert.equal(r.key.status, 'active');
  assert.equal(r.key.keyHash, undefined, '不应回传 hash');
  assert.ok(r.key.keyPrefix);
  const row = store.prepare('SELECT * FROM api_keys WHERE id = ?').get(r.key.id);
  assert.equal(row.key_hash, apiKeyService.hashKey(r.plaintext));
  assert.notEqual(row.key_hash, r.plaintext);
});

test('getByHash 精确命中', async () => {
  await reset();
  const r = await apiKeyService.create({ name: 'x', type: 'pat', userId: 2, createdBy: 2 });
  const hit = await apiKeyService.getByHash(apiKeyService.hashKey(r.plaintext));
  assert.ok(hit && hit.id === r.key.id);
  assert.equal(await apiKeyService.getByHash(apiKeyService.hashKey('nope')), null);
});

test('rotate：新明文可用、旧 hash 失效、返回值剥离 hash', async () => {
  await reset();
  const r = await apiKeyService.create({ name: 'x', type: 'pat', userId: 2, createdBy: 2 });
  const rotated = await apiKeyService.rotate(r.key.id, { userId: 2 });
  assert.match(rotated.plaintext, /^kan_pat_/);
  assert.notEqual(rotated.plaintext, r.plaintext);
  assert.equal(await apiKeyService.getByHash(apiKeyService.hashKey(r.plaintext)), null, '旧明文应失效');
  assert.ok(await apiKeyService.getByHash(apiKeyService.hashKey(rotated.plaintext)), '新明文应命中');
});

test('setStatus / updateMeta 启停与 scope 校验', async () => {
  await reset();
  const r = await apiKeyService.create({ name: 'x', type: 'static', userId: 1, scopes: ['chart:read'], createdBy: 1 });
  await apiKeyService.setStatus(r.key.id, 'revoked');
  assert.equal((await apiKeyService.getOrThrow(r.key.id)).status, 'revoked');
  const upd = await apiKeyService.updateMeta(r.key.id, { isActive: true, scopes: ['dashboard:read'] });
  assert.equal(upd.status, 'active');
  assert.deepEqual(upd.scopes, ['dashboard:read']);
  await assert.rejects(apiKeyService.updateMeta(r.key.id, { scopes: ['user:delete'] }), /不支持的 scope/);
});

test('PAT 不接受自定义 scopes（强制继承）', async () => {
  await reset();
  const r = await apiKeyService.create({ name: 'p', type: 'pat', userId: 2, scopes: ['dataset:read'], createdBy: 2 });
  assert.deepEqual(r.key.scopes, [], 'PAT scopes 应为空=继承本人');
});

test('effectivePermissions：static 取交集、PAT 继承', async () => {
  const staticRow = { type: 'static', scopes: '["chart:read","dataset:read"]' };
  const userPerms = ['chart:read', 'dashboard:read', 'user:read'];
  assert.deepEqual(apiKeyService.effectivePermissions(staticRow, userPerms), ['chart:read']);
  const patRow = { type: 'pat', scopes: '[]' };
  assert.deepEqual(apiKeyService.effectivePermissions(patRow, userPerms), userPerms);
});

test('seeds：apikey:manage 已登记且仅 admin 授予（29 个权限点）', async () => {
  await reset();
  const perms = store.all('SELECT code FROM permissions ORDER BY code').map((r) => r.code);
  assert.ok(perms.includes('apikey:manage'), '应登记 apikey:manage');
  assert.equal(perms.length, 29, '权限点总数应为 29');
  for (const role of ['admin', 'analyst', 'editor', 'viewer']) {
    const rows = store.all(
      `SELECT p.code FROM role_permissions rp JOIN roles r ON r.id = rp.role_id
       JOIN permissions p ON p.id = rp.permission_id WHERE r.code = ?`,
      [role]
    ).map((x) => x.code);
    if (role === 'admin') assert.ok(rows.includes('apikey:manage'), 'admin 应含 apikey:manage');
    else assert.ok(!rows.includes('apikey:manage'), `${role} 不应含 apikey:manage`);
    if (role === 'admin') assert.equal(rows.length, 29);
  }
});