// src/db/drivers/postgres.js
// PostgreSQL 应用存储 driver（Task 8）
// 统一契约：await db.prepare(sql).run/get/all(...)、db.run/get/all/exec/execBatch、
// db.transaction(fn) 返回可调用包装（await 后执行）。
// `run` 对 INSERT INTO 自动追加 `RETURNING *`（无 RETURNING / 非 ON CONFLICT 结尾）以回读自增 id。
const { Pool } = require('pg');
const { AsyncLocalStorage } = require('node:async_hooks');
require('../../utils/pg-types');
const { translate } = require('../translate');
const config = require('../../config');
const { pg: pgDialect } = require('../../datasources/dialects');
const { normalizeRowDates } = require('../../utils/datetime');

// 仅对带显式列名列表的 INSERT 追加 RETURNING：无列名（INSERT INTO t VALUES ...）
// 是数据集数据表批量写入（`ensureDatasetTable` 建表无自增 id 列），追加会报错。
// 用 RETURNING *（而非 RETURNING id）以兼容无 id 列的表（sync_locks / role_permissions 等），
// 回读时按需取 rows[0].id，无 id 列则 lastInsertRowid=0。
const INSERT_WITH_COLS_RE = /^INSERT\s+INTO\s+(?:"[^"]*"|`[^`]*`|\[[^\]]*\]|[^\s(]+)(?:\s*\.\s*(?:"[^"]*"|`[^`]*`|\[[^\]]*\]|[^\s(]+))?\s*\(/i;

function withReturning(sql) {
  const s = String(sql).trim();
  if (INSERT_WITH_COLS_RE.test(s) && !/\bRETURNING\b/i.test(s) && !/ON\s+CONFLICT[\s\S]*$/i.test(s)) {
    return `${s} RETURNING *`;
  }
  return s;
}

// 保持列名原样返回（PG 默认输出小写；AS 别名如 chartType/datasetId 保持与 SQLite 驱动一致），
// 仅统一 null → undefined 空行语义；时间列统一为 'YYYY-MM-DD HH:MM:SS'
const mapRow = (r) => (r == null ? undefined : normalizeRowDates(r));

function createPostgresDriver(url) {
  const pool = new Pool({ connectionString: url, max: config.db.poolMax });

  // 事务连接用 AsyncLocalStorage 按异步调用链隔离：并发事务各自绑定自己的连接。
  // 不能用单个模块级 txClient——并发请求会互相覆盖，导致语句跑错连接、
  // 甚至 "Release called on client which has already been released"。
  const txStore = new AsyncLocalStorage();
  const current = async () => {
    const tx = txStore.getStore();
    if (tx) return tx.client;
    return pool.connect();
  };
  const releaseIfIdle = (client) => { if (!txStore.getStore()) client.release(); };

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
      // runQuery 内部已负责获取/释放连接，这里不再额外 current()，
      // 否则每次查询会占用两条连接（仅在事务外用池，DB_POOL_MAX 小时可能耗尽）。
      run: async (...params) => {
        const r = await runQuery(t, params);
        return { changes: r.rowCount, lastInsertRowid: r.rows[0] ? r.rows[0].id : 0 };
      },
      get: async (...params) => {
        const r = await runQuery(t, params);
        return mapRow(r.rows[0]);
      },
      all: async (...params) => {
        const r = await runQuery(t, params);
        return r.rows.map(mapRow);
      },
    };
  };

  return {
    type: 'postgres',
    dialect: pgDialect,
    prepare: statement,
    // 同 statement：runQuery 自管连接，避免每次查询占用两条连接
    async run(sql, params = []) {
      const r = await runQuery(withReturning(translate(sql, pgDialect, { quoteAliases: true })), params);
      return { changes: r.rowCount, lastInsertRowid: r.rows[0] ? r.rows[0].id : 0 };
    },
    async get(sql, params = []) {
      const r = await runQuery(translate(sql, pgDialect, { quoteAliases: true }), params);
      return mapRow(r.rows[0]);
    },
    async all(sql, params = []) {
      const r = await runQuery(translate(sql, pgDialect, { quoteAliases: true }), params);
      return r.rows.map(mapRow);
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
    // 事务：db.transaction(fn) 返回可调用包装；嵌套事务复用外层连接（不额外 BEGIN）
    transaction(fn) {
      return async function wrapped(...args) {
        if (txStore.getStore()) return fn(...args);
        const client = await pool.connect();
        try {
          return await txStore.run({ client }, async () => {
            await client.query('BEGIN');
            const out = await fn(...args);
            await client.query('COMMIT');
            return out;
          });
        } catch (e) {
          try { await client.query('ROLLBACK'); } catch (_) {}
          throw e;
        } finally {
          client.release();
        }
      };
    },
    async close() { await pool.end(); },
  };
}

module.exports = { createPostgresDriver, withReturning };