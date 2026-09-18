process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDb } = require('./helpers/db');
const buildSql = require('../src/datasources/build-sql');
const datasetService = require('../src/services/dataset.service');

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

/** 插入一个数据源并返回实际 id（resetDb 不清 sqlite_sequence，勿硬编码 id=1） */
function insertDatasource(name) {
  const info = db.prepare('INSERT INTO data_sources (name, type, config, owner_id) VALUES (?, ?, ?, ?)')
    .run(name || 'mysql-ds', 'mysql', '{}', 1);
  return Number(info.lastInsertRowid);
}

before(async () => { await resetDb(); });

test('compileDetail builder: single table no aggregation', () => {
  // field 带自定义 name：实现恒输出 f_<i>（builder 忽略定义 name）
  const def = { type: 'builder', tables: [{ alias: 'o', schema: 'testdb', table: 'orders' }], joins: [], fields: [{ source: 'o', field: 'amount', name: 'custom', label: '金额' }], aggregation: null };
  const { sql, fields, params } = buildSql.compileDetail(def, mysql, catalog());
  assert.match(sql, /FROM `testdb`.`orders` `o`/);
  assert.ok(sql.includes('AS `f_0`'));
  assert.equal(fields.length, 1);
  assert.equal(fields[0].name, 'f_0');
  assert.equal(params.length, 0);
});

test('compileDetail builder: multi-table join + filter param', () => {
  const def = {
    type: 'builder',
    tables: [{ alias: 'o', schema: 'testdb', table: 'orders' }, { alias: 'c', schema: 'testdb', table: 'customers' }],
    joins: [{ type: 'inner', from: { alias: 'o', field: 'customer_id' }, to: { alias: 'c', field: 'id' } }],
    fields: [{ source: 'o', field: 'amount', label: '金额' }, { source: 'c', field: 'name', label: '客户' }],
    filters: [{ field: { alias: 'o', field: 'amount' }, op: 'gt', value: 100 }],
  };
  const { sql, params } = buildSql.compileDetail(def, mysql, catalog());
  assert.match(sql, /JOIN `testdb`.`customers` `c` ON `o`.`customer_id` = `c`.`id`/);
  assert.match(sql, /`o`.`amount` > \?/);
  assert.deepEqual(params, [100]);
});

test('compileDetail aggregation: SUM metric + d_0/m_0 fields', () => {
  const def = {
    type: 'builder',
    tables: [{ alias: 'o', schema: 'testdb', table: 'orders' }],
    joins: [],
    fields: [{ source: 'o', field: 'amount', label: '金额' }, { source: 'o', field: 'customer_id', label: '客户' }],
    aggregation: { groupBy: [{ alias: 'o', field: 'customer_id' }], metrics: [{ source: 'o', field: 'amount', agg: 'sum' }] },
  };
  const { sql, fields } = buildSql.compileDetail(def, mysql, catalog());
  assert.match(sql, /SUM\(`o`.`amount`\)/);
  // 实现按来源维度列分组（GROUP BY `o`.`customer_id`），而非分组输出别名 d_0
  assert.match(sql, /GROUP BY `o`.`customer_id`/);
  assert.ok(fields.some((f) => f.name === 'd_0' && f.type === 'string'));
  assert.ok(fields.some((f) => f.name === 'm_0' && f.type === 'number'));
});

test('compileDetail quoted mysql identifiers', () => {
  const def = { type: 'builder', tables: [{ alias: 'o', schema: 's', table: 'orders' }], joins: [], fields: [{ source: 'o', field: 'amount', label: 'x' }] };
  const { sql } = buildSql.compileDetail(def, mysql, catalog());
  assert.ok(sql.includes('`s`.`orders`'));
  assert.ok(sql.includes('`o`.`amount`'));
  assert.ok(!sql.includes('`s.orders`'));
});

test('compileDetail pg quotes with double quotes', () => {
  const def = { type: 'builder', tables: [{ alias: 'o', schema: 's', table: 'orders' }], joins: [], fields: [{ source: 'o', field: 'amount', label: 'x' }] };
  const { sql } = buildSql.compileDetail(def, pg, catalog());
  assert.ok(sql.includes('"s"."orders"'));
  assert.ok(sql.includes('"o"."amount"'));
});

test('compileDetail pure SQL whitelist + fields passthrough', () => {
  const { sql, fields } = buildSql.compileDetail({ type: 'sql', sql: 'SELECT 1 AS a', fields: [{ name: 'a', label: 'A', type: 'number' }] }, mysql, []);
  assert.equal(sql, 'SELECT 1 AS a');
  assert.deepEqual(fields, [{ name: 'a', label: 'A', type: 'number' }]);
});

test('compileDetail pure SQL accepts WITH', () => {
  const { sql } = buildSql.compileDetail({ type: 'sql', sql: 'WITH c AS (SELECT 1 AS a) SELECT a FROM c', fields: [{ name: 'a', label: 'A', type: 'number' }] }, mysql, []);
  assert.equal(sql, 'WITH c AS (SELECT 1 AS a) SELECT a FROM c');
});

test('compileDetail pure SQL rejects non-select', () => {
  assert.throws(() => buildSql.compileDetail({ type: 'sql', sql: 'DELETE FROM x' }, mysql, []), /SELECT|WITH/);
});

test('compileEtl chain to aggregate node is cumulative', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'orders' },
      { nodeId: 'n2', nodeType: 'join', sourceNode: 'n1', to: { alias: 'c', schema: 'testdb', table: 'customers' }, on: [{ from: { alias: 'o', field: 'customer_id' }, to: { alias: 'c', field: 'id' } }] },
      { nodeId: 'n3', nodeType: 'filter', sourceNode: 'n2', conditions: [{ field: { alias: 'o', field: 'amount' }, op: 'gt', value: 100 }] },
      { nodeId: 'n4', nodeType: 'aggregate', sourceNode: 'n3', groupBy: [{ alias: 'c', field: 'name' }], metrics: [{ source: 'o', field: 'amount', agg: 'sum' }] },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());

  const n2 = nodeSql('n2');
  // join 右侧用 `c`.`id`（右表别名.字段），而非展平后的 `__c__id`
  assert.ok(n2.sql.includes('JOIN `testdb`.`customers` `c` ON `__o__customer_id` = `c`.`id`'));

  const n3 = nodeSql('n3');
  assert.ok(n3.sql.includes('WHERE `__o__amount` > ?'));
  assert.deepEqual(n3.params, [100]);

  const n4 = nodeSql('n4');
  assert.ok(n4.sql.includes('SUM(`__o__amount`)'));
  assert.ok(n4.sql.includes('GROUP BY `__c__name`'));
  assert.equal(n4.fields[0].name, 'd_0');
  assert.equal(n4.fields[0].type, 'string');
  assert.equal(n4.fields[1].name, 'm_0');
  assert.equal(n4.fields[1].type, 'number');
  assert.deepEqual(n4.params, [100]);
});

test('compileEtl join honors right joinType', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 's', schema: 'testdb', table: 'sales' },
      { nodeId: 'n2', nodeType: 'join', joinType: 'right', sourceNode: 'n1', to: { alias: 'c', schema: 'testdb', table: 'sales' }, on: [{ from: { alias: 's', field: 'id' }, to: { alias: 'c', field: 'id' } }] },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  const sql = nodeSql('n2').sql;
  assert.ok(sql.includes('RIGHT JOIN'), '期望 RIGHT JOIN，实际: ' + sql);
  assert.ok(sql.includes('ON `__s__id` = `c`.`id`'), '右表列应直接引用别名: ' + sql);
});

test('compileEtl join honors legacy on[0].joinType left', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 's', schema: 'testdb', table: 'sales' },
      { nodeId: 'n2', nodeType: 'join', sourceNode: 'n1', to: { alias: 'c', schema: 'testdb', table: 'sales' }, on: [{ joinType: 'left', from: { alias: 's', field: 'id' }, to: { alias: 'c', field: 'id' } }] },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  const sql = nodeSql('n2').sql;
  assert.ok(sql.trim().includes('LEFT JOIN'), 'legacy left join not compiled: ' + sql);
});

test('compileEtl join honors node.joinType left', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 's', schema: 'testdb', table: 'sales' },
      { nodeId: 'n2', nodeType: 'join', joinType: 'left', sourceNode: 'n1', to: { alias: 'c', schema: 'testdb', table: 'sales' }, on: [{ from: { alias: 's', field: 'id' }, to: { alias: 'c', field: 'id' } }] },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  const sql = nodeSql('n2').sql;
  assert.ok(sql.trim().includes('LEFT JOIN'), 'node.joinType left not compiled: ' + sql);
});

test('compileEtl unknown node throws', () => {
  const def = { type: 'etl', nodes: [{ nodeId: 'n1', nodeType: 'badthing' }] };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  assert.throws(() => nodeSql('n1'), /未知节点类型/);
});

test('compileEtl multi-source: join via rightNodeId merges two source nodes', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'orders' },
      { nodeId: 'n2', nodeType: 'source', alias: 'c', schema: 'testdb', table: 'customers' },
      { nodeId: 'n3', nodeType: 'join', sourceNode: 'n1', rightNodeId: 'n2', on: [{ from: { alias: 'o', field: 'customer_id' }, to: { alias: 'c', field: 'id' } }] },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  const sql = nodeSql('n3').sql;
  // 右侧也是节点输出，ON 两侧都用展平别名
  assert.ok(sql.includes('ON `__o__customer_id` = `__c__id`'), sql);
  // 右侧必须包成子查询，且不能丢 schema/alias
  assert.ok(sql.includes('FROM `testdb`.`customers` `c`'), sql);
  const fields = nodeSql('n3').fields;
  assert.equal(fields.length, 6, JSON.stringify(fields.map((f) => f.name)));
  assert.ok(fields.some((f) => f.name === '__c__id'));
});

test('compileEtl multi-source: single output pulls both sources down to one chain', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'orders' },
      { nodeId: 'n2', nodeType: 'source', alias: 'c', schema: 'testdb', table: 'customers' },
      { nodeId: 'n3', nodeType: 'join', sourceNode: 'n1', rightNodeId: 'n2', on: [{ from: { alias: 'o', field: 'customer_id' }, to: { alias: 'c', field: 'id' } }] },
      { nodeId: 'n4', nodeType: 'filter', sourceNode: 'n3', conditions: [{ field: { alias: 'o', field: 'amount' }, op: 'gt', value: 100 }] },
      { nodeId: 'n5', nodeType: 'output', sourceNode: 'n4', limit: 10 },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  const n3 = nodeSql('n3');
  const n4 = nodeSql('n4');
  // 输出节点能把 join 后的子查询再包一层（说明链可累积多源）
  assert.ok(n4.sql.includes('FROM `testdb`.`customers` `c`'), n4.sql);
  assert.ok(n4.sql.endsWith('LIMIT 10') === false, 'limit 只出现在 output 节点: ' + n4.sql);
  const n5 = nodeSql('n5');
  assert.ok(n5.sql.includes('LIMIT 10'), n5.sql);
  assert.deepEqual(n5.params, [100]);
});

test('compileEtl columnSelect reduces output fields', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'orders' },
      { nodeId: 'n2', nodeType: 'columnSelect', sourceNode: 'n1', columns: ['o.amount', { alias: 'o', field: 'id' }] },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  const out = nodeSql('n2');
  assert.ok(out.sql.includes('SELECT `__o__amount`, `__o__id`'), out.sql);
  assert.deepEqual(out.fields.map((f) => f.name), ['__o__amount', '__o__id']);
});

test('compileEtl columnSelect rejects empty selection', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'orders' },
      { nodeId: 'n2', nodeType: 'columnSelect', sourceNode: 'n1', columns: [] },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  assert.throws(() => nodeSql('n2'), /至少选一列/);
});

test('compileEtl dedup no columns → DISTINCT * all fields', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'orders' },
      { nodeId: 'n2', nodeType: 'dedup', sourceNode: 'n1' },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  const out = nodeSql('n2');
  assert.ok(out.sql.includes('SELECT DISTINCT *'), out.sql);
  assert.equal(out.fields.length, 4);
});

test('compileEtl dedup by columns outputs only those columns', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'orders' },
      { nodeId: 'n2', nodeType: 'dedup', sourceNode: 'n1', columns: ['o.customer_id'] },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  const out = nodeSql('n2');
  assert.ok(out.sql.includes('SELECT DISTINCT `__o__customer_id`'), out.sql);
  assert.deepEqual(out.fields.map((f) => f.name), ['__o__customer_id']);
});

test('compileEtl valueReplace CASE WHEN + params in text order for positional dialects', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'orders' },
      { nodeId: 'n2', nodeType: 'filter', sourceNode: 'n1', conditions: [{ field: { alias: 'o', field: 'amount' }, op: 'gt', value: 100 }] },
      { nodeId: 'n3', nodeType: 'valueReplace', sourceNode: 'n2', mappings: [{ field: { alias: 'o', field: 'status' }, from: 'SHIPPED', to: '已发货' }] },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  const out = nodeSql('n3');
  // mysql `?` 按文本顺序绑定：外层 SELECT 的 from/to 在子查询 WHERE 之前
  assert.ok(out.params[0] === 'SHIPPED', JSON.stringify(out.params));
  assert.ok(out.sql.includes('CASE WHEN `__o__status` = ? THEN ? ELSE `__o__status` END AS `__o__status`'), out.sql);
  assert.deepEqual(out.params, ['SHIPPED', '已发货', 100]);
});

test('compileEtl nullReplace generates COALESCE', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'orders' },
      { nodeId: 'n2', nodeType: 'nullReplace', sourceNode: 'n1', mappings: [{ field: { alias: 'o', field: 'amount' }, to: 0 }] },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  const out = nodeSql('n2');
  assert.ok(out.sql.includes('COALESCE(`__o__amount`, ?) AS `__o__amount`'), out.sql);
  assert.deepEqual(out.params, [0]);
});

test('compileEtl trim mysql uses TRIM, mssql uses LTRIM/RTRIM', () => {
  const mssql = { quoteIdent: (n) => `[${n}]`, limit: (s, n) => `${s} TOP (${n})`, placeholder: (i) => `@p${i - 1}`,
    agg: { count: 'COUNT', sum: 'SUM', count_distinct: 'COUNT(DISTINCT' }, trim: (n) => `LTRIM(RTRIM(${n}))` };
  const def = (dialect) => ({
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'orders' },
      { nodeId: 'n2', nodeType: 'trim', sourceNode: 'n1', columns: ['o.id', 'o.amount'] },
    ],
  });
  const my = buildSql.compileEtl(def(mysql), mysql, catalog()).nodeSql('n2').sql;
  assert.ok(my.includes('TRIM(`__o__id`)'), my);
  assert.ok(my.includes('TRIM(`__o__amount`)'), my);
  const ms = buildSql.compileEtl(def(mssql), mssql, catalog()).nodeSql('n2').sql;
  assert.ok(ms.includes('LTRIM(RTRIM([__o__id])) AS [__o__id]'), ms);
});

test('compileEtl trim default trims all fields when columns omitted', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'orders' },
      { nodeId: 'n2', nodeType: 'trim', sourceNode: 'n1' },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  const out = nodeSql('n2');
  assert.ok(out.sql.includes('TRIM(`__o__id`)'), out.sql);
  assert.equal(out.fields.length, 4);
});

test('compileEtl sqlNode replaces __etl_prev with upstream subquery', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'orders' },
      { nodeId: 'n2', nodeType: 'columnSelect', sourceNode: 'n1', columns: ['o.amount'] },
      { nodeId: 'n3', nodeType: 'sqlNode', sourceNode: 'n2', sql: 'SELECT amount * 2 AS doubled FROM __etl_prev' },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  const out = nodeSql('n3');
  assert.ok(out.sql.includes('FROM (SELECT `__o__amount` FROM'), out.sql);
  assert.ok(!out.sql.includes('__etl_prev'), out.sql);
});

test('compileEtl sqlNode root raw SQL whitelist', () => {
  const good = buildSql.compileEtl({ type: 'etl', nodes: [
    { nodeId: 'n1', nodeType: 'sqlNode', sql: 'SELECT 1 AS a', fields: [{ name: 'a', label: 'A', type: 'number' }] },
  ] }, mysql, []).nodeSql('n1');
  assert.equal(good.sql, 'SELECT 1 AS a');
  assert.equal(good.fields.length, 1);

  const { nodeSql } = buildSql.compileEtl({ type: 'etl', nodes: [{ nodeId: 'n1', nodeType: 'sqlNode', sql: 'DROP TABLE x' }] }, mysql, []);
  assert.throws(() => nodeSql('n1'), /SELECT|WITH/);
});

test('compileEtl pg renumbers placeholders depth-first in textual order', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'orders' },
      { nodeId: 'n2', nodeType: 'filter', sourceNode: 'n1', conditions: [{ field: { alias: 'o', field: 'amount' }, op: 'gt', value: 100 }] },
      { nodeId: 'n3', nodeType: 'nullReplace', sourceNode: 'n2', mappings: [{ field: { alias: 'o', field: 'amount' }, to: 0 }] },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, pg, catalog());
  const out = nodeSql('n3');
  assert.ok(out.sql.includes('> $1'), out.sql);
  assert.ok(out.sql.includes('COALESCE("__o__amount", $2) AS "__o__amount"'), out.sql);
  assert.deepEqual(out.params, [100, 0]);
});

test('compileEtl diamond refs compile independently (no stale params)', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'orders' },
      { nodeId: 'n2', nodeType: 'filter', sourceNode: 'n1', conditions: [{ field: { alias: 'o', field: 'amount' }, op: 'gt', value: 100 }] },
      { nodeId: 'n3', nodeType: 'filter', sourceNode: 'n1', conditions: [{ field: { alias: 'o', field: 'amount' }, op: 'lt', value: 500 }] },
      { nodeId: 'n4', nodeType: 'join', sourceNode: 'n2', rightNodeId: 'n3', on: [{ from: { alias: 'o', field: 'id' }, to: { alias: 'o', field: 'id' } }] },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, pg, catalog());
  const out = nodeSql('n4');
  // 两侧子树各自独立编译：左子树参数 $1，右子树在文本上晚出现 → $2（顺序与文本一致）
  assert.ok(out.sql.includes('> $1') && out.sql.includes('< $2'), out.sql);
  assert.deepEqual(out.params, [100, 500]);
});

test('saveBuiltDataset creates then updates and rebuilds fields', async () => {
  const dsId = insertDatasource('mysql-ds');
  const def = { type: 'builder', tables: [{ alias: 't', schema: 'testdb', table: 'orders' }], joins: [], fields: [{ source: 't', field: 'amount', label: '金额', type: 'number' }], aggregation: null };
  const created = await datasetService.saveBuiltDataset({ name: 'Wide', definition: def, datasourceId: dsId, datasetId: null, ownerId: 1 });
  assert.equal(created.source_type, 'sql');
  assert.equal(created.build_definition.includes('"type":"builder"'), true);
  assert.equal(created.fields.length, 1);

  const def2 = { ...def, fields: [{ source: 't', field: 'amount', label: '金额2', type: 'number' }, { source: 't', field: 'customer_id', label: '客户', type: 'number' }] };
  const updated = await datasetService.saveBuiltDataset({ name: 'Wide2', definition: def2, datasourceId: dsId, datasetId: created.id, ownerId: 1 });
  assert.equal(updated.name, 'Wide2');
  assert.equal(updated.fields.length, 2);
  assert.equal((await datasetService.getFieldsOrThrow(created.id)).length, 2);
});

test('saveBuiltDataset rebuilds dataset_fields with f_<i> names/order/labels', async () => {
  const dsId = insertDatasource('mysql-ds-rebuild');
  const def = { type: 'builder', tables: [{ alias: 't', schema: 'testdb', table: 'orders' }], joins: [], fields: [{ source: 't', field: 'amount', label: '金额', type: 'number' }], aggregation: null };
  const created = await datasetService.saveBuiltDataset({ name: 'Order Amount', definition: def, datasourceId: dsId, datasetId: null, ownerId: 1 });

  let fields = await datasetService.getFieldsOrThrow(created.id);
  assert.equal(fields.length, 1);
  assert.equal(fields[0].name, 'f_0');
  assert.equal(fields[0].label, '金额');
  assert.equal(fields[0].type, 'number');

  const def2 = { ...def, fields: [
    { source: 't', field: 'customer_id', label: '客户', type: 'number' },
    { source: 't', field: 'amount', label: '金额', type: 'number' },
    { source: 't', field: 'id', label: 'ID', type: 'number' },
  ] };
  const updated = await datasetService.saveBuiltDataset({ name: 'Order Amount v2', definition: def2, datasourceId: dsId, datasetId: created.id, ownerId: 1 });

  fields = await datasetService.getFieldsOrThrow(created.id);
  assert.equal(fields.length, 3);
  assert.deepEqual(fields.map((f) => f.name), ['f_0', 'f_1', 'f_2']);
  assert.deepEqual(fields.map((f) => f.label), ['客户', '金额', 'ID']);
  assert.equal(updated.column_count, 3);
});

test('saveBuiltDataset enforces owner/datasource/existence guards', async () => {
  const dsId = insertDatasource('mysql-ds-guard');
  const def = { type: 'builder', tables: [{ alias: 't', schema: 'testdb', table: 'orders' }], joins: [], fields: [], aggregation: null };
  const created = await datasetService.saveBuiltDataset({ name: 'X', definition: def, datasourceId: dsId, datasetId: null, ownerId: 2 });

  // 他人（ownerId=3）更新 → 403 无权限
  await assert.rejects(datasetService.saveBuiltDataset({ name: 'Y', definition: def, datasourceId: dsId, datasetId: created.id, ownerId: 3 }), /无权限/);
  // datasource 错配（owner 正确但 datasourceId=999999）→ 400 不属于
  await assert.rejects(datasetService.saveBuiltDataset({ name: 'Y', definition: def, datasourceId: 999999, datasetId: created.id, ownerId: 2 }), /不属于该数据源/);
  // datasetId 不存在 → 404
  await assert.rejects(datasetService.saveBuiltDataset({ name: 'Y', definition: def, datasourceId: dsId, datasetId: 999999, ownerId: 2 }), /不存在/);
  // admin 可跨用户编辑
  const admin = await datasetService.saveBuiltDataset({ name: 'Y-admin', definition: def, datasourceId: dsId, datasetId: created.id, ownerId: 3, admin: true });
  assert.equal(admin.name, 'Y-admin');
});

test('saveBuiltDataset validates definition type and size', async () => {
  const dsId = insertDatasource('mysql-ds-validate');
  await assert.rejects(datasetService.saveBuiltDataset({ name: 'Bad', definition: { type: 'olap', tables: [] }, datasourceId: dsId, datasetId: null, ownerId: 1 }), /不支持的构建形态/);

  const big = { type: 'builder', tables: [{ alias: 't', schema: 's', table: 'orders' }], joins: [], fields: [], aggregation: null };
  big.padding = 'x'.repeat(1_000_001);
  await assert.rejects(datasetService.saveBuiltDataset({ name: 'Big', definition: big, datasourceId: dsId, datasetId: null, ownerId: 1 }), /构建定义过大/);
});

test('deleteDataset skips DROP TABLE for external sql datasets', async () => {
  const dsId = insertDatasource('mysql-ds-del');
  // table_name 含危险字符：若执行 DROP TABLE `buy-now` 会因语法错误抛异常 → 不抛即证明未 DROP
  const info = db.prepare(
    `INSERT INTO datasets (name, original_file, row_count, column_count, table_name, source_type, datasource_id, build_definition, owner_id)
     VALUES (?, ?, 0, 0, ?, 'sql', ?, '{}', 1)`
  ).run('danger', 'danger', 'buy-now', dsId);
  const id = Number(info.lastInsertRowid);

  assert.equal(await datasetService.deleteDataset(id), true);
  assert.equal(await datasetService.getDataset(id), null);
});

test('deleteDataset still deletes excel datasets (local table)', async () => {
  // 先真实建本地表，才能验证 deleteDataset 确实执行了 DROP
  db.exec('CREATE TABLE data_1 (id INTEGER)');
  db.exec("INSERT INTO data_1 (id) VALUES (1)");
  const info = db.prepare(
    `INSERT INTO datasets (name, original_file, row_count, column_count, table_name, source_type, owner_id)
     VALUES (?, ?, 0, 0, 'data_1', 'excel', 1)`
  ).run('excel-ds', 'excel-ds');
  const id = Number(info.lastInsertRowid);

  assert.equal(await datasetService.deleteDataset(id), true);
  assert.equal(await datasetService.getDataset(id), null);
  // 本地 excel 表应被清理
  const t = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'data_1'").get();
  assert.equal(t, undefined);
});

test('registerSqlDataset writes equivalent builder definition', async () => {
  const dsId = insertDatasource('mysql-ds-reg');
  const d = await datasetService.registerSqlDataset('Quick', dsId, 'testdb', 'sales', [
    { name: 'id', label: 'ID', type: 'integer' },
    { name: 'amount', label: null, type: null },
  ], 1);

  const def = JSON.parse(d.build_definition);
  assert.equal(def.type, 'builder');
  assert.equal(def.tables[0].table, 'sales');
  assert.equal(def.tables[0].alias, 't0');
  assert.equal(def.fields.length, 2);
  assert.equal(def.fields[0].source, 't0');
  assert.equal(def.fields[0].field, 'id');
  assert.equal(def.fields[0].label, 'ID');
  assert.equal(def.fields[0].type, 'integer');
  // 无 label/type 时回退：label=字段名、type=string
  assert.equal(def.fields[1].label, 'amount');
  assert.equal(def.fields[1].type, 'string');

  const reg = await datasetService.getFieldsOrThrow(d.id);
  assert.equal(reg.length, 2);
  assert.equal(reg[0].name, 'id');
  assert.equal(reg[0].label, 'ID');
});

test('getDataset returns build_definition and ordered fields', async () => {
  const dsId = insertDatasource('mysql-ds-get');
  const def = { type: 'builder', tables: [{ alias: 't', schema: 'testdb', table: 'orders' }], joins: [], fields: [
    { source: 't', field: 'amount', label: '金额', type: 'number' },
    { source: 't', field: 'customer_id', label: '客户', type: 'number' },
  ], aggregation: null };
  const created = await datasetService.saveBuiltDataset({ name: 'Order Amount', definition: def, datasourceId: dsId, datasetId: null, ownerId: 1 });

  const ds = await datasetService.getDataset(created.id);
  assert.ok(ds.build_definition.includes('"type":"builder"'));
  assert.deepEqual(ds.fields.map((f) => f.name), ['f_0', 'f_1']);
  assert.deepEqual(ds.fields.map((f) => f.label), ['金额', '客户']);
});

test('getFieldsOrThrow throws when dataset_fields empty', async () => {
  const dsId = insertDatasource('mysql-ds-empty');
  const def = { type: 'builder', tables: [{ alias: 't', schema: 'testdb', table: 'orders' }], joins: [], fields: [], aggregation: null };
  const created = await datasetService.saveBuiltDataset({ name: 'Empty', definition: def, datasourceId: dsId, datasetId: null, ownerId: 1 });

  await assert.rejects(datasetService.getFieldsOrThrow(created.id), /数据集字段为空/);
});