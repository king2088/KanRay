// src/db/drivers/postgres.js
// PostgreSQL 应用存储 driver（Task 8）
// 统一契约：await db.prepare(sql).run/get/all(...)、db.run/get/all/exec/execBatch、
// db.transaction(fn) 返回可调用包装（await 后执行）。
// `run` 对 INSERT INTO 自动追加 `RETURNING id`（无 RETURNING / 非 ON CONFLICT 结尾）以回读自增 id。
const { Pool } = require('pg');
const { translate } = require('../translate');
const { pg: pgDialect } = require('../../datasources/dialects');

const INSERT_RE = /^INSERT\s+INTO/i;
// 仅对带显式列名列表的 INSERT 追加 RETURNING id：无列名（INSERT INTO t VALUES ...）
// 是数据集数据表批量写入（`ensureDatasetTable` 建表无自增 id 列），追加会报 id 列不存在
const INSERT_WITH_COLS_RE = /^INSERT\s+INTO\s+(?:"[^"]*"|`[^`]*`|\[[^\]]*\]|[^\s(]+)(?:\s*\.\s*(?:"[^"]*"|`[^`]*`|\[[^\]]*\]|[^\s(]+))?\s*\(/i;

function withReturning(sql) {
  const s = String(sql).trim();
  if (INSERT_WITH_COLS_RE.test(s) && !/\bRETURNING\b/i.test(s) && !/ON\s+CONFLICT[\s\S]*$/i.test(s)) {
    return `${s} RETURNING id`;
  }
  return s;
}

// 保持列名原样返回（PG 默认输出小写；AS 别名如 chartType/datasetId 保持与 SQLite 驱动一致），
// 仅统一 null → undefined 空行语义
const mapRow = (r) => r ?? undefined;

function createPostgresDriver(url) {
  const pool = new Pool({ connectionString: url, max: 10 });

  let txClient = null;
  let txDepth = 0;
  const current = async () => txClient || pool.connect();
  const releaseIfIdle = (client) => { if (!txClient) client.release(); };

  // 查询失败时附加实际 SQL 与参数，便于定位 translate/dialect 问题
  const runQuery = async (query, params) => {
    const client = await current();
    try {
      return await client.query(query, params);
    } catch (e) {
      e.sql = query;
      e.sqlParams = params;
      throw e;
    } finally {
      releaseIfIdle(client);
    }
  };

  const statement = (sql) => {
    const t = withReturning(translate(sql, pgDialect, { quoteAliases: true }));
    return {
      run: async (...params) => {
        const client = await current();
        try { const r = await runQuery(t, params); return { changes: r.rowCount, lastInsertRowid: r.rows[0] ? Number(r.rows[0].id) : 0 }; }
        finally { releaseIfIdle(client); }
      },
      get: async (...params) => {
        const client = await current();
        try { const r = await runQuery(t, params); return mapRow(r.rows[0]); }
        finally { releaseIfIdle(client); }
      },
      all: async (...params) => {
        const client = await current();
        try { const r = await runQuery(t, params); return r.rows.map(mapRow); }
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
      try { const r = await runQuery(withReturning(translate(sql, pgDialect, { quoteAliases: true })), params); return { changes: r.rowCount, lastInsertRowid: r.rows[0] ? Number(r.rows[0].id) : 0 }; }
      finally { releaseIfIdle(client); }
    },
    async get(sql, params = []) {
      const client = await current();
      try { const r = await runQuery(translate(sql, pgDialect, { quoteAliases: true }), params); return mapRow(r.rows[0]); }
      finally { releaseIfIdle(client); }
    },
    async all(sql, params = []) {
      const client = await current();
      try { const r = await runQuery(translate(sql, pgDialect, { quoteAliases: true }), params); return r.rows.map(mapRow); }
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
          await runQuery('BEGIN');
          const out = await fn(...args);
          await runQuery('COMMIT');
          return out;
        } catch (e) {
          try { await runQuery('ROLLBACK'); } catch (_) {}
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