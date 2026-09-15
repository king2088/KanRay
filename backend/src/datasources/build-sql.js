const HttpError = require('../utils/http-error');
const d = require('./dialects');

// ETL 节点类型白名单
const NODE_TYPES = new Set([
  'source', 'join', 'filter', 'aggregate', 'output',
  'columnSelect', 'dedup', 'valueReplace', 'nullReplace', 'trim', 'sqlNode',
]);

function toFieldRef(ref, fallbackAlias) {
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

function buildCatalogIndex(catalog) {
  const idx = {};
  for (const t of catalog || []) {
    idx[`${t.schema}.${t.table}`] = t;
  }
  return idx;
}

function mapOut(r) {
  return `__${r.alias}__${r.field}`;
}

// ─── compileDetail（builder / sql 两种形态，保持不变）───────────────────

function compileDetail(def, dialect, catalog) {
  const quote = (name) => dialect.quoteIdent(String(name));

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

function compileAggExprs() { return []; }

// ─── compileEtl（递归解析器，支持多源 + 6 种新节点）──────────────────

/**
 * 编译 ETL 节点链为 SQL。
 * 返回 { nodeSql(nodeId) → { sql, params, fields } }
 * 每次 nodeSql 调用从头重建，无 memo，天然支持 DAG（叶子节点可被多处引用）。
 * @param {object} def           { type:'etl', nodes: [...] }
 * @param {object} dialect       方言对象
 * @param {Array}  catalog       [{ schema, table, columns }]
 */
function compileEtl(def, dialect, catalog) {
  const idx = buildCatalogIndex(catalog);
  const q = (n) => dialect.quoteIdent(String(n));

  const byId = {};
  (def.nodes || []).forEach((n) => { byId[n.nodeId] = n; });

  const nodeSql = (nodeId) => {
    const target = byId[nodeId];
    if (!target) throw new HttpError(404, `节点不存在: ${nodeId}`);

    // 每次调用独立的参数栈，ph() 闭包自增计数器
    const params = [];
    let counter = 0;
    const ph = () => { counter++; return dialect.placeholder(counter); };

    // wrap: 把子查询包成派生表
    const wrap = (innerSql, alias) => `(${innerSql}) ${q(alias)}`;

    // DFS 深度优先求值，返回 { sql, fields }
    const seen = new Set();          // 当前路径上的祖先，用于环检测（弹出后允许其他路径再次访问）
    const resolve = (node) => {
      if (!node) throw new HttpError(400, 'ETL 链不完整，缺少 sourceNode');
      if (seen.has(node.nodeId)) throw new HttpError(400, `ETL 环依赖: ${node.nodeId}`);
      seen.add(node.nodeId);
      try {

      switch (node.nodeType) {

        /* ───── 输入源 ───── */
        case 'source': {
          const key = `${node.schema}.${node.table}`;
          const meta = idx[key];
          const cols = (meta && meta.columns) ? meta.columns.map((c) => c.name) : null;
          const sql = cols
            ? `SELECT ${cols.map((c) => `${q(node.alias)}.${q(c)} AS ${q(mapOut({ alias: node.alias, field: c }))}`).join(', ')} FROM ${node.schema ? `${q(node.schema)}.${q(node.table)}` : q(node.table)} ${q(node.alias)}`
            : `SELECT * FROM ${node.schema ? `${q(node.schema)}.${q(node.table)}` : q(node.table)} ${q(node.alias)}`;
          const fields = cols
            ? cols.map((c) => {
              const col = (meta.columns || []).find((x) => x.name === c) || {};
              return { name: mapOut({ alias: node.alias, field: c }), label: `${node.alias}.${c}`, type: guessType(col.type) };
            })
            : [];
          return { sql, fields };
        }

        /* ───── 关联（支持 node-based 右侧输入 + 旧式 to 表） ───── */
        case 'join': {
          if (!node.sourceNode) throw new HttpError(400, 'join 节点必须指定 sourceNode');
          const left = resolve(byId[node.sourceNode]);

          // 右侧：优先 rightNodeId（节点引用），否则走旧式 to（物理表）
          let right;
          let rightCols = [];
          let rightAlias = node.to?.alias || 'jr';
          let onList;

          if (node.rightNodeId) {
            right = resolve(byId[node.rightNodeId]);
            rightAlias = byId[node.rightNodeId]?.alias || rightAlias;
            rightCols = right.fields.map((f) => ({ name: f.name, label: f.label, type: f.type }));
            onList = (node.on || []).map((o) => {
              const a = toFieldRef(o.from, null);
              const b = toFieldRef(o.to, null);
              return `${q(mapOut(a))} = ${q(mapOut(b))}`;
            });
          } else if (node.to?.schema || node.to?.table) {
            // 旧式 join（向后兼容）：右侧为物理表
            const key = `${node.to.schema}.${node.to.table}`;
            const meta = idx[key];
            const newCols = (meta && meta.columns) ? meta.columns.map((c) => c.name) : [];
            right = {
              sql: node.to.schema ? `${q(node.to.schema)}.${q(node.to.table)} ${q(rightAlias)}` : `${q(node.to.table)} ${q(rightAlias)}`,
              fields: newCols.map((c) => {
                const col = (meta.columns || []).find((x) => x.name === c) || {};
                return { name: mapOut({ alias: rightAlias, field: c }), label: `${rightAlias}.${c}`, type: guessType(col.type) };
              }),
            };
            rightCols = right.fields;
            // 旧式 ON：左侧用 __leftAlias__field，右侧直接用 toAlias.field（物理表别名）
            onList = (node.on || []).map((o) => {
              const a = toFieldRef(o.from, null);
              const b = toFieldRef(o.to, null);
              return `${q(mapOut(a))} = ${q(rightAlias)}.${q(b.field)}`;
            });
          } else {
            throw new HttpError(400, 'join 节点必须指定 rightNodeId 或 to.schema/to.table');
          }

          const jtOverride = node.joinType || (node.on && node.on[0] && node.on[0].joinType);
          const jt = jtOverride === 'right' ? 'RIGHT JOIN' : (jtOverride === 'left' ? 'LEFT JOIN' : 'JOIN');

          const fields = [...left.fields, ...rightCols];
          const rightSql = node.rightNodeId ? wrap(right.sql, 'jr') : right.sql;
          const sql = `SELECT ${fields.map((f) => q(f.name)).join(', ')} FROM ${wrap(left.sql, 'j0')} ${jt} ${rightSql} ON ${onList.join(' AND ')}`;
          return { sql, fields };
        }

        /* ───── 过滤 ───── */
        case 'filter': {
          if (!node.sourceNode) throw new HttpError(400, 'filter 节点必须指定 sourceNode');
          const prev = resolve(byId[node.sourceNode]);
          const preds = (node.conditions || []).map((c) => {
            const r = toFieldRef(c.field, null);
            const col = `${q(mapOut(r))}`;
            const op = { eq: '=', ne: '!=', lt: '<', lte: '<=', gt: '>', gte: '>=', contains: 'LIKE' }[c.op];
            if (!op) throw new HttpError(400, `不支持的筛选操作: ${c.op}`);
            if (c.op === 'contains') { params.push(`%${c.value}%`); return `${col} LIKE ${ph()}`; }
            params.push(c.value);
            return `${col} ${op} ${ph()}`;
          });
          const sql = `SELECT * FROM ${wrap(prev.sql, 'f0')} WHERE ${preds.join(' AND ')}`;
          return { sql, fields: [...prev.fields] };
        }

        /* ───── 聚合 ───── */
        case 'aggregate': {
          if (!node.sourceNode) throw new HttpError(400, 'aggregate 节点必须指定 sourceNode');
          const prev = resolve(byId[node.sourceNode]);
          const dims = (node.groupBy || []).map((g, i) => {
            const r = toFieldRef(g, null);
            return { out: q(mapOut(r)), dim: `d_${i}` };
          });
          const metricSqls = (node.metrics || []).map((m, i) => {
            const fn = (dialect.agg && dialect.agg[m.agg]) || { sum: 'SUM', avg: 'AVG', count: 'COUNT', max: 'MAX', min: 'MIN' }[m.agg] || 'COUNT';
            if (m.agg === 'count') return `COUNT(*) AS ${q(`m_${i}`)}`;
            const r = m && typeof m === 'object' && (m.alias || m.source) && m.field !== undefined
              ? { alias: m.alias || m.source, field: m.field }
              : toFieldRef(m.field || m.source, null);
            const col = q(mapOut(r));
            if (m.agg === 'count_distinct') return `${fn.includes('(') ? `${fn} ` : `${fn}(`}${col}) AS ${q(`m_${i}`)}`;
            return `${fn}(${col}) AS ${q(`m_${i}`)}`;
          });
          const fields = [
            ...dims.map((d) => ({ name: d.dim, label: d.dim, type: 'string' })),
            ...(node.metrics || []).map((m, i) => ({ name: `m_${i}`, label: m.label || `${m.field}(${m.agg})`, type: 'number' })),
          ];
          const sql = `SELECT ${dims.map((d) => `${d.out} AS ${q(d.dim)}`).concat(metricSqls).join(', ')} FROM ${wrap(prev.sql, 'a0')}${dims.length ? ` GROUP BY ${dims.map((d) => d.out).join(', ')}` : ''}`;
          return { sql, fields };
        }

        /* ───── 选择列 ───── */
        case 'columnSelect': {
          if (!node.sourceNode) throw new HttpError(400, 'columnSelect 节点必须指定 sourceNode');
          const prev = resolve(byId[node.sourceNode]);
          const cols = (node.columns || []).map((c) => {
            const r = toFieldRef(c, null);
            const matched = prev.fields.find((f) => f.name === mapOut(r)) || {};
            return { col: mapOut(r), label: matched.label || `${r.alias}.${r.field}`, type: matched.type || 'string' };
          });
          if (!cols.length) throw new HttpError(400, '选择列至少选一列');
          const sql = `SELECT ${cols.map((c) => `${q(c.col)}`).join(', ')} FROM ${wrap(prev.sql, 'cs0')}`;
          return { sql, fields: cols.map((c) => ({ name: c.col, label: c.label, type: c.type })) };
        }

        /* ───── 去重 ───── */
        case 'dedup': {
          if (!node.sourceNode) throw new HttpError(400, 'dedup 节点必须指定 sourceNode');
          const prev = resolve(byId[node.sourceNode]);
          const dedupCols = node.columns || [];
          let sql;
          let fields;
          if (dedupCols.length) {
            const refs = dedupCols.map((c) => {
              const r = toFieldRef(c, null);
              const matched = prev.fields.find((f) => f.name === mapOut(r)) || {};
              return { name: mapOut(r), label: matched.label || `${r.alias}.${r.field}`, type: matched.type || 'string' };
            });
            sql = `SELECT DISTINCT ${refs.map((c) => q(c.name)).join(', ')} FROM ${wrap(prev.sql, 'd0')}`;
            fields = refs;
          } else {
            sql = `SELECT DISTINCT * FROM ${wrap(prev.sql, 'd0')}`;
            fields = [...prev.fields];
          }
          return { sql, fields };
        }

        /* ───── 值替换 ───── */
        case 'valueReplace': {
          if (!node.sourceNode) throw new HttpError(400, 'valueReplace 节点必须指定 sourceNode');
          const prev = resolve(byId[node.sourceNode]);
          const mappings = node.mappings || [];  // [{ field:{alias,field}, from, to }]
          const sqlParts = prev.fields.map((f) => {
            const mapping = mappings.find((m) => mapOut(toFieldRef(m.field, null)) === f.name);
            if (mapping) {
              params.push(mapping.from, mapping.to);
              return `CASE WHEN ${q(f.name)} = ${ph()} THEN ${ph()} ELSE ${q(f.name)} END AS ${q(f.name)}`;
            }
            return q(f.name);
          });
          const sql = `SELECT ${sqlParts.join(', ')} FROM ${wrap(prev.sql, 'vr0')}`;
          return { sql, fields: [...prev.fields] };
        }

        /* ───── null 值替换 ───── */
        case 'nullReplace': {
          if (!node.sourceNode) throw new HttpError(400, 'nullReplace 节点必须指定 sourceNode');
          const prev = resolve(byId[node.sourceNode]);
          const mappings = node.mappings || [];  // [{ field:{alias,field}, to }]
          const mappedSet = new Set(mappings.map((m) => mapOut(toFieldRef(m.field, null))));
          const sqlParts = prev.fields.map((f) => {
            const mapping = mappings.find((m) => mapOut(toFieldRef(m.field, null)) === f.name);
            if (mapping) {
              params.push(mapping.to);
              return `COALESCE(${q(f.name)}, ${ph()}) AS ${q(f.name)}`;
            }
            return q(f.name);
          });
          const sql = `SELECT ${sqlParts.join(', ')} FROM ${wrap(prev.sql, 'nr0')}`;
          return { sql, fields: [...prev.fields] };
        }

        /* ───── 去空格 ───── */
        case 'trim': {
          if (!node.sourceNode) throw new HttpError(400, 'trim 节点必须指定 sourceNode');
          const prev = resolve(byId[node.sourceNode]);
          const trimCols = (node.columns || []).map((c) => mapOut(toFieldRef(c, null)));
          const trimSet = new Set(trimCols.length ? trimCols : prev.fields.map((f) => f.name));
          const trimFn = dialect.trim || ((name) => `TRIM(${name})`);
          const sqlParts = prev.fields.map((f) => {
            if (trimSet.has(f.name)) {
              return `${trimFn(q(f.name))} AS ${q(f.name)}`;
            }
            return q(f.name);
          });
          const sql = `SELECT ${sqlParts.join(', ')} FROM ${wrap(prev.sql, 'tr0')}`;
          return { sql, fields: [...prev.fields] };
        }

        /* ───── 自定义 SQL ───── */
        case 'sqlNode': {
          const raw = String(node.sql || '').trim();
          if (!raw) throw new HttpError(400, 'sqlNode SQL 不能为空');
          if (!/^\s*(SELECT|WITH)\b/i.test(raw)) throw new HttpError(400, 'sqlNode SQL 仅允许 SELECT/WITH 只读语句');
          if (node.sourceNode) {
            const prev = resolve(byId[node.sourceNode]);
            // 把 __etl_prev 替换为 (prevSql)
            const sql = raw.replace(/\b__etl_prev\b/g, `(${prev.sql})`);
            return { sql, fields: [...prev.fields] };
          }
          // 无上游：直接执行原始 SQL（引用真实表）
          return { sql: raw, fields: (node.fields || []).map((f, i) => ({ name: f.name || `col_${i}`, label: f.label || f.name || `列 ${i + 1}`, type: f.type || 'string' })) };
        }

        /* ───── 输出 ───── */
        case 'output': {
          if (!node.sourceNode) throw new HttpError(400, 'output 节点必须指定 sourceNode');
          const prev = resolve(byId[node.sourceNode]);
          const limit = Math.max(1, Number(node.limit) || 1000);
          const sql = dialect.limit ? dialect.limit(prev.sql, limit) : `${prev.sql} LIMIT ${limit}`;
          return { sql, fields: [...prev.fields] };
        }

        default:
          throw new HttpError(400, `未知节点类型: ${node.nodeType}`);
      }
      } finally {
        seen.delete(node.nodeId);
      }
    };

    const result = resolve(target);
    return { sql: result.sql, params: [...params], fields: [...result.fields] };
  };

  return { nodeSql };
}

// ─── buildUpsert（同步模式：六方言 upsert 生成器）──────────────────────

function buildUpsert(table, columns, pkColumns, dialect) {
  if (!pkColumns || pkColumns.length === 0) throw new HttpError(400, '增量同步需要主键字段(primary_key)');
  const q = dialect.quoteIdent;
  const colList = columns.map(q).join(', ');
  const placeholders = columns.map((_, i) => dialect.placeholder(i + 1)).join(', ');

  if (dialect.upsertSyntax === 'dup') {
    const updates = columns.filter((c) => !pkColumns.includes(c)).map((c) => `${q(c)} = VALUES(${q(c)})`).join(', ');
    return `INSERT INTO ${q(table)} (${colList}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`;
  }

  if (dialect.upsertSyntax === 'conflict') {
    const ref = dialect === d.sqlite ? 'excluded' : 'EXCLUDED';
    const set = columns.filter((c) => !pkColumns.includes(c)).map((c) => `${q(c)} = ${ref}.${q(c)}`).join(', ');
    const conflict = dialect === d.sqlite ? `ON CONFLICT(${pkColumns.map(q).join(', ')})` : `ON CONFLICT (${pkColumns.map(q).join(', ')})`;
    return `INSERT INTO ${q(table)} (${colList}) VALUES (${placeholders}) ${conflict} DO UPDATE SET ${set}`;
  }

  if (dialect.upsertSyntax === 'merge') {
    const cols = columns.map(q).join(', ');
    const srcCols = columns.map((c) => `S.${q(c)}`).join(', ');
    const pairs = pkColumns.map((c) => `T.${q(c)} = S.${q(c)}`).join(' AND ');
    const set = columns.filter((c) => !pkColumns.includes(c)).map((c) => `${q(c)} = S.${q(c)}`).join(', ');
    if (dialect === d.mssql) {
      const svals = columns.map((_, i) => `@p${i}`).join(', ');
      return `MERGE INTO ${q(table)} AS T USING (VALUES (${svals})) AS S (${cols}) ON ${pairs} WHEN MATCHED THEN UPDATE SET ${set} WHEN NOT MATCHED THEN INSERT (${cols}) VALUES (${srcCols});`;
    }
    const svals = columns.map((c, i) => `:${i + 1} AS ${q(c)}`).join(', ');
    return `MERGE INTO ${q(table)} T USING (SELECT ${svals} FROM DUAL) S ON (${pairs}) WHEN MATCHED THEN UPDATE SET ${set} WHEN NOT MATCHED THEN INSERT (${cols}) VALUES (${srcCols})`;
  }

  throw new HttpError(500, `方言不支持 upsert: ${dialect.upsertSyntax}`);
}

module.exports = { compileDetail, compileEtl, guessType, toFieldRef, NODE_TYPES, mapOut, buildUpsert };
