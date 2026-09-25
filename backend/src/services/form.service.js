const db = require('../db');
const { translate } = require('../db/translate');
const HttpError = require('../utils/http-error');
const { formSchema, dbFieldsOf } = require('./form-schema');
const audit = require('./audit.service');
const { uuidv7 } = require('../utils/uuidv7');

const SUBMIT_DEFAULTS = { successText: '提交成功', allowRepeat: true };

// 物理表固定系统列（不来自 schema）
const SYSTEM_COLS = new Set(['id', 'submitted_by', 'submitted_at']);

/** 生成唯一的数据表名 */
function nextTableName() {
  return `ds_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function parseJson(text, fallback) {
  try {
    const v = JSON.parse(text || '');
    return v == null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

function nowText() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

async function getForm(id) {
  const row = await db.prepare('SELECT * FROM forms WHERE id = ?').get(id);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    schema: parseJson(row.schema_json, { version: 1, fields: [] }),
    submitConfig: { ...SUBMIT_DEFAULTS, ...parseJson(row.submit_config, {}) },
    tableName: row.table_name || null,
    datasetId: row.dataset_id == null ? null : String(row.dataset_id),
    ownerId: String(row.owner_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getFormOrThrow(id) {
  const f = await getForm(id);
  if (!f) throw new HttpError(404, `表单不存在: id=${id}`);
  return f;
}

async function createForm({ name, description = '', ownerId }) {
  const safeName = String(name || '').trim().slice(0, 100);
  if (!safeName) throw new HttpError(400, '表单名称不能为空');
  const formId = uuidv7();
  const info = await db.prepare(
    'INSERT INTO forms (id, name, description, schema_json, submit_config, owner_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(formId, safeName, String(description || '').slice(0, 1000), '{"version":1,"fields":[]}', JSON.stringify(SUBMIT_DEFAULTS), ownerId == null ? null : String(ownerId));
  return getForm(formId);
}

async function listForms(where = '', params = []) {
  const cond = where.replace(/\bowner_id\b/g, 'f.owner_id');
  const rows = await db.prepare(
    `SELECT f.* FROM forms f ${cond ? ' WHERE ' + cond : ''} ORDER BY f.created_at DESC, f.id DESC`
  ).all(...params);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    status: r.status,
    tableName: r.table_name,
    datasetId: r.dataset_id == null ? null : String(r.dataset_id),
    ownerId: String(r.owner_id),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

async function countSubmissions(form) {
  if (!form.tableName) return 0;
  const q = await db.prepare(`SELECT COUNT(*) AS c FROM ${db.dialect.quoteIdent(form.tableName)}`).get();
  return Number((q && q.c) || 0);
}

/** 发布后加字段：目标方言 ALTER TABLE ... ADD <col> <type> */
async function addColumn(tableName, field) {
  const type = db.dialect.typeMapping[field.type] || db.dialect.typeMapping.string;
  const stmt = translate(
    `ALTER TABLE ${db.dialect.quoteIdent(tableName)} ADD COLUMN ${db.dialect.quoteIdent(field.name)} ${type}`,
    db.dialect
  );
  await db.exec(stmt);
}

/**
 * 更新表单。发布后有提交数据时：
 *  - 禁止删除字段（含把非 static 改 static、改 key）
 *  - 禁止改字段类型
 *  - 允许新增字段（ALTER ADD + 补 dataset_fields）
 */
async function updateForm(id, { name, description, schemaJson, submitConfig }) {
  const form = await getFormOrThrow(id);
  const parsed = formSchema.safeParse(schemaJson);
  if (!parsed.success) throw new HttpError(400, '表单结构不合法', parsed.error.flatten());
  const next = parsed.data;

  if (form.tableName) {
    const existing = (await db.listColumns(form.tableName)).map((c) => c.name).filter((n) => !SYSTEM_COLS.has(n));
    const nextStored = next.fields.filter((f) => f.type !== 'static');
    const nextStoreKeys = nextStored.map((f) => f.key);

    const removed = existing.filter((k) => !nextStoreKeys.includes(k));
    if (removed.length) throw new HttpError(400, `已有提交数据，禁止删除字段: ${removed.join('、')}`);

    const typeChanged = [];
    for (const f of nextStored) {
      const col = existing.includes(f.key)
        ? await db.prepare(
            "SELECT name, type FROM dataset_fields WHERE dataset_id = ? AND name = ?"
          ).get(form.datasetId, f.key)
        : null;
      if (col && col.type !== (dbFieldsOf(next).find((x) => x.name === f.key) || {}).type) {
        typeChanged.push(f.key);
      }
    }
    if (typeChanged.length) throw new HttpError(400, `已有提交数据，禁止修改字段类型: ${typeChanged.join('、')}`);
  }

  const submitCfg = { ...SUBMIT_DEFAULTS, ...(submitConfig || {}) };
  if (submitCfg.allowRepeat !== undefined) submitCfg.allowRepeat = !!submitCfg.allowRepeat;

  await db.prepare(
    "UPDATE forms SET name = ?, description = ?, schema_json = ?, submit_config = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(
    String(name ?? form.name).trim().slice(0, 100) || form.name,
    String(description ?? form.description).slice(0, 1000),
    JSON.stringify(next),
    JSON.stringify(submitCfg),
    String(id)
  );

  let updated = await getForm(id);

  // 已发布：补建新增列 + 同步数据集字段
  if (form.tableName) {
    const existing = (await db.listColumns(form.tableName)).map((c) => c.name);
    const fields = dbFieldsOf(next);
    let changed = false;
    for (const f of fields) {
      if (existing.includes(f.name)) continue;
      await addColumn(form.tableName, f);
      changed = true;
    }
    if (changed) {
      // 重写字段元数据保持 schema 顺序
      await db.prepare('DELETE FROM dataset_fields WHERE dataset_id = ?').run(form.datasetId);
      const insField = await db.prepare(
        'INSERT INTO dataset_fields (id, dataset_id, name, label, type, position) VALUES (?, ?, ?, ?, ?, ?)'
      );
      await db.transaction(async (fs) => {
        for (const [i, f] of fs.entries()) {
          await insField.run(uuidv7(), form.datasetId, f.name, f.label, f.type, i);
        }
      })(fields);
      await db.prepare('UPDATE datasets SET column_count = ? WHERE id = ?').run(fields.length, form.datasetId);
    }
    updated = await getForm(id);
  }
  return updated;
}

/**
 * 发布表单：首次发布建物理表 + 注册 source_type='form' 数据集；幂等。
 */
async function publish(id, userId, req) {
  const form = await getFormOrThrow(id);
  const fields = dbFieldsOf(form.schema);
  if (fields.length === 0) throw new HttpError(400, '请先添加至少一个数据字段（说明文字不计入）');

  if (form.tableName && form.datasetId) {
    // 幂等：已发布仅改状态
    await db.prepare("UPDATE forms SET status = 'published', updated_at = datetime('now') WHERE id = ?")
      .run(String(id));
    await audit.log({ userId, email: req?.user?.email, action: 'form.publish', resourceType: 'form', resourceId: id }, req);
    return getForm(id);
  }

  const tableName = nextTableName();
  const cols = [
    { name: 'id', type: 'integer', label: 'ID' },
    { name: 'submitted_by', type: 'string', label: '提交人' },
    { name: 'submitted_at', type: 'string', label: '提交时间' },
    ...fields,
  ];
  await db.ensureDatasetTable(tableName, cols, ['id']);

  const dsId = uuidv7();
  await db.transaction(async (payload) => {
    const ins = await db.prepare(
      'INSERT INTO datasets (id, name, original_file, row_count, column_count, table_name, source_type, owner_id) VALUES (?, ?, ?, 0, ?, ?, ?, ?)'
    ).run(payload.dsId, payload.name, tableName, payload.fields.length, tableName, 'form', payload.ownerId);
    const insField = await db.prepare(
      'INSERT INTO dataset_fields (id, dataset_id, name, label, type, position) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const [i, f] of payload.fields.entries()) {
      await insField.run(uuidv7(), payload.dsId, f.name, f.label, f.type, i);
    }
    await db.prepare(
      "UPDATE forms SET status = ?, table_name = ?, dataset_id = ?, updated_at = datetime('now') WHERE id = ?"
    ).run('published', payload.tableName, payload.dsId, payload.formId);
    return payload.dsId;
  })({ dsId, name: form.name, fields, tableName, ownerId: form.ownerId, formId: String(id) });

  await audit.log({ userId, email: req?.user?.email, action: 'form.publish', resourceType: 'form', resourceId: id, detail: { tableName, datasetId: dsId } }, req);
  return getForm(id);
}

async function close(id, userId, req) {
  const form = await getFormOrThrow(id);
  await db.prepare("UPDATE forms SET status = 'closed', updated_at = datetime('now') WHERE id = ?")
    .run(String(id));
  await audit.log({ userId, email: req?.user?.email, action: 'form.close', resourceType: 'form', resourceId: id }, req);
  return { ...form, status: 'closed' };
}

/**
 * 删除表单：级联删物理表 + 数据集 + 分享 + 本体
 */
async function deleteForm(id, userId, req) {
  const form = await getFormOrThrow(id);
  if (form.tableName) {
    const q = db.dialect.quoteIdent(form.tableName);
    if (db.type === 'sqlite') await db.exec(`DROP TABLE IF EXISTS ${q}`);
    else {
      const schema = require('../db/schema');
      if (schema.IF_NOT_EXISTS.has(db.type)) await db.exec(`DROP TABLE IF EXISTS ${q}`);
      else {
        const hit = (await db.listTables()).some((n) => String(n).toUpperCase() === String(form.tableName).toUpperCase());
        if (hit) await db.exec(`DROP TABLE ${q}`);
      }
    }
  }
  if (form.datasetId != null) await db.prepare('DELETE FROM datasets WHERE id = ?').run(String(form.datasetId));
  await db.prepare('DELETE FROM form_shares WHERE form_id = ?').run(String(id));
  await db.prepare('DELETE FROM forms WHERE id = ?').run(String(id));
  await audit.log({ userId, email: req?.user?.email, action: 'form.delete', resourceType: 'form', resourceId: id }, req);
  return { deleted: true };
}

/**
 * 填写页 schema 子集（不含内部信息）
 */
function fillSchema(form) {
  return {
    id: form.id,
    name: form.name,
    description: form.description,
    status: form.status,
    submitConfig: form.submitConfig,
    schema: {
      version: form.schema.version || 1,
      fields: (form.schema.fields || []).map((f) => ({
        key: f.key, label: f.label, type: f.type, required: f.required,
        placeholder: f.placeholder, span: f.span, group: f.group, options: f.options || [],
      })),
    },
  };
}

/** 按表单分页查提交（含提交人邮箱） */
async function listSubmissions(form, { page = 1, pageSize = 20 } = {}) {
  if (!form.tableName) throw new HttpError(400, '表单未发布，暂无提交记录');
  const q = db.dialect.quoteIdent(form.tableName);
  const total = Number((await db.prepare(`SELECT COUNT(*) AS c FROM ${q}`).get()).c) || 0;
  const offset = (Math.max(1, Number(page) || 1) - 1) * pageSize;
  const limit = Math.min(Math.max(1, Number(pageSize) || 20), 100);
  const rows = await db.prepare(
    `SELECT t.*, u.email AS submitterEmail FROM ${q} t LEFT JOIN users u ON u.id = t.submitted_by ORDER BY t.submitted_at DESC, t.id DESC LIMIT ? OFFSET ?`
  ).all(limit, offset);
  return { rows, total };
}

/** 当前用户自己的提交（服务端分页） */
async function listMySubmissions(form, userId, { page = 1, pageSize = 20 } = {}) {
  if (!form.tableName) throw new HttpError(400, '表单未发布');
  if (!userId) throw new HttpError(401, '用户信息无效');
  const q = db.dialect.quoteIdent(form.tableName);
  const total = Number((await db.prepare(`SELECT COUNT(*) AS c FROM ${q} t WHERE t.submitted_by = ?`).get(String(userId))).c) || 0;
  const offset = (Math.max(1, Number(page) || 1) - 1) * pageSize;
  const limit = Math.min(Math.max(1, Number(pageSize) || 20), 100);
  const rows = await db.prepare(
    `SELECT t.* FROM ${q} t WHERE t.submitted_by = ? ORDER BY t.submitted_at DESC, t.id DESC LIMIT ? OFFSET ?`
  ).all(String(userId), limit, offset);
  return { rows, total };
}

module.exports = {
  SUBMIT_DEFAULTS,
  SYSTEM_COLS,
  nowText,
  createForm,
  listForms,
  getForm,
  getFormOrThrow,
  updateForm,
  publish,
  close,
  deleteForm,
  countSubmissions,
  fillSchema,
  listSubmissions,
  listMySubmissions,
  nextTableName,
};