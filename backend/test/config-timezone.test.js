const test = require('node:test');
const assert = require('node:assert/strict');

test('config.timezone 默认值为 Asia/Shanghai', () => {
  const original = process.env.TIMEZONE;
  delete process.env.TIMEZONE;
  delete require.cache[require.resolve('../src/config')];
  const config = require('../src/config');
  assert.equal(config.timezone, 'Asia/Shanghai');
  if (original !== undefined) process.env.TIMEZONE = original;
});

test('TIMEZONE env 可覆盖', () => {
  const original = process.env.TIMEZONE;
  process.env.TIMEZONE = 'America/New_York';
  delete require.cache[require.resolve('../src/config')];
  const config = require('../src/config');
  assert.equal(config.timezone, 'America/New_York');
  if (original !== undefined) process.env.TIMEZONE = original;
  else delete process.env.TIMEZONE;
});
