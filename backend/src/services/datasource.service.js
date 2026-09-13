const db = require('../db');
const HttpError = require('../utils/http-error');
const { encrypt, decrypt } = require('../datasources/crypto');
const drivers = require('../datasources/drivers');
const providers = require('../datasources/providers');
const audit = require('./audit.service');

function getDriverMeta(type) {
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
    last_test_at: row.last_test_at,
    last_test_ok: row.last_test_ok == null ? null : !!row.last_test_ok,
    last_test_msg: row.last_test_msg,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function list(where = '') {
  const sql = `SELECT * FROM data_sources${where ? ' WHERE ' + where : ''} ORDER BY id DESC`;
  return db.prepare(sql).all().map(toPublic);
}

function get(id) {
  return toPublic(db.prepare('SELECT * FROM data_sources WHERE id = ?').get(id));
}

function create({ name, type, config }, ownerId, req) {
  const driverMeta = getDriverMeta(type);
  if (driverMeta.status === 'planned') throw new HttpError(400, `${driverMeta.name} 暂不支持接入`);
  const cfg = safeConfig(config || {}, driverMeta);
  const r = db.prepare(
    'INSERT INTO data_sources (name, type, config, owner_id) VALUES (?, ?, ?, ?)'
  ).run(String(name || '').trim().slice(0, 100), type, JSON.stringify(cfg), ownerId == null ? null : Number(ownerId));
  const id = Number(r.lastInsertRowid);
  audit.log({ userId: ownerId, email: req?.user?.email, action: 'datasource.create', resourceType: 'datasource', resourceId: id, detail: { name: String(name || '').trim(), type } }, req);
  return get(id);
}

function update(id, body, req) {
  const row = db.prepare('SELECT * FROM data_sources WHERE id = ?').get(id);
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
  db.prepare("UPDATE data_sources SET name = ?, type = ?, config = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?")
    .run(nextName, nextType, JSON.stringify(cfg), nextActive, id);
  audit.log({ userId: row.owner_id ?? null, email: req?.user?.email, action: 'datasource.update', resourceType: 'datasource', resourceId: id, detail: { name: nextName, type: nextType } }, req);
  return get(id);
}

function remove(id, req) {
  const row = db.prepare('SELECT * FROM data_sources WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, '数据源不存在');
  const used = db.prepare('SELECT COUNT(*) n FROM datasets WHERE datasource_id = ?').get(id).n;
  if (used > 0) throw new HttpError(400, `该数据源已被 ${used} 个数据集引用，请先删除关联数据集`);
  db.prepare('DELETE FROM data_sources WHERE id = ?').run(id);
  audit.log({ userId: row.owner_id ?? null, email: req?.user?.email, action: 'datasource.delete', resourceType: 'datasource', resourceId: id, detail: { name: row.name } }, req);
  return true;
}

async function testConfig({ type, config }) {
  const driverMeta = getDriverMeta(type);
  if (driverMeta.status === 'planned') throw new HttpError(400, `${driverMeta.name} 暂不支持接入`);
  const provider = providers.getProvider(driverMeta.family);
  if (!provider || typeof provider.testConnection !== 'function') throw new HttpError(500, `该数据源不支持测试连接`);
  return provider.testConnection(decryptConfig(config || {}), type);
}

async function testSaved(id, req) {
  const row = db.prepare('SELECT * FROM data_sources WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, '数据源不存在');
  const driverMeta = getDriverMeta(row.type);
  const provider = providers.getProvider(driverMeta.family);
  let ok = false; let msg = '';
  try {
    const result = await provider.testConnection(decryptConfig(parseConfig(row)), row.type);
    ok = result.ok;
    msg = result.message || '';
  } catch (e) {
    msg = e.message;
  }
  db.prepare("UPDATE data_sources SET last_test_at = datetime('now'), last_test_ok = ?, last_test_msg = ? WHERE id = ?")
    .run(ok ? 1 : 0, msg, id);
  audit.log({ userId: row.owner_id ?? null, email: req?.user?.email, action: 'datasource.test', resourceType: 'datasource', resourceId: id, detail: { ok, msg } }, req);
  return { ok, message: msg };
}

async function listSchemas(id, req) {
  const row = db.prepare('SELECT * FROM data_sources WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, '数据源不存在');
  const driverMeta = getDriverMeta(row.type);
  if (!driverMeta.capabilities.browse) throw new HttpError(400, `${driverMeta.name} 不支持 Schema 浏览`);
  const provider = providers.getProvider(driverMeta.family);
  return provider.listSchemas(decryptConfig(parseConfig(row)), row.type);
}

async function listTables(id, schema, req) {
  const row = db.prepare('SELECT * FROM data_sources WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, '数据源不存在');
  const driverMeta = getDriverMeta(row.type);
  if (!driverMeta.capabilities.browse) throw new HttpError(400, `${driverMeta.name} 不支持 Schema 浏览`);
  const provider = providers.getProvider(driverMeta.family);
  return provider.listTables(decryptConfig(parseConfig(row)), row.type, schema);
}

async function listColumns(id, schema, table, req) {
  const row = db.prepare('SELECT * FROM data_sources WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, '数据源不存在');
  const driverMeta = getDriverMeta(row.type);
  if (!driverMeta.capabilities.browse) throw new HttpError(400, `${driverMeta.name} 不支持 Schema 浏览`);
  const provider = providers.getProvider(driverMeta.family);
  return provider.listColumns(decryptConfig(parseConfig(row)), row.type, schema, table);
}

module.exports = {
  getDriverMeta, list, get, create, update, remove,
  testConfig, testSaved, listSchemas, listTables, listColumns,
};