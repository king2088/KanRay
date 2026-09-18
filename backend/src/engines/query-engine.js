const db = require('../db');
const HttpError = require('../utils/http-error');
const { getDatasetOrThrow, getFieldsOrThrow } = require('../services/dataset.service');
const sqlDataProvider = require('../datasources/sql-data-provider');
const { normalizeMetrics, applyDerived, AGG_FUNCS } = require('./metrics');

const TIME_GRANULARITY = {
  day: '%Y-%m-%d',
  week: '%Y-W%W',
  month: '%Y-%m',
  year: '%Y',
};

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
  let ph = 0;
  const p = () => db.dialect.placeholder(++ph);
  for (const f of filters || []) {
    const field = fieldsByName[f.field];
    if (!field) throw new HttpError(400, `筛选字段不存在: ${f.field}`);
    const col = db.dialect.quoteIdent(field.name);
    switch (f.op) {
      case 'eq': {
        if (f.value === null || f.value === undefined || f.value === '') break;
        clauses.push(`${col} = ${p()}`);
        params.push(f.value);
        break;
      }
      case 'ne': {
        if (f.value === null || f.value === undefined || f.value === '') break;
        clauses.push(`${col} != ${p()}`);
        params.push(f.value);
        break;
      }
      case 'in': {
        const arr = Array.isArray(f.value) ? f.value : [];
        if (arr.length === 0) break;
        clauses.push(`${col} IN (${arr.map(() => p()).join(', ')})`);
        params.push(...arr);
        break;
      }
      case 'contains': {
        if (!f.value) break;
        clauses.push(`${col} LIKE ${p()}`);
        params.push(`%${f.value}%`);
        break;
      }
      case 'lt':
        clauses.push(`${col} < ${p()}`);
        params.push(f.value);
        break;
      case 'lte':
        clauses.push(`${col} <= ${p()}`);
        params.push(f.value);
        break;
      case 'gt':
        clauses.push(`${col} > ${p()}`);
        params.push(f.value);
        break;
      case 'gte':
        clauses.push(`${col} >= ${p()}`);
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
async function aggregate(query) {
  const ds = await getDatasetOrThrow(query.datasetId);

  // SQL 数据集走 SqlDataProvider
  if (ds.source_type === 'sql') {
    return sqlDataProvider.query(ds, query);
  }

  const fields = await getFieldsOrThrow(query.datasetId);
  const fieldsByName = {};
  fields.forEach((f) => { fieldsByName[f.name] = f; });
const dimensions = (query.dimensions || []).map((d) => normalizeDimension(d, fieldsByName));
  const metrics = normalizeMetrics(query.metrics, { dialect: db.dialect, fieldsByName, dimensionCount: dimensions.length });

  if (metrics.length === 0) {
    throw new HttpError(400, '至少需要一个指标');
  }

  // 时间粒度处理（按当前 store 方言生成）
  const d = db.dialect;

  const dimSelects = [];
  const dimGroups = [];
  for (const dim of dimensions) {
    let expr;
    if (dim.granularity && TIME_GRANULARITY[dim.granularity]) {
      // 仅对日期可通过的字段启用桶化
      expr = d.dateTrunc(dim.field, dim.granularity);
    } else {
      expr = d.quoteIdent(dim.field);
    }
    dimSelects.push(`${expr} AS __dim_${dim.field}__`);
    dimGroups.push(`__dim_${dim.field}__`);
  }

  // 指标表达式（普通 + 复合统一由归一化提供完整 SQL 片段；衍生指标无 SQL，予以后处理）
  const sqlMetrics = metrics.filter((m) => m.sqlExpr);
  const metricSelects = [];
  const metricAliases = [];
  for (let i = 0; i < sqlMetrics.length; i += 1) {
    metricSelects.push(`${sqlMetrics[i].sqlExpr} AS ${sqlMetrics[i].alias}`);
    metricAliases.push(sqlMetrics[i].alias);
  }

  const { where, params } = buildWhere(query.filters, fieldsByName);

  let sql = `SELECT ${dimSelects.concat(metricSelects).join(', ')} FROM ${ds.table_name} ${where}`;

  // 分组：只有存在维度时才 GROUP BY
  if (dimGroups.length > 0) {
    sql += ` GROUP BY ${dimGroups.join(', ')}`;
  }

  // 排序：仅允许整数指标下标或 'dim'（首维度）；其余一律 400
  if (query.sortBy !== undefined && query.sortBy !== null) {
    const sortOrder = query.sortOrder === 'desc' ? 'DESC' : 'ASC';
    const resolveSort = (entry) => {
      if (Number.isInteger(entry) && entry >= 0 && entry < metricAliases.length) return metricAliases[entry];
      if (typeof entry === 'string' && entry === 'dim') {
        if (dimensions.length === 0) return null;
        return `__dim_${String(dimensions[0].field).replace(/"/g, '""')}__`;
      }
      throw new HttpError(400, `不支持的排序字段: ${entry}`);
    };
    let parts = [];
    if (Number.isInteger(query.sortBy)) {
      parts = [resolveSort(query.sortBy)];
    } else if (Array.isArray(query.sortBy)) {
      parts = query.sortBy.map(resolveSort).filter((x) => x !== null);
    } else if (typeof query.sortBy === 'string') {
      parts = [resolveSort(query.sortBy)].filter((x) => x !== null);
    }
    if (parts.length) sql += ` ORDER BY ${parts.join(', ')} ${sortOrder}`;
  }

  // 分组限制
  if (query.groupLimit && Number.isInteger(query.groupLimit) && query.groupLimit > 0) {
    sql = d.limit(sql, query.groupLimit);
  }

  const start = Date.now();
  const results = await db.prepare(sql).all(...params);
  const elapsedMs = Date.now() - start;

  // 输出归一化
  const outputRows = results.map((r) => {
    const row = {};
    dimensions.forEach((d, i) => {
      row[`dim:${d.field}`] = { label: d.label, value: r[`__dim_${d.field}__`] };
      row[d.field] = r[`__dim_${d.field}__`];
    });
    sqlMetrics.forEach((m, i) => {
      const v = r[metricAliases[i]];
      row[m.field] = v;
      row[m.key] = v;
      row[`metric:${m.field}`] = { label: m.label, agg: m.agg, value: v };
      row[`metric:${m.key}`] = { label: m.label, agg: m.agg, value: v };
    });
    return row;
  });

  const derivedDefs = metrics.filter((m) => m.kind === 'derived');
  const { warnings } = applyDerived(outputRows, dimensions, derivedDefs);

  return {
    dimensions: dimensions.map((d) => ({ field: d.field, label: d.label, granularity: d.granularity })),
    metrics: metrics.map((m) => ({
      key: m.key,
      kind: m.kind,
      field: m.field,
      agg: m.agg,
      label: m.label,
      ...(m.kind === 'expr' ? { expr: m.expr } : {}),
      ...(m.kind === 'derived' ? { derivedKind: m.derivedKind, ref: m.ref } : {}),
    })),
    rows: outputRows,
    ...(warnings.length ? { warnings } : {}),
    elapsedMs,
    sql,
  };
}

module.exports = { aggregate, AGG_FUNCS, TIME_GRANULARITY };
