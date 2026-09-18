const HttpError = require('../utils/http-error');

const AGG_FUNCS = {
  sum: 'SUM',
  avg: 'AVG',
  count: 'COUNT',
  count_distinct: 'COUNT(DISTINCT',
  max: 'MAX',
  min: 'MIN',
};

// 复合指标公式白名单：引用去除后，只允许 数字/括号/基础运算符/百分比/空白
const FORMULA_REMAINDER = /^[0-9+\-*/().%\s]*$/;
const TOKEN_RE = /\$([A-Za-z_][A-Za-z0-9_]*)/g;

// 衍生指标类型：全部在 JS 后处理层计算（规避跨方言窗口函数）
const DERIVED_KINDS = ['share', 'mom', 'yoy', 'cumsum', 'rank'];
const DERIVED_KIND_LABEL = { share: '占比', mom: '环比', yoy: '同比', cumsum: '累计', rank: '排名' };
// yoy 同比按首维度时间粒度取移位数（月/季/年/周）；day 与未聚合日期无法稳定同比 → null + 警告
const YOY_SHIFT = { month: 12, quarter: 4, year: 1, week: 52 };

/** 单个基础聚合的 SQL 片段（count 忽略字段；count_distinct 兼容 CH 的 uniqExact 形态） */
function aggSql(dialect, field, agg) {
  if (agg === 'count') return `${dialect.agg.count}(*)`;
  if (agg === 'count_distinct') {
    return dialect.agg.count_distinct === 'COUNT(DISTINCT'
      ? `COUNT(DISTINCT ${dialect.quoteIdent(field)})`
      : `${dialect.agg.count_distinct}(${dialect.quoteIdent(field)})`;
  }
  if (!dialect.agg[agg]) throw new HttpError(400, `不支持的聚合: ${agg}`);
  return `${dialect.agg[agg]}(${dialect.quoteIdent(field)})`;
}

/**
 * 展开复合指标公式：把 $key 替换为其前序普通指标（base）的完整聚合 SQL。
 * 校验：仅可引用 base 指标；未引用/引用非 base → 400；禁止字母混入（防注入）。
 * 被引用的聚合以 *1.0 提升为浮点，避免 SQLite/Postgres/MSSQL 下整数除法截断。
 */
function buildExprSql(expr, baseByKey) {
  const raw = String(expr || '').trim();
  if (!raw) throw new HttpError(400, '复合指标公式不能为空');
  const remainder = raw.replace(TOKEN_RE, '');
  if (!FORMULA_REMAINDER.test(remainder)) {
    throw new HttpError(400, '公式仅支持引用普通指标($key)以及数字、+ - * / ( ) %');
  }
  return raw.replace(TOKEN_RE, (all, key) => {
    const base = baseByKey[key];
    if (!base) throw new HttpError(400, `公式引用了不可用的指标 "${key}"（只可引用其前的普通指标）`);
    return `(${base.sqlExpr}) * 1.0`;
  });
}

/**
 * 图表级指标归一化：产出可直接构造 SQL 的统一指标集合。
 * - base 普通指标：agg(field)，沿用原语义；fieldsByName 传入时校验字段存在
 * - expr 复合指标：公式 $key 引用其前的普通指标，展开为完整 SQL 表达式（同一 SELECT 层内自包含）
 * @param {Array} metrics
 * @param {object} opts { dialect, fieldsByName? }
 */
/**
 * 图表级指标归一化：产出可直接构造 SQL 的统一指标集合。
 * - base 普通指标：agg(field)，沿用原语义；fieldsByName 传入时校验字段存在
 * - expr 复合指标：公式 $key 引用其前的普通指标，展开为完整 SQL 表达式（同一 SELECT 层内自包含）
 * - derived 衍生指标：share/mom/yoy/cumsum/rank，无 SQL 表达式（sqlExpr=null），由 applyDerived 后处理
 * @param {Array} metrics
 * @param {object} opts { dialect, fieldsByName?, dimensionCount? }
 */
function normalizeMetrics(metrics, { dialect, fieldsByName, dimensionCount = 0 } = {}) {
  const baseByKey = {};
  const byKey = {};
  const out = [];
  (metrics || []).forEach((raw, i) => {
    const key = raw.key || `m${i}`;
    const alias = `_m${i}`;
    if (raw.type === 'expr') {
      out.push({
        key,
        kind: 'expr',
        field: key,
        agg: 'expr',
        expr: raw.expr,
        label: raw.label || raw.expr || `公式${i + 1}`,
        sqlExpr: buildExprSql(raw.expr, baseByKey),
        alias,
      });
      byKey[key] = out[out.length - 1];
      return;
    }

    if (raw.type === 'derived') {
      const derivedKind = raw.kind;
      if (!DERIVED_KINDS.includes(derivedKind)) {
        throw new HttpError(400, `不支持的衍生类型: ${derivedKind}（支持 share/mom/yoy/cumsum/rank）`);
      }
      const refKey = raw.ref;
      if (!refKey) throw new HttpError(400, '衍生指标需引用其前的普通/复合指标');
      const refEntry = byKey[refKey];
      if (!refEntry) {
        throw new HttpError(400, `衍生指标引用了不可用的指标 "${refKey}"（只可引用其前的普通/复合指标）`);
      }
      if (dimensionCount === 0) {
        throw new HttpError(400, `衍生指标(${derivedKind})需要至少一个维度`);
      }
      out.push({
        key,
        kind: 'derived',
        derivedKind,
        ref: refKey,
        field: key,
        agg: derivedKind,
        label: raw.label || `${refEntry.label} · ${DERIVED_KIND_LABEL[derivedKind]}`,
        sqlExpr: null,
        alias: null,
      });
      return;
    }

    const agg = raw.agg || 'count';
    if (fieldsByName) {
      const isStar = raw.field === '*' && agg === 'count';
      const f = isStar ? { name: '*', label: '数据行数' } : fieldsByName[raw.field];
      if (!f) throw new HttpError(400, `指标字段不存在: ${raw.field}`);
      const norm = {
        key, kind: 'base', field: f.name, agg,
        label: raw.label || `${f.label}(${agg})`,
        sqlExpr: aggSql(dialect, f.name, agg), alias,
      };
      out.push(norm);
      baseByKey[key] = norm;
      byKey[key] = norm;
      return;
    }

    const field = raw.field || '';
    if (!field) throw new HttpError(400, '指标字段不能为空');
    const norm = {
      key, kind: 'base', field, agg,
      label: raw.label || field || `指标${i + 1}`,
      sqlExpr: aggSql(dialect, field, agg), alias,
    };
    out.push(norm);
    baseByKey[key] = norm;
    byKey[key] = norm;
  });
  if (!out.length) throw new HttpError(400, '至少需要一个指标');
  return out;
}

const toNum = (x) => {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  return Number.isNaN(n) ? null : n;
};

function setDerived(row, def, value) {
  row[def.key] = value;
  row[`metric:${def.key}`] = { label: def.label, agg: def.derivedKind, value };
}

/**
 * 衍生指标后处理：对聚合结果行纯 JS 计算 share/mom/yoy/cumsum/rank。
 * - 首维度为排序依据；含 mom/yoy/cumsum 时结果行按首维度升序重排（时序语义前提）
 * - ref 源值取自输出行 row[ref.key]（SQL 指标已写入该键）
 * @param {Array} rows 输出行（会被原地补充衍生列；时序类会重排数组）
 * @param {Array} dimensions [{ field, granularity }]
 * @param {Array} defs normalizeMetrics 产出的 derived 条目
 */
function applyDerived(rows, dimensions, defs) {
  const warnings = [];
  if (!defs || !defs.length) return { rows, warnings };
  const firstDim = dimensions[0];
  const timeLike = defs.some((d) => d.derivedKind === 'mom' || d.derivedKind === 'yoy' || d.derivedKind === 'cumsum');
  let ordered = rows;
  if (timeLike && firstDim) {
    const rawKey = firstDim.field;
    ordered = [...rows].sort((a, b) => {
      const av = a[rawKey];
      const bv = b[rawKey];
      if (av == null) return 1;
      if (bv == null) return -1;
      const an = Number(av);
      const bn = Number(bv);
      if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
      return String(av) < String(bv) ? -1 : 1;
    });
    rows.length = 0;
    rows.push(...ordered);
  }

  for (const def of defs) {
    const src = (row) => toNum(row[def.ref]);
    switch (def.derivedKind) {
      case 'share': {
        const groupIdx = dimensions.length >= 2 ? 1 : -1;
        const totals = new Map();
        let grand = 0;
        for (const r of ordered) {
          const v = src(r) || 0;
          if (groupIdx < 0) {
            grand += v;
            continue;
          }
          const g = String(r[dimensions[groupIdx].field] ?? '__null__');
          totals.set(g, (totals.get(g) || 0) + v);
        }
        for (const r of ordered) {
          const v = src(r);
          const total = groupIdx < 0 ? grand : totals.get(String(r[dimensions[groupIdx].field] ?? '__null__')) || 0;
          setDerived(r, def, v == null || total === 0 ? null : v / total);
        }
        break;
      }
      case 'rank': {
        const idx = ordered.map((r) => ({ r, v: src(r) }));
        idx.sort((x, y) => {
          if (x.v == null) return 1;
          if (y.v == null) return -1;
          return y.v - x.v;
        });
        let prev = null;
        let rank = 0;
        idx.forEach((e, pos) => {
          if (e.v == null) { setDerived(e.r, def, null); return; }
          if (e.v !== prev) { rank = pos + 1; prev = e.v; }
          setDerived(e.r, def, rank);
        });
        break;
      }
      case 'mom': {
        for (let i = 0; i < ordered.length; i += 1) {
          const v = src(ordered[i]);
          const pv = i >= 1 ? src(ordered[i - 1]) : null;
          setDerived(ordered[i], def, v == null || pv == null || pv === 0 ? null : (v - pv) / pv);
        }
        break;
      }
      case 'yoy': {
        const shift = firstDim ? YOY_SHIFT[firstDim.granularity] : undefined;
        if (shift === undefined) {
          warnings.push(`同比(${def.key})需要按月/季/年/周粒度聚合，相关值已置空`);
          ordered.forEach((r) => setDerived(r, def, null));
          break;
        }
        for (let i = 0; i < ordered.length; i += 1) {
          const v = src(ordered[i]);
          const pv = i >= shift ? src(ordered[i - shift]) : null;
          setDerived(ordered[i], def, v == null || pv == null || pv === 0 ? null : (v - pv) / pv);
        }
        break;
      }
      case 'cumsum': {
        const resetKey = dimensions.length >= 2 ? dimensions[1].field : null;
        const accs = new Map();
        let accAll = 0;
        for (const r of ordered) {
          const v = src(r);
          let next = accAll;
          if (resetKey) {
            const g = String(r[resetKey] ?? '__null__');
            next = accs.get(g) || 0;
            if (v == null) { setDerived(r, def, next); continue; }
            next += v;
            accs.set(g, next);
          } else {
            if (v == null) { setDerived(r, def, accAll); continue; }
            accAll += v;
            next = accAll;
          }
          setDerived(r, def, next);
        }
        break;
      }
      default:
        break;
    }
  }
  return { rows, warnings };
}

module.exports = { normalizeMetrics, buildExprSql, aggSql, AGG_FUNCS, applyDerived, DERIVED_KINDS };