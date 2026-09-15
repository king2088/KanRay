const config = require('../config');
const { createSqliteDriver } = require('./drivers/sqlite');

// 装配应用存储 driver：默认 SQLite，其余按 config.db.type 动态加载（Task 8-9 提供）
function createStore() {
  const t = config.db.type;
  if (t === 'sqlite') return createSqliteDriver(config.db.sqlitePath);
  if (t === 'mysql' || t === 'mariadb') {
    const { createMysqlDriver } = require('./drivers/mysql');
    return createMysqlDriver(config.db.url, t);
  }
  if (t === 'postgres') {
    const { createPostgresDriver } = require('./drivers/postgres');
    return createPostgresDriver(config.db.url);
  }
  if (t === 'sqlserver') {
    const { createMssqlDriver } = require('./drivers/mssql');
    return createMssqlDriver(config.db.url);
  }
  if (t === 'oracle') {
    const { createOracleDriver } = require('./drivers/oracle');
    return createOracleDriver(config.db.url);
  }
  throw new Error(`不支持的 DB_TYPE: ${t}`);
}

module.exports = { createStore };