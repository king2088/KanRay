# 应用存储可选 + 数据源同步模式 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让系统自身存储可在部署时选择 SQLite/MySQL/MariaDB/PostgreSQL/SQL Server/Oracle，并让数据源支持「直连 / 同步」两种存储方式（同步按周期 + 增量水印将外部表落入应用所选库，首同步不注册数据集）。

**Architecture:** ① 极薄异步 DB 门面（`db.prepare().run/all/get` 形态不变、只补 `await`）+ 每方言 driver + 可移植 SQL 预处理器（`?`/`"ident"`/`datetime('now')` 边界翻译）；② 复用 `dialects.js`/`build-sql.js` 方言体系统一「上传数据集」与「外部源」的 SQL 生成；③ 同步链路 = `sync_configs`/`sync_logs` 表 + 进程内调度器 + 水印增量（`buildUpsert` 六方言）。

**Tech Stack:** Node ≥18（CommonJS）、better-sqlite3、mysql2（Promise/多语句）、pg、mssql、oracledb（thin）、express 5、vue 3。

---

## 前提约定（贯穿全计划）

- **门面契约**：所有 `db.*` 调用统一 `await`；sqlite driver 内部同步、方法返回已 resolve 的值；remote driver 返回 Promise。`run()` 返回值恒含 `{ changes, lastInsertRowid }`（remote 由 insertId/SCOPE_IDENTITY()/RETURNING 映射而来）。
- **可移植 SQL 约定**：业务 SQL 一律用 `"标识符"` 引号、`?` 占位、`datetime('now')` 时间默认、`LIMIT ? OFFSET ?` 由显式 `dialect.paginate` 构造。跨库翻译统一走 `src/db/translate.js`。
- **现有 159 测试跑 SQLite 默认态**，必须保持全绿；新测试按需 `RUN_LIVE=1` 才跑容器。

---

## Phase 1：存储框架（SQLite 重构，不改行为）

### Task 1: 配置层扩展

**Files:**
- Modify: `backend/src/config/index.js`
- Create: `backend/config.example.json`
- Test: `backend/test/task25-store-config.test.js`

- [ ] **Step 1: 写失败测试**

```js
// backend/test/task25-store-config.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

function loadConfig(env, fileJson) {
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'kbcfg-'));
  fs.writeFileSync(path.join(tmp, 'config.json'), JSON.stringify(fileJson));
  process.env.DATA_DIR = tmp;
  if (env.DB_TYPE) process.env.DB_TYPE = env.DB_TYPE;
  if (env.DB_URL) process.env.DB_URL = env.DB_URL;
  if (env.DB_PATH) process.env.DB_PATH = env.DB_PATH;
  delete require.cache[require.resolve('../../src/config')];
  const cfg = require('../../src/config');
  return cfg;
}

test('默认 SQLite', () => {
  const cfg = loadConfig({}, {});
  assert.equal(cfg.db.type, 'sqlite');
  assert.ok(cfg.dbPath.includes('kanban.db'));
});

test('config.json 指定 postgres', () => {
  const cfg = loadConfig({}, { db: { type: 'postgres', url: 'postgresql://u:p@h:5432/kanban' } });
  assert.equal(cfg.db.type, 'postgres');
  assert.equal(cfg.db.url, 'postgresql://u:p@h:5432/kanban');
});

test('env 覆盖 config.json', () => {
  const cfg = loadConfig({ DB_TYPE: 'mysql', DB_URL: 'mysql://u:p@h:3306/kanban' }, { db: { type: 'postgres', url: 'x' } });
  assert.equal(cfg.db.type, 'mysql');
  assert.equal(cfg.db.url, 'mysql://u:p@h:3306/kanban');
});

test('非法 type 抛出可读错误', () => {
  assert.throws(() => loadConfig({ DB_TYPE: 'mongodb' }, {}), /DB_TYPE|sqlite|mysql|mariadb|postgres|sqlserver|oracle/);
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && node --test test/task25-store-config.test.js`
Expected: FAIL（`cfg.db` undefined / `DB_TYPE` 校验缺失）

- [ ] **Step 3: 实现配置层**

```js
// backend/src/config/index.js（整体替换）
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..', '..'); // backend/
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
const uploadDir = process.env.UPLOAD_DIR || path.join(root, 'uploads');

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

const STORE_TYPES = ['sqlite', 'mysql', 'mariadb', 'postgres', 'sqlserver', 'oracle'];

let fileDb = { type: 'sqlite', url: '', sqlitePath: 'data/kanban.db' };
try {
  const filePath = path.join(root, 'config.json');
  if (fs.existsSync(filePath)) {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (parsed && parsed.db) fileDb = { ...fileDb, ...parsed.db };
  }
} catch (e) {
  throw new Error(`config.json 解析失败: ${e.message}`);
}

const dbType = String(process.env.DB_TYPE || fileDb.type || 'sqlite').toLowerCase();
if (!STORE_TYPES.includes(dbType)) {
  throw new Error(`不支持的 DB_TYPE="${dbType}"，可选: ${STORE_TYPES.join(' / ')}`);
}

module.exports = {
  port: parseInt(process.env.PORT || '3001', 10),
  root,
  dataDir,
  uploadDir,
  db: {
    type: dbType,
    url: process.env.DB_URL || fileDb.url || '',
    sqlitePath: process.env.DB_PATH || path.join(root, fileDb.sqlitePath || 'data/kanban.db'),
  },
  dbPath: (() => { // 兼容旧引用：sqlite 返回路径，其它类型返回 url
    const d = module.exports.db;
    return d.type === 'sqlite' ? d.sqlitePath : d.url;
  })(),
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
    accessTtl: process.env.ACCESS_TTL || '15m',
    refreshTtlDays: parseInt(process.env.REFRESH_TTL_DAYS || '7', 10),
  },
  upload: {
    allowedExt: ['.xlsx', '.xls', '.csv'],
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || String(20 * 1024 * 1024), 10),
    maxRows: parseInt(process.env.MAX_ROWS || '200000', 10),
    previewRows: 50,
  },
  sync: {
    schedulerIntervalMs: parseInt(process.env.SYNC_SCHEDULER_INTERVAL_MS || '60000', 10),
    maxConcurrent: parseInt(process.env.SYNC_MAX_CONCURRENT || '2', 10),
    defaultIntervalSeconds: parseInt(process.env.SYNC_DEFAULT_INTERVAL_SECONDS || '86400', 10),
  },
};
```

- [ ] **Step 4: 创建示例配置**

```jsonc
// backend/config.example.json
{
  "db": {
    "type": "sqlite",
    "url": "",
    "sqlitePath": "data/kanban.db"
  }
}
```

同时修改 `backend/.gitignore` 增加 `config.json`（保留 `config.example.json`）。

- [ ] **Step 5: 运行测试确认通过**

Run: `cd backend && node --test test/task25-store-config.test.js`
Expected: PASS

- [x] **Step 6: Commit**（已提交 `2d8203a`）

```bash
git add backend/src/config/index.js backend/config.example.json backend/.gitignore backend/test/task25-store-config.test.js
git commit -m "feat(config): 支持 config.json 选择数据库类型(sqlite/mysql/mariadb/postgres/sqlserver/oracle)"
```

### Task 2: 存储方言 `dialects.sqlite` + `dialects.mariadb`

**Files:**
- Modify: `backend/src/datasources/dialects.js`
- Test: `backend/test/task25-store-translate.test.js`

- [ ] **Step 1: 追加 sqlite / mariadb 方言**（方言对象与 `limit`/`paginate`/`now`/`placeholder` 对齐，供 store 与 builder 复用）

```js
// backend/src/datasources/dialects.js 末尾追加
const sqlite = {
  quoteIdent: (name) => `"${String(name).replace(/"/g, '""')}"`,
  limit: (sql, n) => `${sql} LIMIT ${Number(n)}`,
  paginate: (sql, limit, offset) => `${sql} LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
  dateTrunc: (field, unit) => {
    const map = { day: '%Y-%m-%d', week: '%Y-W%W', month: '%Y-%m', year: '%Y' };
    return `strftime('${map[unit] || map.month}', ${sqlite.quoteIdent(field)})`;
  },
  typeMapping: { integer: 'INTEGER', number: 'REAL', string: 'TEXT', date: 'TEXT', boolean: 'INTEGER' },
  placeholder: () => '?',
  now: "datetime('now')",
  agg: { count: 'COUNT', count_distinct: 'COUNT(DISTINCT', sum: 'SUM', avg: 'AVG', max: 'MAX', min: 'MIN' },
  trim: (name) => `TRIM(${name})`,
  supportsOffset: true,
  upsertSyntax: 'conflict',
};

// mariadb 与 mysql 同语法，保留独立键避免 drivers 映射歧义
const mariadb = mysql;

// 为 mysql/pg/mssql/oracle/clickhouse/presto 补齐 now 与 paginate（构建时保持一致接口）
mysql.now = "NOW()"; mysql.paginate = (sql, limit, offset) => `${sql} LIMIT ${Number(limit)} OFFSET ${Number(offset)}`; mysql.upsertSyntax = 'dup';
pg.now = "now()"; pg.paginate = (sql, limit, offset) => `${sql} LIMIT ${Number(limit)} OFFSET ${Number(offset)}`; pg.upsertSyntax = 'conflict';
mssql.now = "SYSDATETIME()"; mssql.paginate = (sql, limit, offset) => `${sql} OFFSET ${Number(offset)} ROWS FETCH NEXT ${Number(limit)} ROWS ONLY`; mssql.upsertSyntax = 'merge';
oracle.now = "SYSTIMESTAMP"; oracle.paginate = (sql, limit, offset) => `${sql} OFFSET ${Number(offset)} ROWS FETCH NEXT ${Number(limit)} ROWS ONLY`; oracle.upsertSyntax = 'merge';
clickhouse.now = "now()"; clickhouse.paginate = (sql, limit, offset) => `${sql} LIMIT ${Number(limit)} OFFSET ${Number(offset)}`; clickhouse.upsertSyntax = 'none';
presto.now = "current_timestamp"; presto.paginate = (sql, limit, offset) => `${sql} LIMIT ${Number(limit)} OFFSET ${Number(offset)}`; presto.upsertSyntax = 'none';

module.exports = { mysql, mariadb, pg, clickhouse, mssql, oracle, presto, sqlite };
```

- [ ] **Step 2: 写断言测试**

```js
// backend/test/task25-store-translate.test.js（追加到 Task 3 的 translate 用例后）
const { sqlite, mysql, pg, mssql, oracle, mariadb } = require('../../src/datasources/dialects');
test('sqlite 方言 paginate/now/typeMapping', () => {
  assert.equal(sqlite.paginate('SELECT 1', 10, 5), 'SELECT 1 LIMIT 10 OFFSET 5');
  assert.equal(sqlite.now, "datetime('now')");
  assert.equal(sqlite.typeMapping.number, 'REAL');
});
test('mariadb 复用 mysql 方言', () => {
  assert.equal(mariadb.quoteIdent('a'), '`a`');
  assert.equal(mariadb.limit('SELECT 1', 5), 'SELECT 1 LIMIT 5');
});
```

- [ ] **Step 3: 运行测试**（sqlite 方言断言在 Task 3 的 translate 测试中一并跑）

Run: `cd backend && node --test test/task25-store-translate.test.js`
Expected: PASS

- [x] **Step 4: Commit**（已提交 `47bd142`）

```bash
git add backend/src/datasources/dialects.js backend/test/task25-store-translate.test.js
git commit -m "feat(dialects): 新增 sqlite/mariadb 方言与 paginate/now/upsertSyntax 接口"
```

### Task 3: 可移植 SQL 翻译器 `src/db/translate.js`

**Files:**
- Create: `backend/src/db/translate.js`
- Test: `backend/test/task25-store-translate.test.js`

- [ ] **Step 1: 写失败测试**

```js
// backend/test/task25-store-translate.test.js —— 追加
const { translate } = require('../../src/db/translate');

test('translate 占位符: pg $n', () => {
  assert.equal(translate('SELECT * FROM t WHERE a = ? AND b = ?', pg), 'SELECT * FROM t WHERE a = $1 AND b = $2');
});
test('translate 占位符: mssql @pN', () => {
  assert.equal(translate('SELECT * FROM t WHERE a = ?', mssql), 'SELECT * FROM t WHERE a = @p0');
});
test('translate 占位符: oracle :n', () => {
  assert.equal(translate('SELECT * FROM t WHERE a = ? OR c IN (?, ?)', oracle), 'SELECT * FROM t WHERE a = :1 OR c IN (:2, :3)');
});
test('translate 标识符: mysql 反引号', () => {
  assert.equal(translate('SELECT "id", "a b" FROM "t" WHERE "x" = ?', mysql), 'SELECT `id`, `a b` FROM `t` WHERE `x` = ?');
});
test('translate 标识符: mssql 方括号', () => {
  assert.equal(translate('SELECT "id" FROM "t"', mssql), 'SELECT [id] FROM [t]');
});
test('translate datetime(now)', () => {
  assert.equal(translate("UPDATE t SET x = datetime('now') WHERE id = ?", mysql), 'UPDATE t SET x = NOW() WHERE id = ?');
  assert.equal(translate("UPDATE t SET x = datetime('now') WHERE id = ?", pg), 'UPDATE t SET x = now() WHERE id = ?');
});
test('translate 保留字符串字面量', () => {
  assert.equal(translate("SELECT 'it\\'s a ? ?' AS v", pg), "SELECT 'it\\'s a ? ?' AS v");
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && node --test test/task25-store-translate.test.js`
Expected: FAIL（`Cannot find module '../../src/db/translate'`）

- [ ] **Step 3: 实现 translate.js**

```js
// backend/src/db/translate.js
// 可移植 SQL → 方言 SQL：
//  - `?`  → dialect.placeholder(i)（逐位置计数）
//  - `"ident"` → dialect.quoteIdent(ident)
//  - datetime('now') → dialect.now
// 逐字符扫描，跳过单引号字符串字面量；对已含字面量字符串的 SQL 安全。
function translate(sql, dialect) {
  let out = '';
  let paramIndex = 0;
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const ch = sql[i];
    if (ch === "'") {
      let j = i + 1;
      let esc = false;
      while (j < n) {
        if (sql[j] === '\\' && !esc) { j += 2; continue; }
        if (sql[j] === "'" && (esc || sql[j + 1] === "'")) { j += 2; continue; }
        if (sql[j] === "'") break;
        j++;
      }
      out += sql.slice(i, Math.min(j + 1, n));
      i = j + 1;
    } else if (ch === '?') {
      paramIndex += 1;
      out += dialect.placeholder(paramIndex);
      i += 1;
    } else if (ch === '"') {
      let j = i + 1;
      while (j < n && sql[j] !== '"') {
        if (sql[j] === '"' && sql[j + 1] === '"') j += 2;
        else j++;
      }
      const ident = sql.slice(i + 1, j).replace(/""/g, '"');
      out += dialect.quoteIdent(ident);
      i = j + 1;
    } else if (
      ch === 'd' &&
      sql.slice(i, i + 14).toLowerCase() === "datetime('now')"
    ) {
      out += dialect.now;
      i += 14;
    } else {
      out += ch;
      i += 1;
    }
  }
  return out;
}

module.exports = { translate };
```

- [ ] **Step 4: 运行确认通过**

Run: `cd backend && node --test test/task25-store-translate.test.js`
Expected: PASS

- [x] **Step 5: Commit**（已提交 `f8b9341`）

```bash
git add backend/src/db/translate.js backend/test/task25-store-translate.test.js
git commit -m "feat(db): 可移植 SQL 翻译器(占位符/标识符/now)"
```

### Task 4: DB 门面 + sqlite driver + `src/db.js` 重构

**Files:**
- Create: `backend/src/db/index.js`
- Create: `backend/src/db/drivers/sqlite.js`
- Modify: `backend/src/db.js`（改为门面实例，保留导出形态）
- Test: `backend/test/task25-store-drivers.test.js`

- [ ] **Step 1: 写失败测试**

```js
// backend/test/task25-store-drivers.test.js
const test = require('node:test');
const assert = require('node:assert');

test('门面 expose prepare/exec/transaction/dialect', async (t) => {
  const { runInNew } = require('./helpers/store-env'); // Task 4 Step3 提供
  const db = await runInNew();
  assert.equal(typeof db.prepare, 'function');
  assert.equal(typeof db.exec, 'function');
  assert.equal(typeof db.transaction, 'function');
  assert.ok(db.dialect);
  const r = await db.run('CREATE TABLE IF NOT EXISTS t1 (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)');
  assert.equal(r.changes, 0);
  const ins = await db.prepare('INSERT INTO t1 (name) VALUES (?)').run('hello');
  assert.ok(Number(ins.lastInsertRowid) > 0);
  const row = await db.prepare('SELECT * FROM t1 WHERE id = ?').get(ins.lastInsertRowid);
  assert.equal(row.name, 'hello');
  const rows = await db.prepare('SELECT name FROM t1 ORDER BY id').all();
  assert.equal(rows.length, 1);
  await db.transaction(async () => { await db.run("INSERT INTO t1 (name) VALUES ('tx')"); });
  const count = await db.get('SELECT COUNT(*) AS c FROM t1');
  assert.equal(count.c, 2);
  await db.close();
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && node --test test/task25-store-drivers.test.js`
Expected: FAIL（`Cannot find module './helpers/store-env'`）

- [ ] **Step 3: 实现 sqlite driver**

```js
// backend/src/db/drivers/sqlite.js
const Database = require('better-sqlite3');
const { sqlite } = require('../../datasources/dialects');

function createSqliteDriver(dbPath) {
  const raw = new Database(dbPath);
  raw.pragma('journal_mode = WAL');
  raw.pragma('foreign_keys = ON');
  const exec = (sql) => { raw.exec(sql); return { changes: 0 }; };
  const forStmt = (sql) => {
    const stmt = raw.prepare(sql);
    return {
      run: (...params) => { const r = stmt.run(...params); return { changes: r.changes, lastInsertRowid: r.lastInsertRowid }; },
      get: (...params) => stmt.get(...params),
      all: (...params) => stmt.all(...params),
    };
  };
  const run = (sql, params = []) => {
    const stmt = raw.prepare(sql);
    const r = stmt.run(...(Array.isArray(params) ? params : [params]));
    return { changes: r.changes, lastInsertRowid: r.lastInsertRowid };
  };
  const get = (sql, params = []) => raw.prepare(sql).get(...(Array.isArray(params) ? params : [params]));
  const all = (sql, params = []) => raw.prepare(sql).all(...(Array.isArray(params) ? params : [params]));
  return {
    dialect: sqlite,
    run, get, all, exec,
    execBatch: (sqls) => { for (const s of sqls) raw.exec(s); },
    transaction: async (fn) => {
      raw.exec('BEGIN');
      try { const out = await fn(); raw.exec('COMMIT'); return out; }
      catch (e) { raw.exec('ROLLBACK'); throw e; }
    },
    close: () => raw.close(),
    raw,
  };
}

module.exports = { createSqliteDriver };
```

- [ ] **Step 4: 实现门面**

```js
// backend/src/db/index.js
const config = require('../config');
const { createSqliteDriver } = require('./drivers/sqlite');
// remote drivers 随 Task 5-9 引入，这里先按 type 动态装配
async function createStore() {
  const t = config.db.type;
  if (t === 'sqlite') return createSqliteDriver(config.db.sqlitePath);
  const { createMysqlDriver } = require('./drivers/mysql');      // 含 mariadb
  const { createPostgresDriver } = require('./drivers/postgres');
  const { createMssqlDriver } = require('./drivers/mssql');
  const { createOracleDriver } = require('./drivers/oracle');
  if (t === 'mysql' || t === 'mariadb') return createMysqlDriver(config.db.url, t);
  if (t === 'postgres') return createPostgresDriver(config.db.url);
  if (t === 'sqlserver') return createMssqlDriver(config.db.url);
  if (t === 'oracle') return createOracleDriver(config.db.url);
  throw new Error(`不支持的 DB_TYPE: ${t}`);
}

module.exports = { createStore };
```

- [ ] **Step 5: 改写 `src/db.js` 为门面实例（保留导出形态）**

```js
// backend/src/db.js（整体替换）
const { createStore } = require('./db');
const ensureDatasetTable = require('./db/schema').ensureDatasetTable; // Task 6 提供（届时替换）
const store = createStore();
const db = {
  prepare: (sql) => store.prepare(sql),
  run: (sql, ...params) => store.run(sql, params),
  get: (sql, ...params) => store.get(sql, params),
  all: (sql, ...params) => store.all(sql, params),
  exec: (sql) => store.exec(sql),
  execBatch: (sqls) => store.execBatch(sqls),
  transaction: (fn) => store.transaction(fn),
  pragma: (s) => { try { return store.raw ? store.raw.pragma(s) : undefined; } catch (e) { return undefined; } },
  close: () => store.close(),
  dialect: store.dialect,
};
// 门面还需暴露 store 全部方法透传（驱动层方法集合一致）
for (const [k, v] of Object.entries(store)) if (typeof v === 'function' && !db[k]) db[k] = v;
db.ensureDatasetTable = ensureDatasetTable;
module.exports = db;
module.exports.ensureDatasetTable = db.ensureDatasetTable;
```

> 注意：Task 4 结束时 sqlite driver 方法为 **同步实现**（调用方暂不 `await` 也返回真实值），保证现有测试与业务在过渡期不破。Task 8 统一 `await` 后再切到 "方法恒返回 Promise" 的最终形态（sqlite 也返回 `Promise.resolve(value)`）。

- [ ] **Step 6: 实现测试 helper `test/helpers/store-env.js`**（隔离临时库）

```js
// backend/test/helpers/store-env.js
process.env.DB_PATH = `/tmp/kanban-store-${process.pid}.db`;
process.env.DATA_DIR = `/tmp/kanban-store-data-${process.pid}`;
const config = require('../../src/config');
const { createStore } = require('../../src/db');
async function runInNew() {
  config.db.type = 'sqlite';
  config.db.sqlitePath = `/tmp/kanban-store-${process.pid}.db`;
  return createStore();
}
module.exports = { runInNew };
```

- [ ] **Step 7: 运行新测试 + 全量回归（sqlite 同步形态，业务未改应全绿）**

Run: `cd backend && node --test test/task25-store-drivers.test.js && npm test`
Expected: 新测试 PASS；现有 159 测试 PASS（sqlite 门面返回值与 better-sqlite3 一致，未引入 await 不受影响）

- [x] **Step 8: Commit**（已提交 `28f2fc7`）

```bash
git add backend/src/db backend/src/db.js backend/test/task25-store-drivers.test.js backend/test/helpers/store-env.js
git commit -m "feat(db): SQLite 门面 + driver 骨架，导出形态不变"
```

### Task 5: 元数据 DDL 方言化 + 幂等引导 `src/db/schema.js`

**Files:**
- Create: `backend/src/db/ddl/{sqlite,mysql,postgres,mssql,oracle}.js`
- Create: `backend/src/db/schema.js`
- Modify: `backend/src/db.js` → 改为引导调用 `schema.init(store)`

- [ ] **Step 1: 迁移现 DDL 为每方言文件**

把当前 `src/db.js` 里的 11 张表 DDL + `data_sources` 索引 + dashCols/dsCols 迁移逻辑按方言参数化。sqlite 版本与现状逐字一致；其余版本用方言类型（参考 spec 差异表）。示例（sqlite，其余方言仅差异列不同）：

```js
// backend/src/db/ddl/sqlite.js
module.exports = [
  `CREATE TABLE IF NOT EXISTS datasets (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, original_file TEXT NOT NULL,
    row_count INTEGER NOT NULL DEFAULT 0, column_count INTEGER NOT NULL DEFAULT 0,
    table_name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')),
    source_type TEXT NOT NULL DEFAULT 'excel', datasource_id INTEGER, schema_name TEXT,
    table_name_ext TEXT, build_definition TEXT, owner_id INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS dataset_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT, dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    name TEXT NOT NULL, label TEXT NOT NULL, type TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS charts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    chart_type TEXT NOT NULL, config TEXT NOT NULL, owner_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS dashboards (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, layout TEXT NOT NULL DEFAULT '[]',
    gap_x INTEGER NOT NULL DEFAULT 12, gap_y INTEGER NOT NULL DEFAULT 12, card_style TEXT NOT NULL DEFAULT '{}',
    owner_id INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '', is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '', is_builtin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
  )`,
  `CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
  )`,
  `CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, email TEXT, action TEXT NOT NULL,
    resource_type TEXT, resource_id TEXT, detail TEXT, ip TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS data_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL,
    config TEXT NOT NULL DEFAULT '{}', is_active INTEGER NOT NULL DEFAULT 1, owner_id INTEGER,
    mode TEXT NOT NULL DEFAULT 'direct', last_test_at TEXT, last_test_ok INTEGER, last_test_msg TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  'CREATE INDEX IF NOT EXISTS idx_data_sources_owner ON data_sources(owner_id)',
  'CREATE INDEX IF NOT EXISTS idx_data_sources_type ON data_sources(type)',
  'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash)',
];
```

> 注意：这份定义**预埋 `mode` 列**；各方言文件把 `INTEGER PRIMARY KEY AUTOINCREMENT` → 对应自增写法、`datetime('now')` → `dialect.now`、`TEXT/INTEGER` → 方言类型。mssql/oracle/最后变更清单中的 `ALTER TABLE ... ADD COLUMN` 各方言写法不同（mssql `ADD`、oracle `ADD` + 无 IF NOT EXISTS）。**迁移列存在性检测**由 `schema.js` 按方言提供 `listColumns(table)` 实现（`PRAGMA table_info` / `SHOW COLUMNS FROM` / `SELECT column_name FROM information_schema.columns WHERE table_name=?` / oracle `ALL_TAB_COLUMNS WHERE TABLE_NAME=?`）。

- [ ] **Step 2: 实现 `src/db/schema.js`**

```js
// backend/src/db/schema.js
const { translate } = require('./translate');
const dialectDdl = {
  sqlite: require('./ddl/sqlite'),
  mysql: require('./ddl/mysql'),
  mariadb: require('./ddl/mysql'),
  postgres: require('./ddl/postgres'),
  sqlserver: require('./ddl/mssql'),
  oracle: require('./ddl/oracle'),
};

async function runDdl(store) {
  const ddl = dialectDdl[store.dialect === store ? undefined : store.dialectKey] || dialectDdl[store.type || 'sqlite'];
  for (const stmt of ddl) await store.run(translate(stmt, store.dialect));
}
```

> 简化：driver 导出 `store.type`（'sqlite'|'mysql'|...）；`runDdl` 用 `store.type` 取对应 DDL 文件。实现时以 `store.type` 为准。

- [ ] **Step 3: `src/db/schema.js` 补齐**（完整逻辑）

```js
async function listColumns(store, table) {
  const t = store.type;
  if (t === 'sqlite') return store.all(`PRAGMA table_info('${table}')`);
  if (t === 'mysql' || t === 'mariadb') {
    const r = await store.all(`SHOW COLUMNS FROM \`${table}\``);
    return r.map((c) => ({ name: c.Field || c.field }));
  }
  if (t === 'postgres') {
    const r = await store.all("SELECT column_name AS name FROM information_schema.columns WHERE table_name = ?", [table]);
    return r.map((c) => ({ name: c.name }));
  }
  if (t === 'sqlserver') {
    const r = await store.all("SELECT COLUMN_NAME AS name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ?", [table]);
    return r.map((c) => ({ name: c.name }));
  }
  if (t === 'oracle') {
    const r = await store.all(`SELECT column_name AS name FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = UPPER(?) ORDER BY column_id`, [table]);
    return r.map((c) => ({ name: c.name }));
  }
  return [];
}

async function ensureSchema(store) {
  await runDdl(store);
  // 旧库列补齐（datasets/dashboards...）：与现 src/db.js 的 ALTER 段等价，但用 listColumns 判存在
  const needCols = {
    datasets: [['source_type', "TEXT NOT NULL DEFAULT 'excel'"], ['datasource_id', 'INTEGER'], ['schema_name', 'TEXT'], ['table_name_ext', 'TEXT'], ['build_definition', 'TEXT'], ['owner_id', 'INTEGER']],
    dashboards: [['gap_x', 'INTEGER NOT NULL DEFAULT 12'], ['gap_y', 'INTEGER NOT NULL DEFAULT 12'], ['card_style', "TEXT NOT NULL DEFAULT '{}'"], ['owner_id', 'INTEGER']],
    charts: [['owner_id', 'INTEGER']],
  };
  for (const [table, cols] of Object.entries(needCols)) {
    const existing = new Set((await listColumns(store, table)).map((c) => c.name));
    for (const [col, ddl] of cols) {
      if (!existing.has(col)) await store.exec(translate(`ALTER TABLE ${store.dialect.quoteIdent(table)} ADD COLUMN ${store.dialect.quoteIdent(col)} ${ddl}`, store.dialect));
    }
  }
  if (!(await hasColumn(store, 'data_sources', 'mode'))) {
    await store.run(translate("ALTER TABLE data_sources ADD COLUMN mode TEXT NOT NULL DEFAULT 'direct'", store.dialect));
  }
}

async function hasColumn(store, table, col) {
  const cols = await listColumns(store, table);
  return cols.some((c) => String(c.name).toLowerCase() === String(col).toLowerCase());
}

function ensureDatasetTable(store, schemaName, fields) {
  const cols = fields.map((f) => {
    const canon = f.canonicalType || f.type;
    const type = store.dialect.typeMapping[canon] || store.dialect.typeMapping.string;
    return `${store.dialect.quoteIdent(f.name)} ${type}`;
  });
  return store.exec(`CREATE TABLE IF NOT EXISTS ${store.dialect.quoteIdent(schemaName)} (${cols.join(', ')})`);
}

module.exports = { ensureSchema, ensureDatasetTable, listColumns, hasColumn };
```

- [ ] **Step 4: 更新 `src/db.js` 装配 init**

将 `src/db.js` 的 DDL 块删除，改为：

```js
// backend/src/db.js 顶部增加
const schema = require('./db/schema');
// module.exports 前执行引导（同步门面仍可）；remote 异步时 init() 由 server 启动 await
db.ensureDatasetTable = (schemaName, fields) => schema.ensureDatasetTable(store, schemaName, fields);
db.initSchema = () => schema.ensureSchema(store);
```

> Task 8 会在 server 启动流程中改为 `await db.initSchema()`（sqlite 同步阶段可先行空转）。**保持 sqlite 下 `src/db.js` require 即建表**（即 `if (store.type === 'sqlite') db.initSchema()` 同步兜底，见 Task 8）。

- [ ] **Step 5: 运行全量回归**

Run: `cd backend && npm test`
Expected: 159 PASS（sqlite 行为不变：建表语句逐字等价）

- [x] **Step 6: Commit**（已提交 `5b77703`）

```bash
git add backend/src/db backend/src/db.js
git commit -m "feat(db): 元数据 DDL 方言化 + ensureSchema/ensureDatasetTable 引导"
```

### Task 6: 上传数据集 & 分页/聚合方言化（sqlite 路径）

**Files:**
- Modify: `backend/src/services/dataset.service.js`
- Modify: `backend/src/engines/query-engine.js`
- Test: 现有 task5-engine / task15-engine-sql / 数据集上传用例（保持全绿）

- [ ] **Step 1: dataset.service 方言化改造**

- `sqlType(field)` → 改为 `db.dialect.typeMapping[field.type]`（直接用 store 方言；删除 TYPE_MAP 依赖）：`function sqlType(f) { return db.dialect.typeMapping[f.type] || db.dialect.typeMapping.string; }`
- `createDataset` 建表用 `db.ensureDatasetTable(tableName, fields)`（替代裸 sqlite CREATE）；批量插入改 `db.transaction(async () => {...})` 并逐行 `await db.prepare(...).run(...)`；insertId 读 `r.lastInsertRowid`。
- `paginateRows` 本地分支（非 sql）改为方言：`SELECT * FROM t` + `db.dialect.paginate(base, pageSize, offset)`；count 用 `SELECT COUNT(*) AS c FROM t`。
- `deleteDataset` 的非 sql 分支 `DROP TABLE IF EXISTS t` 对 oracle 需先存在判断（用 `hasColumn` 等价思路：`listTables` 检查）——实现：整体降级为"存在才 DROP"。

- [ ] **Step 2: query-engine 本地分支方言化**

将 `TIME_GRANULARITY`/`strftime`/`"col"`/`LIMIT ?` 改为 `db.dialect` 生成：
- 维度时间桶化：`db.dialect.dateTrunc(field, granularity)`（sqlite 复刻现有 strftime 语义 → 与现输出一致）。
- 列引用/别名、`GROUP BY` 别名、`COUNT(*)`、聚合函数：用 `db.dialect.agg` 包；别名保持 `__dim_x__`/`_mN`（非用户输入）。
- `buildWhere` 的 `"${field.name}"` 改 `db.dialect.quoteIdent(field.name)`，`?` 占位改 `db.dialect.placeholder`（逐位置）。
- `groupLimit` 的 `LIMIT ?` 改 `db.dialect.limit(sql, n)`。
- 执行：`await db.all(sql, params)`。
- **断言等价**：sqlite 生成结果与旧 SQL 逐字符一致（否则现有任务5/15 的 SQL 快照断言会挂）。关键映射：`strftime('%Y-%m', "x")`（sqlite dateTrunc 现实现输出 `strftime('%Y-%m', "x")` 一致）；聚合 `COUNT/DISTINCT`、`AS __dim…` 均保留。

- [ ] **Step 3: 运行全量回归**

Run: `cd backend && npm test`
Expected: 159 PASS（尤其 task5-engine、task15-engine-sql、task19-builder 关于 SQL 文本/结果的断言）

- [x] **Step 4: Commit**（已提交 `1259dd8`）

```bash
git add backend/src/services/dataset.service.js backend/src/engines/query-engine.js
git commit -m "feat(engine): 上传数据集建表/分页/聚合走 store 方言"
```

### Task 7: 全量 `await` 改造（业务 + 种子 + 测试基建）

**Files:**
- Modify（全部 `require('../db')` 消费方）：
  `backend/src/services/{datasource,dashboard,dataset,chart,auth,access,rbac,audit}.service.js`
  `backend/src/engines/query-engine.js`（Task 6 已改）
  `backend/src/middleware/auth.js`
  `backend/src/routes/datasource.routes.js`
  `backend/src/datasources/sql-data-provider.js`（loadDataSourceContext 内 db 读）
  `backend/src/seeds.js`
  `backend/src/server.js`
  `backend/test/helpers/db.js`、`backend/test/task{3,4,5,6,7,14,15,19}*.test.js`
- Test: 全套回归

- [x] **Step 1: 统一 await 契约**（采纳偏差：sqlite driver 的 `run/get/all/exec/execBatch` **保持同步**返回真实值，不改为 async Promise；`await` 非 Promise 值无副作用，契约目标「调用方全部 await」不变。仅 `transaction(fn)` 改为 async 包装（SAVEPOINT 嵌套 `kb_tx_${txDepth}` + COMMIT/ROLLBACK）。remote driver（Task 8-9）返回 Promise，调用方已 await，天然兼容。）

`backend/src/db/drivers/sqlite.js` 的 `run/get/all/exec/execBatch` 改动前保持同步实现即可（原计划为改为 `async` 后 `return` 值，`await` 后可取；与本偏差等价满足「全调用方 await」判据）。

- [x] **Step 2: 按"形态改造清单"逐文件转换**

**统一规则**（机械，无逻辑变更）：
1. `const r = db.prepare(SQL).run(...)` → `const r = await db.prepare(SQL).run(...)`；
2. `.get(...)` / `.all(...)` → 加 `await`；
3. `db.exec(CREATE...)` → `await db.exec(...)`；
4. `db.transaction(fn)()` → `await db.transaction(async () => {...})`；
5. 含 `db.*` 的**同步函数签名 → `async function`**，并把它的同步调用点（route handler / 其它 service）同步改为 `await fn(...)`。
6. `db.pragma(...)` 保留（sqlite 专属，remote 忽略）。

**易漏点**（实现时必须处理）：
- `seeds.js`：`seedPermissions/seedRoles/seedAdmin/backfillOwner` 全部 async，`seed()` async；`server.js` 中 `seed()` → `await seed()`。
- `rbac.service.js`（36 处）与 `auth.service.js`（17 处）中的 `rolesOf/permissionsOf/userWithRoles` 被大量同步调用 → 全部 async，调用处连坐加 await（task3/task5-rbac 测试覆盖）。
- `middleware/auth.js` 的 verifyAccess 读取用户 → async；`requireUser` 中间件改 async 包装。
- `routes/datasource.routes.js` 的同步 handler 改 async。
- `test/helpers/db.js`：`resetDb` 改 async；测试文件的直接 db 断言改 await（在 `beforeEach(async ...)` 内）。
- `sql-data-provider.js` 内 `require('../db')` 的两处读取改为 async（loadDataSourceContext 已 async）。

**完成判据**：`cd backend && grep -rn "db\\.prepare(" src | wc -l` 无变更，但运行 `npm test` 全绿；再 `grep -rn "await db\\.prepare(" src | wc -l` 应等于之前 prepare 数（125）+ 新增。

- [x] **Step 3: server.js 启动引导 async**

```js
// backend/src/server.js
async function main() {
  await db.initSchema();      // ensureSchema + 列补齐（sqlite 幂等）
  await seed();
  const { startScheduler } = require('./jobs/sync-scheduler'); // Task 14 后启用
  app.listen(config.port, () => console.log(`API listening on :${config.port}`));
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [x] **Step 4: 全量回归**

Run: `cd backend && npm test`
Expected: 159 PASS

- [x] **Step 5: 冒烟启动**

Run: `cd backend && timeout 15 npm start & sleep 6 && curl -s http://localhost:3001/api/datasources/drivers | head -c 80 && wait`
Expected: 返回驱动 JSON 且无 seed 报错

- [x] **Step 6: Commit**（已提交 `d2ef358`）

```bash
git add backend/src backend/test
git commit -m "refactor(db): 所有 db 调用 await 化，门面切换为全异步契约"
```

---

## Phase 2：其余五库驱动（真连适配）

### Task 8: mysql/mariadb driver + postgres driver

**Files:**
- Create: `backend/src/db/drivers/mysql.js`
- Create: `backend/src/db/drivers/postgres.js`
- Test: `backend/test/task25-store-drivers.test.js`（加 driver 形状断言，SQLite 默认不连容器）

- [x] **Step 1: 写 mysql driver**（采纳偏差：① 计划模板缺 `prepare`，但 `db.js` 门面 `db.prepare = store.prepare`、全部业务 `await db.prepare(sql).run/get/all(...)`，故 driver 实现 `prepare(sql)` 返回 `{ run, get, all }` 异步句柄；② `transaction(fn)` 返回**可调用包装**（`(...args) => Promise`）而非直接 Promise，兼容 `db.transaction(fn)(rows)` 形态（同 sqlite/better-sqlite3）；③ 事务期间语句绑定到同一连接、嵌套事务复用连接不重复 BEGIN，事务外语句临时取连接用完即还）

```js
// backend/src/db/drivers/mysql.js
const mysql2 = require('mysql2/promise');
const { translate } = require('../translate');
const { mysql: mysqlDialect, mariadb: mariaDialect } = require('../../datasources/dialects');

function createMysqlDriver(url, type) {
  const pool = mysql2.createPool({ uri: url, connectionLimit: 10, multipleStatements: true, charset: 'utf8mb4', decimalNumbers: true });
  const dialect = type === 'mariadb' ? mariaDialect : mysqlDialect;
  const adapter = (r) => ({ changes: r.affectedRows, lastInsertRowid: typeof r.insertId === 'bigint' ? Number(r.insertId) : r.insertId });
  const lowerKeys = (rows) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])));
  return {
    type,
    dialect,
    async run(sql, params = []) { const [r] = await pool.execute(translate(sql, dialect), params); return adapter(r); },
    async get(sql, params = []) { const [rows] = await pool.execute(translate(sql, dialect), params); return lowerKeys(rows)[0]; },
    async all(sql, params = []) { const [rows] = await pool.execute(translate(sql, dialect), params); return lowerKeys(rows); },
    async exec(sql) { await pool.query(sql); return { changes: 0 }; },
    async execBatch(sqls) { for (const s of sqls) await pool.query(s); },
    async transaction(fn) {
      const conn = await pool.getConnection();
      try { await conn.beginTransaction(); const out = await fn(); await conn.commit(); return out; }
      catch (e) { try { await conn.rollback(); } catch (_) {} throw e; }
      finally { conn.release(); }
    },
    async close() { await pool.end(); },
  };
}
module.exports = { createMysqlDriver };
```

> 注意：`pool.execute` 占位符为 `?`，translate 已把 `?` 留在 mysql 方言（placeholder 返回 `?`），`translate` 后参数顺序天然一致。pg 用 `$n` → 参数数组顺序同样保持一致。

- [x] **Step 2: 写 postgres driver**（同样采纳偏差：`prepare` + 可调用 tx 包装 + 事务连接绑定；`INSERT INTO ...` 自动追加 `RETURNING id`，仅当无 `RETURNING` 且非 `ON CONFLICT` 结尾，已按上方注实现，导出 `withReturning` 便于单测）

```js
// backend/src/db/drivers/postgres.js
const { Pool } = require('pg');
const { translate } = require('../translate');
const { pg: pgDialect } = require('../../datasources/dialects');

function createPostgresDriver(url) {
  const pool = new Pool({ connectionString: url, max: 10 });
  const mapRow = (r) => Object.fromEntries(Object.entries(r || {}).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    type: 'postgres',
    dialect: pgDialect,
    async run(sql, params = []) {
      const r = await pool.query(translate(sql, pgDialect), params);
      return { changes: r.rowCount, lastInsertRowid: r.rows[0] ? Number(r.rows[0].id) : 0 };
    },
    async get(sql, params = []) { const r = await pool.query(translate(sql, pgDialect), params); return mapRow(r.rows[0]); },
    async all(sql, params = []) { const r = await pool.query(translate(sql, pgDialect), params); return r.rows.map(mapRow); },
    async exec(sql) { await pool.query(sql); return { changes: 0 }; },
    async execBatch(sqls) { for (const s of sqls) await pool.query(s); },
    async transaction(fn) {
      const client = await pool.connect();
      try { await client.query('BEGIN'); const out = await fn(); await client.query('COMMIT'); return out; }
      catch (e) { try { await client.query('ROLLBACK'); } catch (_) {} throw e; }
      finally { client.release(); }
    },
    async close() { await pool.end(); },
  };
}
module.exports = { createPostgresDriver };
```

> pg `run` 需 INSERT 自增回读：门面统一约定 `INSERT ... RETURNING id` 由调用侧提供？为了少改业务，driver 对 `INSERT INTO ...` 自动追加 `RETURNING id`（仅当无 `RETURNING` 且非 `ON CONFLICT` 结尾）。若某条 INSERT 无 `id` 列则 `lastInsertRowid` 为 0（不影响语义）。实现时用正则 `^INSERT\s+INTO` 判定并在末尾追加 ` RETURNING id`。

- [x] **Step 3: 断言驱动形状单测（不联网）**

```js
// backend/test/task25-store-drivers.test.js 追加
const { createMysqlDriver } = require('../../src/db/drivers/mysql');
const { createPostgresDriver } = require('../../src/db/drivers/postgres');
test('mysql/pg driver 暴露统一接口', () => {
  const m = createMysqlDriver('mysql://u:p@127.0.0.1:3306/x', 'mysql');
  for (const fn of ['run', 'get', 'all', 'exec', 'execBatch', 'transaction', 'close']) assert.equal(typeof m[fn], 'function');
  assert.equal(m.dialect.quoteIdent('a'), '`a`');
  const p = createPostgresDriver('postgresql://u:p@127.0.0.1:5432/x');
  assert.equal(p.dialect.quoteIdent('a'), '"a"');
});
```

- [x] **Step 4: 运行测试**

Run: `cd backend && node --test test/task25-store-drivers.test.js`
Expected: PASS（形状断言不触发连接）
Result: 6/6 PASS；全量 `npm test` 189 total / 188 pass / 1 skip（task1-seed 曾出现一次并行 flake `SQLITE_CONSTRAINT_FOREIGNKEY`，隔离与复跑均 PASS，与 Task 8 无关）

- [x] **Step 5: Commit**（已提交 `2dedbfb`）

```bash
git add backend/src/db/drivers/mysql.js backend/src/db/drivers/postgres.js backend/test/task25-store-drivers.test.js
git commit -m "feat(db): mysql/mariadb 与 postgres driver"
```

### Task 9: sqlserver driver + oracle driver

**Files:**
- Create: `backend/src/db/drivers/mssql.js`
- Create: `backend/src/db/drivers/oracle.js`
- Test: `backend/test/task25-store-drivers.test.js`（形状断言）

- [x] **Step 1: mssql driver**（采纳偏差：同样补 `prepare` 返回 `{run,get,all}` 异步句柄；`transaction(fn)` 返回可调用包装，事务内语句走同一 `sql.Transaction(pool)` 的 `request()`（连接绑定+嵌套复用），事务外走 `pool.request()`；`run` 对 INSERT 在同 batch 内追加 `SELECT SCOPE_IDENTITY() AS id` 回读自增 id（同 scope，避免分条 query 作用域失效））

```js
// backend/src/db/drivers/mssql.js
const sql = require('mssql');
const { translate } = require('../translate');
const { mssql: mssqlDialect } = require('../../datasources/dialects');

function parseMssqlUrl(url) { // mssql://user:pass@host:1433/db
  const u = new URL(url);
  return {
    server: u.hostname, port: u.port ? Number(u.port) : 1433,
    user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '') || 'benchbuild',
    options: { encrypt: false, trustServerCertificate: true },
    pool: { max: 10, min: 0 },
  };
}
const isInsert = (sqlText) => /^\s*INSERT\s+INTO/i.test(sqlText);

function createMssqlDriver(url) {
  const cfg = parseMssqlUrl(url);
  const pool = new sql.ConnectionPool(cfg);
  const lowerKeys = (rows) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])));
  return {
    type: 'sqlserver',
    dialect: mssqlDialect,
    async _conn() { return (await pool.connect()).request(); },
    async run(text, params = []) {
      const req = await this._conn();
      const t = translate(text, mssqlDialect);
      params.forEach((v, i) => req.input('p' + i, v));
      let lastInsertRowid = 0;
      if (isInsert(t)) {
        req.output('newId', sql.Int);
        t = `${t};\nSELECT @newId = SCOPE_IDENTITY();`;
      }
      const r = await req.query(t);
      lastInsertRowid = r.output && r.output.newId ? Number(r.output.newId) : (r.recordset && r.recordset[0] ? Number(r.recordset[0].id || 0) : 0);
      return { changes: r.rowsAffected ? r.rowsAffected[0] : 0, lastInsertRowid };
    },
    async get(text, params = []) {
      const req = await this._conn();
      params.forEach((v, i) => req.input('p' + i, v));
      const r = await req.query(translate(text, mssqlDialect));
      return lowerKeys(r.recordset || [])[0];
    },
    async all(text, params = []) {
      const req = await this._conn();
      params.forEach((v, i) => req.input('p' + i, v));
      const r = await req.query(translate(text, mssqlDialect));
      return lowerKeys(r.recordset || []);
    },
    async exec(text) { await this._conn(); ... /* 按 ';' 拆分逐条 query */ },
    async execBatch(sqls) { for (const s of sqls) await this.exec(s); },
    async transaction(fn) {
      // mssql 用本地事务管道（batch 内复用同一连接）——实现为 pool.connect + BEGIN/COMMIT/ROLLBACK
      const ps = await pool.connect();
      try { await new sql.Transaction(ps).begin(sql.ISOLATION_LEVEL.READ_COMMITTED); const out = await fn(); await new sql.Transaction(ps)... }
      return out;
    },
    async close() { await pool.close(); },
  };
}
module.exports = { createMssqlDriver };
```

> 实现提示：mssql `transaction` 用 `Transaction` 对象包裹事务范围内的 request；为降低复杂度可复用 `this._conn()` 同一连接执行 `BEGIN TRAN/COMMIT/ROLLBACK`。

- [x] **Step 2: oracle driver**（同样补 `prepare` + 可调用 tx 包装；`transaction` 为文档化透传——每语句 autoCommit，批量上传由调用方分批 + 失败回库补偿；导出 `parseOracleUrl` 便于单测）

```js
// backend/src/db/drivers/oracle.js
const oracledb = require('oracledb');
const { translate } = require('../translate');
const { oracle: oracleDialect } = require('../../datasources/dialects');

function parseOracleUrl(url) { // oracle://user:pass@host:1521/FREEPDB1
  const u = new URL(url);
  return { user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), connectString: `${u.hostname}:${u.port || 1521}/${u.pathname.replace(/^\//, '')}` };
}
function createOracleDriver(url) {
  oracledb.thin = true;
  const conn = null;
  const lowerKeys = (r) => Object.fromEntries(Object.entries(r || {}).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    type: 'oracle',
    dialect: oracleDialect,
    async _conn() { return await oracledb.getConnection(parseOracleUrl(url)); },
    async run(text, params = []) {
      const c = await this._conn();
      try {
        const t = translate(text, oracleDialect);
        const out = await c.execute(t, params, { autoCommit: true, outFormat: oracledb.OUT_FORMAT_OBJECT });
        return { changes: out.rowsAffected || 0, lastInsertRowid: 0 }; // oracle 无通用 insertId（RETURNING 由调用侧特殊处理）
      } finally { await c.close(); }
    },
    async get(text, params = []) {
      const c = await this._conn();
      try { const out = await c.execute(translate(text, oracleDialect), params, { outFormat: oracledb.OUT_FORMAT_OBJECT }); return lowerKeys(out.rows && out.rows[0]); }
      finally { await c.close(); }
    },
    async all(text, params = []) {
      const c = await this._conn();
      try { const out = await c.execute(translate(text, oracleDialect), params, { outFormat: oracledb.OUT_FORMAT_OBJECT }); return (out.rows || []).map(lowerKeys); }
      finally { await c.close(); }
    },
    async exec(text) { const c = await this._conn(); try { await c.execute(text, [], { autoCommit: true }); } finally { await c.close(); } },
    async execBatch(sqls) { for (const s of sqls) await this.exec(s); },
    async transaction(fn) {
      // Oracle 无连接池级事务继承：对 v1 采用"每语句 autoCommit + 调用方自行补偿"，事务路径仅用于上传批量写入（分批 autoCommit，失败不落库）——语义弱于 sqlite/pg，文档化已知限制
      const out = await fn();
      return out;
    },
    async close() { /* thin 无持久池，逐连接关闭 */ },
  };
}
module.exports = { createOracleDriver };
```

> 明确已知限制（写入 spec）：**Oracle 作为应用存储时事务语义为每语句自动提交**，不适合多语句原子性要求高的调度；上传批量写入以"整批失败则回库重建"补偿。

- [x] **Step 3: 形状断言单测（不联网）**

```js
const { createMssqlDriver } = require('../../src/db/drivers/mssql');
const { createOracleDriver } = require('../../src/db/drivers/oracle');
test('mssql/oracle driver 暴露统一接口', () => {
  const m = createMssqlDriver('mssql://u:p@127.0.0.1:1433/db');
  for (const fn of ['run', 'get', 'all', 'exec', 'execBatch', 'transaction', 'close']) assert.equal(typeof m[fn], 'function');
  assert.equal(m.dialect.quoteIdent('a'), '[a]');
  const o = createOracleDriver('oracle://u:p@127.0.0.1:1521/SERVICE');
  assert.equal(o.dialect.quoteIdent('a'), '"a"');
});
```

- [x] **Step 4: 运行测试**

Run: `cd backend && node --test test/task25-store-drivers.test.js`
Expected: PASS
Result: 7/7 PASS（不建连）；全量 `npm test` 190 total / 188 pass / 0 fail / 2 skip（task21-live-providers 既有 live 容器跳过）

- [x] **Step 5: Commit**（已提交 `7ac849f`）

```bash
git add backend/src/db/drivers/mssql.js backend/src/db/drivers/oracle.js backend/test/task25-store-drivers.test.js
git commit -m "feat(db): sqlserver 与 oracle driver"
```

### Task 10: 容器 live 回归 `task25-live-store.test.js`

**Files:**
- Create: `backend/test/task25-live-store.test.js`
- Create: `backend/test/helpers/store-live.js`
- Modify: `backend/scripts/datasource-live/docker-compose.yml`（如缺 pg 容器则补——已含 pg:16，无需改）

- [x] **Step 1: 写 live 测试**（改按上文实现的偏差落地；含 `LIVE_CASES` 分批跑）

```js
// backend/test/task25-live-store.test.js
const test = require('node:test');
const assert = require('node:assert');
const { createStoreFor } = require('./helpers/store-live');

const CASES = [
  { name: 'mysql', url: 'mysql://root:Kanban@123@127.0.0.1:13306/live_store_test?connectionLimit=5', sqliteCompat: false },
  { name: 'postgres', url: 'postgresql://postgres:Kanban@123@127.0.0.1:15432/live_store_test', sqliteCompat: false },
  { name: 'mssql', url: 'mssql://sa:Kanban@123@127.0.0.1:11433/live_store_test', sqliteCompat: false },
  { name: 'oracle', url: 'oracle://SYSTEM:Kanban@123@127.0.0.1:11521/FREEPDB1', sqliteCompat: false },
  { name: 'sqlite', url: '/tmp/live-store-sqlite.db', sqliteCompat: true },
];

for (const cs of CASES) {
  test(`live store: ${cs.name} 建表/CRUD/自增/paginate`, { skip: !process.env.RUN_LIVE && cs.name !== 'sqlite' && cs.name !== 'sqliteCompat' ? '' : !process.env.RUN_LIVE && cs.url.startsWith('/') ? '' : (!process.env.RUN_LIVE ? 'RUN_LIVE 未开启（或 sqlite 需真连）' : '') }, async () => {
    const store = await createStoreFor(cs);
    await store.run('CREATE TABLE IF NOT EXISTS sv_meta (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)');
    const ins = await store.prepare('INSERT INTO sv_meta (name) VALUES (?)').run('x');
    assert.ok(Number(ins.lastInsertRowid) > 0);
    assert.equal(await store.get('SELECT name FROM sv_meta WHERE id = ?', [ins.lastInsertRowid]).then((r) => r.name), 'x');
    const all = await store.prepare('SELECT name FROM sv_meta ORDER BY id').all();
    assert.ok(all.length >= 1);
    await store.exec(`DROP TABLE IF EXISTS sv_meta`);
    await store.close();
  });
}
```

> `helpers/store-live.js`：按 `type`/`url` 构造 store（sqlite 用路径），复用 `src/db/drivers/*`。**Sqlite 用例恒跑；mysql/pg/mssql/oracle 仅在 `RUN_LIVE=1` 且容器可达时跑。**等待容器可用（轮询 `testConnection` 或 `connect` 重试 30s）。
>
> 实现偏差（已落地）：① 测试 DDL 按方言给出 `svMetaTableSql`（sqlite AUTOINCREMENT / mysql AUTO_INCREMENT / pg BIGSERIAL / mssql IDENTITY / oracle GENERATED AS IDENTITY），先 `DROP TABLE IF EXISTS` 再建，替代模板中的统一 `INTEGER PRIMARY KEY AUTOINCREMENT`（后者在远程方言非法）；② oracle 自增回读存在文档化限制（`run` 恒返回 `lastInsertRowid: 0`，RETURNING 由调用侧特例），断言对 oracle 放宽为 `changes>=1`，其余方言必须 `lastInsertRowid>0`；③ `ensureDatabase` 为 mysql/pg/mssql 预建 `live_store_test` 库（oracle 直接用 FREEPDB1、sqlite 为文件）；④ 支持 `LIVE_CASES=mysql,postgres` 环境变量按需分批跑；⑤ URL 密码含 `@` 用 `%40` 编码；⑥ compose 已含 pg:16（15432），无需补。

- [x] **Step 2: 启动/复用容器**（规格见 compose；pg 已含、无需改）

Run: `cd backend/scripts/datasource-live && docker compose up -d postgres`（或全部已存在）
Expected: 容器 healthy

- [x] **Step 3: 运行（先 sqlite 恒跑，再带容器）**

Run:
```
cd backend && node --test test/task25-live-store.test.js        # sqlite 用例绿（其余 skip 或失败提示）
RUN_LIVE=1 node --test test/task25-live-store.test.js           # 容器全部就绪时全绿
```
Expected: PASS（oracle 需已有 FREEPDB1 容器，端口 11521）
Result: `node --test` → 1 pass / 4 skip（oracle 命中 RUN_LIVE 未见时 waitFor 60s）；`RUN_LIVE=1` → 5/5 全绿（mysql/pg/mssql/oracle/sqlite）。mysql:8.0、pg:16、mssql:2022、oracle-free-23ai(FREEPDB1, 端口 11521) 均在跑。

- [x] **Step 4: DDL 校正循环**

对每个失败的方言，对照 `backend/src/db/ddl/<dialect>.js` 修类型/自增/默认值，回到 Step 3。断言之外再人工核一条：`CREATE TABLE ... mode TEXT NOT NULL DEFAULT 'direct'` 在各库落表成功。
Result: 无失败需要校正（初版即 5/5 全绿）。发现并修复一个 driver 级问题：mssql v12 `pool.request()` 必须先 `pool.connect()`，否则报 "Connection is closed"——driver 改为首次使用时懒连接（`ensureConnected`），形状单测仍不建连。

- [x] **Step 5: Commit**（已提交 `96f241f`）

```bash
git add backend/test/task25-live-store.test.js backend/test/helpers/store-live.js backend/scripts/datasource-live/docker-compose.yml backend/src/db/ddl
git commit -m "feat(db): 五库 live 存储回归(live)"
```

---

## Phase 3：同步模式

### Task 11: `buildUpsert` 六方言生成器 + 单元测试

**Files:**
- Modify: `backend/src/datasources/build-sql.js`
- Test: `backend/test/task26-sync-core.test.js`

- [x] **Step 1: 写失败测试**（修正模板路径：测试文件在 `backend/test/`，require 应为 `../src/...` 而非 `../../src/...`）

```js
// backend/test/task26-sync-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const { buildUpsert } = require('../../src/datasources/build-sql');
const d = require('../../src/datasources/dialects');

const COLS = ['id', 'amt'];
const CASES = [
  ['mysql', d.mysql, 'INSERT INTO `t` (`id`, `amt`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `amt` = VALUES(`amt`)'],
  ['mariadb', d.mariadb, 'INSERT INTO `t` (`id`, `amt`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `amt` = VALUES(`amt`)'],
  ['pg', d.pg, 'INSERT INTO "t" ("id", "amt") VALUES ($1, $2) ON CONFLICT ("id") DO UPDATE SET "amt" = EXCLUDED."amt"'],
  ['sqlite', d.sqlite, 'INSERT INTO "t" ("id", "amt") VALUES (?, ?) ON CONFLICT("id") DO UPDATE SET "amt" = excluded."amt"'],
  ['mssql', d.mssql, 'MERGE INTO [t] AS T USING (VALUES (@p0, @p1)) AS S ([id], [amt]) ON T.[id] = S.[id] WHEN MATCHED THEN UPDATE SET [amt] = S.[amt] WHEN NOT MATCHED THEN INSERT ([id], [amt]) VALUES (S.[id], S.[amt]);'],
  ['oracle', d.oracle, 'MERGE INTO "t" T USING (SELECT :1 AS "id", :2 AS "amt" FROM DUAL) S ON (T."id" = S."id") WHEN MATCHED THEN UPDATE SET "amt" = S."amt" WHEN NOT MATCHED THEN INSERT ("id", "amt") VALUES (S."id", S."amt")'],
];
for (const [name, dialect, expected] of CASES) {
  test(`buildUpsert ${name}`, () => assert.equal(buildUpsert('t', COLS, ['id']).replace(/\s+/g, ' ').trim(), expected.replace(/\s+/g, ' ').trim()));
}
test('buildUpsert 无主键时报错', () => assert.throws(() => buildUpsert('t', COLS, []), /primary|主键/i));
```

- [x] **Step 2: 运行确认失败**

Run: `cd backend && node --test test/task26-sync-core.test.js`
Expected: FAIL（`buildUpsert` 未导出）
Result: 初始失败为 require 路径错误，修正后首轮断言失败（oracle 需 `:1 AS "id"` 别名、sqlite `ON CONFLICT(` 无空格），已在 Step 3 修正。

- [x] **Step 3: 实现 `buildUpsert`**（实现偏差：oracle `SELECT :1 AS "id", :2 AS "amt" FROM DUAL` 需带列别名；sqlite `ON CONFLICT(` 无空格、pg 有空格；mysql `dup` 分支直接 `col = VALUES(col)`）

```js
// backend/src/datasources/build-sql.js 追加
function buildUpsert(table, columns, pkColumns, dialect) {
  if (!pkColumns || pkColumns.length === 0) throw new HttpError(400, '增量同步需要主键字段(primary_key)');
  const q = dialect.quoteIdent;
  const colList = columns.map(q).join(', ');
  const placeholders = columns.map((_, i) => dialect.placeholder(i + 1)).join(', ');
  const updates = columns.filter((c) => !pkColumns.includes(c)).map((c) => `${q(c)} = `);
  const t = dialect.upsertSyntax;
  if (t === 'dup') {
    return `INSERT INTO ${q(table)} (${colList}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates.map((p) => p.slice(0, -2) + ' = VALUES(' + q(p.slice(0, -2)) + ')').join(', ')}`;
  }
  if (t === 'conflict') {
    const set = columns.filter((c) => !pkColumns.includes(c)).map((c) => `${q(c)} = ${dialect === d.sqlite ? 'excluded' : 'EXCLUDED'}.${q(c)}`).join(', ');
    return `INSERT INTO ${q(table)} (${colList}) VALUES (${placeholders}) ON CONFLICT(${pkColumns.map(q).join(', ')}) DO UPDATE SET ${set}`;
  }
  if (t === 'merge') {
    const cols = columns.map(q).join(', ');
    const srcCols = columns.map((c, i) => `S.${q(c)}`).join(', ');
    const pairs = pkColumns.map((c) => `T.${q(c)} = S.${q(c)}`).join(' AND ');
    const set = columns.filter((c) => !pkColumns.includes(c)).map((c) => `${q(c)} = S.${q(c)}`).join(', ');
    if (dialect === d.mssql) {
      const svals = columns.map((_, i) => `@p${i}`).join(', ');
      return `MERGE INTO ${q(table)} AS T USING (VALUES (${svals})) AS S (${cols}) ON ${pairs} WHEN MATCHED THEN UPDATE SET ${set} WHEN NOT MATCHED THEN INSERT (${cols}) VALUES (${srcCols});`;
    }
    const svals = columns.map((_, i) => `:${i + 1}`).join(', ');
    return `MERGE INTO ${q(table)} T USING (SELECT ${svals} FROM DUAL) S ON (${pairs}) WHEN MATCHED THEN UPDATE SET ${set} WHEN NOT MATCHED THEN INSERT (${cols}) VALUES (${srcCols})`;
  }
  throw new HttpError(500, `方言不支持 upsert: ${dialect.upsertSyntax}`);
}
```

> 实现注意：上面 mysql 'dup' 分支的 UPDATE 构造有占位符语义问题——`VALUES(${q(c)})` 引用的应当是原列，直接使用 `VALUES(${q(c)})` 即可（mysql 的 `VALUES(col)` 引用列）。实现时以最终测试断言为准修正字符串，保证 6 方言逐字匹配断言。

- [x] **Step 4: 运行确认通过**

Run: `cd backend && node --test test/task26-sync-core.test.js`
Expected: PASS（6 条断言全部匹配）
Result: 7/7 PASS（含无主键报错用例）

- [x] **Step 5: Commit**（已提交 `6db9e2b`）

```bash
git add backend/src/datasources/build-sql.js backend/test/task26-sync-core.test.js
git commit -m "feat(sync): buildUpsert 六方言生成器"
```

### Task 12: 同步数据模型 + mode 落地

**Files:**
- Modify: `backend/src/db/ddl/*.js`（加 sync_configs / sync_logs 两张表）
- Modify: `backend/src/services/datasource.service.js`（create/update 接收 mode，校验同步合法性）
- Modify: `backend/src/routes/datasource.routes.js`（POST 路由解构透传 mode）
- Test: `backend/test/task14-datasource-api.test.js`（追加 mode 断言）

- [x] **Step 1: 各方言 DDL 追加两张表**（sqlite/mysql/postgres/mssql/oracle 五方言全追加）（sqlite 示例，其它方言按自增/类型差异）

```sql
CREATE TABLE IF NOT EXISTS sync_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  datasource_id INTEGER NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  source_schema TEXT, source_table TEXT NOT NULL, local_table TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'app', strategy TEXT NOT NULL DEFAULT 'incremental',
  watermark_field TEXT, watermark_kind TEXT NOT NULL DEFAULT 'id', primary_key TEXT,
  sync_interval_seconds INTEGER NOT NULL DEFAULT 86400,
  last_sync_at TEXT, last_watermark TEXT, last_sync_status TEXT, last_sync_msg TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (datasource_id, source_schema, source_table)
);
CREATE TABLE IF NOT EXISTS sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_config_id INTEGER NOT NULL REFERENCES sync_configs(id) ON DELETE CASCADE,
  started_at TEXT, finished_at TEXT, status TEXT, rows_synced INTEGER, message TEXT
);
CREATE INDEX IF NOT EXISTS idx_sync_configs_ds ON sync_configs(datasource_id);
```

- [x] **Step 2: datasource.service 支持 mode**（偏差：路由 POST handler 原解构缺少 `mode`，同步补上；update 走 `req.body` 透传已自带）

- `create({ name, type, config, mode }, ...)`：`const m = mode === 'sync' ? 'sync' : 'direct'`；仅非 file 型允许 sync；插入列加 `mode`。
- `update`：同规则更新 `mode`。
- `toPublic`：`mode: row.mode || 'direct'`。
- `getDriverMeta` 逻辑不变。

- [x] **Step 3: 断言测试**

```js
test('datasource create 支持 mode', async (t) => { /* 用 helpers 的 server/API 或直接服务调用 */ });
```

> 该测试走 task14 已有 server 基建：POST datasource 带 `mode:'sync'`，断言返回 data.mode==='sync'；不带则 'direct'。
Result: 新增 `POST datasource 支持 mode：sync/direct 落库返回` 追加到 task14（含 sync/direct/文件型拒绝三断言），task14 全套 15/15 PASS。

- [x] **Step 4: 运行回归**

Run: `cd backend && node --test test/task26-sync-core.test.js && npm test`
Expected: PASS
Result: task26 7/7 PASS；全量 203/197 pass/0 fail/6 skip

- [x] **Step 5: Commit**（已提交 `e3b9411`）

```bash
git add backend/src/db/ddl backend/src/services/datasource.service.js backend/test/task26-sync-core.test.js
git commit -m "feat(sync): sync_configs/sync_logs 表 + data_sources.mode"
```

### Task 13: 同步执行引擎 `sync.service.js`

**Files:**
- Create: `backend/src/services/sync.service.js`
- Test: `backend/test/task26-sync-core.test.js`

- [x] **Step 1: 写核心函数失败测试（mock providers）**

```js
test('watermark 推进逻辑：拉批→入库→推进', async () => {
  // 用真实 sqlite app store + 假 provider（runQuery 返回两批）
  // 见 Task 13 Step 3 实现后补全断言：rows_synced 正确、last_watermark 更新、日志写入
});
test('增量路由：first sync 全量', async () => {});
test('full 策略 truncate+insert', async () => {});
```

> 偏差：先实现在后补测试（TDD 换序）。测试注入 provider：sync.service 改为 `providersApi.getProvider`（模块引用,调用时取），测试里 `providersApi.getProvider = () => FAKE` 并 after 还原；FAKE 的 runQuery 数据驱动（解析 `LIMIT n` 与 `WHERE wf > ?` 返回剩余行）以贴近真实分批。

- [x] **Step 2: 运行确认失败（初版实现→测试驱动修正）**

Run: `cd backend && node --test test/task26-sync-core.test.js`
Expected: FAIL

- [ ] **Step 3: 实现 `sync.service.js`**
> 已实现（见下方说明替换模板注意点）：runSync/incremental/full/startLog/finishLog/createConfig/getConfig/listConfigs/configsOf/updateConfig/deleteConfig/logsOf/nextLocalTable/validateWatermark/parsePk。
> 偏差记录：
> - `require('../db')` 实际解析 `src/db.js`（store 实例），非 `src/db/index.js`；`migrate` 不存在，schema 由 require 自动 initSchema（sqlite）。
> - provider 解析用 `providersApi.getProvider`（可测注入）；`meta.family==='file'` 拒绝建同步配置。
> - 本地表建表 REQUIRE 主键（sqlite `ON CONFLICT` / pg `ON CONFLICT` 需 PK/UNIQUE）→ `schema.ensureDatasetTable(store, schemaName, fields, pkColumns)` 增加 PK 参数，`db.ensureDatasetTable` 透传。
> - 水印重放幂等闭环：更新水印在整轮成功后落库（配合 upsert 幂等可续跑）。
> - 行数守门用 `config.upload.maxRows`（require 时读 env，测试直接改 config 对象）。
> - 源查询：`SELECT cols FROM schema.table WHERE wf > ? ORDER BY wf ASC LIMIT 5000`，白名单列来自 listColumns；full 策略 DROP+CREATE+分批 INSERT（无水印）。
> - mssql INSERT 批处理默认 `@p0...` 位置映射依赖驱动 prepare 的自增命名——本地( app store )方言为准，与源端无关。

```js
// backend/src/services/sync.service.js
const db = require('../db');
const HttpError = require('../utils/http-error');
const { getProvider } = require('../datasources/providers');
const { decryptConfig } = require('./datasource.service');
const { buildUpsert } = require('../datasources/build-sql');
const config = require('../config');

const BATCH_SIZE = 5000;

function nextLocalTable(dsId, table) {
  const safe = String(table).replace(/[^A-Za-z0-9_]/g, '_');
  return `sync_${dsId}_${safe}`;
}

async function getSourceColumns(datasourceRow) {
  const meta = require('../datasources/drivers').find((x) => x.type === datasourceRow.type);
  const provider = getProvider(meta.family);
  const cols = await provider.listColumns(decryptConfig(JSON.parse(datasourceRow.config)), datasourceRow.type, null, null);
  return cols;
}

function validateWatermark(columns, wf) {
  const col = columns.find((c) => c.name === wf);
  if (!col) throw new HttpError(400, `水印字段不存在: ${wf}`);
  const lower = String(col.type || col.dbType || '').toLowerCase();
  const isNum = /int|decimal|numeric|float|real|number|double/i.test(lower);
  const isTime = /date|time|timestamp/i.test(lower);
  if (!isNum && !isTime) throw new HttpError(400, `水印字段需为数值或时间类型: ${wf}(${lower})`);
  return { kind: isTime && !isNum ? 'time' : 'id', isNum };
}

async function runSync(cid) {
  const sc = db.prepare('SELECT * FROM sync_configs WHERE id = ?').get(cid);
  if (!sc) throw new HttpError(404, '同步配置不存在');
  if (sc.last_sync_status === 'running') return { skipped: true };
  const ds = db.prepare('SELECT * FROM data_sources WHERE id = ?').get(sc.datasource_id);
  const provider = getProvider(require('../datasources/drivers').find((x) => x.type === ds.type).family);
  const cfg = decryptConfig(JSON.parse(ds.config));
  const columns = await provider.listColumns(cfg, ds.type, sc.source_schema, sc.source_table);
  const cols = columns.map((c) => c.name);
  await setStatus(cid, 'running', null, null);

  const logId = await startLog(cid);
  let total = 0; let watermark = sc.last_watermark;
  try {
    if (sc.strategy === 'incremental') total = await incremental(cid, provider, cfg, ds, sc, cols, columns, (w) => { watermark = w; }, logId);
    else total = await full(cid, provider, cfg, ds, sc, cols, logId);
    await finishLog(logId, 'success', total);
    await db.prepare("UPDATE sync_configs SET last_sync_at = datetime('now'), last_watermark = ?, last_sync_status = 'success', last_sync_msg = '', updated_at = datetime('now') WHERE id = ?")
      .run(watermark, cid);
    return { rows: total };
  } catch (e) {
    await finishLog(logId, 'failed', total, e.message);
    await db.prepare("UPDATE sync_configs SET last_sync_status = 'failed', last_sync_msg = ?, updated_at = datetime('now') WHERE id = ?").run(String(e.message).slice(0, 500), cid);
    throw e;
  }
  async function setStatus(id, st) {
    await db.prepare("UPDATE sync_configs SET last_sync_status = ? WHERE id = ?").run(st, id);
  }
}
```

（完整实现含 `incremental`/`full`/`startLog`/`finishLog`/`createConfig`/`listConfigs`/`updateConfig`/`deleteConfig`/`logsOf`。）

- **incremental 读批辅助**（供实现）：`SELECT cols FROM schema.table WHERE water > ? ORDER BY water ASC LIMIT batch`，循环直到空批；本批首列水印 > lastWatermark 推进；有主键走 `buildUpsert` 否则批量 INSERT。
- **full**：`DROP TABLE IF EXISTS local` + `db.ensureDatasetTable(local, cols→canonical)` + 全量分批 INSERT。
- 行数守门：`total > config.upload.maxRows` 抛错中止。
- 落库列名即源列名（白名单自 `listColumns`），`db.dialect.quoteIdent` 引用。

- [x] **Step 4: 运行确认通过**

Run: `cd backend && node --test test/task26-sync-core.test.js`
Expected: PASS
Result: task26 13/13 PASS（含 buildUpsert 7 + sync 引擎 6）；全量 209/203/0 fail/6 skip

- [x] **Step 5: Commit**（已提交 `2b816a2`）

```bash
git add backend/src/services/sync.service.js backend/test/task26-sync-core.test.js
git commit -m "feat(sync): 同步执行引擎(全量/增量水印)"
```

### Task 14: 调度器 + 同步路由

**Files:**
- Create: `backend/src/jobs/sync-scheduler.js`
- Modify: `backend/src/routes/datasource.routes.js`
- Modify: `backend/src/server.js`

- [x] **Step 1: 实现调度器**

```js
// backend/src/jobs/sync-scheduler.js
const config = require('../config');
const db = require('../db');
const { runSync } = require('../services/sync.service');
const running = new Set();
let timer = null;

async function tick() {
  if (running.size >= config.sync.maxConcurrent) return;
  const now = new Date().toISOString();
  const due = await db.all(
    `SELECT * FROM sync_configs WHERE (last_sync_at IS NULL OR datetime(last_sync_at, '+' || sync_interval_seconds || ' seconds') <= ?) AND last_sync_status != 'running' ORDER BY last_sync_at IS NULL DESC, id ASC`,
    [now]
  );
  for (const sc of due) {
    if (running.size >= config.sync.maxConcurrent) break;
    running.add(sc.id);
    runSync(sc.id).catch((e) => console.error(`[sync] cfg ${sc.id} failed:`, e.message)).finally(() => running.delete(sc.id));
  }
}

function startScheduler() {
  if (timer) return timer;
  timer = setInterval(tick, config.sync.schedulerIntervalMs);
  tick();
  return timer;
}
function stopScheduler() { clearInterval(timer); timer = null; }
module.exports = { startScheduler, stopScheduler, tick, running };
```

> 实现注意：`datetime(last_sync_at, '+' || seconds || ' seconds')` 为 sqlite 特写；跨库改用"读全部 due 在 JS 里算到期"（避免方言差异）。
> 结果：按上方提示改成 JS 到期判定（`parseUtc`：`' '→'T'`，无时区补 `Z`，兼容 sqlite`datetime('now')` 与远程 ISO）。

- [x] **Step 2: 同步路由**（挂载到 datasource.routes.js）

```js
router.get('/:id/sync-configs', requireUser, requirePermission('datasource', 'read'), async (req, res) => {
  ok(res, await syncService.listConfigs(Number(req.params.id), req));
});
router.post('/:id/sync-configs', requireUser, requirePermission('datasource', 'update'), async (req, res) => {
  // body: { schema, table, strategy, watermark_field, watermark_kind, primary_key, sync_interval_seconds, source_table? }
  ok(res, await syncService.createConfig(Number(req.params.id), req.body, req), '同步配置已创建，首同步已触发');
});
router.patch('/:id/sync-configs/:cid', requireUser, requirePermission('datasource', 'update'), async (req, res) => {
  ok(res, await syncService.updateConfig(Number(req.params.cid), req.body, req));
});
router.delete('/:id/sync-configs/:cid', requireUser, requirePermission('datasource', 'delete'), async (req, res) => {
  ok(res, await syncService.deleteConfig(Number(req.params.cid), req, req.query && req.query.deleteTable === '1'), '同步配置已删除');
});
router.post('/:id/sync-configs/:cid/run', requireUser, requirePermission('datasource', 'update'), async (req, res) => {
  ok(res, await syncService.runNow(Number(req.params.cid)));
});
router.get('/:id/sync-configs/:cid/logs', requireUser, requirePermission('datasource', 'read'), async (req, res) => {
  ok(res, await syncService.logsOf(Number(req.params.cid), req));
});
```

- [x] **Step 3: 同步型浏览路由降级到本地表**
> 偏差：降级逻辑落在 datasource.service 的 listSchemas/listTables/listColumns（isSyncDs → `[{name:"local"}]` / 本地前缀表 / store 列读取），register-table 复用 listColumns 自动生效；`db.listColumns` 加入 src/db.js 透传 schema.listColumns。

mode==='sync' 时 `/schemas` 返回 `[{name:'local'}]`；`/schemas/:schema/tables` 返回该数据源 `sync_configs` 中已成功的本地表；`register-table` 对 sync 数据源改用"本地表存在性 + 列读取"（走 store 方言）而非外部 provider。

- [x] **Step 4: server.js 启动调度器**
> main() 内 startScheduler() + SIGTERM 停表。

`main()` 内 `startScheduler()`；导入常量。加 `process.on('SIGTERM', stopScheduler)`（可省）。

- [x] **Step 5: 冒烟**
> 插件化：路由注册抽查（datasource.routes 含 6 条 sync 路由）+ `server.js` 临时 DB 启动调度器成功、health OK。完整 live curl 冒烟并入 Task 15 端到端。

Run: `cd backend && timeout 20 npm start & sleep 6 && curl -s -X POST http://localhost:3001/api/datasources/1/sync-configs ...`（用 live mysql + register 一张表）
Expected: 返回 config + 首同步立即执行

- [x] **Step 6: Commit**（已提交 `0d6f462`）

```bash
git add backend/src/jobs/sync-scheduler.js backend/src/routes/datasource.routes.js backend/src/server.js backend/src/services/sync.service.js
git commit -m "feat(sync): 调度器 + REST 路由 + 本地表浏览"
```

### Task 15: live 端到端同步 `task26-live-sync.test.js`

**Files:**
- Create: `backend/test/task26-live-sync.test.js`

- [x] **Step 1: 写 live 测试**
> helpers/live-mysql.js（ensure 建库/建表幂等 + resetTable + seed/insertRows/srcCount/datasourceConfig；URL root@13306/sync_src）；task26-live-sync.test.js 三幕：首全量=源 → 增量两行+水印推进=max(id) → registerSqlDataset(local) 可读列。

```js
// 前提：live mysql (13306) 已有 sales2 表；app store 用临时 sqlite
// 流程：
//  1. create mode=sync 数据源(指向 live mysql)
//  2. POST sync-configs: { table: 'sales2', source_schema: 'benchbuild'|'db', strategy:'incremental', watermark_field, primary_key }
//  3. 等待首同步完成 → 断言 sync_configs.last_sync_status==='success'，local_table 数据量 == 源
//  4. 在源插入 2 行（watermark 更大）→ run 二次 → 断言 local 行数 = 源行数，last_watermark 推进
//  5. register-table → dataset 可 preview & 聚合
```
（`helpers/live-mysql.js` 提供建表 `sales2(id INT PK AUTO_INCREMENT, regionkey INT, name VARCHAR(50), created_at DATETIME)` 与 seed。）

- [x] **Step 2: 运行**
> RUN_LIVE=1 3/3 PASS（首全量 94ms / 增量 16ms / 注册读列）。
> 引擎修复（live 首次暴露）：① 落库前 toBindable 归一 Date/Buffer/对象（better-sqlite3 只收原语，mysql2 的 DATETIME/Date 会抛 bind 错）；② normWm 把 Date → `YYYY-MM-DD HH:MM:SS` 便于水印回传比较；③ 测试连接用 finally end()，避免泄漏 socket 让 node --test 永不退出（误判为挂起）。

Run: `cd backend && RUN_LIVE=1 node --test test/task26-live-sync.test.js`
Expected: PASS（首全量 + 增量两轮 + 数据集可查）

- [x] **Step 3: Commit**（已提交 `5c65963`）

```bash
git add backend/test/task26-live-sync.test.js backend/test/helpers/live-mysql.js
git commit -m "feat(sync): live 端到端同步两轮验证"
```

---

## Phase 4：前端

### Task 16: 数据源表单「存储方式」+ 详情页同步任务区

**Files:**
- Modify: `front-end/src/views/DataSourceFormDialog.vue`
- Modify: `front-end/src/views/DataSourceDetail.vue`
- Modify: `front-end/src/api/index.js`（sync-configs API）

- [x] **Step 1: 表单加「存储方式」单选**
> 已实现（含 file 分类禁用 sync、sync 提示文案）。doSave 原样提交含 mode；编辑回填 row.mode||"direct"。

```vue
<el-form-item label="存储方式">
  <el-radio-group v-model="form.mode">
    <el-radio value="direct">直连</el-radio>
    <el-radio value="sync">同步</el-radio>
  </el-radio-group>
  <div v-if="form.mode === 'sync'" class="mode-tip">
    连接信息与直连一致；保存后请在详情页为要分析的表配置「同步」任务（数据会定期落到本机存储，不在此自动注册数据集）。
  </div>
</el-form-item>
```
`doSave` 提交 `{ ...form }`（含 mode）；编辑行回填 `mode: row.mode || 'direct'`。

- [x] **Step 2: 详情页同步任务区**
> 同步任务卡片（状态/最近/下次/立即同步/日志/删除 + 5s 轮询 running）；新建同步弹窗从 `?source=1` 浏览真实源 schema/表/列（新增浏览接口 source=1 旁路，同步数据源默认降级本机浏览不受影响）；目标表名默认 `sync_<dsId>_<表>`；register-table 按钮保留。
> 表节点「同步」入口改为卡片头部「新建同步」（同步模式浏览树展示的是本地镜像表，表节点配置入口语义歧义），见偏差记录。

- 读取 `/api/datasources/:id`（含 `mode`）。
- mode==='sync'：
  - 浏览表格行追加「同步」操作 → 弹窗（字段：源表/目标表名/策略/水印字段<来自 columns> /主键/刷新周期）→ `POST sync-configs` → 刷新列表。
  - 「同步任务」卡片：每 task 显示状态（success/failed/running）、上次/下次、日志计数、操作「立即同步」「删除」。
  - `register-table` 按钮保留（对本地表生效）。

- [x] **Step 3: api/index.js 追加**
> 导出 syncApi（list/create/update/remove/run/logs），datasourceApi.schemas/tables/columns 增加可选 params 透传。

```js
syncConfigs: {
  list: (id) => api.get(`/datasources/${id}/sync-configs`),
  create: (id, body) => api.post(`/datasources/${id}/sync-configs`, body),
  update: (id, cid, body) => api.patch(`/datasources/${id}/sync-configs/${cid}`, body),
  remove: (id, cid) => api.delete(`/datasources/${id}/sync-configs/${cid}`),
  run: (id, cid) => api.post(`/datasources/${id}/sync-configs/${cid}/run`),
  logs: (id, cid) => api.get(`/datasources/${id}/sync-configs/${cid}/logs`),
}
```

- [x] **Step 4: 前端构建 + 冒烟**
> npm run build 通过（633ms，chunk>500kB 为既有告警）。

Run: `cd front-end && npm run build`
Expected: 构建通过

- [ ] **Step 5: e2e 冒烟（可选 CDP，未做，构建通过已覆盖语法/引用）**：打开数据源新建弹窗断言「存储方式」radio 存在。

- [x] **Step 6: Commit**（已提交 `e2deeee`）

```bash
git add front-end/src/views/DataSourceFormDialog.vue front-end/src/views/DataSourceDetail.vue front-end/src/api/index.js
git commit -m "feat(ui): 数据源存储方式(直连/同步)与同步任务区"
```

---

## Phase 5：README 与最终回归

### Task 17: README 完善 + 验收回归

**Files:**
- Modify: `README.md`

- [x] **Step 1: README 章节补充**
> 新增「存储后端（可选架构）与部署配置」（config.json/env 优先级、六库连接串示例、方言差异表、事务语义/小标题 Oracle 自动提交、可移植 SQL 约定、Docker 实测端口）；M2 增加「数据源存储方式：直连 vs 同步」（对比表、sync_configs 字段表、水印说明、首同步不注册数据集与手动注册路径、调度/并发/已知限制）；同步任务接口表；支持的数据源表更新为 11 实测 / 6 兼容 / 5 规划；目录结构、快速开始、M3 注记同步修订。

新增/修订内容：
- **部署配置**：`config.json` 说明（示例、`DB_TYPE`/`DB_URL`/`DB_PATH` 环境变量覆盖、六库支持清单与各自 docker 镜像提示）。
- **存储可选架构**：`src/db/` 门面、方言差异表、可移植 SQL 约定、事务语义差异（尤其 Oracle 每语句自动提交的已知限制）。
- **数据源存储方式**：直连 vs 同步对比表、`mode` 字段、同步配置字段表、增量水印说明、首同步不注册数据集的说明与"如何再注册"路径、调度器/concurrency/已知限制（多实例锁不支持、增量不感知删除）。
- **M2/M3 章节**同步更新 "支持的数据源" 表格与目录结构；**Quick start** 增加切换存储的示例。
- 常见问题：迁移存量数据（当前不做）说明。

- [x] **Step 2: 全量验收回归**
```
cd backend && npm test                     # 214/207/0
RUN_LIVE=1 node --test test/task25-live-store.test.js test/task26-live-sync.test.js  # 5/5 + 3/3
cd front-end && npm run build              # 通过
node test-m35-e2e.mjs                      # ALL CDP CHECKS PASSED（首跑遇 Execution context destroyed 导航竞态，重跑通过）
```

Run:
```
cd backend && npm test
RUN_LIVE=1 node --test test/task25-live-store.test.js test/task26-live-sync.test.js
cd front-end && npm run build
node test-m35-e2e.mjs
```
Expected: 全部 PASS / build 通过 / e2e 通过

- [x] **Step 3: 清点未交付项**
> README「已知限制（未交付项）」已列明：同步=单实例内存调度（无分布式锁）/ 增量不感知删除 / oracle 每语句自动提交导致事务不回滚；存储切换不做存量数据自动迁移；缓存层无 Redis；RLS/看板共享授权留 M4；excel 数据源不支持同步。（对照 spec 第 8 节"已知限制/不做"，在 README 确认列明）

- [x] **Step 4: Commit**（已提交 `c0af2d0`）

```bash
git add README.md
git commit -m "docs: 完善 README(存储可选/同步模式/部署配置)"
```

---

## Self-Review 记录

**Spec 覆盖核对**：配置层(Task1)✔；六库驱动(Task8-9)✔；方言 DDL/幂等引导(Task5)✔；117 处 await(Task7)✔；上传/查询方言化(Task6)✔；同步模型+mode(Task12)✔；全量/增量水印+upsert(Task11,13)✔；调度+路由(Task14)✔；首同步不注册数据集(Task13 仅落物理表)+手动注册(本地表浏览，Task14)✔；前端(Task16)✔；live 回归(Task10,15)✔；README(Task17)✔；CLICKHOUSE/DORIS 作为 target_type='olap' 契约(Task12 DDL 含 target_type，仅契约)✔。

**占位符扫描**：无 TBD/TODO；sync.service 完整实现以 Task13 断言为准（增量/全量循环、守门、日志代码已在 Task13 给出主入口与伪代码，落地时按断言补全子函数）。buildUpsert mysql 分支的 `VALUES(col)` 细节留待断言驱动修正，已注明。

**类型一致性**：`store.type`（driver 导出）与 `dialects` key 对齐；`db.dialect` 门面透传 store.dialect；`buildUpsert(table, columns, pkColumns, dialect)` 六方言接口一致；sync_configs 字段名与 spec 一致。

## 执行方式

保存于 `docs/superpowers/plans/2026-09-14-app-store-and-sync-mode.md`，17 个任务、按 Phase 顺序执行。