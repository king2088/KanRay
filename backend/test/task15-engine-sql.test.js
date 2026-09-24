process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDb, adminId } = require('./helpers/db');
const { uuidv7 } = require('../src/utils/uuidv7');
const datasetService = require('../src/services/dataset.service');
const sqlDataProvider = require('../src/datasources/sql-data-provider');

before(async () => {
  await resetDb();
});

test('registerSqlDataset creates dataset with source_type=sql', async () => {
  // Insert a mock data_sources row
  const dsId = uuidv7();
  db.prepare("INSERT INTO data_sources (id, name, type, config, owner_id) VALUES (?, ?, ?, ?, ?)")
    .run(dsId, 'Test MySQL', 'mysql', '{"host":"127.0.0.1","port":13306}', adminId());

  const ds = await datasetService.registerSqlDataset(
    'Sales Table', dsId, 'testdb', 'sales',
    [{ name: 'id', label: 'ID', type: 'integer' }, { name: 'amount', label: 'Amount', type: 'number' }],
    adminId()
  );
  assert.equal(ds.source_type, 'sql');
  assert.equal(ds.datasource_id, dsId);
  assert.equal(ds.schema_name, 'testdb');
  assert.equal(ds.table_name_ext, 'sales');
  assert.equal(ds.fields.length, 2);
});

test('existing aggregate still works for excel datasets', async () => {
  // Create a regular Excel dataset
  const ds = await datasetService.createDataset('Test Excel', [
    { key: 'name', label: 'Name', type: 'string' },
    { key: 'val', label: 'Value', type: 'number' },
  ], [{ name: 'A', val: 10 }, { name: 'B', val: 20 }], adminId());

  const queryEngine = require('../src/engines/query-engine');
  const result = await queryEngine.aggregate({
    datasetId: ds.id,
    dimensions: [{ field: 'name' }],
    metrics: [{ field: 'val', agg: 'sum' }],
    filters: [],
  });
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0]['dim:name'].value, 'A');
});