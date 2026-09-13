process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('../src/datasources/crypto');

test('encrypt then decrypt returns original', () => {
  const plain = 'Kanban@123';
  const enc = crypto.encrypt(plain);
  assert.notEqual(enc, plain, 'encrypted should differ from plain');
  const dec = crypto.decrypt(enc);
  assert.equal(dec, plain);
});

test('tampered ciphertext throws', () => {
  const enc = crypto.encrypt('secret');
  const tampered = enc.slice(0, -2) + (enc.slice(-2) === 'aa' ? 'bb' : 'aa');
  assert.throws(() => crypto.decrypt(tampered), /state|format|Invalid|authenticate|tag|fail/i);
});

test('mask hides password', () => {
  const masked = crypto.mask('my-secret-pw');
  assert.equal(masked, 'my-s****');
  assert.equal(crypto.mask(''), '');
  assert.equal(crypto.mask(null), '');
  assert.equal(crypto.mask(undefined), '');
});