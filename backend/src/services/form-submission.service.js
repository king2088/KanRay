const db = require('../db');
const HttpError = require('../utils/http-error');
const { optionsOf } = require('./form-schema');
const { nowText } = require('./form.service');

// 与 dataset.service 的 convertValue 保持等价的类型强制（此处副本，避免共享模块改导出）
function convertValue(value, type) {
  if (value === null || value === undefined || value === '') return null;
  if (type === 'date') {
    const s = String(value).trim();
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
  return String(value);
}

function isEmptyValue(raw, type) {
  if (raw === undefined || raw === null) return true;
  if (typeof raw === 'string') return raw.trim() === '';
  if (Array.isArray(raw)) return raw.length === 0;
  return false;
}

/**
 * 按 schema 校验并规整提交值。返回 { 字段key: 入库值 }。
 * 字段 key 白名单：只保留 schema 内注册的非 static 字段，其余输入一概丢弃。
 */
function validateValues(form, values) {
  const out = {};
  for (const f of form.schema.fields || []) {
    if (f.type === 'static') continue;
    const raw = values ? values[f.key] : undefined;
    const empty = isEmptyValue(raw, f.type);

    if (empty) {
      if (f.required) throw new HttpError(400, `「${f.label}」为必填项`);
      out[f.key] = null;
      continue;
    }

    switch (f.type) {
      case 'text':
      case 'textarea': {
        const s = String(raw);
        if (s.length > 5000) throw new HttpError(400, `「${f.label}」长度不能超过 5000 字符`);
        out[f.key] = s;
        break;
      }
      case 'number': {
        const n = Number(raw);
        if (raw === '' || Number.isNaN(n) || !Number.isFinite(n)) throw new HttpError(400, `「${f.label}」必须是数字`);
        out[f.key] = n;
        break;
      }
      case 'date': {
        const s = String(raw).trim();
        if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s)) throw new HttpError(400, `「${f.label}」日期格式须为 YYYY-MM-DD`);
        out[f.key] = s;
        break;
      }
      case 'select':
      case 'radio': {
        const allowed = optionsOf(f);
        if (!allowed.includes(String(raw))) throw new HttpError(400, `「${f.label}」选项不合法`);
        out[f.key] = String(raw);
        break;
      }
      case 'checkbox': {
        const allowed = optionsOf(f);
        const arr = Array.isArray(raw) ? raw.map((x) => String(x)) : [String(raw)];
        for (const v of arr) {
          if (!allowed.includes(v)) throw new HttpError(400, `「${f.label}」选项不合法`);
        }
        out[f.key] = arr.join(',');
        break;
      }
      default:
        out[f.key] = String(raw);
    }
  }
  return out;
}

function qFormOrThrow(form) {
  if (!form.tableName) throw new HttpError(400, '表单未发布');
  return db.dialect.quoteIdent(form.tableName);
}

/** 插入一条提交。匿名（share）submitted_by 为 null。 */
async function insert(form, values, userId) {
  const table = qFormOrThrow(form);
  if (form.status === 'closed') throw new HttpError(400, '表单已关闭，无法提交');
  if (form.status !== 'published') throw new HttpError(400, '表单未发布，无法提交');

  const cleaned = validateValues(form, values || {});

  if (userId) {
    const own = await db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE submitted_by = ?`).get(Number(userId));
    if (!form.submitConfig.allowRepeat && Number((own && own.c) || 0) > 0) {
      throw new HttpError(400, '该表单每人仅可提交一次');
    }
  }

  const keys = Object.keys(cleaned);
  const meta = { id: '?', submitted_by: '?', submitted_at: '?' };
  const allCols = ['id', 'submitted_by', 'submitted_at', ...keys];
  const placeholders = allCols.map((c, i) => db.dialect.placeholder ? db.dialect.placeholder(i + 1) : '?').join(', ');
  const insSql = `INSERT INTO ${table} (${allCols.map((c) => db.dialect.quoteIdent(c)).join(', ')}) VALUES (${placeholders})`;

  const ts = nowText();
  const rowId = await db.transaction(async (payload) => {
    const cur = await db.prepare('SELECT submission_seq AS seq FROM forms WHERE id = ?').get(payload.formId);
    const seq = Number((cur && cur.seq) || 0) + 1;
    const ins = await db.prepare(payload.insSql);
    const vals = payload.keys.map((k) => payload.cleaned[k]);
    const info = await ins.run(seq, payload.userId, payload.ts, ...vals);
    if (Number(info.changes || 0) === 0) throw new HttpError(409, '提交冲突，请重试');
    await db.prepare('UPDATE forms SET submission_seq = ? WHERE id = ?').run(seq, payload.formId);
    return { id: seq, submittedAt: payload.ts };
  })({ formId: form.id, keys, cleaned, userId: userId == null ? null : Number(userId), ts, insSql });

  if (form.datasetId != null) {
    await db.prepare('UPDATE datasets SET row_count = row_count + 1 WHERE id = ?').run(form.datasetId);
  }
  return rowId;
}

/** 更新单条提交（管理员/拥有者）。部分更新：仅覆盖传入字段，其余保留。 */
async function update(form, submissionId, values) {
  const table = qFormOrThrow(form);
  const row = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(Number(submissionId));
  if (!row) throw new HttpError(404, `提交记录不存在: id=${submissionId}`);

  // 已有值并入，未传字段保持原状；整体校验保证必填/类型仍成立
  const merged = {};
  for (const f of form.schema.fields || []) {
    if (f.type === 'static') continue;
    merged[f.key] = row[f.key] === undefined ? null : row[f.key];
  }
  for (const [k, v] of Object.entries(values || {})) {
    if (k in merged) merged[k] = v;
  }
  const cleaned = validateValues(form, merged);

  if (!Object.keys(cleaned).length) throw new HttpError(400, '没有可更新的字段');
  const sets = Object.keys(cleaned).map((k) => `${db.dialect.quoteIdent(k)} = ?`).join(', ');
  await db.prepare(`UPDATE ${table} SET ${sets} WHERE id = ?`).run(...Object.keys(cleaned).map((k) => cleaned[k]), Number(submissionId));
  return { id: Number(submissionId), updated: true };
}

/** 删除单条提交 */
async function remove(form, submissionId) {
  const table = qFormOrThrow(form);
  const info = await db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(Number(submissionId));
  if (Number(info.changes || 0) === 0) throw new HttpError(404, `提交记录不存在: id=${submissionId}`);
  if (form.datasetId != null) {
    await db.prepare('UPDATE datasets SET row_count = MAX(0, row_count - 1) WHERE id = ?').run(form.datasetId);
  }
  return { deleted: true };
}

module.exports = { convertValue, validateValues, insert, update, remove };