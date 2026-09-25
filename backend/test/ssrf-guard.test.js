process.env.DB_PATH = `/tmp/kanban-test-ssrf-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { blockReason, createLookup } = require('../src/datasources/ssrf-guard');

// ── 云元数据端点：任何情况下都拦截 ───────────────────────────
test('云元数据/链路本地 无论开关都拦截', () => {
  for (const ip of ['169.254.169.254', '100.100.100.200', '169.254.1.2']) {
    assert.ok(blockReason(ip, false), `默认也应拦截 ${ip}`);
    assert.ok(blockReason(ip, true), `开启私网拦截也应拦截 ${ip}`);
  }
});

// ── 公网 IP：任何情况下放行 ─────────────────────────────────
test('公网 IP 恒放行', () => {
  for (const ip of ['8.8.8.8', '1.1.1.1', '114.114.114.114']) {
    assert.equal(blockReason(ip, false), null);
    assert.equal(blockReason(ip, true), null);
  }
});

// ── 回环 / 私网：默认放行，开启开关后拦截 ─────────────────────
test('回环地址受开关控制', () => {
  assert.equal(blockReason('127.0.0.1', false), null, 'dev 默认应放行 127.0.0.1');
  assert.ok(blockReason('127.0.0.1', true));
  assert.equal(blockReason('0.0.0.0', false), null);
  assert.ok(blockReason('0.0.0.0', true));
});

test('RFC1918 私网段受开关控制', () => {
  for (const ip of ['10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.1.1']) {
    assert.equal(blockReason(ip, false), null, `默认应放行 ${ip}`);
    assert.ok(blockReason(ip, true), `开启后应拦截 ${ip}`);
  }
  assert.equal(blockReason('11.0.0.1', true), null, '10/8 之外不误拦');
  assert.equal(blockReason('173.0.0.1', true), null, '172.16/12 之外不误拦');
});

// ── IPv6 ──────────────────────────────────────────────────
test('IPv6 回环/ULA/链路本地 受开关控制', () => {
  for (const ip of ['::1', 'fc00::1', 'fdff::1', 'fe80::1']) {
    assert.equal(blockReason(ip, false), null, `默认应放行 ${ip}`);
    assert.ok(blockReason(ip, true), `开启后应拦截 ${ip}`);
  }
  assert.equal(blockReason('2001:4860:4860::8888', true), null, '公网 IPv6 不误拦');
});

test('IPv4-mapped IPv6 按内嵌 IPv4 判定', () => {
  assert.equal(blockReason('::ffff:127.0.0.1', false), null);
  assert.ok(blockReason('::ffff:127.0.0.1', true));
  assert.ok(blockReason('::ffff:169.254.169.254', false), '内嵌元数据恒拦截');
});

// ── createLookup 集成 ─────────────────────────────────────
test('createLookup 拒绝被拦截目标并放行公网', async () => {
  const open = createLookup(false);
  const strict = createLookup(true);

  const openResult = await new Promise((resolve) => open('8.8.8.8', {}, (err, addr) => resolve(err ? err.message : addr)));
  assert.doesNotMatch(String(openResult), /禁止/);

  const cb127 = await new Promise((resolve) => strict('127.0.0.1', {}, (err) => resolve(err ? err.message : null)));
  assert.match(cb127, /禁止/);

  const cbMeta = await new Promise((resolve) => open('169.254.169.254', {}, (err) => resolve(err ? err.message : null)));
  assert.match(cbMeta, /禁止/);
});

// ── config 接线：HTTP_DATASOURCE_BLOCK_PRIVATE ─────────────
function loadConfig() {
  delete require.cache[require.resolve('../src/config')];
  return require('../src/config');
}

test('HTTP_DATASOURCE_BLOCK_PRIVATE 默认 false', () => {
  const original = process.env.HTTP_DATASOURCE_BLOCK_PRIVATE;
  delete process.env.HTTP_DATASOURCE_BLOCK_PRIVATE;
  const config = loadConfig();
  assert.equal(config.datasource.httpBlockPrivate, false);
  if (original !== undefined) process.env.HTTP_DATASOURCE_BLOCK_PRIVATE = original;
});

test('HTTP_DATASOURCE_BLOCK_PRIVATE=true 生效且被 api-service 采用', async () => {
  const original = process.env.HTTP_DATASOURCE_BLOCK_PRIVATE;
  process.env.HTTP_DATASOURCE_BLOCK_PRIVATE = 'true';
  const config = loadConfig();
  assert.equal(config.datasource.httpBlockPrivate, true);

  const apiService = require('../src/datasources/providers/api-service');
  const res = await apiService.testConnection({ url: 'http://127.0.0.1:9', method: 'GET' });
  assert.equal(res.ok, false);
  assert.match(res.message, /禁止访问/);
  if (original !== undefined) process.env.HTTP_DATASOURCE_BLOCK_PRIVATE = original;
  else delete process.env.HTTP_DATASOURCE_BLOCK_PRIVATE;
});