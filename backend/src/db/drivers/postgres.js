// src/db/drivers/postgres.js
// PostgreSQL 应用存储 driver（Task 8）
// 统一契约：await db.prepare(sql).run/get/all(...)、db.run/get/all/exec/execBatch、
// db.transaction(fn) 返回可调用包装（await 后执行）。
// `run` 对 INSERT INTO 自动追加 `RETURNING id`（无 RETURNING / 非 ON CONFLICT 结尾）以回读自增 id。
const { Pool } = require('pg');
const { translate } = require('../translate');
const { pg: pgDialect } = require('../../datasources/dialects');

const INSERT_RE = /^INSERT\s+INTO/i;

function withReturning(sql) {
  const s = String(sql).trim();
  if (INSERT_RE.test(s) && !/\bRETURNING\b/i.test(s) && !/ON\s+CONFLICT[\s\S]*$/i.test(s)) {
    return `${s} RETURNING id`;
  }
  return s;
}

const mapRow = (r) => Object.fromEntries(Object.entries(r || {}).map(([k, v]) => [k.toLowerCase(), v]));

function createPostgresDriver(url) {
  const pool = new Pool({ connectionString: url, max: 10 });

  let txClient = null;
  let txDepth = 0;
  const current = async () => txClient || pool.connect();
  const releaseIfIdle = (client) => { if (!txClient) client.release(); };

  const statement = (sql) => {
    const t = withReturning(translate(sql, pgDialect));
    return {
      run: async (...params) => {
        const client = await current();
        try { const r = await client.query(t, params); return { changes: r.rowCount, lastInsertRowid: r.rows[0] ? Number(r.rows[0].id) : 0 }; }
        finally { releaseIfIdle(client); }
      },
      get: async (...params) => {
        const client = await current();
        try { const r = await client.query(t, params); return mapRow(r.rows[0]); }
        finally { releaseIfIdle(client); }
      },
      all: async (...params) => {
        const client = await current();
        try { const r = await client.query(t, params); return r.rows.map(mapRow); }
        finally { releaseIfIdle(client); }
      },
    };
  };

  return {
    type: 'postgres',
    dialect: pgDialect,
    prepare: statement,
    async run(sql, params = []) {
      const client = await current();
      try { const r = await client.query(withReturning(translate(sql, pgDialect)), params); return { changes: r.rowCount, lastInsertRowid: r.rows[0] ? Number(r.rows[0].id) : 0 }; }
      finally { releaseIfIdle(client); }
    },
    async get(sql, params = []) {
      const client = await current();
      try { const r = await client.query(translate(sql, pgDialect), params); return mapRow(r.rows[0]); }
      finally { releaseIfIdle(client); }
    },
    async all(sql, params = []) {
      const client = await current();
      try { const r = await client.query(translate(sql, pgDialect), params); return r.rows.map(mapRow); }
      finally { releaseIfIdle(client); }
    },
    async exec(sql) {
      const client = await current();
      try { await client.query(sql); return { changes: 0 }; }
      finally { releaseIfIdle(client); }
    },
    async execBatch(sqls) {
      const client = await current();
      try { for (const s of sqls) await client.query(s); }
      finally { releaseIfIdle(client); }
    },
    // 事务：db.transaction(fn) 返回可调用包装；嵌套事务复用同一连接（不额外 BEGIN）
    transaction(fn) {
      return async function wrapped(...args) {
        if (txClient) {
          txDepth++;
          try { return await fn(...args); }
          finally { txDepth--; }
        }
        const client = await pool.connect();
        txClient = client;
        txDepth = 1;
        try {
          await client.query('BEGIN');
          const out = await fn(...args);
          await client.query('COMMIT');
          return out;
        } catch (e) {
          try { await client.query('ROLLBACK'); } catch (_) {}
          throw e;
        } finally {
          txClient = null;
          txDepth = 0;
          client.release();
        }
      };
    },
    async close() { await pool.end(); },
  };
}

module.exports = { createPostgresDriver, withReturning };