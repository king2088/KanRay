const oracledb = require('oracledb');
const { oracle: oracleDialect } = require('../dialects');
const { toDialect } = require('../portable-sql');

// thin 模式：纯 JS 实现，免装 Oracle Instant Client
oracledb.thin = true;
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

function makeConn(cfg) {
  const service = cfg.service_name || cfg.database || 'FREEPDB1';
  return oracledb.getConnection({
    user: cfg.user,
    password: cfg.password || '',
    connectString: `${cfg.host}:${Number(cfg.port) || 1521}/${service}`,
    connectTimeout: 15000,
  });
}

const NUMERIC = /NUMBER|INT|FLOAT|DOUBLE|DECIMAL|NUMERIC|BINARY_DOUBLE|BINARY_FLOAT|REAL/i;

async function testConnection(cfg) {
  let conn;
  try {
    conn = await makeConn(cfg);
    await conn.execute('SELECT 1 FROM dual');
    return { ok: true, message: '连接成功' };
  } catch (e) {
    return { ok: false, message: e.message };
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
}

/** Oracle 的 schema 即用户账号，返回当前连接用户（大写） */
async function listSchemas(cfg) {
  const user = String(cfg.user || '').toUpperCase();
  return user ? [{ name: user }] : [];
}

async function listTables(cfg, type, schema) {
  const owner = String(schema || cfg.user || '').toUpperCase();
  const conn = await makeConn(cfg);
  try {
    const r = await conn.execute(
      `SELECT TABLE_NAME AS name, 'TABLE' AS kind FROM all_tables WHERE owner = :owner
       UNION ALL
       SELECT VIEW_NAME AS name, 'VIEW' AS kind FROM all_views WHERE owner = :owner
       ORDER BY name`,
      { owner },
    );
    return (r.rows || []).map((row) => ({ name: row.NAME, type: row.KIND === 'VIEW' ? 'view' : 'table' }));
  } finally {
    await conn.close().catch(() => {});
  }
}

async function listColumns(cfg, type, schema, table) {
  const owner = String(schema || cfg.user || '').toUpperCase();
  const conn = await makeConn(cfg);
  try {
    const r = await conn.execute(
      `SELECT COLUMN_NAME AS name, DATA_TYPE AS type
       FROM all_tab_columns
       WHERE owner = :1 AND table_name = :2
       ORDER BY column_id`,
      [owner, String(table).toUpperCase()],
    );
    return (r.rows || []).map((row) => ({
      // 未加引号的列名 Oracle 自动大写；与 runQuery 的行键归一化保持一致，统一转小写
      name: String(row.NAME).toLowerCase(),
      type: row.TYPE,
      role: NUMERIC.test(row.TYPE) ? 'metric' : 'dimension',
    }));
  } finally {
    await conn.close().catch(() => {});
  }
}

async function runQuery(cfg, sql, params = []) {
  const conn = await makeConn(cfg);
  try {
    // 同步引擎传入可移植占位符 `?` 与 `LIMIT`，此处转成 Oracle 的 :1/:2 与 FETCH FIRST。
    // runQuery 每次新建连接，DML 需随语句提交，否则新连接不可见。
    const r = await conn.execute(toDialect(sql, oracleDialect), params, { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: true });
    // 归一化：双引号保留原始大小写，未加引号的列名 Oracle 自动大写；统一转小写以对齐其他数据源
    return (r.rows || []).map((row) => {
      const o = {};
      for (const [k, v] of Object.entries(row)) o[k.toLowerCase()] = v;
      return o;
    });
  } finally {
    await conn.close().catch(() => {});
  }
}

module.exports = { testConnection, listSchemas, listTables, listColumns, runQuery };