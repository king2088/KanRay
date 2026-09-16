const path = require('path');
const config = require('../config');
const { createSqliteDriver } = require('./drivers/sqlite');

// 装配应用存储 driver：默认 SQLite，其余按 config.db.type 动态加载（Task 8-9 提供）。
// 可选 ovr = { type, url, sqlitePath } 覆盖 config（供迁移脚本同时连接双端）。
function createStore(ovr) {
  const c = ovr || config.db;
  const t = String(c.type || 'sqlite').toLowerCase();
  if (t === 'sqlite') {
    const p = c.sqlitePath || 'data/kanban.db';
    return createSqliteDriver(path.isAbsolute(p) ? p : path.join(config.root, p));
  }
  if (t === 'mysql' || t === 'mariadb') {
    const { createMysqlDriver } = require('./drivers/mysql');
    return createMysqlDriver(c.url, t);
  }
  if (t === 'postgres') {
    const { createPostgresDriver } = require('./drivers/postgres');
    return createPostgresDriver(c.url);
  }
  if (t === 'sqlserver') {
    const { createMssqlDriver } = require('./drivers/mssql');
    return createMssqlDriver(c.url);
  }
  if (t === 'oracle') {
    const { createOracleDriver } = require('./drivers/oracle');
    return createOracleDriver(c.url);
  }
  throw new Error(`不支持的 DB_TYPE: ${t}`);
}

module.exports = { createStore };