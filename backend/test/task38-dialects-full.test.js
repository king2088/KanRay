process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const dialects = require('../src/datasources/dialects');
const { toDialect } = require('../src/datasources/portable-sql');

// ── DB2 ────────────────────────────────────────────────
test('db2: double-quote ident + FETCH FIRST limit + OFFSET/FETCH NEXT paginate', () => {
  assert.equal(dialects.db2.quoteIdent('col'), '"col"');
  assert.equal(dialects.db2.quoteIdent('a"b'), '"a""b"');
  assert.equal(dialects.db2.limit('SELECT * FROM t', 10), 'SELECT * FROM t FETCH FIRST 10 ROWS ONLY');
  assert.equal(dialects.db2.paginate('SELECT * FROM t', 10, 20), 'SELECT * FROM t OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY');
});

test('db2: DATE_TRUNC dateTrunc + ? placeholder + upsert merge', () => {
  const sql = dialects.db2.dateTrunc('created_at', 'month');
  assert.ok(sql.includes('DATE_TRUNC'), sql);
  assert.equal(dialects.db2.placeholder(), '?');
  assert.equal(dialects.db2.upsertSyntax, 'merge');
  assert.equal(dialects.db2.typeMapping.string, 'VARCHAR(4000)');
});

// ── 达梦 ────────────────────────────────────────────────
test('dameng: double-quote ident + LIMIT/OFFSET + TRUNC dateTrunc', () => {
  assert.equal(dialects.dameng.quoteIdent('col'), '"col"');
  assert.equal(dialects.dameng.limit('SELECT * FROM t', 10), 'SELECT * FROM t LIMIT 10');
  assert.equal(dialects.dameng.paginate('SELECT * FROM t', 10, 20), 'SELECT * FROM t LIMIT 10 OFFSET 20');
  const d = dialects.dameng.dateTrunc('created_at', 'month');
  assert.ok(d.includes("TRUNC("), d);
  assert.ok(d.includes("'MONTH'"), d);
  assert.equal(dialects.dameng.upsertSyntax, 'merge');
});

// ── Hive ────────────────────────────────────────────────
test('hive: backtick ident + LIMIT + trunc dateTrunc', () => {
  assert.equal(dialects.hive.quoteIdent('col'), '`col`');
  assert.equal(dialects.hive.limit('SELECT * FROM t', 10), 'SELECT * FROM t LIMIT 10');
  const d = dialects.hive.dateTrunc('created_at', 'month');
  assert.ok(d.startsWith('trunc('), d);
  assert.ok(d.includes("'MM'"), d);
  assert.equal(dialects.hive.upsertSyntax, 'none');
});

test('hive: OFFSET 用 ROW_NUMBER 窗口模拟并保留 ORDER BY 与占位符', () => {
  const sql = 'SELECT id FROM t WHERE x = ? ORDER BY id ASC LIMIT 500 OFFSET 1000';
  const out = toDialect(sql, dialects.hive);
  assert.equal(
    out,
    'SELECT id FROM ( SELECT id, ROW_NUMBER() OVER (ORDER BY id ASC) AS __rn FROM t WHERE x = ? ) __p WHERE __rn > 1000 AND __rn <= 1500 ORDER BY id ASC',
  );
});

// ── Impala ────────────────────────────────────────────────
test('impala: backtick ident + LIMIT/OFFSET + TRUNC dateTrunc', () => {
  assert.equal(dialects.impala.quoteIdent('col'), '`col`');
  assert.equal(dialects.impala.limit('SELECT * FROM t', 10), 'SELECT * FROM t LIMIT 10');
  assert.equal(dialects.impala.paginate('SELECT * FROM t ORDER BY id', 10, 20), 'SELECT * FROM t ORDER BY id LIMIT 10 OFFSET 20');
  assert.ok(dialects.impala.dateTrunc('created_at', 'month').includes("'MONTH'"));
});

// ── MaxCompute ────────────────────────────────────────────
test('maxcompute: backtick ident + LIMIT + DATE_FORMAT dateTrunc', () => {
  assert.equal(dialects.maxcompute.quoteIdent('col'), '`col`');
  assert.equal(dialects.maxcompute.limit('SELECT * FROM t', 10), 'SELECT * FROM t LIMIT 10');
  assert.ok(dialects.maxcompute.dateTrunc('created_at', 'month').includes("DATE_FORMAT"));
  assert.ok(dialects.maxcompute.dateTrunc('created_at', 'month').includes("'yyyy-MM'"));
});

test('maxcompute: OFFSET 用 ROW_NUMBER 窗口模拟', () => {
  const out = toDialect('SELECT a, b FROM t ORDER BY a ASC LIMIT 500 OFFSET 1000', dialects.maxcompute);
  assert.ok(out.includes('ROW_NUMBER()'), out);
  assert.ok(out.includes('__rn > 1000 AND __rn <= 1500'), out);
  assert.ok(out.includes('ORDER BY a ASC'), out);
});

// ── Elasticsearch ────────────────────────────────────────────
test('es-rest: backtick ident + LIMIT + 保留 LIMIT/OFFSET（provider 用游标解释）+ DATE_TRUNC', () => {
  assert.equal(dialects['es-rest'].quoteIdent('col'), '`col`');
  assert.equal(dialects['es-rest'].limit('SELECT * FROM idx', 10), 'SELECT * FROM idx LIMIT 10');
  assert.equal(dialects['es-rest'].paginate('SELECT * FROM idx', 10, 20), 'SELECT * FROM idx LIMIT 10 OFFSET 20');
  assert.ok(dialects['es-rest'].dateTrunc('created_at', 'month').includes("DATE_TRUNC('month'"));
  assert.equal(dialects['es-rest'].upsertSyntax, 'none');
});

// ── http / file 别名 sdqlite ────────────────────────────
test('http/file dialect 复用 sqlite', () => {
  assert.equal(dialects.http, dialects.sqlite);
  assert.equal(dialects.file, dialects.sqlite);
});

// ── 全部新方言具备契约函数 ────────────────────────────
test('新增方言均具备完整契约（含 typeMapping/now/agg）', () => {
  for (const name of ['db2', 'dameng', 'hive', 'impala', 'maxcompute', 'es-rest']) {
    const d = dialects[name];
    for (const fn of ['quoteIdent', 'limit', 'paginate', 'dateTrunc', 'placeholder', 'trim']) {
      assert.equal(typeof d[fn], 'function', `${name} missing ${fn}`);
    }
    assert.ok(d.typeMapping, `${name} missing typeMapping`);
    assert.ok(d.now, `${name} missing now`);
    assert.ok(d.agg, `${name} missing agg`);
    assert.ok(d.upsertSyntax, `${name} missing upsertSyntax`);
  }
});