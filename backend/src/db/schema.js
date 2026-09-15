// 元数据模式引导：按方言执行 DDL + 旧库迁移，并为数据集数据表生成动态建表
// 说明：当前 sqlite driver 为同步实现，本模块采用同步函数（require 即建表）；
//      remote 驱动接入（Task 7/8）时统一切换为 async/await。
const { translate } = require('./translate');

const dialectDdl = {
  sqlite: require('./ddl/sqlite'),
  mysql: require('./ddl/mysql'),
  mariadb: require('./ddl/mysql'),
  postgres: require('./ddl/postgres'),
  sqlserver: require('./ddl/mssql'),
  oracle: require('./ddl/oracle'),
};

// 支持 IF NOT EXISTS 的方言（mssql/oracle 需先查表存在性）
const IF_NOT_EXISTS = new Set(['sqlite', 'mysql', 'mariadb', 'postgres']);

function listTables(store) {
  const t = store.type;
  if (t === 'sqlite') return store.all("SELECT name FROM sqlite_master WHERE type='table'").map((r) => r.name);
  if (t === 'mysql' || t === 'mariadb') return store.all('SHOW TABLES').map((r) => Object.values(r)[0]);
  if (t === 'postgres') return store.all("SELECT tablename AS name FROM pg_catalog.pg_tables WHERE schemaname = 'public'").map((r) => r.name);
  if (t === 'sqlserver') return store.all('SELECT TABLE_NAME AS name FROM INFORMATION_SCHEMA.TABLES').map((r) => r.name);
  if (t === 'oracle') return store.all('SELECT table_name AS name FROM user_tables').map((r) => r.name);
  return [];
}

function listColumns(store, table) {
  const t = store.type;
  if (t === 'sqlite') return store.all(`PRAGMA table_info('${table}')`).map((c) => ({ name: c.name }));
  if (t === 'mysql' || t === 'mariadb') return store.all(`SHOW COLUMNS FROM \`${table}\``).map((c) => ({ name: c.Field || c.field }));
  if (t === 'postgres') return store.all('SELECT column_name AS name FROM information_schema.columns WHERE table_name = ?', [table]).map((c) => ({ name: c.name }));
  if (t === 'sqlserver') return store.all('SELECT COLUMN_NAME AS name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ?', [table]).map((c) => ({ name: c.name }));
  if (t === 'oracle') return store.all('SELECT column_name AS name FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = UPPER(?) ORDER BY column_id', [table]).map((c) => ({ name: c.name }));
  return [];
}

function hasColumn(store, table, col) {
  return listColumns(store, table).some((c) => String(c.name).toLowerCase() === String(col).toLowerCase());
}

function runDdl(store) {
  const ddl = dialectDdl[store.type] || dialectDdl.sqlite;
  const withIfNotExists = IF_NOT_EXISTS.has(store.type);
  let existing = null;
  if (!withIfNotExists) existing = new Set(listTables(store).map((n) => String(n).toUpperCase()));
  for (const rawStmt of ddl) {
    const m = rawStmt.trim().match(/^CREATE TABLE(?:\s+IF NOT EXISTS)?\s+"?([A-Za-z_$][\w$]*)"?/i);
    if (!withIfNotExists && m && existing.has(String(m[1]).toUpperCase())) continue;
    const stmt = translate(rawStmt, store.dialect);
    try {
      store.exec(stmt);
    } catch (e) {
      // mssql/oracle 无 IF NOT EXISTS：索引重名视为幂等
      if (!withIfNotExists && /CREATE INDEX/i.test(stmt) && /(already exists|ORA-01408|ORA-00955|name is already used)/i.test(String(e.message))) continue;
      throw e;
    }
  }
}

// 旧库列补齐（预埋列已含于基表 DDL，此处仅兜底既有库）；写法用方言无关的 ADD + 由 translate 处理标识符
function ensureSchema(store) {
  runDdl(store);
  const needCols = {
    datasets: [['source_type', "TEXT NOT NULL DEFAULT 'excel'"], ['datasource_id', 'INTEGER'], ['schema_name', 'TEXT'], ['table_name_ext', 'TEXT'], ['build_definition', 'TEXT'], ['owner_id', 'INTEGER']],
    dashboards: [['gap_x', 'INTEGER NOT NULL DEFAULT 12'], ['gap_y', 'INTEGER NOT NULL DEFAULT 12'], ['card_style', "TEXT NOT NULL DEFAULT '{}'"], ['owner_id', 'INTEGER']],
    charts: [['owner_id', 'INTEGER']],
  };
  for (const [table, cols] of Object.entries(needCols)) {
    const existing = new Set(listColumns(store, table).map((c) => c.name));
    for (const [col, ddl] of cols) {
      if (!existing.has(col)) {
        store.exec(translate(`ALTER TABLE ${store.dialect.quoteIdent(table)} ADD ${store.dialect.quoteIdent(col)} ${ddl}`, store.dialect));
      }
    }
  }
  if (!hasColumn(store, 'data_sources', 'mode')) {
    store.exec(translate("ALTER TABLE data_sources ADD mode TEXT NOT NULL DEFAULT 'direct'", store.dialect));
  }
}

function ensureDatasetTable(store, schemaName, fields, pkColumns) {
  const withIfNotExists = IF_NOT_EXISTS.has(store.type);
  if (!withIfNotExists && listTables(store).map((n) => String(n).toUpperCase()).includes(String(schemaName).toUpperCase())) return store;
  const cols = fields.map((f) => {
    const canon = f.canonicalType || f.type;
    const type = store.dialect.typeMapping[canon] || store.dialect.typeMapping.string;
    return `${store.dialect.quoteIdent(f.name)} ${type}`;
  });
  if (pkColumns && pkColumns.length > 0) {
    cols.push(`PRIMARY KEY (${pkColumns.map((c) => store.dialect.quoteIdent(c)).join(', ')})`);
  }
  return store.exec(`CREATE TABLE${withIfNotExists ? ' IF NOT EXISTS' : ''} ${store.dialect.quoteIdent(schemaName)} (${cols.join(', ')})`);
}

module.exports = { ensureSchema, ensureDatasetTable, listColumns, hasColumn, listTables, IF_NOT_EXISTS };