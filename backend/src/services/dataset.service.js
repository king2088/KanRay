const db = require('../db');
const schema = require('../db/schema');
const config = require('../config');
const HttpError = require('../utils/http-error');
const { parseExcelFile } = require('../services/excel.service');

/** 把值转换为可安全入库的 SQLite 值 */
function convertValue(value, type) {
  if (value === null || value === undefined || value === '') return null;
  if (type === 'date') {
    if (value instanceof Date) {
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, '0');
      const d = String(value.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const s = String(value).trim();
    // 保留 YYYY-MM-DD 或 YYYY/MM/DD
    return s.slice(0, 10);
  }
  if (type === 'integer') {
    const n = Number(value);
    return Number.isNaN(n) ? null : Math.trunc(n);
  }
  if (type === 'number') {
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }
  if (type === 'boolean') {
    if (value === true || value === 1 || value === '1' || value === 'true' || value === 'TRUE') return 1;
    if (value === false || value === 0 || value === '0' || value === 'false' || value === 'FALSE') return 0;
    return null;
  }
  return String(value);
}

/** 生成唯一的数据表名 */
function nextTableName() {
  return `ds_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

async function listDatasets(where = '') {
  const sql = `SELECT * FROM datasets${where ? ' WHERE ' + where : ''} ORDER BY created_at DESC, id DESC`;
  return (await db.prepare(sql)).all();
}

async function getDataset(id) {
  const ds = (await db.prepare('SELECT * FROM datasets WHERE id = ?')).get(id);
  if (!ds) return null;
  ds.fields = (await db.prepare('SELECT id, name, label, type, position FROM dataset_fields WHERE dataset_id = ? ORDER BY position')).all(id);
  return ds;
}

async function getDatasetOrThrow(id) {
  const ds = await getDataset(id);
  if (!ds) throw new HttpError(404, `数据集不存在: id=${id}`);
  return ds;
}

async function getFieldsOrThrow(datasetId) {
  const fields = await db.prepare('SELECT name, label, type FROM dataset_fields WHERE dataset_id = ? ORDER BY position').all(datasetId);
  if (fields.length === 0) throw new HttpError(400, '数据集字段为空');
  return fields;
}

/**
 * 创建数据集：调用方传入已解析好的 { name, header, rows }
 */
async function createDataset(name, header, rows, ownerId = null) {
  const tableName = nextTableName();
  const fields = header.map((h, i) => ({ name: h.key, key: h.key, label: h.label, type: h.type, position: i }));
  const quotedTable = db.dialect.quoteIdent(tableName);

  // 建表（走 store 方言类型映射）
  await db.ensureDatasetTable(tableName, fields);

  // 批量写入
  const placeholders = fields.map((_, i) => db.dialect.placeholder(i + 1)).join(', ');
  const insert = await db.prepare(`INSERT INTO ${quotedTable} VALUES (${placeholders})`);
  await db.transaction(async (batch) => {
    for (const row of batch) {
      const values = fields.map((f, i) => convertValue(row[f.key], f.type));
      await insert.run(...values);
    }
  })(rows);

  // 记录数据集
  const info = await db
    .prepare('INSERT INTO datasets (name, original_file, row_count, column_count, table_name, owner_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, name, rows.length, fields.length, tableName, ownerId == null ? null : Number(ownerId));
  const datasetId = info.lastInsertRowid;

  // 字段元数据
  const insField = await db.prepare(
    'INSERT INTO dataset_fields (dataset_id, name, label, type, position) VALUES (?, ?, ?, ?, ?)'
  );
  await db.transaction(async (fs) => {
    for (const f of fs) await insField.run(datasetId, f.key, f.label, f.type, f.position);
  })(fields);

  return getDataset(datasetId);
}

/**
 * 上传 Excel 并创建数据集；若已有同名文件且仅预览（不落库）走 preview 流程
 */
async function previewExcel(filePath) {
  const { header, rows } = await parseExcelFile(filePath);
  return {
    header,
    previewRows: rows.slice(0, config.upload.previewRows),
    rowCount: rows.length,
  };
}

/**
 * 全量导入（用于真正创建数据集），返回预览信息 + 可随后调用 create
 */
async function parseAndCreate(name, filePath, ownerId = null) {
  const { header, rows } = await parseExcelFile(filePath);
  const ds = await createDataset(name, header, rows, ownerId);
  ds.previewRows = rows.slice(0, config.upload.previewRows);
  return ds;
}

/**
 * 删除本地数据表；mssql/oracle 无 DROP TABLE IF EXISTS，先判存在再删
 */
async function dropLocalTable(tableName) {
  const q = db.dialect.quoteIdent(tableName);
  if (schema.IF_NOT_EXISTS.has(db.type)) {
    await db.exec(`DROP TABLE IF EXISTS ${q}`);
    return;
  }
  const hit = (await db.listTables()).some((n) => String(n).toUpperCase() === String(tableName).toUpperCase());
  if (hit) await db.exec(`DROP TABLE ${q}`);
}

async function deleteDataset(id) {
  const ds = await getDatasetOrThrow(id);
  if (ds.source_type !== 'sql') {
    await dropLocalTable(ds.table_name);
  }
  await db.prepare('DELETE FROM datasets WHERE id = ?').run(id);
  return true;
}

async function renameDataset(id, name) {
  await getDatasetOrThrow(id);
  if (!name || !String(name).trim()) throw new HttpError(400, '数据集名称不能为空');
  await db.prepare('UPDATE datasets SET name = ? WHERE id = ?').run(String(name).trim(), id);
  return getDataset(id);
}

async function updateFieldLabel(datasetId, fieldId, label) {
  await getDatasetOrThrow(datasetId);
  if (!label || !String(label).trim()) throw new HttpError(400, '字段别名不能为空');
  const field = await db
    .prepare('SELECT id, dataset_id FROM dataset_fields WHERE id = ? AND dataset_id = ?')
    .get(fieldId, datasetId);
  if (!field) throw new HttpError(404, '字段不存在');
  await db.prepare('UPDATE dataset_fields SET label = ? WHERE id = ?').run(String(label).trim().slice(0, 100), fieldId);
  return (await db.prepare('SELECT id, dataset_id AS datasetId, name, label, type, position FROM dataset_fields WHERE id = ?').get(fieldId));
}

async function paginateRows(id, page, pageSize) {
  const ds = await getDatasetOrThrow(id);
  const fields = await getFieldsOrThrow(id);

  // SQL 数据集：行数据在外部数据库，走 SqlDataProvider 读取
  if (ds.source_type === 'sql') {
    const provider = require('../datasources/sql-data-provider');
    const { rows, total } = await provider.paginate(ds, page, pageSize);
    return {
      total,
      page: Math.max(1, Number(page) || 1),
      pageSize,
      fields: fields.map((f) => ({ name: f.name, label: f.label, type: f.type })),
      rows,
    };
  }

  const table = db.dialect.quoteIdent(ds.table_name);
  const total = (await db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get()).c;
  const offset = (Math.max(1, Number(page) || 1) - 1) * pageSize;
  const rows = await db.prepare(db.dialect.paginate(`SELECT * FROM ${table}`, pageSize, offset)).all();
  return {
    total,
    page: Math.max(1, Number(page) || 1),
    pageSize,
    fields: fields.map((f) => ({ name: f.name, label: f.label, type: f.type })),
    rows,
  };
}

/**
 * 注册外部数据库表为 SQL 数据集（不落库数据，仅登记元数据）
 */
/**
 * 构建定义 fields → 注册字段清单
 * builder 定义的 fields 是来源引用 {source, field, label?, type?}，编译输出恒为 f_<i>（compileDetail 忽略 name），故注册名必须取 f_<i>；
 * sql/etl 的定义由编译端给出 {name, label, type}，直接透传（真实入库名与查询期输出列一致）。
 */
function deriveRegistryFields(definition) {
  const src = Array.isArray(definition.fields) ? definition.fields : [];
  if (definition.type === 'etl') {
    return src.map((f, i) => ({
      name: f.name != null ? f.name : (f.field != null ? f.field : `f_${i}`),
      label: f.label || f.field || f.name || '',
      type: f.type || 'string',
    }));
  }
  if (definition.type === 'sql') {
    return src.map((f, i) => ({
      name: f.name != null ? f.name : `f_${i}`,
      label: f.label || f.name || f.field || '',
      type: f.type || 'string',
    }));
  }
  return src.map((f, i) => ({
    name: `f_${i}`,
    label: f.label || f.field || '',
    type: f.type || 'string',
  }));
}

/**
 * 按定义顺序重建数据集字段元数据
 */
async function insertDatasetFields(datasetId, fields) {
  const insField = await db.prepare(
    'INSERT INTO dataset_fields (dataset_id, name, label, type, position) VALUES (?, ?, ?, ?, ?)'
  );
  await db.transaction(async (fs) => {
    for (const [i, f] of fs.entries()) {
      await insField.run(datasetId, f.name, f.label || f.name, f.type || 'string', i);
    }
  })(Array.isArray(fields) ? fields : []);
}

async function registerSqlDataset(name, datasourceId, schemaName, tableName, fields, ownerId) {
  const safeName = String(name || tableName).trim().slice(0, 100);
  const def = {
    type: 'builder',
    tables: [{ alias: 't0', schema: schemaName || null, table: tableName }],
    joins: [],
    fields: fields.map((f) => ({ source: 't0', field: f.name, label: f.label || f.name, type: f.type || 'string' })),
    aggregation: null,
  };
  const ins = await db.prepare(
    `INSERT INTO datasets (name, original_file, row_count, column_count, table_name, source_type, datasource_id, schema_name, table_name_ext, build_definition, owner_id)
     VALUES (?, ?, 0, ?, ?, 'sql', ?, ?, ?, ?, ?)`
  );
  const defJson = JSON.stringify(def);
  const info = await ins.run(safeName, safeName, fields.length, tableName, datasourceId, schemaName, tableName, defJson, ownerId == null ? null : Number(ownerId));
  const datasetId = Number(info.lastInsertRowid);

  await insertDatasetFields(datasetId, fields);

  return getDataset(datasetId);
}

/**
 * 保存构建形态定义（sql/builder/etl）：新建或更新已有的 SQL 数据集，并重建字段元数据
 */
async function saveBuiltDataset({ name, definition, datasourceId, datasetId, ownerId, admin = false }) {
  if (!definition || !definition.type) throw new HttpError(400, '构建定义不合法');
  if (!['sql', 'builder', 'etl'].includes(definition.type)) throw new HttpError(400, `不支持的构建形态: ${definition.type}`);
  if (datasetId) {
    // 更新：校验存在 + datasource 一致 + owner 一致（admin 可跨用户编辑，与 access.assertResource 语义一致）
    const exist = await getDataset(datasetId);
    if (!exist) throw new HttpError(404, `数据集不存在: id=${datasetId}`);
    if (exist.source_type !== 'sql') throw new HttpError(400, '仅 SQL 数据集可编辑');
    if (exist.datasource_id !== datasourceId) throw new HttpError(400, '数据集不属于该数据源');
    if (!admin && ownerId && Number(exist.owner_id) !== Number(ownerId)) throw new HttpError(403, '无权限修改该数据集');
    const defJson = JSON.stringify(definition);
    if (defJson.length > 1_000_000) throw new HttpError(400, '构建定义过大');
    const safeName = String(name || exist.name || '未命名数据集').trim().slice(0, 100);
    const firstTable = (definition.tables && definition.tables[0]) || null;
    const upd = await db.prepare(
      `UPDATE datasets SET name = ?, build_definition = ?, column_count = ?, table_name = ?, schema_name = ?, table_name_ext = ? WHERE id = ?`
    );
    const delFields = await db.prepare('DELETE FROM dataset_fields WHERE dataset_id = ?');
    await db.transaction(async () => {
      await upd.run(
        safeName, defJson,
        (definition.fields || []).length,
        (firstTable ? firstTable.table : exist.table_name),
        (firstTable ? firstTable.schema : null),
        (firstTable ? firstTable.table : exist.table_name),
        datasetId
      );
      await delFields.run(datasetId);
      await insertDatasetFields(datasetId, deriveRegistryFields(definition));
    })();
    return getDataset(datasetId);
  }
  // 新建
  const safeName = String(name || '未命名数据集').trim().slice(0, 100);
  const defJson = JSON.stringify(definition);
  if (defJson.length > 1_000_000) throw new HttpError(400, '构建定义过大');
  const firstTable = (definition.tables && definition.tables[0]) || null;
  const ins = await db.prepare(
    `INSERT INTO datasets (name, original_file, row_count, column_count, table_name, source_type, datasource_id, schema_name, table_name_ext, build_definition, owner_id)
     VALUES (?, ?, 0, ?, ?, 'sql', ?, ?, ?, ?, ?)`
  );
  const datasetId2 = await db.transaction(async () => {
    const info = await ins.run(
      safeName, safeName,
      (definition.fields || []).length,
      (firstTable ? firstTable.table : safeName),
      datasourceId,
      (firstTable ? firstTable.schema : null),
      (firstTable ? firstTable.table : null),
      defJson,
      ownerId == null ? null : Number(ownerId)
    );
    const id = Number(info.lastInsertRowid);
    await insertDatasetFields(id, deriveRegistryFields(definition));
    return id;
  })();
  return getDataset(datasetId2);
}

module.exports = {
  listDatasets,
  getDataset,
  getDatasetOrThrow,
  getFieldsOrThrow,
  createDataset,
  previewExcel,
  parseAndCreate,
  deleteDataset,
  renameDataset,
  updateFieldLabel,
  paginateRows,
  registerSqlDataset,
  saveBuiltDataset,
};