const Database = require('better-sqlite3');
const { sqlite } = require('../../datasources/dialects');

// SQLite driver — 同步实现（Task 4-6 过渡期，调用方暂不 await 也返回真实值）
function createSqliteDriver(dbPath) {
  const raw = new Database(dbPath);
  raw.pragma('journal_mode = WAL');
  raw.pragma('foreign_keys = ON');
  let txDepth = 0;

  const forStmt = (sql) => {
    const stmt = raw.prepare(sql);
    return {
      run: (...params) => {
        const r = stmt.run(...params);
        return { changes: r.changes, lastInsertRowid: r.lastInsertRowid };
      },
      get: (...params) => stmt.get(...params),
      all: (...params) => stmt.all(...params),
    };
  };

  return {
    type: 'sqlite',
    dialect: sqlite,
    prepare: forStmt,
    run(sql, params = []) {
      const stmt = raw.prepare(sql);
      const r = stmt.run(...(Array.isArray(params) ? params : [params]));
      return { changes: r.changes, lastInsertRowid: r.lastInsertRowid };
    },
    get(sql, params = []) {
      return raw.prepare(sql).get(...(Array.isArray(params) ? params : [params]));
    },
    all(sql, params = []) {
      return raw.prepare(sql).all(...(Array.isArray(params) ? params : [params]));
    },
    exec(sql) {
      raw.exec(sql);
      return { changes: 0 };
    },
    execBatch(sqls) {
      for (const s of sqls) raw.exec(s);
    },
    // 事务：db.transaction(fn) 返回异步可调用包装（调用后 await）
    // 兼容 better-sqlite3 嵌套语义：根事务 BEGIN/COMMIT，嵌套用 SAVEPOINT/RELEASE
    // fn 可为同步或 async；async 回调用例中 await fn 后再 COMMIT（保证回滚正确）
    transaction(fn) {
      return async function wrapped(...args) {
        const isRoot = txDepth === 0;
        const marker = isRoot ? null : `kb_tx_${txDepth}`;
        raw.exec(isRoot ? 'BEGIN' : `SAVEPOINT ${marker}`);
        txDepth++;
        try {
          const out = await fn(...args);
          txDepth--;
          raw.exec(isRoot ? 'COMMIT' : `RELEASE ${marker}`);
          return out;
        } catch (e) {
          txDepth--;
          raw.exec(isRoot ? 'ROLLBACK' : `ROLLBACK TO ${marker}`);
          throw e;
        }
      };
    },
    close() {
      raw.close();
    },
    raw,
  };
}

module.exports = { createSqliteDriver };