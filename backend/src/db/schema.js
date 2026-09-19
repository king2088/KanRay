// 元数据模式引导：按方言执行 DDL + 旧库迁移，并为数据集数据表生成动态建表
// SQLite driver 同步（require 即建表），Postgres driver 异步；
// maybeAwait 桥接两种，确保 Postgres 路径正确 await。
const { translate } = require('./translate');

const isThenable = (v) => v && typeof v.then === 'function';
function maybeAwait(v, fn) { return isThenable(v) ? v.then(fn) : fn(v); }

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
  let q;
  if (t === 'sqlite') q = store.all("SELECT name FROM sqlite_master WHERE type='table'");
  else if (t === 'mysql' || t === 'mariadb') q = store.all('SHOW TABLES');
  else if (t === 'postgres') q = store.all("SELECT tablename AS name FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
  else if (t === 'sqlserver') q = store.all('SELECT TABLE_NAME AS name FROM INFORMATION_SCHEMA.TABLES');
  else if (t === 'oracle') q = store.all('SELECT table_name AS name FROM user_tables');
  else return [];
  const mapFn = (rows) => {
    if (t === 'sqlite') return rows.map((r) => r.name);
    if (t === 'mysql' || t === 'mariadb') return rows.map((r) => Object.values(r)[0]);
    return rows.map((r) => r.name || Object.values(r)[0]);
  };
  return maybeAwait(q, mapFn);
}

function listColumns(store, table) {
  const t = store.type;
  let q;
  if (t === 'sqlite') q = store.all(`PRAGMA table_info('${table}')`);
  else if (t === 'mysql' || t === 'mariadb') q = store.all(`SHOW COLUMNS FROM \`${table}\``);
  else if (t === 'postgres') q = store.all('SELECT column_name AS name FROM information_schema.columns WHERE table_name = ?', [table]);
  else if (t === 'sqlserver') q = store.all('SELECT COLUMN_NAME AS name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ?', [table]);
  else if (t === 'oracle') q = store.all('SELECT column_name AS name FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = UPPER(?) ORDER BY column_id', [table]);
  else return [];
  const mapFn = (rows) => {
    if (t === 'sqlite') return rows.map((c) => ({ name: c.name }));
    if (t === 'mysql' || t === 'mariadb') return rows.map((c) => ({ name: c.Field || c.field }));
    return rows.map((c) => ({ name: c.name }));
  };
  return maybeAwait(q, mapFn);
}

function hasColumn(store, table, col) {
  const v = listColumns(store, table);
  const check = (cols) => cols.some((c) => String(c.name).toLowerCase() === String(col).toLowerCase());
  return maybeAwait(v, check);
}

function runDdl(store) {
  const ddl = dialectDdl[store.type] || dialectDdl.sqlite;
  const withIfNotExists = IF_NOT_EXISTS.has(store.type);

  const existingSet = (rows) => new Set(rows.map((n) => String(n).toUpperCase()));

  const doRun = (existing) => {
    const stmts = ddl.filter((rawStmt) => {
      const m = rawStmt.trim().match(/^CREATE TABLE(?:\s+IF NOT EXISTS)?\s+"?([A-Za-z_$][\w$]*)"?/i);
      return withIfNotExists || !m || !existing.has(String(m[1]).toUpperCase());
    });

    // 逐条执行 DDL，兼容同步（SQLite）与异步（Postgres）驱动；每条只执行一次
    const runSafe = (i) => {
      if (i >= stmts.length) return;
      const stmt = translate(stmts[i], store.dialect);
      const isIndexStmt = /CREATE INDEX/i.test(stmt);
      const tolerate = (e) => !withIfNotExists && isIndexStmt && /(already exists|ORA-01408|ORA-00955|name is already used)/i.test(String(e.message));
      try {
        const execResult = store.exec(stmt);
        if (isThenable(execResult)) {
          return execResult.then(() => runSafe(i + 1), (e) => {
            if (tolerate(e)) return runSafe(i + 1);
            throw e;
          });
        }
        return runSafe(i + 1);
      } catch (e) {
        if (tolerate(e)) return runSafe(i + 1);
        throw e;
      }
    };

    return runSafe(0);
  };

  if (withIfNotExists) return doRun(new Set());
  const tables = listTables(store);
  return maybeAwait(tables, (rows) => doRun(existingSet(rows)));
}

// 旧库列补齐（预埋列已含于基表 DDL，此处仅兜底既有库）；写法用方言无关的 ADD + 由 translate 处理标识符
function ensureSchema(store) {
  const needCols = {
    datasets: [['source_type', "TEXT NOT NULL DEFAULT 'excel'"], ['datasource_id', 'INTEGER'], ['schema_name', 'TEXT'], ['table_name_ext', 'TEXT'], ['build_definition', 'TEXT'], ['owner_id', 'INTEGER']],
    dashboards: [['gap_x', 'INTEGER NOT NULL DEFAULT 12'], ['gap_y', 'INTEGER NOT NULL DEFAULT 12'], ['card_style', "TEXT NOT NULL DEFAULT '{}'"], ['owner_id', 'INTEGER']],
    charts: [['owner_id', 'INTEGER']],
    sync_configs: [['reconcile_delete', 'INTEGER NOT NULL DEFAULT 1']],
  };

  const alterSync = () => {
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
  };

  const alterAsync = async () => {
    for (const [table, cols] of Object.entries(needCols)) {
      const colList = await listColumns(store, table);
      const existing = new Set(colList.map((c) => c.name));
      for (const [col, ddl] of cols) {
        if (!existing.has(col)) {
          const r = store.exec(translate(`ALTER TABLE ${store.dialect.quoteIdent(table)} ADD ${store.dialect.quoteIdent(col)} ${ddl}`, store.dialect));
          if (isThenable(r)) await r;
        }
      }
    }
    const dsCol = await hasColumn(store, 'data_sources', 'mode');
    if (!dsCol) {
      const r = store.exec(translate("ALTER TABLE data_sources ADD mode TEXT NOT NULL DEFAULT 'direct'", store.dialect));
      if (isThenable(r)) await r;
    }
  };

  // SQLite 驱动同步：保持 require 即建表的同步语义；远程驱动走 async 分支
  if (store.type === 'sqlite') {
    runDdl(store);
    alterSync();
    return undefined;
  }
  return maybeAwait(runDdl(store), () => maybeAwait(alterAsync(), () => {}));
}

function ensureDatasetTable(store, schemaName, fields, pkColumns) {
  const withIfNotExists = IF_NOT_EXISTS.has(store.type);
  const buildCols = () => fields.map((f) => {
    const canon = f.canonicalType || f.type;
    const type = store.dialect.typeMapping[canon] || store.dialect.typeMapping.string;
    return `${store.dialect.quoteIdent(f.name)} ${type}`;
  });
  const createTable = (exists) => {
    if (exists) return store;
    const cols = buildCols();
    if (pkColumns && pkColumns.length > 0) cols.push(`PRIMARY KEY (${pkColumns.map((c) => store.dialect.quoteIdent(c)).join(', ')})`);
    const r = store.exec(`CREATE TABLE${withIfNotExists ? ' IF NOT EXISTS' : ''} ${store.dialect.quoteIdent(schemaName)} (${cols.join(', ')})`);
    return maybeAwait(r, () => store);
  };
  if (withIfNotExists) return createTable(false);
  const tables = listTables(store);
  return maybeAwait(tables, (rows) => createTable(rows.map((n) => String(n).toUpperCase()).includes(String(schemaName).toUpperCase())));
}

module.exports = { ensureSchema, ensureDatasetTable, listColumns, hasColumn, listTables, IF_NOT_EXISTS };