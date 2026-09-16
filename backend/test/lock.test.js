const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// 指向临时 sqlite，默认无 Redis -> 走数据库租约锁
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kblock-')), 'lock.db');
const lock = require('../src/services/lock');

test('数据库租约锁：互斥（第二个抢不到）', async () => {
  const a = await lock.acquire('t1', 60000);
  assert.ok(a, '首个应抢到');
  const b = await lock.acquire('t1', 60000);
  assert.equal(b, null, '持锁期间不应抢到');
  await lock.release('t1', a);
  const c = await lock.acquire('t1', 60000);
  assert.ok(c, '释放后应可再抢');
  await lock.release('t1', c);
});

test('数据库租约锁：TTL 过期自动释放', async () => {
  const a = await lock.acquire('t2', 100);
  assert.ok(a);
  await new Promise((r) => setTimeout(r, 200));
  const b = await lock.acquire('t2', 60000);
  assert.ok(b, '到期后应可再抢');
  await lock.release('t2', b);
});

test('release 幂等（重复释放不报错）', async () => {
  const a = await lock.acquire('t3', 60000);
  assert.ok(a);
  await lock.release('t3', a);
  await lock.release('t3', a);
  const b = await lock.acquire('t3', 60000);
  assert.ok(b);
  await lock.release('t3', b);
});

test('withLock：抢不到返回 null，抢到返回 executed.value', async () => {
  const a = await lock.acquire('t4', 60000);
  assert.ok(a);
  const r = await lock.withLock('t4', 60000, async () => 42);
  assert.equal(r, null, '持锁期间 withLock 应返回 null');
  await lock.release('t4', a);

  const r2 = await lock.withLock('t4', 60000, async () => 42);
  assert.deepEqual(r2, { executed: true, value: 42 });
});

test('withLock：fn 抛错时释放锁并向上抛出', async () => {
  await assert.rejects(
    () => lock.withLock('t5', 60000, async () => { throw new Error('boom'); }),
    /boom/,
  );
  const a = await lock.acquire('t5', 60000);
  assert.ok(a, '异常后锁应已被释放');
  await lock.release('t5', a);
});