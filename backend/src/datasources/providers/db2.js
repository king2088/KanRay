// DB2 接入：基于 ibm_db 原生驱动（可选依赖，懒加载）。
// createProvider(driverModule) 支持注入 fake 驱动单测。
const { db2: db2Dialect } = require('../dialects');
const { toDialect } = require('../portable-sql');

function loadDriver() {
  try {
    return require('ibm_db');
  } catch (err) {
    const e = new Error('缺少可选依赖 ibm_db，请先安装并编译：npm i ibm_db（DB2 数据源需要，需本机 C++ 工具链）');
    e.code = 'IBM_DB_MISSING';
    e.cause = err;
    throw e;
  }
}

function connString(cfg) {
  const parts = [
    `DATABASE=${String(cfg.database || '')}`,
    `HOSTNAME=${String(cfg.host || '')}`,
    `PORT=${Number(cfg.port) || 50000}`,
    `PROTOCOL=TCPIP`,
    `UID=${String(cfg.user || '')}`,
    `PWD=${String(cfg.password || '')}`,
  ];
  if (cfg.security) parts.push(`SECURITY=${String(cfg.security)}`);
  return parts.join(';');
}

const NUMERIC = /INT|FLOAT|DOUBLE|DECIMAL|DEC|NUMERIC|REAL|BIGINT|SMALLINT/i;

function createProvider(driverModule) {
  const driver = driverModule || loadDriver;

  async function withConn(cfg, fn) {
    let conn;
    try {
      const instance = typeof driver === 'function' ? driver() : driver;
      conn = await instance.open(connString(cfg));
      return await fn(conn);
    } finally {
      if (conn) await conn.close().catch(() => {});
    }
  }

  async function testConnection(cfg) {
    try {
      await withConn(cfg, async (conn) => conn.query('SELECT 1 FROM SYSIBM.SYSDUMMY1'));
      return { ok: true, message: '连接成功' };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }

  async function listSchemas(cfg) {
    return withConn(cfg, async (conn) => {
      const rows = await conn.query('SELECT SCHEMANAME AS NAME FROM SYSCAT.SCHEMATA ORDER BY NAME', []);
      return rows.map((r) => ({ name: String(r.NAME != null ? r.NAME : r.name) }));
    });
  }

  async function listTables(cfg, type, schema) {
    return withConn(cfg, async (conn) => {
      const rows = await conn.query(
        'SELECT TABNAME AS NAME, TYPE FROM SYSCAT.TABLES WHERE TABSCHEMA = ? ORDER BY TABNAME',
        [String(schema)],
      );
      return rows.map((r) => {
        const name = String(r.NAME != null ? r.NAME : r.name);
        const t = String(r.TYPE || 'T').toUpperCase();
        return { name, type: t === 'V' ? 'view' : 'table' };
      });
    });
  }

  async function listColumns(cfg, type, schema, table) {
    return withConn(cfg, async (conn) => {
      const rows = await conn.query(
        'SELECT COLNAME AS NAME, TYPENAME AS TYPE FROM SYSCAT.COLUMNS WHERE TABSCHEMA = ? AND TABNAME = ? ORDER BY COLNO',
        [String(schema), String(table)],
      );
      return rows.map((r) => {
        const name = String(r.NAME != null ? r.NAME : r.name);
        const t = String(r.TYPE != null ? r.TYPE : r.type);
        return { name, type: t, role: NUMERIC.test(t) ? 'metric' : 'dimension' };
      });
    });
  }

  async function runQuery(cfg, sql, params = []) {
    return withConn(cfg, async (conn) => conn.query(toDialect(sql, db2Dialect), params));
  }

  return { testConnection, listSchemas, listTables, listColumns, runQuery };
}

module.exports = createProvider();
module.exports.createProvider = createProvider;