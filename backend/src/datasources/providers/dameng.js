// 达梦 DM 接入：基于 odbc npm（原生 C 绑定，绕过 JDBC）。
// 依赖链：odbc → unixODBC → DM ODBC 驱动；连接串 SERVER/PORT/UID/PWD。
// createProvider(odbcModule) 支持注入 fake 单测。
const { dameng: dmDialect } = require('../dialects');
const { toDialect } = require('../portable-sql');

function loadOdbc() {
  try {
    return require('odbc');
  } catch (err) {
    const e = new Error('缺少可选依赖 odbc，请先安装：npm i odbc（需本机 unixODBC 与达梦 DM ODBC 驱动；macOS 官方驱动暂无）');
    e.code = 'ODBC_MISSING';
    e.cause = err;
    throw e;
  }
}

function connString(cfg) {
  if (cfg.dsn) return `DSN=${String(cfg.dsn)};UID=${String(cfg.user || '')};PWD=${String(cfg.password || '')}`;
  return `SERVER=${String(cfg.host || '')};PORT=${Number(cfg.port) || 5236};UID=${String(cfg.user || '')};PWD=${String(cfg.password || '')}`;
}

const NUMERIC = /INT|FLOAT|DOUBLE|DECIMAL|DEC|NUMERIC|REAL|BIGINT|SMALLINT|BIT/i;

function createProvider(odbcModule) {
  const odbc = odbcModule || loadOdbc;

  async function withConn(cfg, fn) {
    let conn;
    try {
      const mod = typeof odbc === 'function' ? odbc() : odbc;
      conn = await mod.connect(connString(cfg));
      return await fn(conn);
    } finally {
      if (conn) await conn.close().catch(() => {});
    }
  }

  async function testConnection(cfg) {
    try {
      await withConn(cfg, async (conn) => conn.query('SELECT 1'));
      return { ok: true, message: '连接成功' };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }

  async function listSchemas(cfg) {
    return withConn(cfg, async (conn) => {
      const res = await conn.query('SELECT DISTINCT OWNER AS NAME FROM ALL_TABLES ORDER BY NAME');
      const rows = res.rows || res;
      return rows.map((r) => ({ name: String(r.NAME != null ? r.NAME : r.name) }));
    });
  }

  async function listTables(cfg, type, schema) {
    return withConn(cfg, async (conn) => {
      const res = await conn.query(
        'SELECT TABLE_NAME AS NAME, TABLE_TYPE AS TYPE FROM ALL_TABLES WHERE OWNER = ? ORDER BY TABLE_NAME',
        [String(schema)],
      );
      const rows = res.rows || res;
      return rows.map((r) => {
        const name = String(r.NAME != null ? r.NAME : r.name);
        const t = String(r.TYPE != null ? r.TYPE : r.type).toUpperCase();
        return { name, type: t.includes('VIEW') ? 'view' : 'table' };
      });
    });
  }

  async function listColumns(cfg, type, schema, table) {
    return withConn(cfg, async (conn) => {
      const res = await conn.query(
        'SELECT COLUMN_NAME AS NAME, DATA_TYPE AS TYPE FROM ALL_TAB_COLUMNS WHERE OWNER = ? AND TABLE_NAME = ? ORDER BY COLUMN_ID',
        [String(schema), String(table)],
      );
      const rows = res.rows || res;
      return rows.map((r) => {
        const name = String(r.NAME != null ? r.NAME : r.name);
        const t = String(r.TYPE != null ? r.TYPE : r.type);
        return { name, type: t, role: NUMERIC.test(t) ? 'metric' : 'dimension' };
      });
    });
  }

  async function runQuery(cfg, sql, params = []) {
    return withConn(cfg, async (conn) => {
      const res = await conn.query(toDialect(sql, dmDialect), params);
      return res.rows || res;
    });
  }

  return { testConnection, listSchemas, listTables, listColumns, runQuery };
}

module.exports = createProvider();
module.exports.createProvider = createProvider;