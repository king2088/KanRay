const db = require('../db');
const HttpError = require('../utils/http-error');
const { encrypt, decrypt } = require('../datasources/crypto');
const drivers = require('../datasources/drivers');
const providers = require('../datasources/providers');
const audit = require('./audit.service');

// 文件型数据源（Excel/CSV 上传）不属于 drivers 列表，单独定义驱动元数据
const FILE_META = {
  type: 'excel',
  name: 'Excel/CSV',
  category: '文件',
  family: 'file',
  status: 'tested',
  capabilities: { test: true, browse: false, dataset: false },
  defaultPort: null,
  fields: [],
};

function isFileType(type) {
  return type === 'excel';
}

function getDriverMeta(type) {
  if (isFileType(type)) return FILE_META;
  const d = drivers.find((x) => x.type === type);
  if (!d) throw new HttpError(400, `不支持的数据源类型: ${type}`);
  return d;
}

function passwordFields(driverMeta) {
  return (driverMeta.fields || []).filter((f) => f.type === 'password');
}

/** 把明文密码加密为密文后存入库 */
function safeConfig(config, driverMeta) {
  const cfg = { ...config };
  for (const f of passwordFields(driverMeta)) {
    if (cfg[f.name]) cfg[f.name] = encrypt(cfg[f.name]);
  }
  return cfg;
}

/** 出参脱敏：密码统一替换为掩码 */
function maskedConfig(config, driverMeta) {
  const cfg = { ...config };
  for (const f of passwordFields(driverMeta)) {
    if (cfg[f.name]) cfg[f.name] = '********';
  }
  for (const f of passwordFields(driverMeta)) {
    if (cfg[`${f.name}_masked`] === undefined) cfg[`${f.name}_masked`] = true;
  }
  return cfg;
}

/** 运行时解密：识别 iv:tag:ct 三段 base64，尝试解密，失败则原样保留 */
function decryptConfig(config) {
  const cfg = { ...config };
  for (const [k, v] of Object.entries(cfg)) {
    if (typeof v === 'string' && v.split(':').length === 3) {
      try { cfg[k] = decrypt(v); } catch (e) { /* 非密文保留 */ }
    }
  }
  return cfg;
}

function parseConfig(row) {
  if (!row || !row.config) return {};
  try { return JSON.parse(row.config); } catch (e) { return {}; }
}

function toPublic(row) {
  if (!row) return null;
  const driverMeta = getDriverMeta(row.type);
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    config: maskedConfig(parseConfig(row), driverMeta),
    is_active: !!row.is_active,
    owner_id: row.owner_id,
    mode: row.mode || 'direct',
    last_test_at: row.last_test_at,
    last_test_ok: row.last_test_ok == null ? null : !!row.last_test_ok,
    last_test_msg: row.last_test_msg,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function list(where = '') {
  const sql = `SELECT * FROM data_sources${where ? ' WHERE ' + where : ''} ORDER BY id DESC`;
  return (await db.prepare(sql).all()).map(toPublic);
}

async function get(id) {
  return toPublic(await db.prepare('SELECT * FROM data_sources WHERE id = ?').get(id));
}

async function create({ name, type, config, mode }, ownerId, req) {
  const driverMeta = getDriverMeta(type);
  if (driverMeta.status === 'planned') throw new HttpError(400, `${driverMeta.name} 暂不支持接入`);
  const cfg = safeConfig(config || {}, driverMeta);
  const m = mode === 'sync' ? 'sync' : 'direct';
  if (m === 'sync' && driverMeta.family === 'file') throw new HttpError(400, '文件型数据源不支持同步模式');
  const r = await db.prepare(
    'INSERT INTO data_sources (name, type, config, owner_id, mode) VALUES (?, ?, ?, ?, ?)'
  ).run(String(name || '').trim().slice(0, 100), type, JSON.stringify(cfg), ownerId == null ? null : Number(ownerId), m);
  const id = Number(r.lastInsertRowid);
  await audit.log({ userId: ownerId, email: req?.user?.email, action: 'datasource.create', resourceType: 'datasource', resourceId: id, detail: { name: String(name || '').trim(), type, mode: m } }, req);
  return get(id);
}

/**
 * 文件型数据源：Excel/CSV 上传后在 data_sources 登记一行（type='excel'），config 仅存文件元数据
 */
async function createExcelDatasource({ name, file, rowCount, columnCount }, ownerId, req) {
  const cfg = {
    file: String(file || '').trim().slice(0, 300),
    rowCount: rowCount || 0,
    columnCount: columnCount || 0,
  };
  const len = String(name || (file ? String(file).replace(/\.(xlsx|xls|csv)$/i, '') : '') || '未命名文件').trim().slice(0, 100);
  const r = await db.prepare('INSERT INTO data_sources (name, type, config, owner_id) VALUES (?, ?, ?, ?)')
    .run(len, 'excel', JSON.stringify(cfg), ownerId == null ? null : Number(ownerId));
  const id = Number(r.lastInsertRowid);
  await audit.log({ userId: ownerId, email: req?.user?.email, action: 'datasource.create', resourceType: 'datasource', resourceId: id, detail: { name: len, type: 'excel' } }, req);
  return get(id);
}

async function update(id, body, req) {
  const row = await db.prepare('SELECT * FROM data_sources WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, '数据源不存在');
  if (body.type && body.type !== row.type) throw new HttpError(400, '暂不支持直接修改数据源类型，请删除后重建');
  const driverMeta = getDriverMeta(body.type || row.type);
  const curConfig = parseConfig(row);
  let cfg = curConfig;
  if (body.config !== undefined) {
    cfg = { ...curConfig };
    for (const [k, v] of Object.entries(body.config)) cfg[k] = v;
    // 仅加密客户端显式提供的新明文密码；'********' 或缺省/空值均保留原密文
    for (const f of passwordFields(driverMeta)) {
      const incoming = body.config[f.name];
      if (!incoming || incoming === '********') {
        cfg[f.name] = curConfig[f.name];
      } else {
        cfg[f.name] = encrypt(incoming);
      }
    }
  }
  const nextName = body.name !== undefined ? String(body.name).trim().slice(0, 100) : row.name;
  const nextType = body.type || row.type;
  const nextActive = body.is_active !== undefined ? (body.is_active ? 1 : 0) : row.is_active;
  const m = body.mode === 'sync' ? 'sync' : body.mode === 'direct' ? 'direct' : row.mode || 'direct';
  if (m === 'sync' && driverMeta.family === 'file') throw new HttpError(400, '文件型数据源不支持同步模式');
  await db.prepare("UPDATE data_sources SET name = ?, type = ?, config = ?, is_active = ?, mode = ?, updated_at = datetime('now') WHERE id = ?")
    .run(nextName, nextType, JSON.stringify(cfg), nextActive, m, id);
  await audit.log({ userId: row.owner_id ?? null, email: req?.user?.email, action: 'datasource.update', resourceType: 'datasource', resourceId: id, detail: { name: nextName, type: nextType, mode: m } }, req);
  return get(id);
}

async function remove(id, req) {
  const row = await db.prepare('SELECT * FROM data_sources WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, '数据源不存在');
  const used = await db.prepare('SELECT COUNT(*) n FROM datasets WHERE datasource_id = ?').get(id).n;
  if (used > 0) throw new HttpError(400, `该数据源已被 ${used} 个数据集引用，请先删除关联数据集`);
  await db.prepare('DELETE FROM data_sources WHERE id = ?').run(id);
  await audit.log({ userId: row.owner_id ?? null, email: req?.user?.email, action: 'datasource.delete', resourceType: 'datasource', resourceId: id, detail: { name: row.name } }, req);
  return true;
}

async function testConfig({ type, config }) {
  const driverMeta = getDriverMeta(type);
  if (driverMeta.status === 'planned') throw new HttpError(400, `${driverMeta.name} 暂不支持接入`);
  if (driverMeta.family === 'file') return { ok: true, message: '文件数据源已导入' };
  const provider = providers.getProvider(driverMeta.family);
  if (!provider || typeof provider.testConnection !== 'function') throw new HttpError(500, `该数据源不支持测试连接`);
  return provider.testConnection(decryptConfig(config || {}), type);
}

async function testSaved(id, req) {
  const row = await db.prepare('SELECT * FROM data_sources WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, '数据源不存在');
  const driverMeta = getDriverMeta(row.type);
  if (driverMeta.family === 'file') {
    await db.prepare("UPDATE data_sources SET last_test_at = datetime('now'), last_test_ok = 1, last_test_msg = '文件数据源已导入' WHERE id = ?").run(id);
    await audit.log({ userId: row.owner_id ?? null, email: req?.user?.email, action: 'datasource.test', resourceType: 'datasource', resourceId: id, detail: { ok: true, msg: '文件数据源已导入' } }, req);
    return { ok: true, message: '文件数据源已导入' };
  }
  const provider = providers.getProvider(driverMeta.family);
  let ok = false; let msg = '';
  try {
    const result = await provider.testConnection(decryptConfig(parseConfig(row)), row.type);
    ok = result.ok;
    msg = result.message || '';
  } catch (e) {
    msg = e.message;
  }
  await db.prepare("UPDATE data_sources SET last_test_at = datetime('now'), last_test_ok = ?, last_test_msg = ? WHERE id = ?")
    .run(ok ? 1 : 0, msg, id);
  await audit.log({ userId: row.owner_id ?? null, email: req?.user?.email, action: 'datasource.test', resourceType: 'datasource', resourceId: id, detail: { ok, msg } }, req);
  return { ok, message: msg };
}

// 同步型数据源：浏览降级到本地落库表（schema 固定为 'local'）
function isSyncDs(row) {
  return row.mode === 'sync';
}

function localTablesOf(id) {
  const prefix = `sync_${id}_`;
  return db.listTables()
    .map((t) => String(t))
    .filter((name) => name.toLowerCase().startsWith(prefix.toLowerCase()));
}

function localColumnsOf(table) {
  return db.listColumns(table).map((c) => {
    const type = String(c.type || 'text').toLowerCase();
    return { name: c.name, type, role: /int|float|double|decimal|numeric|bigint|smallint|tinyint|number|real/.test(type) ? 'metric' : 'dimension' };
  });
}

async function listSchemas(id, req, opts = {}) {
  const row = await db.prepare('SELECT * FROM data_sources WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, '数据源不存在');
  if (!opts.source && isSyncDs(row)) return [{ name: 'local' }];
  const driverMeta = getDriverMeta(row.type);
  if (!driverMeta.capabilities.browse) throw new HttpError(400, `${driverMeta.name} 不支持 Schema 浏览`);
  const provider = providers.getProvider(driverMeta.family);
  return provider.listSchemas(decryptConfig(parseConfig(row)), row.type);
}

async function listTables(id, schema, req, opts = {}) {
  const row = await db.prepare('SELECT * FROM data_sources WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, '数据源不存在');
  if (!opts.source && isSyncDs(row)) return localTablesOf(id);
  const driverMeta = getDriverMeta(row.type);
  if (!driverMeta.capabilities.browse) throw new HttpError(400, `${driverMeta.name} 不支持 Schema 浏览`);
  const provider = providers.getProvider(driverMeta.family);
  return provider.listTables(decryptConfig(parseConfig(row)), row.type, schema);
}

async function listColumns(id, schema, table, req, opts = {}) {
  const row = await db.prepare('SELECT * FROM data_sources WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, '数据源不存在');
  if (!opts.source && isSyncDs(row)) return localColumnsOf(table);
  const driverMeta = getDriverMeta(row.type);
  if (!driverMeta.capabilities.browse) throw new HttpError(400, `${driverMeta.name} 不支持 Schema 浏览`);
  const provider = providers.getProvider(driverMeta.family);
  return provider.listColumns(decryptConfig(parseConfig(row)), row.type, schema, table);
}

module.exports = {
  getDriverMeta, decryptConfig, list, get, create, createExcelDatasource, update, remove,
  testConfig, testSaved, listSchemas, listTables, listColumns,
};