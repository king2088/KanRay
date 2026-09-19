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

async function testConnection(cfg) {
  try {
    const pool = await sql.connect(makeConfig(cfg));
    await pool.request().query('SELECT 1');
    await pool.close();
    return { ok: true, message: '连接成功' };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

async function listSchemas() {
  return [{ name: 'dbo' }];
}

async function listTables(cfg, type, schema) {
  const pool = await sql.connect(makeConfig(cfg));
  try {
    const result = await pool.request()
      .input('schema', sql.NVarChar, String(schema))
      .query(
        "SELECT t.name AS name, t.type_desc AS type FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = @schema ORDER BY t.name"
      );
    return result.recordset.map((r) => ({ name: r.name, type: r.type.includes('VIEW') ? 'view' : 'table' }));
  } finally {
    await pool.close();
  }
}

async function listColumns(cfg, type, schema, table) {
  const pool = await sql.connect(makeConfig(cfg));
  try {
    const result = await pool.request()
      .input('schema', sql.NVarChar, String(schema))
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
  } finally {
    await pool.close();
  }
}

async function runQuery(cfg, sqlQuery, params = []) {
  const pool = await sql.connect(makeConfig(cfg));
  try {
    const request = pool.request();
    params.forEach((p, i) => request.input(`p${i}`, p));
    const result = await request.query(toDialect(sqlQuery, mssqlDialect));
    return result.recordset;
  } finally {
    await pool.close();
  }
}

module.exports = { testConnection, listSchemas, listTables, listColumns, runQuery };