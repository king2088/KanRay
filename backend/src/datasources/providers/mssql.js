const sql = require('mssql');
const { mssql: mssqlDialect } = require('../dialects');
const { toDialect } = require('../portable-sql');

function makeConfig(cfg) {
  return {
    server: cfg.host, port: Number(cfg.port) || 1433, database: cfg.database,
    user: cfg.user, password: cfg.password,
    options: { encrypt: false, trustServerCertificate: true, connectTimeout: 10000 },
    pool: { max: 5, idleTimeoutMillis: 10000 },
  };
}

// 注意：mssql 包的 sql.connect() 是模块级共享池，并发连接不同服务器会互相覆盖，
// 且任一调用方 pool.close() 会关闭共享池影响他人。这里每个调用都创建独立的
// sql.ConnectionPool 实例，用完即关（与 app-store 驱动一致）。

// 打开一次性池并执行 fn；无论成败都关闭池。连接失败时 pool 可能不存在，需判空。
async function withPool(cfg, fn) {
  const pool = new sql.ConnectionPool(makeConfig(cfg));
  try {
    await pool.connect();
    return await fn(pool);
  } finally {
    if (pool.connected) await pool.close().catch(() => {});
  }
}

async function testConnection(cfg) {
  try {
    await withPool(cfg, async (pool) => {
      await pool.request().query('SELECT 1');
    });
    return { ok: true, message: '连接成功' };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

async function listSchemas() {
  return [{ name: 'dbo' }];
}

async function listTables(cfg, type, schema) {
  return withPool(cfg, async (pool) => {
    const result = await pool.request()
      .input('schema', sql.NVarChar, String(schema || cfg.schema || 'dbo'))
      .query(
        "SELECT t.name AS name, t.type_desc AS type FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = @schema ORDER BY t.name"
      );
    return result.recordset.map((r) => ({ name: r.name, type: r.type.includes('VIEW') ? 'view' : 'table' }));
  });
}

async function listColumns(cfg, type, schema, table) {
  return withPool(cfg, async (pool) => {
    const result = await pool.request()
      .input('schema', sql.NVarChar, String(schema || cfg.schema || 'dbo'))
      .input('table', sql.NVarChar, String(table))
      .query(
        `SELECT c.name AS name, tp.name AS type
         FROM sys.columns c
         JOIN sys.types tp ON c.user_type_id = tp.user_type_id
         JOIN sys.tables t ON c.object_id = t.object_id
         JOIN sys.schemas s ON t.schema_id = s.schema_id
         WHERE s.name = @schema AND t.name = @table
         ORDER BY c.column_id`
      );
    return result.recordset.map((r) => ({
      name: r.name,
      type: r.type,
      role: /int|float|decimal|numeric|money|real/.test(r.type) ? 'metric' : 'dimension',
    }));
  });
}

async function runQuery(cfg, sqlQuery, params = []) {
  return withPool(cfg, async (pool) => {
    const request = pool.request();
    params.forEach((p, i) => request.input(`p${i}`, p));
    const result = await request.query(toDialect(sqlQuery, mssqlDialect));
    return result.recordset;
  });
}

module.exports = { testConnection, listSchemas, listTables, listColumns, runQuery };