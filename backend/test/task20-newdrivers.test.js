process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const dialects = require('../src/datasources/dialects');
const drivers = require('../src/datasources/drivers');
const providers = require('../src/datasources/providers');

test('oracle dialect: double-quote ident + accidental quote escape', () => {
  assert.equal(dialects.oracle.quoteIdent('col'), '"col"');
  assert.equal(dialects.oracle.quoteIdent('a"b'), '"a""b"');
});

test('oracle dialect: FETCH FIRST for limit (12c+)', () => {
  assert.equal(dialects.oracle.limit('SELECT * FROM t ORDER BY 1', 10), 'SELECT * FROM t ORDER BY 1 FETCH FIRST 10 ROWS ONLY');
});

test('oracle dialect: TRUNC dateTrunc + numbered placeholder + agg', () => {
  const sql = dialects.oracle.dateTrunc('created_at', 'month');
  assert.ok(sql.startsWith('TRUNC('), sql);
  assert.ok(sql.includes("'MONTH'"), sql);
  assert.equal(dialects.oracle.placeholder(1), ':1');
  assert.equal(dialects.oracle.placeholder(3), ':3');
  assert.equal(dialects.oracle.agg.count_distinct, 'COUNT(DISTINCT');
});

test('presto dialect: double-quote ident + LIMIT + date_trunc + ? placeholder', () => {
  assert.equal(dialects.presto.quoteIdent('col'), '"col"');
  assert.equal(dialects.presto.limit('SELECT * FROM t', 10), 'SELECT * FROM t LIMIT 10');
  assert.ok(dialects.presto.dateTrunc('created_at', 'month').startsWith("date_trunc('month'"));
  assert.equal(dialects.presto.placeholder(), '?');
  assert.equal(dialects.presto.agg.sum, 'SUM');
});

test('gbase/oracle/presto now tested with full capabilities', () => {
  for (const type of ['gbase', 'oracle', 'presto']) {
    const d = drivers.find((x) => x.type === type);
    assert.ok(d, `${type} missing in drivers`);
    assert.equal(d.status, 'tested', `${type} should be tested`);
    assert.deepEqual(d.capabilities, { test: true, browse: true, dataset: true }, `${type} full capabilities`);
  }
});

test('gbase reuses mysql family; oracle/presto have dedicated providers', () => {
  const gbase = drivers.find((x) => x.type === 'gbase');
  assert.equal(gbase.family, 'mysql');
  assert.ok(providers.getProvider('mysql'));
  assert.equal(drivers.find((x) => x.type === 'oracle').family, 'oracle');
  assert.equal(drivers.find((x) => x.type === 'presto').family, 'presto');
  assert.ok(providers.getProvider('oracle'));
  assert.ok(providers.getProvider('presto'));
});

test('new providers expose full connector surface', () => {
  for (const family of ['oracle', 'presto', 'db2', 'dameng', 'hive', 'impala', 'maxcompute', 'es-rest', 'http']) {
    const p = providers.getProvider(family);
    assert.ok(p, `${family} provider missing`);
    for (const fn of ['testConnection', 'listSchemas', 'listTables', 'listColumns', 'runQuery']) {
      assert.equal(typeof p[fn], 'function', `${family}.${fn} missing`);
    }
  }
});

test('5 新家族 tested 全配套（dialect + provider + drivers）', () => {
  const NEW = {
    db2: { family: 'db2', dialect: 'db2' },
    dameng: { family: 'dameng', dialect: 'dameng' },
    hive: { family: 'hive', dialect: 'hive' },
    impala: { family: 'impala', dialect: 'impala' },
    maxcompute: { family: 'maxcompute', dialect: 'maxcompute' },
  };
  for (const [type, spec] of Object.entries(NEW)) {
    const d = drivers.find((x) => x.type === type);
    assert.ok(d, `${type} missing in drivers`);
    assert.equal(d.status, 'tested', `${type} should be tested`);
    assert.deepEqual(d.capabilities, { test: true, browse: true, dataset: true }, `${type} full capabilities`);
    assert.equal(d.family, spec.family, `${type} family`);
    assert.ok(dialects[d.family], `${type} dialect missing`);
    assert.ok(providers.getProvider(d.family), `${type} provider missing`);
  }
});

test('es-rest / http 已达全能力 dataset', () => {
  for (const type of ['elasticsearch', 'api']) {
    const d = drivers.find((x) => x.type === type);
    assert.deepEqual(d.capabilities, { test: true, browse: true, dataset: true }, `${type} full capabilities`);
    assert.ok(providers.getProvider(d.family), `${type} provider missing`);
  }
});