// src/db/drivers/mysql.js
// MySQL / MariaDB 应用存储 driver（Task 8）
// 统一契约：await db.prepare(sql).run/get/all(...)、db.run/get/all/exec/execBatch、
// db.transaction(fn) 返回可调用包装（await 后执行，兼容 better-sqlite3 形态 + 参数透传）。
const mysql2 = require('mysql2/promise');
const { AsyncLocalStorage } = require('node:async_hooks');
const { translate } = require('../translate');
const config = require('../../config');
const { mysql: mysqlDialect, mariadb: mariaDialect } = require('../../datasources/dialects');
const { normalizeRowDates } = require('../../utils/datetime');

function createMysqlDriver(url, type) {
  const pool = mysql2.createPool({
    uri: url,
    connectionLimit: config.db.poolMax,
    multipleStatements: true,
    charset: 'utf8mb4',
    decimalNumbers: true,
    dateStrings: true,
    waitForConnections: true,
    queueLimit: 0,
  });
  const dialect = type === 'mariadb' ? mariaDialect : mysqlDialect;
  const lowerKeys = (rows) => rows.map((r) => normalizeRowDates(Object.fromEntries(Object.entries(r || {}).map(([k, v]) => [k.toLowerCase(), v]))));
  const lastInsert = (r) => ({ changes: r.affectedRows, lastInsertRowid: typeof r.insertId === 'bigint' ? Number(r.insertId) : r.insertId });

  // 事务连接用 AsyncLocalStorage 按异步调用链隔离：并发事务各自绑定自己的连接。
  // 不能用单个模块级 txConn——并发请求会互相覆盖，导致语句跑错连接、丢写。
  const txStore = new AsyncLocalStorage();
  const current = async () => {
    const tx = txStore.getStore();
    if (tx) return tx.conn;
    return pool.getConnection();
  };
  const releaseIfIdle = (conn) => { if (!txStore.getStore()) conn.release(); };

  const statement = (sql) => {
    const t = translate(sql, dialect);
    return {
      run: async (...params) => {
        const conn = await current();
        try { const [r] = await conn.execute(t, params); return lastInsert(r); }
        finally { releaseIfIdle(conn); }
      },
      get: async (...params) => {
        const conn = await current();
        try { const [rows] = await conn.execute(t, params); return lowerKeys(rows)[0]; }
        finally { releaseIfIdle(conn); }
      },
      all: async (...params) => {
        const conn = await current();
        try { const [rows] = await conn.execute(t, params); return lowerKeys(rows); }
        finally { releaseIfIdle(conn); }
      },
    };
  };

  return {
    type,
    dialect,
    prepare: statement,
    async run(sql, params = []) {
      const conn = await current();
      try { const [r] = await conn.execute(translate(sql, dialect), params); return lastInsert(r); }
      finally { releaseIfIdle(conn); }
    },
    async get(sql, params = []) {
      const conn = await current();
      try { const [rows] = await conn.execute(translate(sql, dialect), params); return lowerKeys(rows)[0]; }
      finally { releaseIfIdle(conn); }
    },
    async all(sql, params = []) {
      const conn = await current();
      try { const [rows] = await conn.execute(translate(sql, dialect), params); return lowerKeys(rows); }
      finally { releaseIfIdle(conn); }
    },
    async exec(sql) {
      const conn = await current();
      try { await conn.query(sql); return { changes: 0 }; }
      finally { releaseIfIdle(conn); }
    },
    async execBatch(sqls) {
      const conn = await current();
      try { for (const s of sqls) await conn.query(s); }
      finally { releaseIfIdle(conn); }
    },
    // 事务：db.transaction(fn) 返回可调用包装；嵌套事务复用外层连接（不额外 BEGIN）
    transaction(fn) {
      return async function wrapped(...args) {
        if (txStore.getStore()) return fn(...args);
        const conn = await pool.getConnection();
        try {
          return await txStore.run({ conn }, async () => {
            await conn.beginTransaction();
            const out = await fn(...args);
            await conn.commit();
            return out;
          });
        } catch (e) {
          try { await conn.rollback(); } catch (_) {}
          throw e;
        } finally {
          conn.release();
        }
      };
    },
    async close() { await pool.end(); },
  };
}

module.exports = { createMysqlDriver };