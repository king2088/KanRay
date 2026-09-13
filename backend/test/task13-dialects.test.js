process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const dialects = require('../src/datasources/dialects');

test('mysql quoteIdent uses backticks', () => {
  assert.equal(dialects.mysql.quoteIdent('col'), '`col`');
  assert.equal(dialects.mysql.quoteIdent('my table'), '`my table`');
});

test('pg quoteIdent uses double quotes', () => {
  assert.equal(dialects.pg.quoteIdent('col'), '"col"');
});

test('clickhouse quoteIdent uses double quotes', () => {
  assert.equal(dialects.clickhouse.quoteIdent('col'), '"col"');
});

test('mssql quoteIdent uses brackets', () => {
  assert.equal(dialects.mssql.quoteIdent('col'), '[col]');
});

test('mysql limit uses LIMIT n', () => {
  assert.equal(dialects.mysql.limit('SELECT * FROM t', 10), 'SELECT * FROM t LIMIT 10');
});

test('mssql limit uses TOP n', () => {
  assert.equal(dialects.mssql.limit('SELECT * FROM t', 10), 'SELECT TOP (10) * FROM t');
});

test('mysql dateTrunc uses DATE_FORMAT', () => {
  const sql = dialects.mysql.dateTrunc('created_at', 'month');
  assert.ok(sql.includes('DATE_FORMAT'));
  assert.ok(sql.includes('%Y-%m'));
});

test('pg dateTrunc uses DATE_TRUNC', () => {
  const sql = dialects.pg.dateTrunc('created_at', 'month');
  assert.ok(sql.includes('DATE_TRUNC'));
});

test('clickhouse dateTrunc uses toStartOfMonth', () => {
  const sql = dialects.clickhouse.dateTrunc('created_at', 'month');
  assert.ok(sql.includes('toStartOfMonth'));
});

test('mssql dateTrunc uses DATETRUNC', () => {
  const sql = dialects.mssql.dateTrunc('created_at', 'month');
  assert.ok(sql.includes('DATETRUNC'));
});

test('all dialects have quoteIdent, limit, dateTrunc, typeMapping, placeholder', () => {
  for (const [name, d] of Object.entries(dialects)) {
    assert.equal(typeof d.quoteIdent, 'function', `${name} missing quoteIdent`);
    assert.equal(typeof d.limit, 'function', `${name} missing limit`);
    assert.equal(typeof d.dateTrunc, 'function', `${name} missing dateTrunc`);
    assert.ok(d.typeMapping, `${name} missing typeMapping`);
    assert.equal(typeof d.placeholder, 'function', `${name} missing placeholder`);
  }
});