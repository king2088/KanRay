const { Client } = require('presto-client');

function quote(name = '') {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function makeClient(cfg) {
  return new Client({
    host: cfg.host,
    port: Number(cfg.port) || 8080,
    user: cfg.user || 'trino',
    catalog: cfg.catalog,
    schema: cfg.schema,
    engine: cfg.engine || 'trino', // `presto-client` 用 engine 参数区分 headers；Presto → 'presto'，Trino → 'trino'
    checkInterval: 300,
    timeout: 30000,
  });
}

/** Presto 协议为分页 REST，presto-client 通过 data 回调逐页返回 data（行数组），最终 success 拿到末页列信息 */
function runStatement(client, sql, catalog, schema) {
  return new Promise((resolve, reject) => {
    let columns = null;
    let rows = [];
    client.execute({
      query: sql,
      catalog: catalog || client.catalog,
      schema: schema || client.schema,
      columns: (err, cols) => {
        if (!err && cols) columns = cols;
      },
      data: (err, data) => {
        if (!err && Array.isArray(data)) rows = rows.concat(data);
      },
      success: (err) => {
        if (err) return reject(new Error(String(err.message || err)));
        const mapCol = (c) => c.name;
        resolve(
          rows.map((r) => {
            const o = {};
            (columns || []).forEach((c, i) => {
              o[mapCol(c)] = Array.isArray(r) ? r[i] : r[mapCol(c)];
            });
            // 无列信息（如 SHOW 类语句）时原样透出
            if (!columns || !columns.length) return r;
            return o;
          }),
        );
      },
      error: (e) => reject(new Error(String((e && e.message) || e))),
    });
  });
}

/** 把 ? 占位符按序替换为安全的字面量（引擎传入的滤值均为标量） */
function render(sql, params = []) {
  let i = 0;
  return sql.replace(/\?/g, () => {
    const v = params[i++];
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return String(v);
    return `'${String(v).replace(/'/g, "''")}'`;
  });
}

async function testConnection(cfg) {
  const client = makeClient(cfg);
  try {
    await runStatement(client, 'SELECT 1', cfg.catalog, cfg.schema);
    return { ok: true, message: '连接成功' };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

async function listSchemas(cfg) {
  const client = makeClient(cfg);
  const rows = await runStatement(client, `SHOW SCHEMAS FROM ${quote(cfg.catalog)}`, cfg.catalog, null);
  return rows.map((r) => ({ name: String(Object.values(r)[0]) }));
}

async function listTables(cfg, type, schema) {
  const client = makeClient(cfg);
  const rows = await runStatement(
    client,
    `SHOW TABLES FROM ${quote(cfg.catalog)}.${quote(schema)}`,
    cfg.catalog,
    schema,
  );
  return rows.map((r) => ({ name: String(Object.values(r)[0]), type: 'table' }));
}

async function listColumns(cfg, type, schema, table) {
  const client = makeClient(cfg);
  const rows = await runStatement(
    client,
    `SHOW COLUMNS FROM ${quote(cfg.catalog)}.${quote(schema)}.${quote(table)}`,
    cfg.catalog,
    schema,
  );
  const nameOf = (r, key) => (r[key] !== undefined ? r[key] : r[Object.keys(r)[0]]);
  return rows.map((r) => {
    const type2 = String(nameOf(r, 'Type') ?? '');
    return {
      name: String(nameOf(r, 'Column')),
      type: type2,
      role: /int|double|float|real|decimal|bigint|smallint|tinyint|numeric/.test(type2) ? 'metric' : 'dimension',
    };
  });
}

async function runQuery(cfg, sql, params = []) {
  const client = makeClient(cfg);
  return runStatement(client, render(sql, params), cfg.catalog, cfg.schema);
}

module.exports = { testConnection, listSchemas, listTables, listColumns, runQuery };