// src/services/sync.service.js
// 同步执行引擎（Phase 3 同步模式）：
//  - createConfig/updateConfig/deleteConfig/listConfigs/configsOf/logsOf 配置与日志 CRUD
//  - runSync：增量（水印）与全量（drop+insert）策略；批大小 5000；行数守门 upload.maxRows
//  - 落库列名即源列名（白名单来自 provider.listColumns），本地表用 db.dialect.quoteIdent 引用
const db = require('../db');
const HttpError = require('../utils/http-error');
const providersApi = require('../datasources/providers');
const { decryptConfig } = require('./datasource.service');
const { buildUpsert, guessType } = require('../datasources/build-sql');
const config = require('../config');

const BATCH_SIZE = 5000;

function driversMeta(type) {
  const meta = require('../datasources/drivers').find((x) => x.type === type);
  if (!meta) throw new HttpError(400, `未知数据源类型: ${type}`);
  return meta;
}

function nextLocalTable(dsId, table) {
  const safe = String(table).replace(/[^A-Za-z0-9_]/g, '_');
  return `sync_${dsId}_${safe}`;
}

function parsePk(raw) {
  if (!raw) return [];
  const s = String(raw).trim();
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [String(v)];
  } catch (e) {
    return s.split(',').map((x) => x.trim()).filter(Boolean);
  }
}

// 源端回读的水印值归一化：驱动（如 mysql2）可能把 DATETIME 转成 JS Date，
// 统一成源端字面量可回传字符串 'YYYY-MM-DD HH:MM:SS'（本地时区），数值原样保留。
function normWm(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const p = (n) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())} ${p(v.getHours())}:${p(v.getMinutes())}:${p(v.getSeconds())}`;
  }
  return v;
}

// 主键元组归一化为可比较键：数值/字符串统一转字符串，避免驱动类型（number vs bigint 字符串等）不一致误判
function pkKey(vals) {
  return JSON.stringify(vals.map((v) => (v == null ? '' : String(v))));
}

function deleteSql(localTable, pks) {
  const q = db.dialect.quoteIdent;
  const where = pks.map((c, i) => `${q(c)} = ${db.dialect.placeholder(i + 1)}`).join(' AND ');
  return `DELETE FROM ${q(localTable)} WHERE ${where}`;
}

// 主键对账删除：增量同步后把「本地有、源端无」的主键从本地表删掉。
// 源端唯一能发现硬删除的途径是比对主键全集；源/本各扫一遍，差异分批 DELETE。
async function reconcileDeletes(provider, cfg, sc, pks, localTable) {
  const qname = (n) => String(n);
  const from = sc.source_schema ? `${qname(sc.source_schema)}.${qname(sc.source_table)}` : qname(sc.source_table);
  const keyCols = pks.map(qname).join(', ');
  const srcKeys = new Set();
  let offset = 0;
  while (true) {
    const sql = `SELECT ${keyCols} FROM ${from} ORDER BY ${keyCols} ASC LIMIT ${BATCH_SIZE} OFFSET ${offset}`;
    const rows = await provider.runQuery(cfg, sql, []);
    if (!rows || rows.length === 0) break;
    for (const r of rows) srcKeys.add(pkKey(pks.map((c) => r[c])));
    offset += rows.length;
    if (rows.length < BATCH_SIZE) break;
  }
  const q = db.dialect.quoteIdent;
  const localRows = await db.prepare(`SELECT ${pks.map(q).join(', ')} FROM ${q(localTable)}`).all();
  const missing = [];
  for (const r of localRows) {
    const key = pkKey(pks.map((c) => r[c]));
    if (!srcKeys.has(key)) missing.push(pks.map((c) => r[c]));
  }
  if (missing.length === 0) return 0;
  const delSql = deleteSql(localTable, pks);
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const slice = missing.slice(i, i + BATCH_SIZE);
    await db.transaction(async (batch) => {
      for (const vals of batch) await db.prepare(delSql).run(...vals);
    })(slice);
  }
  return missing.length;
}

// 落库前把驱动可能返回的富类型转成可绑定原语（sqlite 只收 number/string/bigint/buffer/null）
function toBindable(v) {
  if (v == null) return null;
  if (v instanceof Date) return normWm(v);
  if (Buffer.isBuffer(v)) return v.toString('base64');
  if (typeof v === 'object') { try { return JSON.stringify(v); } catch (e) { return String(v); } }
  return v;
}

// 校验水印字段：需为数值或时间类型；返回 { kind: 'id'|'time', isNum }
function validateWatermark(columns, wf) {
  const col = columns.find((c) => String(c.name) === String(wf));
  if (!col) throw new HttpError(400, `水印字段不存在: ${wf}`);
  const lower = String(col.type || col.dbType || '').toLowerCase();
  const isNum = /int|decimal|numeric|float|real|double|number/i.test(lower);
  const isTime = /date|time|timestamp/i.test(lower);
  if (!isNum && !isTime) throw new HttpError(400, `水印字段需为数值或时间类型: ${wf}(${lower})`);
  return { kind: isTime && !isNum ? 'time' : 'id', isNum };
}

function ensureLocalTable(dsId, sourceTable, columns, pks) {
  const localTable = nextLocalTable(dsId, sourceTable);
  const existing = db.listTables().map((n) => String(n).toLowerCase());
  if (existing.includes(localTable.toLowerCase())) return localTable;
  const fields = columns.map((c) => ({
    name: c.name,
    label: c.name,
    type: guessType(c.type || c.dbType),
  }));
  db.ensureDatasetTable(localTable, fields, pks);
  return localTable;
}

async function startLog(cid) {
  const r = await db.prepare("INSERT INTO sync_logs (sync_config_id, started_at, status) VALUES (?, datetime('now'), 'running')").run(cid);
  return Number(r.lastInsertRowid);
}

async function finishLog(logId, status, rows, message) {
  await db.prepare("UPDATE sync_logs SET finished_at = datetime('now'), status = ?, rows_synced = ?, message = ? WHERE id = ?")
    .run(status, rows, message == null ? null : String(message).slice(0, 1000), logId);
}

function insertSql(localTable, cols, pks) {
  const q = db.dialect.quoteIdent;
  const colList = cols.map(q).join(', ');
  const placeholders = cols.map((_, i) => db.dialect.placeholder(i + 1)).join(', ');
  if (pks.length > 0) return buildUpsert(localTable, cols, pks, db.dialect);
  return `INSERT INTO ${q(localTable)} (${colList}) VALUES (${placeholders})`;
}

async function writeBatch(localTable, cols, pks, rows) {
  const sql = insertSql(localTable, cols, pks);
  await db.transaction(async (batch) => {
    for (const row of batch) {
      await db.prepare(sql).run(...cols.map((c) => toBindable(row[c])));
    }
  })(rows);
}

async function readPage(provider, cfg, sc, cols) {
  // 源端只读查询：水印增量 WHERE wf > ? ORDER BY wf ASC LIMIT BATCH；首同步（无水印）全量取
  const qname = (n) => String(n);
  const sel = cols.map(qname).join(', ');
  const from = sc.source_schema ? `${qname(sc.source_schema)}.${qname(sc.source_table)}` : qname(sc.source_table);
  let sql = `SELECT ${sel} FROM ${from}`;
  const params = [];
  if (sc.watermark_field && sc.last_watermark != null && sc.last_watermark !== '') {
    sql += ` WHERE ${qname(sc.watermark_field)} > ?`;
    params.push(sc.last_watermark);
  }
  sql += ` ORDER BY ${qname(sc.watermark_field || sel.split(', ')[0])} ASC LIMIT ${BATCH_SIZE}`;
  return provider.runQuery(cfg, sql, params);
}

async function incremental(cid, provider, cfg, ds, sc, cols, columns, logId) {
  const pks = parsePk(sc.primary_key);
  const localTable = ensureLocalTable(sc.datasource_id, sc.source_table, columns, pks);
  let lastWm = sc.last_watermark;
  let total = 0;
  let continueReading = true;
  while (continueReading) {
    const rows = await readPage(provider, cfg, { ...sc, last_watermark: lastWm }, cols);
    if (!rows || rows.length === 0) break;
    await writeBatch(localTable, cols, pks, rows);
    total += rows.length;
    if (sc.watermark_field) {
      lastWm = normWm(rows[rows.length - 1][sc.watermark_field]);
    }
    continueReading = rows.length === BATCH_SIZE;
    if (total > config.upload.maxRows) throw new HttpError(400, `同步行数超过上限 ${config.upload.maxRows}`);
  }
  let deleted = 0;
  if (pks.length > 0 && sc.reconcile_delete !== 0) {
    deleted = await reconcileDeletes(provider, cfg, sc, pks, localTable);
  }
  return { total, deleted, watermark: lastWm, localTable };
}

async function full(cid, provider, cfg, ds, sc, cols, columns, logId) {
  const localTable = nextLocalTable(sc.datasource_id, sc.source_table);
  await db.exec(`DROP TABLE IF EXISTS ${db.dialect.quoteIdent(localTable)}`);
  ensureLocalTable(sc.datasource_id, sc.source_table, columns, parsePk(sc.primary_key));
  let total = 0;
  while (true) {
    const rows = await readPage(provider, cfg, { ...sc, last_watermark: null }, cols);
    if (!rows || rows.length === 0) break;
    await writeBatch(localTable, cols, [], rows);
    total += rows.length;
    if (total > config.upload.maxRows) throw new HttpError(400, `同步行数超过上限 ${config.upload.maxRows}`);
    if (rows.length < BATCH_SIZE) break;
  }
  return { total, watermark: null, localTable };
}

async function runSync(cid) {
  const sc = await db.prepare('SELECT * FROM sync_configs WHERE id = ?').get(cid);
  if (!sc) throw new HttpError(404, '同步配置不存在');
  if (sc.last_sync_status === 'running') return { skipped: true };
  const ds = await db.prepare('SELECT * FROM data_sources WHERE id = ?').get(sc.datasource_id);
  if (!ds) throw new HttpError(404, '数据源不存在');
  const meta = driversMeta(ds.type);
  const provider = providersApi.getProvider(meta.family);
  if (!provider || typeof provider.runQuery !== 'function') throw new HttpError(400, meta.name + ' 暂不支持同步');
  const cfg = decryptConfig(JSON.parse(ds.config));
  const columns = await provider.listColumns(cfg, ds.type, sc.source_schema, sc.source_table);
  if (!columns || columns.length === 0) throw new HttpError(400, `源表 ${sc.source_table} 无可用列或不存在`);
  const cols = columns.map((c) => c.name);
  await db.prepare("UPDATE sync_configs SET last_sync_status = 'running', updated_at = datetime('now') WHERE id = ?").run(cid);

  const logId = await startLog(cid);
  let out;
  try {
    out = sc.strategy === 'full' ? await full(cid, provider, cfg, ds, sc, cols, columns, logId)
      : await incremental(cid, provider, cfg, ds, sc, cols, columns, logId);
    const msg = out.deleted ? `删除对账：本地删除 ${out.deleted} 行` : '';
    await finishLog(logId, 'success', out.total, msg || null);
    await db.prepare("UPDATE sync_configs SET last_sync_at = datetime('now'), last_watermark = ?, last_sync_status = 'success', last_sync_msg = ?, updated_at = datetime('now') WHERE id = ?")
      .run(out.watermark == null ? null : String(out.watermark), msg, cid);
    return { rows: out.total, deleted: out.deleted || 0, localTable: out.localTable };
  } catch (e) {
    await finishLog(logId, 'failed', out ? out.total : 0, e.message);
    await db.prepare("UPDATE sync_configs SET last_sync_status = 'failed', last_sync_msg = ?, updated_at = datetime('now') WHERE id = ?").run(String(e.message).slice(0, 500), cid);
    throw e;
  }
}

// ─── 配置 CRUD ────────────────────────────────────────────────

async function createConfig(dsId, body, req) {
  const ds = await db.prepare('SELECT * FROM data_sources WHERE id = ?').get(dsId);
  if (!ds) throw new HttpError(404, '数据源不存在');
  if (driversMeta(ds.type).family === 'file') throw new HttpError(400, '文件型数据源不支持同步');
  const sourceTable = String(body.sourceTable || body.source_table || '').trim();
  if (!sourceTable) throw new HttpError(400, '缺少源表名 sourceTable');
  const meta = driversMeta(ds.type);
  const provider = providersApi.getProvider(meta.family);
  const cfg = decryptConfig(JSON.parse(ds.config));
  const columns = await provider.listColumns(cfg, ds.type, body.sourceSchema || null, sourceTable);
  if (!columns || columns.length === 0) throw new HttpError(400, `源表 ${sourceTable} 无可用列或不存在`);
  const strategy = body.strategy === 'full' ? 'full' : 'incremental';
  let watermarkField = body.watermarkField != null ? String(body.watermarkField) : null;
  let watermarkKind = 'id';
  if (strategy === 'incremental') {
    if (!watermarkField) {
      // 未指定则尝试找名为 id/updated_at/created_at 的数值或时间列
      const cand = columns.find((c) => /^(id|created_at)$/i.test(String(c.name))) || columns.find((c) => /_at$/i.test(String(c.name)));
      watermarkField = cand ? cand.name : watermarkField;
    }
    if (!watermarkField) throw new HttpError(400, '增量同步需要水印字段 watermarkField');
    watermarkKind = validateWatermark(columns, watermarkField).kind;
  }
  let pkRaw = Array.isArray(body.primaryKey) ? JSON.stringify(body.primaryKey.map(String)) : (body.primaryKey != null ? String(body.primaryKey) : null);
  if (!pkRaw) {
    const idCol = columns.find((c) => /^id$/i.test(String(c.name)));
    if (idCol) pkRaw = JSON.stringify([idCol.name]);
  }
const interval = parseInt(body.syncIntervalSeconds || body.interval || config.sync.defaultIntervalSeconds, 10);
  const reconcile = body.reconcileDelete === false ? 0 : 1;
  const localTable = body.localTable ? String(body.localTable).replace(/[^A-Za-z0-9_]/g, '_') : nextLocalTable(dsId, sourceTable);
  try {
    const r = await db.prepare("INSERT INTO sync_configs (datasource_id, source_schema, source_table, local_table, target_type, strategy, watermark_field, watermark_kind, primary_key, reconcile_delete, sync_interval_seconds, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))")
      .run(dsId, body.sourceSchema || null, sourceTable, localTable, body.targetType === 'file' ? 'file' : 'app', strategy, watermarkField, watermarkKind, pkRaw, reconcile, interval);
    const id = Number(r.lastInsertRowid);
    if (req) await require('./audit.service').log({ userId: ds.owner_id ?? null, email: req?.user?.email, action: 'datasource.sync.create', resourceType: 'sync_config', resourceId: id, detail: { datasource_id: dsId, source_table: sourceTable, strategy } }, req).catch(() => {});
    return getConfig(id);
  } catch (e) {
    if (/UNIQUE|duplicate/i.test(String(e.message))) throw new HttpError(409, '该数据源下同一张源表已存在同步配置');
    throw e;
  }
}

async function getConfig(id) {
  const row = await db.prepare('SELECT * FROM sync_configs WHERE id = ?').get(id);
  if (!row) return null;
  return toConfig(row);
}

function toConfig(row) {
  return {
    id: row.id,
    datasource_id: row.datasource_id,
    source_schema: row.source_schema,
    source_table: row.source_table,
    local_table: row.local_table,
    target_type: row.target_type,
    strategy: row.strategy,
    watermark_field: row.watermark_field,
    watermark_kind: row.watermark_kind,
    primary_key: parsePk(row.primary_key),
    reconcile_delete: row.reconcile_delete == null ? 1 : row.reconcile_delete,
    sync_interval_seconds: row.sync_interval_seconds,
    last_sync_at: row.last_sync_at,
    last_watermark: row.last_watermark,
    last_sync_status: row.last_sync_status,
    last_sync_msg: row.last_sync_msg,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function listConfigs(where = '', params = []) {
  const rows = await db.prepare(`SELECT * FROM sync_configs${where ? ' WHERE ' + where : ''} ORDER BY id DESC`).all(...params);
  return rows.map(toConfig);
}

async function configsOf(dsId) {
  return listConfigs('datasource_id = ?', [dsId]);
}

async function updateConfig(id, body) {
  const row = await db.prepare('SELECT * FROM sync_configs WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, '同步配置不存在');
  const nextStrategy = body.strategy === 'full' ? 'full' : body.strategy === 'incremental' ? 'incremental' : row.strategy;
  const nextInterval = body.syncIntervalSeconds != null ? parseInt(body.syncIntervalSeconds, 10) : row.sync_interval_seconds;
  const nextPk = body.primaryKey != null ? (Array.isArray(body.primaryKey) ? JSON.stringify(body.primaryKey.map(String)) : String(body.primaryKey)) : row.primary_key;
  const nextWf = body.watermarkField != null ? String(body.watermarkField) : row.watermark_field;
  const nextReconcile = body.reconcileDelete != null ? (body.reconcileDelete ? 1 : 0) : row.reconcile_delete;
  await db.prepare("UPDATE sync_configs SET strategy = ?, watermark_field = ?, primary_key = ?, reconcile_delete = ?, sync_interval_seconds = ?, updated_at = datetime('now') WHERE id = ?")
    .run(nextStrategy, nextWf, nextPk, nextReconcile, nextInterval, id);
  if (nextStrategy === 'full') {
    await db.prepare("UPDATE sync_configs SET watermark_field = NULL, last_watermark = NULL WHERE id = ?").run(id);
  }
  return getConfig(id);
}

async function deleteConfig(id) {
  const row = await db.prepare('SELECT * FROM sync_configs WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, '同步配置不存在');
  await db.prepare('DELETE FROM sync_configs WHERE id = ?').run(id);
  return true;
}

async function logsOf(cid) {
  return (await db.prepare('SELECT * FROM sync_logs WHERE sync_config_id = ? ORDER BY id DESC LIMIT 50').all(cid));
}

async function runNow(cid) {
  return runSync(cid);
}

module.exports = {
  runSync, runNow, createConfig, getConfig, listConfigs, configsOf, updateConfig, deleteConfig, logsOf,
  nextLocalTable, validateWatermark, parsePk, normWm, toBindable,
};