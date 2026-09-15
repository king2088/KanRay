// src/db/drivers/mysql.js
// MySQL / MariaDB 应用存储 driver（Task 8）
// 统一契约：await db.prepare(sql).run/get/all(...)、db.run/get/all/exec/execBatch、
// db.transaction(fn) 返回可调用包装（await 后执行，兼容 better-sqlite3 形态 + 参数透传）。
const mysql2 = require('mysql2/promise');
const { translate } = require('../translate');
const { mysql: mysqlDialect, mariadb: mariaDialect } = require('../../datasources/dialects');

function createMysqlDriver(url, type) {
  const pool = mysql2.createPool({
    uri: url,
    connectionLimit: 10,
    multipleStatements: true,
    charset: 'utf8mb4',
    decimalNumbers: true,
    waitForConnections: true,
    queueLimit: 0,
  });
  const dialect = type === 'mariadb' ? mariaDialect : mysqlDialect;
  const lowerKeys = (rows) => rows.map((r) => Object.fromEntries(Object.entries(r || {}).map(([k, v]) => [k.toLowerCase(), v])));
  const lastInsert = (r) => ({ changes: r.affectedRows, lastInsertRowid: typeof r.insertId === 'bigint' ? Number(r.insertId) : r.insertId });

  // 事务期间绑定到同一连接的上下文；无非事务语句临时取连接用完即还
  let txConn = null;
  let txDepth = 0;
  const current = async () => txConn || pool.getConnection();
  const releaseIfIdle = (conn) => { if (!txConn) conn.release(); };

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
    // 事务：db.transaction(fn) 返回可调用包装；嵌套事务复用同一连接（不额外 BEGIN）
    transaction(fn) {
      return async function wrapped(...args) {
        if (txConn) {
          txDepth++;
          try { return await fn(...args); }
          finally { txDepth--; }
        }
        const conn = await pool.getConnection();
        txConn = conn;
        txDepth = 1;
        try {
          await conn.beginTransaction();
          const out = await fn(...args);
          await conn.commit();
          return out;
        } catch (e) {
          try { await conn.rollback(); } catch (_) {}
          throw e;
        } finally {
          txConn = null;
          txDepth = 0;
          conn.release();
        }
      };
    },
    async close() { await pool.end(); },
  };
}

module.exports = { createMysqlDriver };