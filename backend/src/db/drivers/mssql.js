// src/db/drivers/mssql.js
// SQL Server 应用存储 driver（Task 9）
// 统一契约：await db.prepare(sql).run/get/all(...)、db.run/get/all/exec/execBatch、
// db.transaction(fn) 返回可调用包装（await 后执行）。
// INSERT 场景在同一 batch 内追加 `SELECT SCOPE_IDENTITY() AS id` 回读自增 id（同 scope 有效）。
const sql = require('mssql');
const { translate } = require('../translate');
const { mssql: mssqlDialect } = require('../../datasources/dialects');

function parseMssqlUrl(url) {
  const u = new URL(url);
  return {
    server: u.hostname,
    port: u.port ? Number(u.port) : 1433,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '') || 'benchbuild',
    options: { encrypt: false, trustServerCertificate: true },
    pool: { max: 10, min: 0 },
  };
}

const isInsert = (sqlText) => /^\s*INSERT\s+INTO/i.test(sqlText);
const lowerKeys = (rows) => (rows || []).map((r) => Object.fromEntries(Object.entries(r || {}).map(([k, v]) => [k.toLowerCase(), v])));
const changesOf = (r) => (r.rowsAffected && r.rowsAffected[0]) || 0;

function createMssqlDriver(url) {
  const pool = new sql.ConnectionPool(parseMssqlUrl(url));

  // 事务期间：语句走同一 Transaction 下的 request（连接绑定）；事务外走池。
  let txTrans = null;
  let txDepth = 0;
  // mssql v12：pool.request() 需先 connect() 才可用；首次使用时懒连接（形状断言不触发建连）
  let connected = null;
  const ensureConnected = () => connected || (connected = pool.connect());
  const _req = async () => { await ensureConnected(); return txTrans ? txTrans.request() : pool.request(); };

  const statement = (text) => {
    const t = translate(text, mssqlDialect);
    return {
      run: async (...params) => {
        const req = await _req();
        params.forEach((v, i) => req.input('p' + i, v));
        if (isInsert(t)) {
          const r = await req.query(`${t};\nSELECT SCOPE_IDENTITY() AS id;`);
          return {
            changes: changesOf(r),
            lastInsertRowid: Number((r.recordset && r.recordset[0] && r.recordset[0].id) || 0),
          };
        }
        const r = await req.query(t);
        return { changes: changesOf(r), lastInsertRowid: 0 };
      },
      get: async (...params) => {
        const req = await _req();
        params.forEach((v, i) => req.input('p' + i, v));
        const r = await req.query(t);
        return lowerKeys(r.recordset)[0];
      },
      all: async (...params) => {
        const req = await _req();
        params.forEach((v, i) => req.input('p' + i, v));
        const r = await req.query(t);
        return lowerKeys(r.recordset);
      },
    };
  };

  return {
    type: 'sqlserver',
    dialect: mssqlDialect,
    prepare: statement,
    async run(text, params = []) { return statement(text).run(...params); },
    async get(text, params = []) { return statement(text).get(...params); },
    async all(text, params = []) { return statement(text).all(...params); },
    async exec(text) {
      // exec 无参数，支持多语句 batch（DDL 引导）
      const req = await _req();
      await req.batch(text);
      return { changes: 0 };
    },
    async execBatch(sqls) {
      for (const s of sqls) await this.exec(s);
    },
    transaction(fn) {
      return async function wrapped(...args) {
        if (txTrans) {
          txDepth++;
          try { return await fn(...args); }
          finally { txDepth--; }
        }
        await ensureConnected();
        const trans = new sql.Transaction(pool);
        txTrans = trans;
        txDepth = 1;
        try {
          await trans.begin();
          const out = await fn(...args);
          await trans.commit();
          return out;
        } catch (e) {
          try { await trans.rollback(); } catch (_) {}
          throw e;
        } finally {
          txTrans = null;
          txDepth = 0;
        }
      };
    },
    async close() { await pool.close(); },
  };
}

module.exports = { createMssqlDriver, parseMssqlUrl };