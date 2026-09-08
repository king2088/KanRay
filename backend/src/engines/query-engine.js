const db = require('../db');
const HttpError = require('../utils/http-error');
const { getDatasetOrThrow, getFieldsOrThrow } = require('../services/dataset.service');

const AGG_FUNCS = {
  sum: 'SUM',
  avg: 'AVG',
  count: 'COUNT',
  count_distinct: 'COUNT(DISTINCT',
  max: 'MAX',
  min: 'MIN',
};

const TIME_GRANULARITY = {
  day: '%Y-%m-%d',
  week: '%Y-W%W',
  month: '%Y-%m',
  year: '%Y',
};

/**
 * 校验一个指标配置
 */
function normalizeMetric(metric, fieldsByName) {
  const agg = metric.agg || 'count';
  if (!AGG_FUNCS[agg]) throw new HttpError(400, `不支持的聚合: ${agg}`);
  const field = metric.field === '*' && agg === 'count'
    ? { name: '*', label: '数据行数' }
    : fieldsByName[metric.field];
  if (!field) throw new HttpError(400, `指标字段不存在: ${metric.field}`);
  return { field: field.name, label: metric.label || `${field.label}(${agg})`, agg };
}

/**
 * 校验一个维度配置
 */
function normalizeDimension(dim, fieldsByName) {
  const field = fieldsByName[dim.field];
  if (!field) throw new HttpError(400, `维度字段不存在: ${dim.field}`);
  return {
    field: field.name,
    label: dim.label || field.label,
    granularity: dim.granularity || null,
  };
}

/**
 * 构建安全 WHERE 片段与参数
 * @param {Array} filters [{ field, op, value }]
 * @param {object} fieldsByName
 */
function buildWhere(filters, fieldsByName) {
  const clauses = [];
  const params = [];
  for (const f of filters || []) {
    const field = fieldsByName[f.field];
    if (!field) throw new HttpError(400, `筛选字段不存在: ${f.field}`);
    const col = `"${field.name}"`;
    switch (f.op) {
      case 'eq': {
        if (f.value === null || f.value === undefined || f.value === '') break;
        clauses.push(`${col} = ?`);
        params.push(f.value);
        break;
      }
      case 'ne': {
        if (f.value === null || f.value === undefined || f.value === '') break;
        clauses.push(`${col} != ?`);
        params.push(f.value);
        break;
      }
      case 'in': {
        const arr = Array.isArray(f.value) ? f.value : [];
        if (arr.length === 0) break;
        clauses.push(`${col} IN (${arr.map(() => '?').join(', ')})`);
        params.push(...arr);
        break;
      }
      case 'contains': {
        if (!f.value) break;
        clauses.push(`${col} LIKE ?`);
        params.push(`%${f.value}%`);
        break;
      }
      case 'lt':
        clauses.push(`${col} < ?`);
        params.push(f.value);
        break;
      case 'lte':
        clauses.push(`${col} <= ?`);
        params.push(f.value);
        break;
      case 'gt':
        clauses.push(`${col} > ?`);
        params.push(f.value);
        break;
      case 'gte':
        clauses.push(`${col} >= ?`);
        params.push(f.value);
        break;
      default:
        throw new HttpError(400, `不支持的筛选操作: ${f.op}`);
    }
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

/**
 * 聚合查询入口（DataProvider）
 * @param {object} query
 *  {
 *    datasetId, dimensions: [{field,label,granularity}], metrics: [{field,agg,label}],
 *    filters: [{field,op,value}], groupLimit, sortBy, sortOrder
 *  }
 */
function aggregate(query) {
  const ds = getDatasetOrThrow(query.datasetId);
  const fields = getFieldsOrThrow(query.datasetId);
  const fieldsByName = {};
  fields.forEach((f) => { fieldsByName[f.name] = f; });

  const dimensions = (query.dimensions || []).map((d) => normalizeDimension(d, fieldsByName));
  const metrics = (query.metrics || []).map((m) => normalizeMetric(m, fieldsByName));

  if (metrics.length === 0) {
    throw new HttpError(400, '至少需要一个指标');
  }

  // 时间粒度处理
  const dimSelects = [];
  const dimGroups = [];
  for (const dim of dimensions) {
    let expr;
    if (dim.granularity && TIME_GRANULARITY[dim.granularity]) {
      // 仅对日期可通过的字段启用桶化
      expr = `strftime('${TIME_GRANULARITY[dim.granularity]}', "${dim.field}")`;
    } else {
      expr = `"${dim.field}"`;
    }
    dimSelects.push(`${expr} AS __dim_${dim.field}__`);
    dimGroups.push(`__dim_${dim.field}__`);
  }

  // 指标表达式
  const metricSelects = [];
  const metricAliases = [];
  for (let i = 0; i < metrics.length; i += 1) {
    const m = metrics[i];
    let expr;
    if (m.agg === 'count') {
      expr = `COUNT(*)`;
    } else if (m.agg === 'count_distinct') {
      expr = `COUNT(DISTINCT "${m.field}")`;
    } else {
      expr = `${AGG_FUNCS[m.agg]}("${m.field}")`;
    }
    const alias = `_m${i}`;
    metricSelects.push(`${expr} AS ${alias}`);
    metricAliases.push(alias);
  }

  const { where, params } = buildWhere(query.filters, fieldsByName);

  let sql = `SELECT ${dimSelects.concat(metricSelects).join(', ')} FROM ${ds.table_name} ${where}`;

  // 分组：只有存在维度时才 GROUP BY
  if (dimGroups.length > 0) {
    sql += ` GROUP BY ${dimGroups.join(', ')}`;
  }

  // 排序：优先按用户指定的指标下标或维度列名
  if (query.sortBy !== undefined && query.sortBy !== null) {
    const sortOrder = query.sortOrder === 'desc' ? 'DESC' : 'ASC';
    if (Number.isInteger(query.sortBy)) {
      // 指标下标
      if (query.sortBy >= 0 && query.sortBy < metricAliases.length) {
        sql += ` ORDER BY ${metricAliases[query.sortBy]} ${sortOrder}`;
      }
    } else if (Array.isArray(query.sortBy)) {
      const parts = query.sortBy.map((s) => {
        if (Number.isInteger(s) && s >= 0 && s < metricAliases.length) return metricAliases[s];
        return s;
      });
      sql += ` ORDER BY ${parts.join(', ')} ${sortOrder}`;
    }
  }

  // 分组限制
  if (query.groupLimit && Number.isInteger(query.groupLimit) && query.groupLimit > 0) {
    sql += ` LIMIT ${query.groupLimit}`;
  }

  const start = Date.now();
  const results = db.prepare(sql).all(...params);
  const elapsedMs = Date.now() - start;

  // 输出归一化
  const outputRows = results.map((r) => {
    const row = {};
    dimensions.forEach((d, i) => {
      row[`dim:${d.field}`] = { label: d.label, value: r[`__dim_${d.field}__`] };
      row[d.field] = r[`__dim_${d.field}__`];
    });
    metrics.forEach((m, i) => {
      row[m.field] = r[metricAliases[i]];
      row[`metric:${m.field}`] = { label: m.label, agg: m.agg, value: r[metricAliases[i]] };
    });
    return row;
  });

  return {
    dimensions: dimensions.map((d) => ({ field: d.field, label: d.label, granularity: d.granularity })),
    metrics: metrics.map((m) => ({ field: m.field, agg: m.agg, label: m.label })),
    rows: outputRows,
    elapsedMs,
    sql,
  };
}

module.exports = { aggregate, AGG_FUNCS, TIME_GRANULARITY };
