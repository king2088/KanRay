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
    { schema: 'testdb', table: 'orders', columns: [{ name: 'id', type: 'int' }, { name: 'customer_id', type: 'int' }, { name: 'amount', type: 'decimal' }] },
    { schema: 'testdb', table: 'customers', columns: [{ name: 'id', type: 'int' }, { name: 'name', type: 'varchar' }] },
  ];
}

/** 插入一个数据源并返回实际 id（resetDb 不清 sqlite_sequence，勿硬编码 id=1） */
function insertDatasource(name) {
  const info = db.prepare('INSERT INTO data_sources (name, type, config, owner_id) VALUES (?, ?, ?, ?)')
    .run(name || 'mysql-ds', 'mysql', '{}', 1);
  return Number(info.lastInsertRowid);
}

before(() => { resetDb(); });

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

test('compileEtl unknown node throws', () => {
  const def = { type: 'etl', nodes: [{ nodeId: 'n1', nodeType: 'badthing' }] };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  assert.throws(() => nodeSql('n1'), /未知节点类型/);
});

test('saveBuiltDataset creates then updates and rebuilds fields', () => {
  const dsId = insertDatasource('mysql-ds');
  const def = { type: 'builder', tables: [{ alias: 't', schema: 'testdb', table: 'orders' }], joins: [], fields: [{ source: 't', field: 'amount', label: '金额', type: 'number' }], aggregation: null };
  const created = datasetService.saveBuiltDataset({ name: 'Wide', definition: def, datasourceId: dsId, datasetId: null, ownerId: 1 });
  assert.equal(created.source_type, 'sql');
  assert.equal(created.build_definition.includes('"type":"builder"'), true);
  assert.equal(created.fields.length, 1);

  const def2 = { ...def, fields: [{ source: 't', field: 'amount', label: '金额2', type: 'number' }, { source: 't', field: 'customer_id', label: '客户', type: 'number' }] };
  const updated = datasetService.saveBuiltDataset({ name: 'Wide2', definition: def2, datasourceId: dsId, datasetId: created.id, ownerId: 1 });
  assert.equal(updated.name, 'Wide2');
  assert.equal(updated.fields.length, 2);
  assert.equal(datasetService.getFieldsOrThrow(created.id).length, 2);
});

test('saveBuiltDataset rebuilds dataset_fields with f_<i> names/order/labels', () => {
  const dsId = insertDatasource('mysql-ds-rebuild');
  const def = { type: 'builder', tables: [{ alias: 't', schema: 'testdb', table: 'orders' }], joins: [], fields: [{ source: 't', field: 'amount', label: '金额', type: 'number' }], aggregation: null };
  const created = datasetService.saveBuiltDataset({ name: 'Order Amount', definition: def, datasourceId: dsId, datasetId: null, ownerId: 1 });

  let fields = datasetService.getFieldsOrThrow(created.id);
  assert.equal(fields.length, 1);
  assert.equal(fields[0].name, 'f_0');
  assert.equal(fields[0].label, '金额');
  assert.equal(fields[0].type, 'number');

  const def2 = { ...def, fields: [
    { source: 't', field: 'customer_id', label: '客户', type: 'number' },
    { source: 't', field: 'amount', label: '金额', type: 'number' },
    { source: 't', field: 'id', label: 'ID', type: 'number' },
  ] };
  const updated = datasetService.saveBuiltDataset({ name: 'Order Amount v2', definition: def2, datasourceId: dsId, datasetId: created.id, ownerId: 1 });

  fields = datasetService.getFieldsOrThrow(created.id);
  assert.equal(fields.length, 3);
  assert.deepEqual(fields.map((f) => f.name), ['f_0', 'f_1', 'f_2']);
  assert.deepEqual(fields.map((f) => f.label), ['客户', '金额', 'ID']);
  assert.equal(updated.column_count, 3);
});

test('saveBuiltDataset enforces owner/datasource/existence guards', () => {
  const dsId = insertDatasource('mysql-ds-guard');
  const def = { type: 'builder', tables: [{ alias: 't', schema: 'testdb', table: 'orders' }], joins: [], fields: [], aggregation: null };
  const created = datasetService.saveBuiltDataset({ name: 'X', definition: def, datasourceId: dsId, datasetId: null, ownerId: 2 });

  // 他人（ownerId=3）更新 → 403 无权限
  assert.throws(() => datasetService.saveBuiltDataset({ name: 'Y', definition: def, datasourceId: dsId, datasetId: created.id, ownerId: 3 }), /无权限/);
  // datasource 错配（owner 正确但 datasourceId=999999）→ 400 不属于
  assert.throws(() => datasetService.saveBuiltDataset({ name: 'Y', definition: def, datasourceId: 999999, datasetId: created.id, ownerId: 2 }), /不属于该数据源/);
  // datasetId 不存在 → 404
  assert.throws(() => datasetService.saveBuiltDataset({ name: 'Y', definition: def, datasourceId: dsId, datasetId: 999999, ownerId: 2 }), /不存在/);
  // admin 可跨用户编辑
  const admin = datasetService.saveBuiltDataset({ name: 'Y-admin', definition: def, datasourceId: dsId, datasetId: created.id, ownerId: 3, admin: true });
  assert.equal(admin.name, 'Y-admin');
});

test('saveBuiltDataset validates definition type and size', () => {
  const dsId = insertDatasource('mysql-ds-validate');
  assert.throws(() => datasetService.saveBuiltDataset({ name: 'Bad', definition: { type: 'olap', tables: [] }, datasourceId: dsId, datasetId: null, ownerId: 1 }), /不支持的构建形态/);

  const big = { type: 'builder', tables: [{ alias: 't', schema: 's', table: 'orders' }], joins: [], fields: [], aggregation: null };
  big.padding = 'x'.repeat(1_000_001);
  assert.throws(() => datasetService.saveBuiltDataset({ name: 'Big', definition: big, datasourceId: dsId, datasetId: null, ownerId: 1 }), /构建定义过大/);
});

test('deleteDataset skips DROP TABLE for external sql datasets', () => {
  const dsId = insertDatasource('mysql-ds-del');
  // table_name 含危险字符：若执行 DROP TABLE `buy-now` 会因语法错误抛异常 → 不抛即证明未 DROP
  const info = db.prepare(
    `INSERT INTO datasets (name, original_file, row_count, column_count, table_name, source_type, datasource_id, build_definition, owner_id)
     VALUES (?, ?, 0, 0, ?, 'sql', ?, '{}', 1)`
  ).run('danger', 'danger', 'buy-now', dsId);
  const id = Number(info.lastInsertRowid);

  assert.equal(datasetService.deleteDataset(id), true);
  assert.equal(datasetService.getDataset(id), null);
});

test('deleteDataset still deletes excel datasets (local table)', () => {
  // 先真实建本地表，才能验证 deleteDataset 确实执行了 DROP
  db.exec('CREATE TABLE data_1 (id INTEGER)');
  db.exec("INSERT INTO data_1 (id) VALUES (1)");
  const info = db.prepare(
    `INSERT INTO datasets (name, original_file, row_count, column_count, table_name, source_type, owner_id)
     VALUES (?, ?, 0, 0, 'data_1', 'excel', 1)`
  ).run('excel-ds', 'excel-ds');
  const id = Number(info.lastInsertRowid);

  assert.equal(datasetService.deleteDataset(id), true);
  assert.equal(datasetService.getDataset(id), null);
  // 本地 excel 表应被清理
  const t = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'data_1'").get();
  assert.equal(t, undefined);
});

test('registerSqlDataset writes equivalent builder definition', () => {
  const dsId = insertDatasource('mysql-ds-reg');
  const d = datasetService.registerSqlDataset('Quick', dsId, 'testdb', 'sales', [
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

  const reg = datasetService.getFieldsOrThrow(d.id);
  assert.equal(reg.length, 2);
  assert.equal(reg[0].name, 'id');
  assert.equal(reg[0].label, 'ID');
});

test('getDataset returns build_definition and ordered fields', () => {
  const dsId = insertDatasource('mysql-ds-get');
  const def = { type: 'builder', tables: [{ alias: 't', schema: 'testdb', table: 'orders' }], joins: [], fields: [
    { source: 't', field: 'amount', label: '金额', type: 'number' },
    { source: 't', field: 'customer_id', label: '客户', type: 'number' },
  ], aggregation: null };
  const created = datasetService.saveBuiltDataset({ name: 'Order Amount', definition: def, datasourceId: dsId, datasetId: null, ownerId: 1 });

  const ds = datasetService.getDataset(created.id);
  assert.ok(ds.build_definition.includes('"type":"builder"'));
  assert.deepEqual(ds.fields.map((f) => f.name), ['f_0', 'f_1']);
  assert.deepEqual(ds.fields.map((f) => f.label), ['金额', '客户']);
});

test('getFieldsOrThrow throws when dataset_fields empty', () => {
  const dsId = insertDatasource('mysql-ds-empty');
  const def = { type: 'builder', tables: [{ alias: 't', schema: 'testdb', table: 'orders' }], joins: [], fields: [], aggregation: null };
  const created = datasetService.saveBuiltDataset({ name: 'Empty', definition: def, datasourceId: dsId, datasetId: null, ownerId: 1 });

  assert.throws(() => datasetService.getFieldsOrThrow(created.id), /数据集字段为空/);
});