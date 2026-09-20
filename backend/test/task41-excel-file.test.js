// backend/test/task41-excel-file.test.js
// 文件型数据源（Excel/CSV）全能力：多 sheet / .xls / 浏览 / 本地表关联 / 安全边界
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
process.env.DB_PATH = `/tmp/kanban-file-${process.pid}.db`;
process.env.DATA_DIR = `/tmp/kanban-file-data-${process.pid}`;
const { test } = require('node:test');
const assert = require('node:assert');
const XLSX = require('xlsx');
const db = require('../src/db');
const excel = require('../src/services/excel.service');
const fileProviderFactory = require('../src/datasources/providers/file');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kanban-xlsx-'));

test.before(() => {
  db.initSchema();
});

test.after(() => {
  try { db.close(); } catch (e) { /* ignore */ }
  fs.rmSync(process.env.DB_PATH, { force: true });
  fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
  fs.rmSync(tmp, { recursive: true, force: true });
});

function makeWorkbook() {
  const wb = XLSX.utils.book_new();
  const s1 = XLSX.utils.aoa_to_sheet([
    ['name', 'amount', 'onboard'],
    ['甲', 12, true],
    ['乙', 3.5, false],
  ]);
  const s2 = XLSX.utils.aoa_to_sheet([
    ['region', 'sales'],
    ['east', 100],
    ['west', 200],
  ]);
  XLSX.utils.book_append_sheet(wb, s1, 'Sheet1');
  XLSX.utils.book_append_sheet(wb, s2, 'Sheet2');
  return wb;
}

test('excel: 多 sheet 选择（序号与名称）', async () => {
  const xlsxFile = path.join(tmp, 'multi.xlsx');
  XLSX.writeFile(makeWorkbook(), xlsxFile, { cellDates: true });
  const byName = await excel.parseExcelFile(xlsxFile, { sheet: 'Sheet2' });
  assert.deepEqual(byName.header.map((h) => h.key), ['region', 'sales']);
  assert.equal(byName.rows.length, 2);
  const byIndex = await excel.parseExcelFile(xlsxFile, { sheet: 1 });
  assert.deepEqual(byIndex.rows, byName.rows);
  const first = await excel.parseExcelFile(xlsxFile, {});
  assert.deepEqual(first.header.map((h) => h.key), ['name', 'amount', 'onboard']);
});

test('excel: .xls 旧版二进制可解析', async () => {
  const xlsFile = path.join(tmp, 'legacy.xls');
  XLSX.writeFile(makeWorkbook(), xlsFile, { bookType: 'xls' });
  const res = await excel.parseExcelFile(xlsFile, { sheet: 'Sheet2' });
  assert.deepEqual(res.header.map((h) => h.key), ['region', 'sales']);
  assert.deepEqual(res.rows, [{ region: 'east', sales: 100 }, { region: 'west', sales: 200 }]);
});

test('excel: 未知工作表给出可读错误', async () => {
  const xlsxFile = path.join(tmp, 'multi2.xlsx');
  XLSX.writeFile(makeWorkbook(), xlsxFile, { cellDates: true });
  await assert.rejects(() => excel.parseExcelFile(xlsxFile, { sheet: 'Nope' }), /工作表不存在/);
});

test('file provider: 关联本地表浏览 + 查询安全边界', async () => {
  await db.ensureDatasetTable('ds_excel_test', [
    { name: 'region', type: 'string' },
    { name: 'sales', type: 'number' },
  ]);
  db.prepare('INSERT INTO "ds_excel_test" (region, sales) VALUES (?, ?)').run('east', 100);
  db.prepare('INSERT INTO "ds_excel_test" (region, sales) VALUES (?, ?)').run('west', 200);

  const p = fileProviderFactory.createProvider();
  const cfg = {
    file: 'x.xlsx',
    tableName: 'ds_excel_test',
    columns: [
      { name: 'region', type: 'string' },
      { name: 'sales', type: 'number' },
    ],
  };
  assert.deepEqual(await p.listSchemas(cfg), [{ name: 'local' }]);
  assert.deepEqual(await p.listTables(cfg), [{ name: 'ds_excel_test', type: 'table' }]);
  const cols = await p.listColumns(cfg, 'excel', 'local', 'ds_excel_test');
  assert.deepEqual(cols.map((c) => c.name), ['region', 'sales']);
  assert.equal(cols.find((c) => c.name === 'sales').role, 'metric');

  const rows = await p.runQuery(cfg, 'SELECT * FROM "ds_excel_test" LIMIT 1', []);
  assert.deepEqual(rows, [{ region: 'east', sales: 100 }]);

  const rows2 = await p.runQuery(cfg, 'SELECT * FROM "ds_excel_test" WHERE "sales" > ? ORDER BY "sales" ASC LIMIT 5', [150]);
  assert.deepEqual(rows2, [{ region: 'west', sales: 200 }]);

  await assert.rejects(() => p.runQuery(cfg, 'SELECT * FROM "users" LIMIT 1', []), /仅允许访问数据集本地表/);
  assert.deepEqual(await p.listTables({ file: 'y.csv' }), [], '旧行无 tableName → 空清单');
});

test('file provider: 文件数据源经 datasource.service 全链路浏览', async () => {
  const dsApi = require('../src/services/datasource.service');
  const created = await dsApi.createExcelDatasource(
    { name: 'excel-ds', file: 'multi.xlsx', rowCount: 2, columnCount: 2, tableName: 'ds_excel_test', columns: [{ name: 'region', type: 'string' }, { name: 'sales', type: 'number' }] },
    7, {}
  );
  assert.equal(created.type, 'excel');
  assert.equal(created.config.tableName, 'ds_excel_test');

  assert.deepEqual(await dsApi.listSchemas(created.id, {}), [{ name: 'local' }]);
  const tables = await dsApi.listTables(created.id, 'local');
  assert.deepEqual(tables.map((t) => t.name), ['ds_excel_test']);
  const cols = await dsApi.listColumns(created.id, 'local', 'ds_excel_test');
  assert.deepEqual(cols.map((c) => c.name), ['region', 'sales']);

  const page = await dsApi.paginateRows(created.id, 'local', 'ds_excel_test', {}, 1, 10);
  assert.equal(page.rows.length, 2);
  assert.equal(page.hasMore, false);
  assert.deepEqual(page.fields, ['region', 'sales']);
});

test('drivers: 文件型数据源 browse 能力已开放（FILE_META）', () => {
  const dsApi = require('../src/services/datasource.service');
  const meta = dsApi.getDriverMeta('excel');
  assert.deepEqual(meta.capabilities, { test: true, browse: true, dataset: true });
  assert.ok(require('../src/datasources/providers').getProvider('file'));
});