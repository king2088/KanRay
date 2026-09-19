// backend/test/task36-portable-sql.test.js
// 同步源可移植 SQL 转换单测：`?` 占位符与 `LIMIT n [OFFSET m]` 转各方言。
// 覆盖 mssql（@p0 / TOP / FETCH）与 oracle（:1 / FETCH FIRST），以及字符串字面量跳过。
const test = require('node:test');
const assert = require('node:assert');
const { toDialect } = require('../src/datasources/portable-sql');
const { pg, mssql, oracle, mysql } = require('../src/datasources/dialects');

test('pg：? → $n，单引号字面量内的 ? 不替换', () => {
  const sql = "SELECT * FROM t WHERE note = 'a?b' AND id > ? AND x = ?";
  assert.equal(
    toDialect(sql, pg),
    "SELECT * FROM t WHERE note = 'a?b' AND id > $1 AND x = $2",
  );
});

test('mysql：? 原样保留，LIMIT 原样', () => {
  assert.equal(toDialect('SELECT * FROM t WHERE id > ? ORDER BY id LIMIT 500', mysql),
    'SELECT * FROM t WHERE id > ? ORDER BY id LIMIT 500');
});

test('mssql：? → @p0，LIMIT → SELECT TOP，OFFSET → FETCH NEXT', () => {
  const sql = 'SELECT id, amt FROM dbo.t WHERE id > ? ORDER BY id ASC LIMIT 500';
  assert.equal(
    toDialect(sql, mssql),
    'SELECT TOP (500) id, amt FROM dbo.t WHERE id > @p0 ORDER BY id ASC',
  );
});

test('mssql：LIMIT n OFFSET m → OFFSET/FETCH（主键对账分页）', () => {
  const sql = 'SELECT id FROM dbo.t ORDER BY id ASC LIMIT 500 OFFSET 1000';
  assert.equal(
    toDialect(sql, mssql),
    'SELECT id FROM dbo.t ORDER BY id ASC OFFSET 1000 ROWS FETCH NEXT 500 ROWS ONLY',
  );
});

test('oracle：? → :n，LIMIT → FETCH FIRST，OFFSET → FETCH NEXT', () => {
  const one = 'SELECT id, amt FROM t WHERE id > ? ORDER BY id ASC LIMIT 500';
  assert.equal(
    toDialect(one, oracle),
    'SELECT id, amt FROM t WHERE id > :1 ORDER BY id ASC FETCH FIRST 500 ROWS ONLY',
  );
  const page = 'SELECT id FROM t ORDER BY id ASC LIMIT 500 OFFSET 1000';
  assert.equal(
    toDialect(page, oracle),
    'SELECT id FROM t ORDER BY id ASC OFFSET 1000 ROWS FETCH NEXT 500 ROWS ONLY',
  );
});

test('无 ? 且无 LIMIT：语句原样返回', () => {
  const sql = 'SELECT COUNT(*) AS c FROM t';
  assert.equal(toDialect(sql, mssql), sql);
  assert.equal(toDialect(sql, oracle), sql);
});

test('占位符计数与字面量：字符串里的 ? 不占用位置', () => {
  const sql = "SELECT * FROM t WHERE a = '?' AND b = ? AND c = ? LIMIT 10";
  assert.equal(
    toDialect(sql, oracle),
    "SELECT * FROM t WHERE a = '?' AND b = :1 AND c = :2 FETCH FIRST 10 ROWS ONLY",
  );
});
