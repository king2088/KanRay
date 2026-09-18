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
function normalizeMetrics(metrics, { dialect, fieldsByName } = {}) {
  const baseByKey = {};
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
  });
  if (!out.length) throw new HttpError(400, '至少需要一个指标');
  return out;
}

module.exports = { normalizeMetrics, buildExprSql, aggSql, AGG_FUNCS };