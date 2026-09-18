process.env.DB_PATH = `/tmp/kanban-test-etl-fixes-${process.pid}.db`;
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDb } = require('./helpers/db');
const buildSql = require('../src/datasources/build-sql');

const mysql = {
  quoteIdent: (n) => `\`${n}\``, limit: (s, n) => `${s} LIMIT ${n}`,
  placeholder: () => '?', dateTrunc: (f, u) => `DATE_FORMAT(\`${f}\`, '%Y-%m')`,
  agg: { count: 'COUNT', sum: 'SUM', count_distinct: 'COUNT(DISTINCT' },
};
const pg = {
  quoteIdent: (n) => `"${n}"`, limit: (s, n) => `${s} LIMIT ${n}`,
  placeholder: (i) => `$${i}`, dateTrunc: (f) => `DATE_TRUNC('month', "${f}")`,
  agg: { count: 'COUNT', sum: 'SUM', count_distinct: 'COUNT(DISTINCT' },
};

function catalog() {
  return [
    { schema: 'testdb', table: 'orders', columns: [{ name: 'id', type: 'int' }, { name: 'customer_id', type: 'int' }, { name: 'amount', type: 'decimal' }, { name: 'status', type: 'varchar' }] },
    { schema: 'testdb', table: 'customers', columns: [{ name: 'id', type: 'int' }, { name: 'name', type: 'varchar' }] },
  ];
}

before(async () => { await resetDb(); });

test('compileEtl source without table → clear error, not blank SQL', () => {
  const def = { type: 'etl', nodes: [{ nodeId: 'n1', nodeType: 'source', alias: 'o', schema: null, table: null }] };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  assert.throws(() => nodeSql('n1'), /源节点未选择表/);
});

test('compileEtl source with table but no catalog columns compiles with SELECT *', () => {
  const def = { type: 'etl', nodes: [{ nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'x', table: 't' }] };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  const out = nodeSql('n1');
  assert.ok(out.sql.includes('FROM `x`.`t` `o`'), out.sql);
});

test('compileEtl filter: empty-metric default condition is skipped → passthrough', () => {
  // 前端新建 filter 自带一条空条件 { field:{alias:'t0',field:''}, op:'eq', value:'' }
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'orders' },
      { nodeId: 'n2', nodeType: 'filter', sourceNode: 'n1', conditions: [{ field: { alias: 't0', field: '' }, op: 'eq', value: '' }] },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  const out = nodeSql('n2');
  assert.ok(!out.sql.includes('WHERE'), out.sql);
  assert.deepEqual(out.params, []);
});

test('compileEtl filter: skips empty-value rows, keeps valid ones, param order preserved', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'orders' },
      { nodeId: 'n2', nodeType: 'filter', sourceNode: 'n1', conditions: [
        { field: { alias: 'o', field: 'amount' }, op: 'gt', value: '' },
        { field: { alias: 'o', field: 'status' }, op: 'eq', value: 'SHIPPED' },
        { field: { alias: 'o', field: 'amount' }, op: 'gt', value: 100 },
      ] },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  const out = nodeSql('n2');
  assert.ok(out.sql.includes('WHERE `__o__status` = ? AND `__o__amount` > ?'), out.sql);
  assert.deepEqual(out.params, ['SHIPPED', 100], JSON.stringify(out.params));
});

test('compileEtl aggregate: empty-metric default does not throw; valid count compiled', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'orders' },
      { nodeId: 'n2', nodeType: 'aggregate', sourceNode: 'n1', groupBy: [], metrics: [
        { agg: 'sum', field: '' },
        { agg: 'count' },
      ] },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  const out = nodeSql('n2');
  assert.ok(out.sql.includes('COUNT(*)'), out.sql);
  assert.equal(out.fields.length, 1);
});

test('compileEtl aggregate: all metrics empty → still produces valid SQL (no throw)', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'orders' },
      { nodeId: 'n2', nodeType: 'aggregate', sourceNode: 'n1', groupBy: [], metrics: [{ agg: 'sum', field: '' }] },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  const out = nodeSql('n2');
  assert.ok(out.sql.includes('SELECT'), out.sql);
});

test('compileEtl aggregate: metric field gives pref alias.o ref, merges dims+metrics correctly', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'orders' },
      { nodeId: 'n2', nodeType: 'aggregate', sourceNode: 'n1', groupBy: [{ alias: 'o', field: 'status' }], metrics: [{ agg: 'sum', field: { alias: 'o', field: 'amount' } }] },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  const out = nodeSql('n2');
  assert.ok(out.sql.includes('SUM(`__o__amount`)'), out.sql);
  assert.ok(out.sql.includes('GROUP BY `__o__status`'), out.sql);
  const names = out.fields.map((f) => f.name);
  assert.deepEqual(names, ['d_0', 'm_0'], JSON.stringify(names));
});

test('compileEtl join: field refs compare using mapOut of refs', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'orders' },
      { nodeId: 'n2', nodeType: 'source', alias: 'c', schema: 'testdb', table: 'customers' },
      { nodeId: 'n3', nodeType: 'join', sourceNode: 'n1', rightNodeId: 'n2', on: [{ from: { alias: 'o', field: 'customer_id' }, to: { alias: 'c', field: 'id' } }] },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  const out = nodeSql('n3');
  assert.ok(out.sql.includes('ON `__o__customer_id` = `__c__id`'), out.sql);
});

test('compileEtl valueReplace: empty-field mapping skipped, valid mapping works', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'orders' },
      { nodeId: 'n2', nodeType: 'valueReplace', sourceNode: 'n1', mappings: [
        { field: { alias: 't0', field: '' }, from: 'A', to: 'B' },
        { field: { alias: 'o', field: 'status' }, from: 'SHIPPED', to: '已发货' },
      ] },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  const out = nodeSql('n2');
  assert.ok(out.sql.includes('CASE WHEN `__o__status`'), out.sql);
  assert.deepEqual(out.params, ['SHIPPED', '已发货'], JSON.stringify(out.params));
});

test('compileEtl nullReplace: empty-field mapping skipped', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'orders' },
      { nodeId: 'n2', nodeType: 'nullReplace', sourceNode: 'n1', mappings: [
        { field: { alias: 'o', field: 'status' }, to: '未知' },
        { field: { alias: 't0', field: '' }, to: 'x' },
      ] },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  const out = nodeSql('n2');
  assert.ok(out.sql.includes('COALESCE(`__o__status`, ?)'), out.sql);
  assert.deepEqual(out.params, ['未知'], JSON.stringify(out.params));
});

test('compileEtl trim: empty columns are skipped, valid columns trimmed', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'orders' },
      { nodeId: 'n2', nodeType: 'trim', sourceNode: 'n1', columns: ['o.id', 'o.missing', ''] },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  const out = nodeSql('n2');
  assert.ok(out.sql.includes('TRIM(`__o__id`)'), out.sql);
  // 不存在于 catalog 的列被忽略
  assert.ok(!out.sql.includes('__o__missing'), out.sql);
});

test('compileEtl pref-string refs (frontend form) work across filter/aggregate/join', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'orders' },
      { nodeId: 'n2', nodeType: 'source', alias: 'c', schema: 'testdb', table: 'customers' },
      { nodeId: 'n3', nodeType: 'join', sourceNode: 'n1', rightNodeId: 'n2', on: [{ from: 'o.customer_id', to: 'c.id' }] },
      { nodeId: 'n4', nodeType: 'filter', sourceNode: 'n3', conditions: [{ field: 'o.status', op: 'eq', value: 'SHIPPED' }] },
      { nodeId: 'n5', nodeType: 'aggregate', sourceNode: 'n4', groupBy: ['o.status'], metrics: [{ agg: 'sum', field: 'o.amount' }, { agg: 'count' }] },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  const join = nodeSql('n3');
  assert.ok(join.sql.includes('ON `__o__customer_id` = `__c__id`'), join.sql);
  const filter = nodeSql('n4');
  assert.ok(filter.sql.includes('WHERE `__o__status` = ?') || filter.sql.includes('`__o__status` = ?'), filter.sql);
  assert.deepEqual(filter.params, ['SHIPPED'], JSON.stringify(filter.params));
  const agg = nodeSql('n5');
  assert.ok(agg.sql.includes('SUM(`__o__amount`)'), agg.sql);
  assert.ok(agg.sql.includes('COUNT(*)'), agg.sql);
  assert.ok(agg.sql.includes('GROUP BY `__o__status`'), agg.sql);
});