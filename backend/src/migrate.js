// src/migrate.js
// 跨库数据迁移库（解决「不做旧库→新库自动数据迁移」）：元数据表 + 数据表（ds_*/sync_*）全量复制。
// 设计：
//  - 源/目标通过 createStore({type,url,sqlitePath}) 显式连接（与 config 解耦）。
//  - createTable 由源列类型自省 -> canonical（integer/number/string/date/boolean）-> 目标方言 typeMapping 重建。
//  - 元数据表明细列 ID 保留执行（保证 FK 有效）；自增序列按方言 best-effort 重置。
//  - mssql 显式 ID 插入前 SET IDENTITY_INSERT ON/OFF。
const { translate } = require('./db/translate');
const { createStore } = require('./db/index');
const { listTables } = require('./db/schema');

const STORE_TYPES = ['sqlite', 'mysql', 'mariadb', 'postgres', 'sqlserver', 'oracle'];

// FK 安全顺序：先父后子
const META_ORDER = [
  'users',
  'roles',
  'permissions',
  'data_sources',
  'datasets',
  'dataset_fields',
  'charts',
  'dashboards',
  'sync_configs',
  'sync_logs',
  'refresh_tokens',
  'user_roles',
  'role_permissions',
  'audit_logs',
];

const dialectDdl = {
  sqlite: require('./db/ddl/sqlite'),
  mysql: require('./db/ddl/mysql'),
  mariadb: require('./db/ddl/mysql'),
  postgres: require('./db/ddl/postgres'),
  sqlserver: require('./db/ddl/mssql'),
  oracle: require('./db/ddl/oracle'),
};

const IF_NOT_EXISTS = new Set(['sqlite', 'mysql', 'mariadb', 'postgres']);

const asPromise = (v) => Promise.resolve(v);

/**
 * 解析连接串：TYPE@URL（如 sqlite@data/kanban.db、postgres@postgresql://...）。
 */
function parseConn(s) {
  const i = String(s).indexOf('@');
  if (i <= 0) throw new Error(`连接串需为 TYPE@URL，例如 sqlite@data/kanban.db`);
  const type = String(s.slice(0, i)).toLowerCase();
  const url = String(s.slice(i + 1)).trim();
  if (!STORE_TYPES.includes(type)) throw new Error(`不支持的类型 "${type}"，可选: ${STORE_TYPES.join('/')}`);
  if (!url) throw new Error('缺少 URL');
  return { type, url };
}

/** 连接串 -> createStore 覆盖参数 */
function toStoreOverride(conn) {
  if (conn.type === 'sqlite') return { type: 'sqlite', sqlitePath: conn.url };
  return { type: conn.type, url: conn.url };
}

const typeOf = (driver, text) => {
  const t = String(text).toLowerCase();
  const map = {
    sqlite: () => {
      if (t.includes('bool')) return 'boolean';
      if (t.includes('int')) return 'integer';
      if (t.includes('real') || t.includes('floating') || t.includes('doubl') || t.includes('numeric') || t.includes('decimal')) return 'number';
      if (t.includes('char') || t.includes('clob') || t.includes('text')) return 'string';
      if (t.includes('date') || t.includes('time')) return 'date';
      return 'string';
    },
    mysql: () => {
      if (t.includes('bool') || /^tinyint\(1\)/.test(t)) return 'boolean';
      if (t.includes('int') || t.includes('year')) return 'integer';
      if (t.includes('decimal') || t.includes('numeric') || t.includes('double') || t.includes('float') || t.includes('real')) return 'number';
      if (t.includes('date') || t.includes('time') || t.includes('timestamp')) return 'date';
      return 'string';
    },
    mariadb: () => {
      if (t.includes('bool') || /^tinyint\(1\)/.test(t)) return 'boolean';
      if (t.includes('int') || t.includes('year')) return 'integer';
      if (t.includes('decimal') || t.includes('numeric') || t.includes('double') || t.includes('float') || t.includes('real')) return 'number';
      if (t.includes('date') || t.includes('time') || t.includes('timestamp')) return 'date';
      return 'string';
    },
    postgres: () => {
      if (t === 'boolean') return 'boolean';
      if (t.includes('int')) return 'integer';
      if (t.includes('numeric') || t.includes('decimal') || t.includes('double') || t.includes('real') || t.includes('float') || t.includes('money')) return 'number';
      if (t.includes('date') || t.includes('time')) return 'date';
      return 'string';
    },
    sqlserver: () => {
      if (t === 'bit') return 'boolean';
      if (t.includes('int')) return 'integer';
      if (t.includes('decimal') || t.includes('numeric') || t.includes('float') || t.includes('real') || t.includes('money')) return 'number';
      if (t.includes('date') || t.includes('time')) return 'date';
      return 'string';
    },
    oracle: () => {
      if (t.includes('int')) return 'integer';
      if (t === 'number') return 'number';
      if (t.includes('date') || t.includes('timestamp')) return 'date';
      return 'string';
    },
  };
  return (map[driver] || (() => 'string'))();
};

// 各方言列自省 -> [{ name, canonical }]（保持源列序）
function introspectColumns(store, table) {
  const t = store.type;
  const lower = (v) => String(v || '').toLowerCase();
  const maps = {
    sqlite: () => asPromise(store.all(`PRAGMA table_info('${table}')`)).then((rows) =>
      rows.map((c) => ({ name: c.name, canonical: typeOf('sqlite', c.type) }))),
    mysql: () =>
      asPromise(store.all(`SHOW FULL COLUMNS FROM \`${table}\``)).then((rows) =>
        rows.map((c) => ({ name: c.field ?? c.Field, canonical: typeOf('mysql', c.type ?? c.Type) }))),
    mariadb: () =>
      asPromise(store.all(`SHOW FULL COLUMNS FROM \`${table}\``)).then((rows) =>
        rows.map((c) => ({ name: c.field ?? c.Field, canonical: typeOf('mariadb', c.type ?? c.Type) }))),
    postgres: () =>
      asPromise(
        store.all(
          "SELECT column_name AS name, data_type AS data_type, is_nullable AS is_nullable FROM information_schema.columns WHERE table_name = ? ORDER BY ordinal_position",
          [table],
        ),
      ).then((rows) => rows.map((c) => ({ name: c.name, canonical: typeOf('postgres', c.data_type) }))),
    sqlserver: () =>
      asPromise(
        store.all(
          "SELECT COLUMN_NAME AS name, DATA_TYPE AS data_type FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? ORDER BY ORDINAL_POSITION",
          [table],
        ),
      ).then((rows) => rows.map((c) => ({ name: c.name, canonical: typeOf('sqlserver', c.data_type) }))),
    oracle: () =>
      asPromise(
        store.all(
          'SELECT column_name AS name, data_type AS data_type FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = UPPER(?) ORDER BY column_id',
          [table],
        ),
      ).then((rows) =>
        rows.map((c) => {
          let canonical = typeOf('oracle', c.data_type);
          if (canonical === 'number' && lower(c.name) === 'id' && parseInt(c.data_scale, 10) === 0) canonical = 'integer';
          return { name: c.name, canonical };
        }),
      ),
  };
  const fn = maps[t];
  if (!fn) return asPromise([]);
  return fn();
}

async function tableExists(store, table) {
  const ts = await asPromise(listTables(store));
  return ts.some((n) => String(n).toLowerCase() === String(table).toLowerCase());
}

/** 目标缺表则按源列结构重建 */
async function ensureTable(store, table, cols) {
  if (await tableExists(store, table)) return;
  const tm = store.dialect.typeMapping || { integer: 'BIGINT', number: 'DOUBLE', string: 'TEXT', date: 'DATE', boolean: 'TINYINT(1)' };
  const defs = cols.map((c) => `${store.dialect.quoteIdent(c.name)} ${tm[c.canonical] || tm.string || 'TEXT'}`);
  await store.exec(`CREATE TABLE ${store.dialect.quoteIdent(table)} (${defs.join(', ')})`);
}

async function countRows(store, table) {
  const r = await asPromise(store.get(`SELECT COUNT(*) AS c FROM ${store.dialect.quoteIdent(table)}`));
  return Number((r && r.c)) || 0;
}

async function isIdentityColumn(store, table) {
  if (store.type !== 'sqlserver') return false;
  try {
    const r = await asPromise(store.get("SELECT COLUMNPROPERTY(OBJECT_ID(?), 'id', 'IsIdentity') AS v", [table]));
    return Number(r && r.v) === 1;
  } catch (_) {
    return false;
  }
}

/** 复制单表（源的列全集、行全量），返回复制行数 */
async function copyTable(src, dst, table) {
  const cols = await introspectColumns(src, table);
  if (!cols.length) return 0;
  await ensureTable(dst, table, cols);
  const names = cols.map((c) => c.name);
  const colsSql = names.map((n) => dst.dialect.quoteIdent(n)).join(', ');
  const placeholders = names.map(() => '?').join(', ');
  const ins = `INSERT INTO ${dst.dialect.quoteIdent(table)} (${colsSql}) VALUES (${placeholders})`;
  const identityInsert = (await isIdentityColumn(dst, table)) && dst.type === 'sqlserver';
  if (identityInsert) await dst.exec(`SET IDENTITY_INSERT ${dst.dialect.quoteIdent(table)} ON`);
  let n = 0;
  try {
    const rows = await asPromise(src.all(`SELECT * FROM ${src.dialect.quoteIdent(table)}`));
    for (const row of rows) {
      await dst.run(ins, names.map((col) => row[col]));
      n += 1;
    }
  } finally {
    if (identityInsert) {
      try { await dst.exec(`SET IDENTITY_INSERT ${dst.dialect.quoteIdent(table)} OFF`); } catch (_) {}
    }
  }
  return n;
}

/** 自增序列重置（best-effort，各种方言差异容错） */
async function resetSequence(store, table) {
  const t = store.type;
  const q = store.dialect.quoteIdent(table);
  try {
    if (t === 'postgres') {
      const seq = await asPromise(store.get("SELECT pg_get_serial_sequence(?, 'id') AS s", [table])).then((r) => r && r.s);
      if (seq) await store.exec(`SELECT setval('${String(seq).replace(/'/g, "''")}', COALESCE((SELECT MAX(id) FROM ${q}), 1))`);
    } else if (t === 'mysql' || t === 'mariadb') {
      const max = await asPromise(store.get(`SELECT COALESCE(MAX(id), 0) AS m FROM ${q}`)).then((r) => Number(r && r.m) || 0);
      await store.exec(`ALTER TABLE ${q} AUTO_INCREMENT = ${max + 1}`);
    } else if (t === 'sqlserver') {
      const max = await asPromise(store.get(`SELECT COALESCE(MAX(id), 0) AS m FROM ${q}`)).then((r) => Number(r && r.m) || 0);
      await store.exec(`DBCC CHECKIDENT ('${String(table).replace(/'/g, "''")}', RESEED, ${max})`);
    } else if (t === 'sqlite') {
      await store.exec(`UPDATE sqlite_sequence SET seq = (SELECT COALESCE(MAX(id), 0) FROM ${q}) WHERE name = '${String(table).replace(/'/g, "''")}'`);
    }
    // oracle 每次复现 IDENTITY 重启较繁琐，best-effort 跳过（保留 ID 已满足迁移正确性）
  } catch (_) { /* 序列重置不影响数据正确性，失败忽略 */ }
}

/** 目标库建元数据表（await 版，兼容同步/异步 driver） */
async function prepareTargetSchema(dst) {
  const ddl = dialectDdl[dst.type] || dialectDdl.sqlite;
  const withIf = IF_NOT_EXISTS.has(dst.type);
  const existing = withIf ? null : new Set((await asPromise(listTables(dst))).map((n) => String(n).toUpperCase()));
  for (const rawStmt of ddl) {
    const m = rawStmt.trim().match(/^CREATE TABLE(?:\s+IF NOT EXISTS)?\s+"?([A-Za-z_$][\w$]*)"?/i);
    if (!withIf && m && existing.has(String(m[1]).toUpperCase())) continue;
    if (!withIf && /^CREATE INDEX/i.test(rawStmt.trim())) {
      // mssql/oracle 无 IF NOT EXISTS：索引重名视为幂等
      try { await dst.exec(translate(rawStmt, dst.dialect)); } catch (_) {}
      continue;
    }
    await dst.exec(translate(rawStmt, dst.dialect));
  }
}

/**
 * 执行迁移。opts: { tables?, skipData?, dryRun? }
 * @returns {Promise<Array<{table, rows}>>}
 */
async function migrate(fromConn, toConn, opts = {}) {
  const src = createStore(toStoreOverride(fromConn));
  let dst = null;
  if (!opts.dryRun) dst = createStore(toStoreOverride(toConn));
  try {
    if (dst) await prepareTargetSchema(dst);
    const rawTables = await asPromise(listTables(src));
    // 过滤驱动内部表（如 sqlite_sequence）
    const tables = rawTables.filter((t) => !String(t).toLowerCase().startsWith('sqlite_'));
    const lower = (s) => String(s || '').toLowerCase();
    const present = (t) => tables.some((n) => lower(n) === lower(t));

    let order;
    if (opts.tables) {
      order = opts.tables.split(',').map((x) => String(x).trim()).filter(Boolean).filter(present);
    } else if (opts.skipData) {
      order = META_ORDER.filter(present);
    } else {
      const meta = META_ORDER.filter(present);
      const data = tables.filter((n) => !META_ORDER.some((m) => lower(m) === lower(n)));
      order = [...meta, ...data];
    }

    const summary = [];
    for (const table of order) {
      if (opts.dryRun) {
        summary.push({ table, rows: await countRows(src, table) });
      } else {
        const rows = await copyTable(src, dst, table);
        await resetSequence(dst, table);
        summary.push({ table, rows });
      }
    }
    return { from: fromConn, to: toConn, dryRun: !!opts.dryRun, tables: summary };
  } finally {
    try { await src.close(); } catch (_) {}
    if (dst) { try { await dst.close(); } catch (_) {} }
  }
}

module.exports = { migrate, parseConn, introspectColumns, STORE_TYPES, META_ORDER };