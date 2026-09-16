const test = require('node:test');
const assert = require('node:assert');

const cache = require('../src/cache');

test('未配置 REDIS_URL 时 isRedis() 为 false（默认内存）', () => {
  assert.equal(cache.isRedis(), false);
});

test('内存后端：set/get/del 基本读写', async () => {
  await cache.set('t:obj', { a: 1, b: [2, 3] });
  assert.deepEqual(await cache.get('t:obj'), { a: 1, b: [2, 3] });

  await cache.set('t:str', 'hello');
  assert.equal(await cache.get('t:str'), 'hello');

  await cache.del('t:obj');
  assert.equal(await cache.get('t:obj'), undefined);
});

test('内存后端：未命中返回 undefined', async () => {
  assert.equal(await cache.get('t:missing'), undefined);
});

test('内存后端：TTL 过期后读不到', async () => {
  await cache.set('t:exp', 'v', 30);
  assert.equal(await cache.get('t:exp'), 'v');
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(await cache.get('t:exp'), undefined);
});

test('flush 清空所有键', async () => {
  await cache.set('t:f1', 1);
  await cache.set('t:f2', 2);
  await cache.flush();
  assert.equal(await cache.get('t:f1'), undefined);
  assert.equal(await cache.get('t:f2'), undefined);
});