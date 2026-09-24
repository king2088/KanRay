process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { uuidv7, isValidUuid7 } = require('../src/utils/uuidv7');

test('uuidv7 has canonical 36-char lowercase form, version 7, variant 10x', () => {
  const id = uuidv7();
  assert.equal(id.length, 36);
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.equal(id[14], '7', 'version nibble');
  assert.ok(['8', '9', 'a', 'b'].includes(id[19]), 'variant bits');
  assert.ok(isValidUuid7(id));
});

test('uuidv7 timestamp prefix tracks current time', () => {
  const before = Date.now();
  const id = uuidv7();
  const after = Date.now();
  const ts = BigInt('0x' + id.replace(/-/g, '').slice(0, 12));
  // 进程内单调推进可能让时间戳比 now 快 1ms，允许 ≤10ms 漂移
  assert.ok(ts >= BigInt(before - 10) && ts <= BigInt(after + 10), `ts=${ts} before=${before} after=${after}`);
});

test('uuidv7 is monotonic and unique across many calls', () => {
  const seen = new Set();
  let prev = null;
  for (let i = 0; i < 5000; i++) {
    const id = uuidv7();
    assert.ok(isValidUuid7(id));
    seen.add(id);
    if (prev) assert.ok(id > prev, `${id} should sort after ${prev}`);
    prev = id;
  }
  assert.equal(seen.size, 5000, 'no collisions');
});

test('isValidUuid7 rejects non-v7 / malformed input', () => {
  const id = uuidv7();
  assert.equal(isValidUuid7(id.slice(0, 14) + '4' + id.slice(15)), false, 'version 4 rejected');
  assert.equal(isValidUuid7(id.slice(0, 19) + '0' + id.slice(20)), false, 'bad variant rejected');
  assert.equal(isValidUuid7(id.toUpperCase()), false, 'uppercase rejected');
  assert.equal(isValidUuid7('not-a-uuid'), false);
  assert.equal(isValidUuid7(123), false);
  assert.equal(isValidUuid7(null), false);
  assert.equal(isValidUuid7(undefined), false);
});
