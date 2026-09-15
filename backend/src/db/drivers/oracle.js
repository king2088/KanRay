// src/db/drivers/oracle.js
// Oracle 应用存储 driver（Task 9）
// 统一契约：await db.prepare(sql).run/get/all(...)、db.run/get/all/exec/execBatch、
// db.transaction(fn) 返回可调用包装。
// 已知限制（写入 spec）：Oracle 无连接池级事务继承——每语句 autoCommit，
// 上传批量写入以"整批失败则回库重建"补偿；run 无通用 insertId（RETURNING 由调用侧特例处理）。
const oracledb = require('oracledb');
const { translate } = require('../translate');
const { oracle: oracleDialect } = require('../../datasources/dialects');

function parseOracleUrl(url) {
  const u = new URL(url);
  return {
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    connectString: `${u.hostname}:${u.port || 1521}/${u.pathname.replace(/^\//, '')}`,
  };
}

function createOracleDriver(url) {
  oracledb.thin = true;
  const cfg = parseOracleUrl(url);
  const lowerKeys = (r) => Object.fromEntries(Object.entries(r || {}).map(([k, v]) => [k.toLowerCase(), v]));
  const _conn = () => oracledb.getConnection(cfg);

  const statement = (text) => {
    const t = translate(text, oracleDialect);
    return {
      run: async (...params) => {
        const c = await _conn();
        try {
          const out = await c.execute(t, params, { autoCommit: true, outFormat: oracledb.OUT_FORMAT_OBJECT });
          return { changes: out.rowsAffected || 0, lastInsertRowid: 0 };
        } finally { await c.close(); }
      },
      get: async (...params) => {
        const c = await _conn();
        try {
          const out = await c.execute(t, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
          return out.rows && out.rows[0] ? lowerKeys(out.rows[0]) : undefined;
        } finally { await c.close(); }
      },
      all: async (...params) => {
        const c = await _conn();
        try {
          const out = await c.execute(t, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
          return (out.rows || []).map(lowerKeys);
        } finally { await c.close(); }
      },
    };
  };

  return {
    type: 'oracle',
    dialect: oracleDialect,
    prepare: statement,
    async run(text, params = []) { return statement(text).run(...params); },
    async get(text, params = []) { return statement(text).get(...params); },
    async all(text, params = []) { return statement(text).all(...params); },
    async exec(text) {
      const c = await _conn();
      try { await c.execute(text, [], { autoCommit: true }); return { changes: 0 }; }
      finally { await c.close(); }
    },
    async execBatch(sqls) {
      for (const s of sqls) await this.exec(s);
    },
    // 每语句 autoCommit，事务路径为透传（批量上传由调用方分批 autoCommit + 失败回库补偿）
    transaction(fn) {
      return async function wrapped(...args) {
        return fn(...args);
      };
    },
    async close() { /* thin 无持久池，逐连接关闭 */ },
  };
}

module.exports = { createOracleDriver, parseOracleUrl };