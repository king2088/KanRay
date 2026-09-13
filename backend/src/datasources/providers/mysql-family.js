const mysql = require('mysql2/promise');

function makeConn(cfg) {
  return mysql.createConnection({
    host: cfg.host, port: Number(cfg.port) || 3306, user: cfg.user,
    password: cfg.password || '', database: cfg.database,
    connectTimeout: 5000,
  });
}

async function testConnection(cfg) {
  let conn;
  try {
    conn = await makeConn(cfg);
    await conn.ping();
    return { ok: true, message: '连接成功' };
  } catch (e) {
    return { ok: false, message: e.message };
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}

async function listSchemas(cfg) {
  const conn = await makeConn(cfg);
  try {
    const [rows] = await conn.query("SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA");
    return rows.map((r) => ({ name: r.name }));
  } finally {
    await conn.end().catch(() => {});
  }
}

async function listTables(cfg, type, schema) {
  const conn = await makeConn(cfg);
  try {
    const [rows] = await conn.query(
      'SELECT TABLE_NAME AS name, TABLE_TYPE AS type FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME',
      [schema]
    );
    return rows.map((r) => ({ name: r.name, type: r.type === 'BASE TABLE' ? 'table' : 'view' }));
  } finally {
    await conn.end().catch(() => {});
  }
}

async function listColumns(cfg, type, schema, table) {
  const conn = await makeConn(cfg);
  try {
    const [rows] = await conn.query(
      `SELECT COLUMN_NAME AS name, DATA_TYPE AS type
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [schema, table]
    );
    return rows.map((r) => ({
      name: r.name,
      type: r.type,
      role: /int|float|double|decimal|numeric|bigint|smallint|tinyint/.test(r.type) ? 'metric' : 'dimension',
    }));
  } finally {
    await conn.end().catch(() => {});
  }
}

async function runQuery(cfg, sql, params = []) {
  const conn = await makeConn(cfg);
  try {
    const [rows] = await conn.query(sql, params);
    return rows;
  } finally {
    await conn.end().catch(() => {});
  }
}

module.exports = { testConnection, listSchemas, listTables, listColumns, runQuery };