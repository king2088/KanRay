const HttpError = require('../utils/http-error');

// 简版 ETL 固定节点类型（顺序由 sourceNode 链决定）
const NODE_TYPES = new Set(['source', 'join', 'filter', 'aggregate', 'output']);

function toFieldRef(ref, fallbackAlias) {
  // { alias, field } 定位字段；兼容旧式半限名 "o.amount"
  if (!ref) throw new HttpError(400, '字段引用缺失');
  if (typeof ref === 'string') {
    const parts = String(ref).split('.');
    if (parts.length === 2) return { alias: parts[0], field: parts[1] };
    return { alias: fallbackAlias, field: parts[0] };
  }
  if (!ref.field) throw new HttpError(400, '字段引用缺失 field');
  return { alias: ref.alias || ref.source || fallbackAlias, field: ref.field };
}

function guessType(dbType) {
  const t = String(dbType || '').toLowerCase();
  if (/int|decimal|numeric|double|float|bigint|smallint|tinyint|number|real|money/.test(t)) return 'number';
  if (/date|time|timestamp|datetime/.test(t)) return 'date';
  if (/bool/.test(t)) return 'boolean';
  return 'string';
}

/**
 * 解析目录元数据为 { 'schema.table' -> { columns: [ {name,type,role} ] } }
 */
function buildCatalogIndex(catalog) {
  const idx = {};
  for (const t of catalog || []) {
    idx[`${t.schema}.${t.table}`] = t;
  }
  return idx;
}

/**
 * 编译明细宽表 SQL。
 * @param {object} def build_definition
 * @param {object} dialect 方言
 * @param {Array} catalog [{ schema, table, columns: [{name,type,role}] }]
 * @returns {{ sql, params, fields }}
 */
function compileDetail(def, dialect, catalog) {
  const quote = (name) => dialect.quoteIdent(String(name));

  // 纯 SQL：白名单 SELECT 只读；字段来自定义 fields（前端预览后导入）
  if (def.type === 'sql') {
    const sql = String(def.sql || '').trim();
    if (!/^\s*(SELECT|WITH)\b/i.test(sql)) throw new HttpError(400, 'SQL 仅允许 SELECT/WITH 只读语句');
    const fields = (def.fields || []).map((f, i) => ({
      name: String(f.name || `col_${i}`),
      label: f.label || String(f.name || `列 ${i + 1}`),
      type: f.type || 'string',
    }));
    return { sql, params: [], fields };
  }

  // builder：FROM 主表 + JOIN 表 + 可选聚合
  const tables = (def.tables || []).map((t, i) => ({
    alias: t.alias || `t${i}`, schema: t.schema || null, table: t.table, index: i,
  }));
  if (tables.length === 0) throw new HttpError(400, '至少需要一张表');
  const byAlias = {};
  tables.forEach((t) => { byAlias[t.alias] = t; });

  const qualified = (t) => (t.schema ? `${quote(t.schema)}.${quote(t.table)}` : quote(t.table));

  const selectFields = (def.fields && def.fields.length ? def.fields : []);
  const fromParts = [`${qualified(tables[0])} ${quote(tables[0].alias)}`];
  (def.joins || []).forEach((j) => {
    const from = toFieldRef(j.from, tables[0].alias);
    const to = toFieldRef(j.to, null);
    const jt = (j.type === 'left' ? 'LEFT ' : j.type === 'right' ? 'RIGHT ' : '') + 'JOIN';
    const target = byAlias[to.alias];
    if (!target) throw new HttpError(400, `关联目标别名不存在: ${to.alias}`);
    fromParts.push(`${jt} ${qualified(target)} ${quote(to.alias)} ON ${quote(from.alias)}.${quote(from.field)} = ${quote(to.alias)}.${quote(to.field)}`);
  });

  // 明细输出列
  const params = [];
  const colRefs = selectFields.map((f, i) => {
    const r = f && typeof f === 'object'
      ? { alias: f.alias || f.source || tables[0].alias, field: f.field }
      : toFieldRef(f, tables[0].alias);
    const t = byAlias[r.alias];
    if (!t) throw new HttpError(400, `字段别名不存在: ${r.alias}`);
    return { alias: `f_${i}`, sql: `${quote(r.alias)}.${quote(r.field)}`, label: f.label || r.field, type: f.type || 'string' };
  });
  const whereSql = buildWhere(def.filters, dialect, byAlias, params);

  let sql = `SELECT ${colRefs.map((c) => `${c.sql} AS ${quote(c.alias)}`).join(', ')} FROM ${fromParts.join(' ')}${whereSql.where ? ` ${whereSql.where}` : ''}`;

  // 聚合
  const agg = def.aggregation && (def.aggregation.groupBy || def.aggregation.metrics) ? def.aggregation : null;
  if (agg) {
    const dims = (agg.groupBy || []).map((g, i) => {
      const r = toFieldRef(g, tables[0].alias);
      const t = byAlias[r.alias];
      if (!t) throw new HttpError(400, `字段别名不存在: ${r.alias}`);
      return { ref: r, dim: `d_${i}` };
    });
    const metricSql = (agg.metrics || []).map((m, i) => {
      const fn = (dialect.agg && dialect.agg[m.agg]) || { sum: 'SUM', avg: 'AVG', count: 'COUNT', max: 'MAX', min: 'MIN', count_distinct: 'COUNT(DISTINCT' }[m.agg] || 'COUNT';
      if (m.agg === 'count') return `COUNT(*) AS ${quote('m_' + i)}`;
      const r = m && typeof m === 'object' && m.field !== undefined
        ? { alias: m.alias || m.source || tables[0].alias, field: m.field }
        : toFieldRef(m.field || m.source, tables[0].alias);
      const t = byAlias[r.alias];
      if (!t) throw new HttpError(400, `字段别名不存在: ${r.alias}`);
      let expr;
      if (m.agg === 'count_distinct') expr = `${fn.includes('(') ? `${fn} ` : `${fn}(`}${quote(r.alias)}.${quote(r.field)})`;
      else expr = `${fn}(${quote(r.alias)}.${quote(r.field)})`;
      return `${expr} AS ${quote('m_' + i)}`;
    });
    const dimSel = dims.map((d, i) => `${quote(d.ref.alias)}.${quote(d.ref.field)} AS ${quote(`d_${i}`)}`);
    sql = `SELECT ${[...dimSel, ...metricSql].join(', ')} FROM ${fromParts.join(' ')}${whereSql.where ? ` ${whereSql.where}` : ''}${dims.length ? ` GROUP BY ${dims.map((d) => `${quote(d.ref.alias)}.${quote(d.ref.field)}`).join(', ')}` : ''}`;
    return {
      sql,
      params,
      fields: [
        ...dims.map((d, i) => ({ name: `d_${i}`, label: `${d.ref.alias}.${d.ref.field}`, type: 'string' })),
        ...(agg.metrics || []).map((m, i) => ({ name: `m_${i}`, label: m.label || `${m.field}(${m.agg})`, type: 'number' })),
      ],
    };
  }
  const n = Number(def.limit);
  if (Number.isFinite(n) && n > 0) sql = dialect.limit ? dialect.limit(sql, n) : `${sql} LIMIT ${n}`;
  return { sql, params, fields: colRefs.map((c) => ({ name: c.alias, label: c.label, type: c.type })) };
}

/** 构建 WHERE 子句（仅 detail 前置筛选；聚合自带 groupBy）——占位符通用实现 */
function buildWhere(filters, dialect, byAlias, params) {
  const clauses = [];
  const ph = dialect.placeholder;
  for (const f of filters || []) {
    const r = toFieldRef(f.field || f, null);
    const t = byAlias[r.alias];
    if (!t) throw new HttpError(400, `筛选字段别名不存在: ${r.alias}`);
    const col = `${dialect.quoteIdent(r.alias)}.${dialect.quoteIdent(r.field)}`;
    const op = { eq: '=', ne: '!=', lt: '<', lte: '<=', gt: '>', gte: '>=', contains: 'LIKE', in: 'IN' }[f.op];
    if (!op) throw new HttpError(400, `不支持的筛选操作: ${f.op}`);
    if (f.op === 'in') {
      const arr = Array.isArray(f.value) ? f.value : [];
      if (!arr.length) continue;
      const marks = arr.map((v) => { params.push(v); return ph(params.length); });
      clauses.push(`${col} IN (${marks.join(', ')})`);
    } else {
      if (f.value === null || f.value === undefined || f.value === '') continue;
      params.push(f.op === 'contains' ? `%${f.value}%` : f.value);
      clauses.push(`${col} ${op} ${ph(params.length)}`);
    }
  }
  return clauses.length ? { where: `WHERE ${clauses.join(' AND ')}` } : { where: '' };
}

function compileAggExprs(def, dialect, byAlias, agg, params) {
  return []; // 占位（本文件聚合统一走 compileDetail 内联逻辑；保留以供扩展）
}

/**
 * 编译 ETL 节点链（源 → join → filter → aggregate → output）。
 * 链式累积：每个节点在上一节点 SELECT 结果上变换。
 * @returns { node => {sql, params, fields} }
 */
function compileEtl(def, dialect, catalog) {
  const idx = buildCatalogIndex(catalog);
  const ph = dialect.placeholder;
  const q = (n) => dialect.quoteIdent(String(n));

  let currentSql = null;
  let currentFields = [];       // { name, label, type }
  let params = [];

  const byId = {};
  (def.nodes || []).forEach((n) => { byId[n.nodeId] = n; });

  const walk = (node) => {
    const prev = node.sourceNode ? byId[node.sourceNode] : null;
    const wrap = (innerSql, alias) => `(${innerSql}) ${q(alias)}`;
    switch (node.nodeType) {
      case 'source': {
        const key = `${node.schema}.${node.table}`;
        const meta = idx[key];
        const cols = (meta && meta.columns) ? meta.columns.map((c) => c.name) : null;
        if (cols) {
          const exprs = cols.map((c) => `${q(node.alias)}.${q(c)} AS ${q(`__${node.alias}__${c}`)}`);
          currentSql = `SELECT ${exprs.join(', ')} FROM ${node.schema ? `${q(node.schema)}.${q(node.table)}` : q(node.table)} ${q(node.alias)}`;
          currentFields = cols.map((c) => {
            const col = (meta.columns || []).find((x) => x.name === c) || {};
            return { name: `__${node.alias}__${c}`, label: `${node.alias}.${c}`, type: guessType(col.type) };
          });
        } else {
          currentSql = `SELECT * FROM ${node.schema ? `${q(node.schema)}.${q(node.table)}` : q(node.table)} ${q(node.alias)}`;
          currentFields = [];
        }
        break;
      }
      case 'join': {
        if (!prev) throw new HttpError(400, 'join 节点必须指定 sourceNode');
        const key = `${node.to.schema}.${node.to.table}`;
        const meta = idx[key];
        const newCols = (meta && meta.columns) ? meta.columns.map((c) => c.name) : [];
        const newExprs = newCols.map((c) => `${q(node.to.alias)}.${q(c)} AS ${q(`__${node.to.alias}__${c}`)}`);
        const onList = (node.on || []).map((o) => {
          const a = toFieldRef(o.from, null);
          const b = toFieldRef(o.to, null);
          return `${q(mapOut(a))} = ${q(node.to.alias)}.${q(b.field)}`;
        });
        const jt = (node.on && node.on[0] && node.on[0].joinType === 'left') ? 'LEFT JOIN' : 'JOIN';
        const prevFields = [...currentFields];
        currentFields = [...currentFields, ...newCols.map((c) => {
          const col = (meta.columns || []).find((x) => x.name === c) || {};
          return { name: `__${node.to.alias}__${c}`, label: `${node.to.alias}.${c}`, type: guessType(col.type) };
        })];
        currentSql = `SELECT ${[...prevFields.map((f) => q(f.name)), ...newExprs].join(', ')} FROM ${wrap(currentSql, 'j0')} ${jt} ${node.to.schema ? `${q(node.to.schema)}.${q(node.to.table)}` : q(node.to.table)} ${q(node.to.alias)} ON ${onList.join(' AND ')}`;
        break;
      }
      case 'filter': {
        if (!prev) throw new HttpError(400, 'filter 节点必须指定 sourceNode');
        const preds = (node.conditions || []).map((c) => {
          const r = toFieldRef(c.field, null);
          if (!r.alias) throw new HttpError(400, '筛选字段缺少别名');
          const col = `${q(mapOut(r))}`;
          const op = { eq: '=', ne: '!=', lt: '<', lte: '<=', gt: '>', gte: '>=', contains: 'LIKE' }[c.op];
          if (!op) throw new HttpError(400, `不支持的筛选操作: ${c.op}`);
          if (c.op === 'contains') { params.push(`%${c.value}%`); return `${col} LIKE ${ph(params.length)}`; }
          params.push(c.value);
          return `${col} ${op} ${ph(params.length)}`;
        });
        currentSql = `SELECT * FROM ${wrap(currentSql, 'f0')} WHERE ${preds.join(' AND ')}`;
        currentFields = [...currentFields];
        break;
      }
      case 'aggregate': {
        if (!prev) throw new HttpError(400, 'aggregate 节点必须指定 sourceNode');
        const dims = (node.groupBy || []).map((g, i) => {
          const r = toFieldRef(g, null);
          return { out: q(mapOut(r)), dim: `d_${i}` };
        });
        const metricSqls = (node.metrics || []).map((m, i) => {
          const fn = (dialect.agg && dialect.agg[m.agg]) || { sum: 'SUM', avg: 'AVG', count: 'COUNT', max: 'MAX' }[m.agg] || 'COUNT';
          if (m.agg === 'count') return `COUNT(*) AS ${q(`m_${i}`)}`;
          const r = m && typeof m === 'object' && (m.alias || m.source) && m.field !== undefined
            ? { alias: m.alias || m.source, field: m.field }
            : toFieldRef(m.field || m.source, null);
          const col = q(mapOut(r));
          if (m.agg === 'count_distinct') return `${fn.includes('(') ? `${fn} ` : `${fn}(`}${col}) AS ${q(`m_${i}`)}`;
          return `${fn}(${col}) AS ${q(`m_${i}`)}`;
        });
        currentFields = [
          ...dims.map((d) => ({ name: d.dim, label: d.dim, type: 'string' })),
          ...(node.metrics || []).map((m, i) => ({ name: `m_${i}`, label: m.label || `${m.field}(${m.agg})`, type: 'number' })),
        ];
        currentSql = `SELECT ${dims.map((d) => `${d.out} AS ${q(d.dim)}`).concat(metricSqls).join(', ')} FROM ${wrap(currentSql, 'a0')}${dims.length ? ` GROUP BY ${dims.map((d) => d.out).join(', ')}` : ''}`;
        break;
      }
      case 'output': {
        if (!prev) throw new HttpError(400, 'output 节点必须指定 sourceNode');
        const limit = Math.max(1, Number(node.limit) || 1000);
        currentSql = dialect.limit ? dialect.limit(currentSql, limit) : `${currentSql} LIMIT ${limit}`;
        break;
      }
      default:
        throw new HttpError(400, `未知节点类型: ${node.nodeType}`);
    }
    return currentSql;
  };

  const nodeSql = (nodeId) => {
    const target = byId[nodeId];
    if (!target) throw new HttpError(404, `节点不存在: ${nodeId}`);
    // 重建链（从链头依次应用）
    const chain = [];
    let cur = target;
    while (cur) {
      chain.unshift(cur);
      if (!cur.sourceNode) break;
      cur = byId[cur.sourceNode];
    }
    params = [];
    for (const n of chain) walk(n);
    return { sql: currentSql, params: [...params], fields: [...currentFields] };
  };

  return { nodeSql };
}

function mapOut(r) {
  return `__${r.alias}__${r.field}`;
}

module.exports = { compileDetail, compileEtl, guessType, toFieldRef, NODE_TYPES };