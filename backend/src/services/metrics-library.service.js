const db = require('../db');
const HttpError = require('../utils/http-error');
const { AGG_FUNCS, DERIVED_KINDS } = require('../engines/metrics');

// 指标库公式引用写法：$<数字指标ID>（区别于图表内联公式的 $m<key>）
const FORMULA_REMAINDER = /^[0-9+\-*/().%\s]*$/;
const LIB_EXPR_TOKEN = /\$([0-9]+)/g;

function parseRow(row) {
  let definition = {};
  try {
    definition = JSON.parse(row.definition || '{}');
  } catch (e) {
    definition = {};
  }
  return {
    id: row.id,
    dataset_id: row.dataset_id,
    name: row.name,
    kind: row.kind,
    definition,
    owner_id: row.owner_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function listMetrics(datasetId) {
  const rows = await db.prepare('SELECT * FROM metrics WHERE dataset_id = ? ORDER BY id').all(datasetId);
  return rows.map(parseRow);
}

async function getMetricRecord(datasetId, id) {
  const row = await db.prepare('SELECT * FROM metrics WHERE id = ? AND dataset_id = ?').get(id, datasetId);
  if (!row) throw new HttpError(404, `指标不存在: id=${id}`);
  return parseRow(row);
}

async function datasetFields(datasetId) {
  const rows = await db.prepare('SELECT name, label, type FROM dataset_fields WHERE dataset_id = ?').all(datasetId);
  return rows.map((r) => r.name);
}

function assertFormulaSyntax(expr) {
  const raw = String(expr || '').trim();
  if (!raw) throw new HttpError(400, '复合指标公式不能为空');
  const remainder = raw.replace(LIB_EXPR_TOKEN, '');
  if (!FORMULA_REMAINDER.test(remainder)) {
    throw new HttpError(400, '复合指标公式仅支持引用指标库原子指标($数字ID)以及数字、+ - * / ( ) %');
  }
  let depth = 0;
  for (const ch of remainder) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (depth < 0) throw new HttpError(400, '公式括号不匹配');
  }
  if (depth !== 0) throw new HttpError(400, '公式括号不匹配');
}

/**
 * 校验指标库定义（创建/更新时）：kind 决定 definition 结构；引用需指向同数据集内合法指标。
 * - base   定义 { field, agg }：字段必须存在于数据集；agg 在白名单内
 * - expr   定义 { expr }：公式仅可 $数字ID 引用库内 base 指标
 * - derived定义 { derivative, refId }：只能引用库内 base/expr 指标（禁止衍生套衍生）
 */
async function assertMetricDefinition(datasetId, kind, definition) {
  const d = definition || {};
  if (kind === 'base') {
    if (!d.field || typeof d.field !== 'string') throw new HttpError(400, '原子指标缺少 field');
    if (!AGG_FUNCS[d.agg]) throw new HttpError(400, `不支持的聚合: ${d.agg}`);
    if (d.field !== '*' || d.agg !== 'count') {
      const fields = await datasetFields(datasetId);
      if (!fields.includes(d.field)) throw new HttpError(400, `指标字段不存在: ${d.field}`);
    }
    return;
  }
  if (kind === 'expr') {
    assertFormulaSyntax(d.expr);
    const refs = new Set();
    String(d.expr || '').replace(LIB_EXPR_TOKEN, (all, id) => {
      refs.add(Number(id));
      return all;
    });
    for (const id of refs) {
      const rec = await getMetricRecord(datasetId, id);
      if (rec.kind !== 'base') {
        throw new HttpError(400, `复合指标公式只能引用指标库原子指标（id=${id} 为 ${rec.kind}）`);
      }
    }
    return;
  }
  if (kind === 'derived') {
    if (!DERIVED_KINDS.includes(d.derivative)) {
      throw new HttpError(400, `不支持的衍生类型: ${d.derivative}（支持 ${DERIVED_KINDS.join('/')}）`);
    }
    const refId = Number(d.refId);
    if (!Number.isInteger(refId)) throw new HttpError(400, '衍生指标缺少 refId');
    const rec = await getMetricRecord(datasetId, refId);
    if (rec.kind === 'derived') {
      throw new HttpError(400, `衍生指标不能引用另一个衍生指标（id=${refId}）`);
    }
    return;
  }
  throw new HttpError(400, `指标库仅支持 base/expr/derived 三种类型，收到: ${kind}`);
}

async function createMetric(datasetId, { name, kind, definition }, ownerId) {
  const n = String(name || '').trim();
  if (!n) throw new HttpError(400, '指标名称不能为空');
  if (!['base', 'expr', 'derived'].includes(kind)) {
    throw new HttpError(400, `指标类型仅支持 base/expr/derived，收到: ${kind}`);
  }
  await assertMetricDefinition(datasetId, kind, definition);
  const defJson = JSON.stringify(definition || {});
  const result = await db
    .prepare('INSERT INTO metrics (dataset_id, name, kind, definition, owner_id) VALUES (?, ?, ?, ?, ?)')
    .run(datasetId, n, kind, defJson, ownerId || null);
  return getMetricRecord(datasetId, result.lastInsertRowid);
}

async function updateMetric(datasetId, id, { name, definition } = {}) {
  const rec = await getMetricRecord(datasetId, id);
  const nextName = name !== undefined && name !== null ? String(name).trim() : rec.name;
  if (!nextName) throw new HttpError(400, '指标名称不能为空');
  if (definition !== undefined && definition !== null) {
    await assertMetricDefinition(datasetId, rec.kind, definition);
  }
  const defJson = JSON.stringify(definition !== undefined && definition !== null ? definition : rec.definition);
  const stamp = new Date().toISOString();
  await db.prepare('UPDATE metrics SET name = ?, definition = ?, updated_at = ? WHERE id = ? AND dataset_id = ?')
    .run(nextName, defJson, stamp, id, datasetId);
  return getMetricRecord(datasetId, id);
}

/**
 * 解析一条指标定义的被引用 ID 集合（结构化解引用，避免 `$919` 误伤 `$91` 这种子串假阳性）：
 * - derived  -> refId
 * - expr     -> 公式内 $数字 引用
 */
function referencesIn(definitionRaw) {
  const refs = new Set();
  let d = definitionRaw;
  if (typeof d === 'string') {
    try { d = JSON.parse(d); } catch (e) { return refs; }
  }
  if (!d || typeof d !== 'object' || Array.isArray(d)) return refs;
  if (typeof d.refId !== 'undefined' && d.refId !== null) {
    refs.add(Number(d.refId));
  }
  if (typeof d.expr === 'string') {
    String(d.expr).replace(LIB_EXPR_TOKEN, (all, id) => {
      refs.add(Number(id));
      return all;
    });
  }
  refs.delete(NaN);
  return refs;
}

/**
 * 删除库指标：若被同数据集其他库指标引用、或被数据集内任一图表 saved 引用则拒绝（避免孤儿引用）。
 */
async function assertNoReferences(datasetId, rec) {
  const rows = await db.prepare('SELECT id, name, kind, definition FROM metrics WHERE dataset_id = ?').all(datasetId);
  for (const r of rows) {
    if (r.id === rec.id) continue;
    if (referencesIn(r.definition).has(rec.id)) {
      throw new HttpError(400, `无法删除："${rec.name}" 被指标库其他指标 "${r.name}" 引用`);
    }
  }
  const charts = await db.prepare('SELECT id, name, config FROM charts WHERE dataset_id = ?').all(datasetId);
  for (const ch of charts) {
    let cfg;
    try { cfg = JSON.parse(ch.config || '{}'); } catch (e) { continue; }
    const refs = (cfg.metrics || []).filter((m) => m && m.type === 'saved' && Number(m.metricId) === rec.id);
    if (refs.length) {
      throw new HttpError(400, `无法删除："${rec.name}" 被图表 "${ch.name}" 引用`);
    }
  }
}

async function deleteMetric(datasetId, id) {
  const rec = await getMetricRecord(datasetId, id);
  await assertNoReferences(datasetId, rec);
  await db.prepare('DELETE FROM metrics WHERE id = ? AND dataset_id = ?').run(id, datasetId);
  return { deleted: true, id: rec.id };
}

async function emitRef(out, resolved, visiting, datasetId, id) {
  const numeric = Number(id);
  if (resolved.has(numeric)) return resolved.get(numeric);
  if (visiting.has(numeric)) {
    throw new HttpError(400, `指标库存在循环引用（id=${numeric}）`);
  }
  visiting.add(numeric);
  const rec = await getMetricRecord(datasetId, numeric);
  const d = rec.definition || {};
  let def;
  if (rec.kind === 'base') {
    def = { type: 'base', field: d.field, agg: d.agg, label: rec.name };
  } else if (rec.kind === 'expr') {
    const tokens = [];
    String(d.expr || '').replace(LIB_EXPR_TOKEN, (all, t) => {
      tokens.push(Number(t));
      return all;
    });
    const keyByRef = new Map();
    for (const t of tokens) {
      if (!keyByRef.has(t)) keyByRef.set(t, await emitRef(out, resolved, visiting, datasetId, t));
    }
    def = { type: 'expr', expr: String(d.expr || '').replace(LIB_EXPR_TOKEN, (all, t) => `$${keyByRef.get(Number(t))}`), label: rec.name };
  } else if (rec.kind === 'derived') {
    const refKey = await emitRef(out, resolved, visiting, datasetId, d.refId);
    def = { type: 'derived', kind: d.derivative, ref: refKey, label: rec.name };
  } else {
    throw new HttpError(400, `指标库存在未知类型: ${rec.kind}`);
  }
  def.key = `m${out.length}`;
  out.push(def);
  resolved.set(numeric, def.key);
  visiting.delete(numeric);
  return def.key;
}

// 图表内联公式/引用的 key 形如 m0/m1...（前端 ensureMetricShapes 生成）
// 捕获整段 m<数字> 全键，配合 finalKeyByFrontKey 做重编号重写（capture 仅取数字会永远匹配不到）
const INLINE_KEY_TOKEN = /\$(m[0-9]+)/g;

/**
 * 展开图表指标里的 { type:'saved', metricId }：
 *  - 递归拉取指标库定义（带环检测），派生/复合引用重写为展开后的 m<key>；
 *  - 全部指标（内联 + 指标库）按最终出现顺序重编号为 m0..mN，内联 expr/derived 引用同步重写；
 *  - 返回 { metrics, savedKeys }，savedKeys 记录每个 metricId 对应的最终根 key（供前端取渲染列）。
 */
async function expandSavedMetrics(datasetId, metrics) {
  if (!(metrics || []).some((m) => m && m.type === 'saved')) {
    return { metrics, savedKeys: {} };
  }
  const out = [];
  const resolved = new Map();
  const visiting = new Set();
  const savedKeys = {};
  const finalKeyByFrontKey = new Map();

  for (const m of metrics) {
    if (m && m.type === 'saved') {
      const id = Number(m.metricId);
      if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, '已存指标缺少有效 metricId');
      const rootKey = await emitRef(out, resolved, visiting, datasetId, id);
      savedKeys[id] = rootKey;
      if (m.key) finalKeyByFrontKey.set(m.key, rootKey);
    } else {
      const clone = { ...m };
      const frontKey = clone.key || `m${out.length}`;
      if (clone.type === 'expr') {
        clone.expr = String(clone.expr || '').replace(INLINE_KEY_TOKEN, (all, k) => {
          return finalKeyByFrontKey.has(k) ? `$${finalKeyByFrontKey.get(k)}` : all;
        });
      }
      if (clone.type === 'derived' && clone.ref) {
        clone.ref = finalKeyByFrontKey.get(clone.ref) || clone.ref;
      }
      clone.key = `m${out.length}`;
      out.push(clone);
      finalKeyByFrontKey.set(frontKey, clone.key);
    }
  }
  if (!out.length) throw new HttpError(400, '至少需要一个指标');
  return { metrics: out, savedKeys };
}

module.exports = {
  listMetrics,
  getMetricRecord,
  createMetric,
  updateMetric,
  deleteMetric,
  expandSavedMetrics,
};