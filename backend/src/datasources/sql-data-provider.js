const HttpError = require('../utils/http-error');
const dialects = require('./dialects');
const providers = require('./providers');
const { getDriverMeta, decryptConfig } = require('../services/datasource.service');

const OPS = { eq: '=', ne: '!=', lt: '<', lte: '<=', gt: '>', gte: '>=', contains: 'LIKE', in: 'IN' };

const catalogCache = new Map();
const CATALOG_TTL_MS = 60_000;

/**
 * 加载数据集连接上下文：db 行、数据源配置、方言、provider、解密配置。
 * @returns {{ ds, dsConfig, driverMeta, dialect, provider, cfg }}
 */
async function loadDataSourceContext(dataset) {
  const db = require('../db');
  const ds = await db.prepare('SELECT * FROM datasets WHERE id = ?').get(dataset.id);
  if (!ds || ds.source_type !== 'sql') throw new HttpError(400, '非 SQL 数据集');
  const dsConfig = ds.datasource_id
    ? await db.prepare('SELECT * FROM data_sources WHERE id = ?').get(ds.datasource_id)
    : null;
  if (!dsConfig) throw new HttpError(500, '数据源不存在');
  const driverMeta = getDriverMeta(dsConfig.type);
  const dialect = dialects[driverMeta.family];
  if (!dialect) throw new HttpError(500, `未知方言: ${driverMeta.family}`);
  const cfg = decryptConfig(JSON.parse(dsConfig.config));
  const provider = providers.getProvider(driverMeta.family);
  if (!provider || typeof provider.runQuery !== 'function') throw new HttpError(400, '该数据源不支持查询');
  return { ds, dsConfig, driverMeta, dialect, provider, cfg };
}

/**
 * ETL 链涉及的物理表元数据（query/paginate 阶段需真实列，保证 __alias__col 输出列名与注册字段一致）
 */
async function resolveEtlCatalog(dsConfig, provider, cfg, def) {
  const now = Date.now();
  const prefix = `${dsConfig.id}:${dsConfig.type}/`;
  const getTab = (schema, table) => {
    const key = `${prefix}${(schema || '')}.${table}`;
    const hit = catalogCache.get(key);
    if (hit && now - hit.at < CATALOG_TTL_MS) return hit.columns;
    return undefined;
  };
  const seen = new Set();
  const tables = [];
  const push = (schema, table) => {
    const key = `${(schema || '')}.${table}`;
    if (!table || seen.has(key)) return;
    seen.add(key);
    tables.push({ schema: schema || null, table });
  };
  for (const n of def.nodes || []) {
    if (n.nodeType === 'source') push(n.schema || null, n.table);
    else if (n.nodeType === 'join' && n.to) push(n.to.schema || null, n.to.table);
  }
  const catalog = [];
  for (const t of tables) {
    const cached = getTab(t.schema, t.table);
    if (cached) {
      catalog.push({ schema: t.schema, table: t.table, columns: cached });
      continue;
    }
    try {
      const columns = await provider.listColumns(cfg, dsConfig.type, t.schema, t.table);
      catalogCache.set(`${prefix}${(t.schema || '')}.${t.table}`, { at: now, columns });
      catalog.push({ schema: t.schema, table: t.table, columns });
    } catch (e) {
      console.error(`[m3] ETL 目录解析失败: ${t.schema || '(默认)'}.${t.table} :: ${e.message}`);
      catalog.push({ schema: t.schema, table: t.table, columns: [] });
    }
  }
  return catalog;
}

async function query(dataset, queryObj) {
  const db = require('../db');
  const ds = await db.prepare('SELECT * FROM datasets WHERE id = ?').get(dataset.id);
  if (!ds || ds.source_type !== 'sql') throw new HttpError(400, '非 SQL 数据集');
  if (!(queryObj.metrics || []).length) throw new HttpError(400, '至少需要一个指标');

  const { dialect, provider, cfg, dsConfig } = await loadDataSourceContext(dataset);

  // M3：有 build_definition 时以编译结果作为明细源，外层再按图表聚合
  if (ds.build_definition) {
    const def = JSON.parse(ds.build_definition);
    const catalog = [];
    let inner;
    if (def.type === 'etl') {
      const nodes = def.nodes || [];
      const last = nodes[nodes.length - 1];
      if (!last || last.nodeType !== 'output') throw new HttpError(400, 'ETL 定义缺少 output 节点');
      const etlCatalog = await resolveEtlCatalog(dsConfig, provider, cfg, def);
      const { nodeSql } = require('./build-sql').compileEtl(def, dialect, etlCatalog);
      const { sql, params: innerParams, fields: etlFields } = nodeSql(last.nodeId);
      inner = { sql, params: innerParams, fields: etlFields };
    } else {
      const compiled = require('./build-sql').compileDetail({ ...def, aggregation: null }, dialect, catalog);
      inner = compiled;
    }

    // register-table 写入的 registry 字段用原始列名（regionkey），
    // 但 builder 编译输出别名统一为 f_N，需要将原生列名映射过去，
    // 否则 aggregateOverSource 在外层无法解析内层别名。
    const defFields = Array.isArray(def.fields) ? def.fields : [];
    const nativeToF = {};
    defFields.forEach((df, i) => { nativeToF[df.field] = `f_${i}`; });
    const remapField = (obj) => {
      if (obj && typeof obj.field === 'string' && nativeToF[obj.field] && !/^f_\d+$/.test(obj.field)) {
        obj.field = nativeToF[obj.field];
      }
    };
    const remapped = {
      ...queryObj,
      dimensions: (queryObj.dimensions || []).map((d) => { const c = { ...d }; remapField(c); return c; }),
      metrics: (queryObj.metrics || []).map((m) => { const c = { ...m }; remapField(c); return c; }),
    };

    return aggregateOverSource(dataset, remapped, { sql: inner.sql, params: inner.params, fields: inner.fields, dialect, provider, cfg });
  }

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

/** 对子查询源执行图表聚合（复用现有聚合表达逻辑，仅 FROM 换成子查询） */
async function aggregateOverSource(dataset, queryObj, { sql, params, dialect, provider, cfg }) {
  const quote = dialect.quoteIdent;
  const ph = dialect.placeholder;

  const dimExprs = (queryObj.dimensions || []).map((d, i) => ({
    expr: d.granularity ? dialect.dateTrunc(d.field, d.granularity) : quote(d.field),
    alias: `dim_${i}`,
  }));
  const metricExprs = (queryObj.metrics || []).map((m, i) => {
    const agg = dialect.agg[m.agg] || 'COUNT';
    let expr;
    if (m.agg === 'count') expr = 'COUNT(*)';
    else if (m.agg === 'count_distinct') expr = agg.includes('(') ? `${agg} ${quote(m.field)})` : `${agg}(${quote(m.field)})`;
    else expr = `${agg}(${quote(m.field)})`;
    return { expr, alias: `m_${i}` };
  });
  if (!metricExprs.length) throw new HttpError(400, '至少需要一个指标');
  const params2 = [...params];
  const whereClauses = (queryObj.filters || []).map((f) => {
    const op = OPS[f.op];
    if (!op) throw new HttpError(400, `不支持的操作: ${f.op}`);
    if (f.op === 'in') {
      const arr = Array.isArray(f.value) ? f.value : [];
      if (arr.length === 0) return null;
      const marks = arr.map((v) => { params2.push(v); return ph(params2.length); });
      return `${quote(f.field)} IN (${marks.join(', ')})`;
    }
    if (f.op === 'contains') {
      if (f.value === null || f.value === undefined || f.value === '') return null;
      params2.push(`%${f.value}%`);
      return `${quote(f.field)} LIKE ${ph(params2.length)}`;
    }
    if (f.value === null || f.value === undefined || f.value === '') return null;
    params2.push(f.value);
    return `${quote(f.field)} ${op} ${ph(params2.length)}`;
  }).filter(Boolean);

  const allExprs = [
    ...dimExprs.map((x) => `${x.expr} AS ${quote(x.alias)}`),
    ...metricExprs.map((x) => `${x.expr} AS ${quote(x.alias)}`),
  ];
  let aggSql = `SELECT ${allExprs.join(', ')} FROM ( ${sql} ) ${quote('__base')}`;
  if (whereClauses.length) aggSql += ` WHERE ${whereClauses.join(' AND ')}`;
  if (dimExprs.length) aggSql += ` GROUP BY ${dimExprs.map((x) => x.expr).join(', ')}`;

  // D2: 与无定义直查路径保持一致：支持 sortBy/sortOrder 与 groupLimit
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
  if (orderAliases.length) aggSql += ` ORDER BY ${orderAliases.map((a) => quote(a)).join(', ')} ${sortOrder}`;
  if (queryObj.groupLimit && Number.isInteger(queryObj.groupLimit) && queryObj.groupLimit > 0) aggSql = dialect.limit(aggSql, queryObj.groupLimit);

  const start = Date.now();
  const rows = await provider.runQuery(cfg, aggSql, params2);
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
  return { dimensions, metrics, rows: outputRows, elapsedMs, sql: aggSql };
}

/**
 * SQL 数据集原始数据分页预览（用于数据集详情「数据预览」）
 * 返回表内前 pageSize 行与总行数；分页仅支持首页语义，避免方言不一致的 OFFSET。
 */
async function paginate(dataset, page, pageSize) {
  const { ds, dialect, provider, cfg, dsConfig } = await loadDataSourceContext(dataset);

  if (ds.build_definition) {
    const def = JSON.parse(ds.build_definition);
    let detail;
    if (def.type === 'etl') {
      const nodes = def.nodes || [];
      const last = nodes[nodes.length - 1];
      if (!last || last.nodeType !== 'output') throw new HttpError(400, 'ETL 定义缺少 output 节点');
      const etlCatalog = await resolveEtlCatalog(dsConfig, provider, cfg, def);
      const { nodeSql } = require('./build-sql').compileEtl(def, dialect, etlCatalog);
      detail = nodeSql(last.nodeId);
    } else {
      detail = require('./build-sql').compileDetail({ ...def, aggregation: null }, dialect, []);
    }
    const size = Math.min(100, Math.max(1, Number(pageSize) || 50));
    // 外层包一层派生表再限行：避免 output 节点自带 LIMIT 造成双重 LIMIT（mssql 用 TOP 替换首行 SELECT，同样安全）。
    // 已知限制：type=sql 且以 WITH 开头的语句，wrapped 派生表包裹在 mysql/mssql 非法，预览请改用 preview-detail。
    const wrapped = `SELECT * FROM ( ${detail.sql} ) ${dialect.quoteIdent('__c')}`;
    const rows = await provider.runQuery(cfg, dialect.limit(wrapped, size), detail.params || []);
    const countRows = await provider.runQuery(cfg, `SELECT COUNT(*) AS ${dialect.quoteIdent('__total')} FROM ( ${detail.sql} ) ${dialect.quoteIdent('__c')}`, detail.params || []);
    const total = countRows.length ? Number(countRows[0].__total ?? 0) : 0;
    return { rows, total };
  }

  const quote = dialect.quoteIdent;
  const schema = ds.schema_name;
  const table = ds.table_name_ext;
  const qualified = schema ? `${quote(schema)}.${quote(table)}` : quote(table);

  const size = Math.min(100, Math.max(1, Number(pageSize) || 50));
  const rows = await provider.runQuery(cfg, dialect.limit(`SELECT * FROM ${qualified}`, size), []);
  const countRows = await provider.runQuery(cfg, `SELECT COUNT(*) AS ${dialect.quoteIdent('__total')} FROM ${qualified}`, []);
  const total = countRows.length ? Number(countRows[0].__total ?? 0) : 0;
  return { rows, total };
}

module.exports = { query, paginate, loadDataSourceContext };