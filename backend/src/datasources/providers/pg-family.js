const { Pool } = require('pg');

function makePool(cfg) {
  return new Pool({
    host: cfg.host, port: Number(cfg.port) || 5432, user: cfg.user,
    password: cfg.password || '', database: cfg.database,
    max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 5000,
  });
}

async function testConnection(cfg) {
  const pool = makePool(cfg);
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return { ok: true, message: '连接成功' };
  } catch (e) {
    return { ok: false, message: e.message };
  } finally {
    await pool.end();
  }
}

async function listSchemas(cfg) {
  const pool = makePool(cfg);
  try {
    const { rows } = await pool.query(
      "SELECT schema_name AS name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog','information_schema') ORDER BY schema_name"
    );
    return rows.map((r) => ({ name: r.name }));
  } finally {
    await pool.end();
  }
}

async function listTables(cfg, type, schema) {
  const pool = makePool(cfg);
  try {
    const { rows } = await pool.query(
      'SELECT table_name AS name, table_type AS type FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name',
      [schema]
    );
    return rows.map((r) => ({ name: r.name, type: r.type === 'BASE TABLE' ? 'table' : 'view' }));
  } finally {
    await pool.end();
  }
}

async function listColumns(cfg, type, schema, table) {
  const pool = makePool(cfg);
  try {
    const { rows } = await pool.query(
      `SELECT column_name AS name, data_type AS type
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      [schema, table]
    );
    return rows.map((r) => ({
      name: r.name,
      type: r.type,
      role: /int|float|double|decimal|numeric|bigint|smallint/.test(r.type) ? 'metric' : 'dimension',
    }));
  } finally {
    await pool.end();
  }
}

async function runQuery(cfg, sql, params = []) {
  const pool = makePool(cfg);
  try {
    const { rows } = await pool.query(sql, params);
    return rows;
  } finally {
    await pool.end();
  }
}

module.exports = { testConnection, listSchemas, listTables, listColumns, runQuery };