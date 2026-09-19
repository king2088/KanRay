const { Pool } = require('pg');
require('../../utils/pg-types');
const { normalizeRowsDates } = require('../../utils/datetime');

// 同步引擎以 ? 作为可移植占位符（与 mysql 驱动一致），PG 需转成 $1/$2…；
// 逐字符扫描并跳过单引号字符串字面量，避免误替换字符串里的 ?。
function toPositional(sql) {
  let out = '';
  let idx = 0;
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const ch = sql[i];
    if (ch === "'") {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; }
        if (sql[j] === "'") break;
        j += 1;
      }
      out += sql.slice(i, j + 1);
      i = j + 1;
    } else if (ch === '?') {
      idx += 1;
      out += `$${idx}`;
      i += 1;
    } else {
      out += ch;
      i += 1;
    }
  }
  return out;
}

function makePool(cfg) {
  return new Pool({
    host: cfg.host, port: Number(cfg.port) || 5432, user: cfg.user,
    password: cfg.password || '', database: cfg.database,
    max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 5000,
  });
}

async function testConnection(cfg) {
  const pool = makePool(cfg);
  let client;
  try {
    client = await pool.connect();
    await client.query('SELECT 1');
    return { ok: true, message: '连接成功' };
  } catch (e) {
    return { ok: false, message: e.message };
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

async function listSchemas() {
  return [{ name: 'public' }];
}

async function listTables(cfg, type, schema) {
  const sch = schema || cfg.schema || 'public';
  const pool = makePool(cfg);
  try {
    const { rows } = await pool.query(
      'SELECT table_name AS name, table_type AS type FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name',
      [sch]
    );
    return rows.map((r) => ({ name: r.name, type: r.type === 'BASE TABLE' ? 'table' : 'view' }));
  } finally {
    await pool.end();
  }
}

async function listColumns(cfg, type, schema, table) {
  const sch = schema || cfg.schema || 'public';
  const pool = makePool(cfg);
  try {
    const { rows } = await pool.query(
      `SELECT column_name AS name, data_type AS type
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      [sch, table]
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
    const { rows } = await pool.query(toPositional(sql), params);
    return normalizeRowsDates(rows);
  } finally {
    await pool.end();
  }
}

module.exports = { testConnection, listSchemas, listTables, listColumns, runQuery };