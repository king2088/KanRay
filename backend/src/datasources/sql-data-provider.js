const HttpError = require('../utils/http-error');
const dialects = require('./dialects');
const providers = require('./providers');
const { getDriverMeta, decryptConfig } = require('../services/datasource.service');

const OPS = { eq: '=', ne: '!=', lt: '<', lte: '<=', gt: '>', gte: '>=', contains: 'LIKE', in: 'IN' };

async function query(dataset, queryObj) {
  const db = require('../db');
  const ds = db.prepare('SELECT * FROM datasets WHERE id = ?').get(dataset.id);
  if (!ds || ds.source_type !== 'sql') throw new Error('Not a SQL dataset');

  const dsConfig = ds.datasource_id
    ? db.prepare('SELECT * FROM data_sources WHERE id = ?').get(ds.datasource_id)
    : null;
  if (!dsConfig) throw new HttpError(500, '数据源不存在');

  const driverMeta = getDriverMeta(dsConfig.type);
  const dialect = dialects[driverMeta.family];
  if (!dialect) throw new HttpError(500, `未知方言: ${driverMeta.family}`);

  const cfg = decryptConfig(JSON.parse(dsConfig.config));
  const provider = providers.getProvider(driverMeta.family);
  if (!provider || typeof provider.runQuery !== 'function') throw new HttpError(400, '该数据源不支持查询');

  const quote = dialect.quoteIdent;
  const ph = dialect.placeholder;
  const schema = ds.schema_name;
  const table = ds.table_name_ext;
  const qualifiedTable = schema ? `${quote(schema)}.${quote(table)}` : quote(table);

  const dimExprs = (queryObj.dimensions || []).map((d, i) => {
    const expr = d.granularity ? dialect.dateTrunc(d.field, d.granularity) : quote(d.field);
    return { expr, alias: `dim_${i}` };
  });

  const metricExprs = (queryObj.metrics || []).map((m, i) => {
    const agg = dialect.agg[m.agg] || 'COUNT';
    let expr;
    if (m.agg === 'count') expr = 'COUNT(*)';
    else if (m.agg === 'count_distinct') {
      expr = agg.includes('(') ? `${agg} ${quote(m.field)})` : `${agg}(${quote(m.field)})`;
    } else {
      expr = `${agg}(${quote(m.field)})`;
    }
    return { expr, alias: `m_${i}` };
  });

  const params = [];
  const whereClauses = (queryObj.filters || []).map((f) => {
    const op = OPS[f.op];
    if (!op) throw new HttpError(400, `不支持的操作: ${f.op}`);
    if (f.op === 'in') {
      const arr = Array.isArray(f.value) ? f.value : [];
      if (arr.length === 0) return null;
      const marks = arr.map((v) => { params.push(v); return ph(params.length); });
      return `${quote(f.field)} IN (${marks.join(', ')})`;
    }
    if (f.op === 'contains') {
      if (f.value === null || f.value === undefined || f.value === '') return null;
      params.push(`%${f.value}%`);
      return `${quote(f.field)} LIKE ${ph(params.length)}`;
    }
    if (f.value === null || f.value === undefined || f.value === '') return null;
    params.push(f.value);
    return `${quote(f.field)} ${op} ${ph(params.length)}`;
  }).filter(Boolean);

  const allExprs = [
    ...dimExprs.map((d) => `${d.expr} AS ${quote(d.alias)}`),
    ...metricExprs.map((m) => `${m.expr} AS ${quote(m.alias)}`),
  ];

  let sql = `SELECT ${allExprs.join(', ')} FROM ${qualifiedTable}`;
  if (whereClauses.length) sql += ` WHERE ${whereClauses.join(' AND ')}`;
  if (dimExprs.length) sql += ` GROUP BY ${dimExprs.map((d) => d.expr).join(', ')}`;

  const sortOrder = queryObj.sortOrder === 'desc' ? 'DESC' : 'ASC';
  let orderAliases = [];
  const resolveSort = (entry) => {
    if (Number.isInteger(entry) && entry >= 0 && entry < metricExprs.length) return metricExprs[entry].alias;
    if (typeof entry === 'string' && entry === 'dim' && dimExprs.length) return dimExprs[0].alias;
    return null;
  };
  if (Number.isInteger(queryObj.sortBy)) orderAliases = [resolveSort(queryObj.sortBy)].filter(Boolean);
  else if (typeof queryObj.sortBy === 'string') orderAliases = [resolveSort(queryObj.sortBy)].filter(Boolean);
  else if (Array.isArray(queryObj.sortBy)) orderAliases = queryObj.sortBy.map(resolveSort).filter(Boolean);
  if (orderAliases.length) sql += ` ORDER BY ${orderAliases.map((a) => quote(a)).join(', ')} ${sortOrder}`;

  if (queryObj.groupLimit && Number.isInteger(queryObj.groupLimit) && queryObj.groupLimit > 0) sql = dialect.limit(sql, queryObj.groupLimit);

  const start = Date.now();
  const rows = await provider.runQuery(cfg, sql, params);
  const elapsedMs = Date.now() - start;

  const dimensions = (queryObj.dimensions || []).map((d) => ({ field: d.field, label: d.label || d.field }));
  const metrics = (queryObj.metrics || []).map((m) => ({ field: m.field, agg: m.agg, label: m.label || m.field }));

  const outputRows = rows.map((r) => {
    const row = {};
    dimensions.forEach((d, i) => {
      const v = r[`dim_${i}`];
      row[`dim:${d.field}`] = { label: d.label || d.field, value: v };
      row[d.field] = v;
    });
    metrics.forEach((m, i) => {
      const v = r[`m_${i}`];
      row[m.field] = v;
      row[`metric:${m.field}`] = { label: m.label || m.field, agg: m.agg, value: v };
    });
    return row;
  });

  return { dimensions, metrics, rows: outputRows, elapsedMs, sql };
}

module.exports = { query };