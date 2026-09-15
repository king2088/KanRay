const test = require('node:test');
const assert = require('node:assert');
const { sqlite, mysql, pg, mssql, oracle, mariadb } = require('../src/datasources/dialects');

// --- Task 2: sqlite / mariadb 方言断言 ---

test('sqlite 方言 paginate/now/typeMapping', () => {
  assert.equal(sqlite.paginate('SELECT 1', 10, 5), 'SELECT 1 LIMIT 10 OFFSET 5');
  assert.equal(sqlite.now, "datetime('now')");
  assert.equal(sqlite.typeMapping.number, 'REAL');
  assert.equal(sqlite.typeMapping.integer, 'INTEGER');
  assert.equal(sqlite.upsertSyntax, 'conflict');
});

test('sqlite 方言 dateTrunc', () => {
  assert.equal(sqlite.dateTrunc('created_at', 'month'), "strftime('%Y-%m', \"created_at\")");
});

test('sqlite 方言 quoteIdent', () => {
  assert.equal(sqlite.quoteIdent('my table'), '"my table"');
});

test('mariadb 复用 mysql 方言', () => {
  assert.equal(mariadb.quoteIdent('a'), '`a`');
  assert.equal(mariadb.limit('SELECT 1', 5), 'SELECT 1 LIMIT 5');
  assert.equal(mariadb.now, 'NOW()');
  assert.equal(mariadb.upsertSyntax, 'dup');
});

// --- Task 3: translate.js ---

// translate 尚未创建，先用 module cache 方式测试
test('translate 占位符: pg $n', () => {
  try {
    const { translate } = require('../src/db/translate');
    assert.equal(translate('SELECT * FROM t WHERE a = ? AND b = ?', pg), 'SELECT * FROM t WHERE a = $1 AND b = $2');
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') throw e;
    throw e;
  }
});

test('translate 占位符: mssql @pN', () => {
  const { translate } = require('../src/db/translate');
  assert.equal(translate('SELECT * FROM t WHERE a = ?', mssql), 'SELECT * FROM t WHERE a = @p0');
});

test('translate 占位符: oracle :n', () => {
  const { translate } = require('../src/db/translate');
  assert.equal(translate('SELECT * FROM t WHERE a = ? OR c IN (?, ?)', oracle), 'SELECT * FROM t WHERE a = :1 OR c IN (:2, :3)');
});

test('translate 标识符: mysql 反引号', () => {
  const { translate } = require('../src/db/translate');
  assert.equal(translate('SELECT "id", "a b" FROM "t" WHERE "x" = ?', mysql), 'SELECT `id`, `a b` FROM `t` WHERE `x` = ?');
});

test('translate 标识符: mssql 方括号', () => {
  const { translate } = require('../src/db/translate');
  assert.equal(translate('SELECT "id" FROM "t"', mssql), 'SELECT [id] FROM [t]');
});

test('translate datetime(now)', () => {
  const { translate } = require('../src/db/translate');
  assert.equal(translate("UPDATE t SET x = datetime('now') WHERE id = ?", mysql), 'UPDATE t SET x = NOW() WHERE id = ?');
  assert.equal(translate("UPDATE t SET x = datetime('now') WHERE id = ?", pg), 'UPDATE t SET x = now() WHERE id = $1');
});

test('translate 保留字符串字面量', () => {
  const { translate } = require('../src/db/translate');
  assert.equal(translate("SELECT 'it\\'s a ? ?' AS v", pg), "SELECT 'it\\'s a ? ?' AS v");
});

test('translate sqlite 方言无变化', () => {
  const { translate } = require('../src/db/translate');
  assert.equal(translate("SELECT \"id\" FROM \"t\" WHERE a = ? AND b = datetime('now')", sqlite),
    "SELECT \"id\" FROM \"t\" WHERE a = ? AND b = datetime('now')");
});

test('translate 嵌套引号字面量不被替换', () => {
  const { translate } = require('../src/db/translate');
  assert.equal(translate("SELECT 'hello' || ' ? ' AS x", pg), "SELECT 'hello' || ' ? ' AS x");
});
