# 看板管理系统 · 后端

ExpressJS 5 后端服务（Node.js >= 18，CommonJS）。提供鉴权/RBAC、数据源接入、数据集构建器、图表看板查询、Excel 分析、同步调度等能力，并将全部元数据通过统一存储门面落地到可选数据库。

- 入口：`src/server.js`（生产）/ `npm run dev`（`node --watch` 热重载）
- 默认端口：`3001`（`PORT` 可覆盖）
- 前端：见仓库根 `README.md`；本文件专注后端运行、配置与数据库切换。

# KanRay Backend

ExpressJS 5 backend service (Node.js >= 18, CommonJS). It provides authentication / RBAC, data source connectivity, the dataset builder, chart and dashboard queries, Excel analysis and sync scheduling, and persists all metadata through a unified storage facade onto a pluggable database.

- Entry point: `src/server.js` (production) / `npm run dev` (`node --watch` hot reload)
- Default port: `3001` (override with `PORT`)
- Front end: see the repository root `README.md`; this file focuses on running, configuring and switching the backend's database.

---

## 快速开始

```bash
cd backend
npm install
npm run dev        # 或 npm start
```

首次启动自动创建 `backend/data/kanban.db`（SQLite），并幂等建表 + 写入初始管理员 `admin@kanray.local / admin123`（环境变量 `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD` 可改，**生产务必改密**）。

> **本地开发约定**：dev 环境默认使用 **SQLite**、**不启用 Redis**（缓存走内存，锁走 `sync_locks` 表），无需启动任何中间件。仅当需要联调外部库/Redis 时再按「存储后端」章节覆盖 `DB_TYPE` / `DB_URL` / `REDIS_URL`。

## Quick Start

The commands above install dependencies and start the service: `npm run dev` reloads on change via `node --watch`, `npm start` runs it in production mode.

On first start it automatically creates `backend/data/kanban.db` (SQLite), creates the schema idempotently, and seeds the initial administrator `admin@kanray.local / admin123` (override with the `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD` environment variables — **change the password in production**).

> **Note**: the local dev convention is **SQLite** with **Redis disabled** by default (caching falls back to process memory, locking goes through the `sync_locks` table), so no middleware needs to be running. Only override `DB_TYPE` / `DB_URL` / `REDIS_URL` as described in the storage-backend sections when you need to integrate against an external database or Redis.

---

## 配置总览

配置优先级：**环境变量 > config.json > 默认值**。

`config.json` 读取顺序：`$DATA_DIR/config.json`（默认 `backend/data/`）→ `backend/config.json`。示例见 `backend/config.example.json`：

```json
{ "db": { "type": "sqlite", "url": "", "sqlitePath": "data/kanban.db" }, "cache": { "url": "" } }
```

## Configuration Overview

Configuration priority: **environment variables > config.json > defaults**.

`config.json` is read in this order: `$DATA_DIR/config.json` (defaults to `backend/data/`) → `backend/config.json`. See `backend/config.example.json` for an example.

### 核心环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3001` | 后端端口 |
| `DB_TYPE` | `sqlite` | 存储后端类型：`sqlite` / `mysql` / `mariadb` / `postgres` / `sqlserver` / `oracle` |
| `DB_URL` | 空 | 非 sqlite 时的 JDBC 风格连接串 |
| `DB_PATH` | `data/kanban.db` | sqlite 文件路径（支持绝对路径） |
| `DATA_DIR` | `backend/data` | 运行时数据目录（也决定 `config.json` 首个读取位置） |
| `UPLOAD_DIR` | `backend/uploads` | 上传文件目录 |
| `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD` | `admin@kanray.local` / `admin123` | 初始管理员 |
| `JWT_SECRET` | `dev-secret-change-me` | JWT 密钥（生产必须注入） |
| `ACCESS_TTL` / `REFRESH_TTL_DAYS` | `15m` / `7` | 令牌有效期 |
| `MAX_FILE_SIZE` / `MAX_ROWS` | `20MB` / `200000` | 上传大小与行数上限 |
| `DATASOURCE_SECRET` | `kanban-dev-datasource-secret-32b!` | 数据源密码加密主密钥（生产必须替换，见下文） |
| `SYNC_SCHEDULER_INTERVAL_MS` / `SYNC_MAX_CONCURRENT` / `SYNC_DEFAULT_INTERVAL_SECONDS` / `SYNC_LOCK_TTL_MS` | `60000` / `2` / `86400` / `1800000` | 同步调度参数；`SYNC_LOCK_TTL_MS` 为调度锁租约时长（毫秒） |
| `REDIS_URL` | 空（关闭） | Redis 缓存/锁开关，如 `redis://127.0.0.1:6379`；空则用内存缓存 + 数据库租约锁 |
| `CACHE_TTL_MS` | `60000` | 数据源目录缓存 TTL（毫秒） |
| `TIMEZONE` | `Asia/Shanghai` | 时区标识符（IANA），前端按此时区渲染时间 |

### Core Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | Backend port |
| `DB_TYPE` | `sqlite` | Storage backend type: `sqlite` / `mysql` / `mariadb` / `postgres` / `sqlserver` / `oracle` |
| `DB_URL` | empty | JDBC-style connection string for non-sqlite backends |
| `DB_PATH` | `data/kanban.db` | SQLite file path (absolute paths supported) |
| `DATA_DIR` | `backend/data` | Runtime data directory (also the first location `config.json` is read from) |
| `UPLOAD_DIR` | `backend/uploads` | Upload directory |
| `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD` | `admin@kanray.local` / `admin123` | Initial administrator |
| `JWT_SECRET` | `dev-secret-change-me` | JWT signing secret (must be injected in production) |
| `ACCESS_TTL` / `REFRESH_TTL_DAYS` | `15m` / `7` | Token lifetimes |
| `MAX_FILE_SIZE` / `MAX_ROWS` | `20MB` / `200000` | Upload size and row-count limits |
| `DATASOURCE_SECRET` | `kanban-dev-datasource-secret-32b!` | Master key for data source password encryption (must be replaced in production, see below) |
| `SYNC_SCHEDULER_INTERVAL_MS` / `SYNC_MAX_CONCURRENT` / `SYNC_DEFAULT_INTERVAL_SECONDS` / `SYNC_LOCK_TTL_MS` | `60000` / `2` / `86400` / `1800000` | Sync scheduler parameters; `SYNC_LOCK_TTL_MS` is the scheduler lock lease duration in milliseconds |
| `REDIS_URL` | empty (disabled) | Redis cache/lock switch, e.g. `redis://127.0.0.1:6379`; when empty an in-memory cache plus database lease locks are used |
| `CACHE_TTL_MS` | `60000` | Data source catalog cache TTL in milliseconds |
| `TIMEZONE` | `Asia/Shanghai` | IANA time zone identifier; the front end renders times in this zone |

---

## 切换数据库（存储后端）详解

### 一句话说明

`DB_TYPE` / `DB_URL` / `DB_PATH` 控制的是**元数据库**（用户 / 角色 / 数据源配置 / 数据集 / 图表 / 看板 / 同步配置 `sync_configs` / 同步落库的本地表 `sync_*`）。它与「外部数据源连接」是两码事：数据源连接是运行时按 `DATASOURCE_SECRET` 加密、存在各数据源记录里的独立配置，不随存储后端走。

### In One Sentence

`DB_TYPE` / `DB_URL` / `DB_PATH` control the **metadata database** (users / roles / data source configuration / datasets / charts / dashboards / sync configuration `sync_configs` / the local `sync_*` tables that synced data lands in). This is a different thing from an "external data source connection": a data source connection is an independent configuration, encrypted at runtime with `DATASOURCE_SECRET` and stored inside each data source record, and it does not travel with the storage backend.

### 支持的存储后端

| `DB_TYPE` | 驱动库 | 说明 |
| --- | --- | --- |
| `sqlite` | better-sqlite3 | 默认，零运维；单文件，同步 API |
| `mysql` | mysql2 | |
| `mariadb` | mysql2 | 与 mysql 同驱动 |
| `postgres` | pg | |
| `sqlserver` | mssql | |
| `oracle` | oracledb | 每语句自动提交（事务限制见下） |

### Supported Storage Backends

| `DB_TYPE` | Driver | Description |
| --- | --- | --- |
| `sqlite` | better-sqlite3 | The default, zero-ops; single file, synchronous API |
| `mysql` | mysql2 | |
| `mariadb` | mysql2 | Same driver as mysql |
| `postgres` | pg | |
| `sqlserver` | mssql | |
| `oracle` | oracledb | Auto-commit per statement (transaction limits see below) |

### 切换方式一：环境变量（推荐，不落盘）

```bash
cd backend
# PostgreSQL
DB_TYPE=postgres DB_URL='postgresql://kanban:kanban@127.0.0.1:15432/kanban?sslmode=disable' npm start
# MySQL
DB_TYPE=mysql DB_URL='mysql://root:Kanban%40123@127.0.0.1:13306/kanban' npm start
# MariaDB
DB_TYPE=mariadb DB_URL='mysql://root:Kanban%40123@127.0.0.1:13307/kanban' npm start
# SQL Server
DB_TYPE=sqlserver DB_URL='mssql://sa:Kanban%40123@127.0.0.1:11433/kanban' npm start
# Oracle
DB_TYPE=oracle DB_URL='oracle://SYSTEM:Kanban%40123@127.0.0.1:11521/FREEPDB1' npm start
```

密码中含特殊字符需做 URL 编码（如 `@` → `%40`）。`mariadb` 连接串协议可写 `mysql://`。

### Switching Method 1: Environment Variables (Recommended, Not Persisted)

Special characters in passwords must be URL-encoded (e.g. `@` → `%40`). The connection-string scheme for `mariadb` may be written as `mysql://`.

### 切换方式二：config.json（随部署持久化）

```bash
# backend/config.json
{
  "db": { "type": "postgres", "url": "postgresql://kanban:kanban@127.0.0.1:15432/kanban?sslmode=disable" }
}
# 放 backend/data/config.json 同样生效（读取顺序 DATA_DIR 在前）
```

### Switching Method 2: config.json (Persisted with the Deployment)

Placing the same file at `backend/data/config.json` works too, since `DATA_DIR` is read first.

### 首次启动会发生什么

1. 读取连接串，检查可达性；
2. 对所选库执行**幂等建表**（`IF NOT EXISTS` 等）+ **老库列补齐**（按方言探测已有表结构并补列）,建表 DDL 见 `src/db/ddl/*.js`；
3. 若库中无管理员则自动播种 `admin@kanray.local`；
4. 直接进入正常使用，无需手工建表。

增量大表 / 生产切换建议先人工在目标库执行 `src/db/schema.js` 对应的引导逻辑演练一遍，再切正式流量。

### What Happens on First Start

1. It reads the connection string and checks reachability;
2. It runs **idempotent table creation** on the chosen database (`IF NOT EXISTS` and friends) plus **column back-filling for older databases** (probing the existing schema per dialect and adding missing columns). The DDL lives in `src/db/ddl/*.js`;
3. If the database has no administrator yet, it seeds `admin@kanray.local` automatically;
4. You can start using it right away — no manual schema setup.

For large tables or a production cutover, we recommend rehearsing the bootstrap logic from `src/db/schema.js` against the target database manually first, then switch over real traffic.

### 本地实测容器（用同一批库做存储后端）

```bash
docker compose -f scripts/datasource-live/docker-compose.yml up -d
```

| DB_TYPE | 端口 | 连接串（示例） |
| --- | --- | --- |
| sqlite | — | `DB_PATH=data/kanban.db` |
| mysql | 13306 | `mysql://root:Kanban%40123@127.0.0.1:13306/kanban` |
| mariadb | 13307 | `mysql://root:Kanban%40123@127.0.0.1:13307/kanban` |
| postgres | 15432 | `postgresql://postgres:Kanban%40123@127.0.0.1:15432/kanban?sslmode=disable` |
| sqlserver | 11433 | `mssql://sa:Kanban%40123@127.0.0.1:11433/kanban` |
| oracle | 11521 | `oracle://SYSTEM:Kanban%40123@127.0.0.1:11521/FREEPDB1` |

### Local Test Containers (The Same Set of Databases Used as Storage Backends)

| DB_TYPE | Port | Connection string (example) |
| --- | --- | --- |
| sqlite | — | `DB_PATH=data/kanban.db` |
| mysql | 13306 | `mysql://root:Kanban%40123@127.0.0.1:13306/kanban` |
| mariadb | 13307 | `mysql://root:Kanban%40123@127.0.0.1:13307/kanban` |
| postgres | 15432 | `postgresql://postgres:Kanban%40123@127.0.0.1:15432/kanban?sslmode=disable` |
| sqlserver | 11433 | `mssql://sa:Kanban%40123@127.0.0.1:11433/kanban` |
| oracle | 11521 | `oracle://SYSTEM:Kanban%40123@127.0.0.1:11521/FREEPDB1` |

### 切换注意事项

- **不做存量数据自动迁移**：切换存储后端不会把旧库（如默认 SQLite）里的元数据自动搬运到新库。请在新库首次启动前决定部署形态，或用 `backend/scripts/` 下的工具/手工导出重建。
- **`DATASOURCE_SECRET` 必须一致**：数据源连接密码是加密存储的。若把元数据从旧库搬到新库但 `DATASOURCE_SECRET` 变了，历史密码将无法解密（需逐个重新保存）。SKU 在创建首个数据源**之前**固定该密钥。
- **Oracle 事务语义**：Oracle 每语句自动提交，`store.transaction(fn)` 退化为逐条执行，批量写中途失败不会整体回滚；其余方言支持显式事务。
- **本地同步物理表跟着存储后端走**：同步落库的 `sync_*` 表建在存储后端库中，切换后端后这些表也随库移动/换库（旧表需要自行迁移或重同步）。
- **SQL Server 主键回写**依赖驱动 `lastInsertRowid`；不同方言自增值的回取方式见下方「方言」一节。

### Switching Caveats

- **Existing data is not migrated automatically**: switching the storage backend does not copy metadata out of the old database (such as the default SQLite file) into the new one. Decide on the deployment shape before the new database's first start, or rebuild it with the tooling under `backend/scripts/` or a manual export.
- **`DATASOURCE_SECRET` must stay the same**: data source connection passwords are stored encrypted. If you move metadata from the old database to a new one but change `DATASOURCE_SECRET`, historical passwords can no longer be decrypted (each one has to be re-saved). Fix this key **before** creating the first data source of the SKU.
- **Oracle transaction semantics**: Oracle auto-commits per statement, so `store.transaction(fn)` degrades to statement-by-statement execution and a mid-batch failure will not roll the whole batch back; the other dialects support explicit transactions.
- **Local synced tables follow the storage backend**: the `sync_*` tables that synced data lands in are created in the storage backend database, so they move (or must be recreated) when you switch backends; old tables need to be migrated or re-synced by hand.
- **SQL Server primary-key write-back** relies on the driver's `lastInsertRowid`; see the "Dialects" section below for how each dialect reads back auto-increment values.

---

## 存储门面与方言

统一入口 `src/db.js`：`prepare()` → `{ run, get, all }`、`exec`、`transaction(fn)`、`dialect`。SQLite 为同步句柄，远端驱动为异步句柄，调用方一律 `await`。

- **方言** `src/db/dialects/*.js` + `src/db/translate.js`：标识符引用（`` ` ` `` / `"` / `[ ]`）、占位符（`?` / `$1..` / `@p1..` / `:p1..`）、时间默认值、分页（`LIMIT` / `OFFSET..FETCH`）、自增主键的建表与回取差异。
- **可移植 SQL 约定**：标识符一律 `dialect.quoteIdent`，值一律占位符，时间默认值用 `dialect.now`；跨库写业务 SQL 时遵守该约定即可一库通吃。
- **新增一种存储后端**（极少）：加 `src/db/ddl/<type>.js`、`src/db/drivers/<type>.js`、一套 dialect，并在 `config/index.js` 的 `STORE_TYPES` 中登记即可。

## Storage Facade and Dialects

The single entry point is `src/db.js`: `prepare()` → `{ run, get, all }`, `exec`, `transaction(fn)`, `dialect`. SQLite exposes a synchronous handle while remote drivers are asynchronous, so callers always `await`.

- **Dialects** live in `src/db/dialects/*.js` plus `src/db/translate.js`: identifier quoting (`` ` ` `` / `"` / `[ ]`), placeholders (`?` / `$1..` / `@p1..` / `:p1..`), time defaults, pagination (`LIMIT` / `OFFSET..FETCH`), and the differences in creating and reading back auto-increment primary keys.
- **Portable SQL conventions**: always quote identifiers with `dialect.quoteIdent`, always bind values through placeholders, and use `dialect.now` for time defaults; following these conventions makes business SQL work across every backend.
- **Adding a new storage backend** (very rarely needed): add `src/db/ddl/<type>.js`, `src/db/drivers/<type>.js` and a dialect, then register it in `STORE_TYPES` in `config/index.js`.

---

## 统一响应信封（`message` / `messageEn`）

所有接口返回同一层信封，实现见 `src/middleware/response.js`：

- **成功**：`{ code: 0, data, message }`，`message` 是**中文**文案（默认 `success`）。
- **失败**：`{ code, message, data: null }`；`code` 默认取 HTTP 状态码，若错误对象自带 `code`（`HttpError` 一定会带）则以它为准。`HttpError` 额外带 `details`。
- **`messageEn` 是可选字段**：仅当中文原文能查到英文译文时才出现。

> **注意**：查不到译文时 `messageEn` 会被**整体省略**——既不会回落成同一段中文，也不是空字符串。前端据此回退显示 `message`，所以漏译只会降低英文界面的可读性，不会丢信息、也不会报错。

辅助工具：

| 位置 | 说明 |
| --- | --- |
| `ok(res, data, message, messageEn)` | 成功响应。显式传入的 `messageEn` 优先，否则按 `message` 查表；默认 `message` 为 `success`（未收录，因此不带 `messageEn`） |
| `HttpError(status, message, details, code, messageEn)` | 抛出即失败响应。第 5 参 `messageEn` 可选，缺失时按中文 `message` 查表 |
| `enOf(message)` | 中文原文 → 英文文案；查不到返回 `undefined`，调用方据此省略字段 |
| `withMessageEn(result)` | 给 `data.message` 形态的 provider 结果补 `messageEn`，让 22 个 provider 只维护一份英文 |

查表数据见 `src/i18n/en-messages.js`：`MESSAGES`（静态错误文案）、`SUCCESS_MESSAGES`（`ok()` 的成功文案）、`MESSAGE_TEMPLATES`（带插值模板）。查询与模板回填逻辑见 `src/i18n/index.js`——`MESSAGE_TEMPLATES` 的键保留源码里的 `${...}` 表达式原文，编译成正则时统一替换为捕获组，再把实际值按出现顺序回填到英文模板的 `${...}` 位置，因此 `${f.label}` 与 `${label}` 会命中同一条模板。

`errorHandler` 的兜底 500 文案、三处特例（`entity.too.large` / `entity.parse.failed` / `MulterError`）以及 `notFound` 的 404 文案不经查表，直接写死英文。

## Unified Response Envelope (`message` / `messageEn`)

Every endpoint returns the same envelope, implemented in `src/middleware/response.js`:

- **Success**: `{ code: 0, data, message }`, where `message` is the **Chinese** text (default `success`).
- **Failure**: `{ code, message, data: null }`; `code` defaults to the HTTP status, and is taken from the error's own `code` when it has one (an `HttpError` always does). An `HttpError` also carries `details`.
- **`messageEn` is an optional field**: it appears only when an English translation can be found for the Chinese text.

> **Note**: when no translation is found, `messageEn` is **omitted entirely** — it never falls back to the same Chinese text, and it is never an empty string. The front end falls back to `message` in that case, so a missing translation only affects readability of the English UI; no information is lost and nothing throws.

Helpers:

| Helper | Description |
| --- | --- |
| `ok(res, data, message, messageEn)` | Success response. An explicitly passed `messageEn` wins; otherwise the table is looked up by `message`. The default `message` is `success`, which is not in the tables, so that response carries no `messageEn` |
| `HttpError(status, message, details, code, messageEn)` | Throwing it produces the failure response. The 5th parameter `messageEn` is optional; when missing, the table is looked up by the Chinese `message` |
| `enOf(message)` | Chinese text → English text; returns `undefined` when not found, and callers omit the field accordingly |
| `withMessageEn(result)` | Adds `messageEn` to a provider result that carries its text in `data.message`, so the 22 providers only maintain one English copy |

The lookup tables live in `src/i18n/en-messages.js`: `MESSAGES` (static error text), `SUCCESS_MESSAGES` (success text for `ok()`) and `MESSAGE_TEMPLATES` (templates with interpolation). The lookup and template back-filling logic lives in `src/i18n/index.js` — the keys of `MESSAGE_TEMPLATES` keep the original `${...}` expressions from the source, are compiled into a regular expression with each expression replaced by a capture group, and the actual values are then back-filled into the `${...}` positions of the English template in order of appearance, so `${f.label}` and `${label}` match the same template.

The fallback 500 text in `errorHandler`, its three special cases (`entity.too.large` / `entity.parse.failed` / `MulterError`) and the 404 text in `notFound` do not go through the tables; their English is hard-coded.

---

## 目录结构

```
backend/
  src/
    server.js / app.js       入口与中间件装配
    config/index.js          配置（env > config.json > 默认值）
    db.js                    存储门面（prepare/exec/transaction/dialect）
    db/
      index.js               门面 → 具体驱动工厂
      schema.js              幂等建表 + 列补齐 + ensureDatasetTable(PK)
      dialects/              六库方言（标识符/占位符/时间/分页/自增）
      translate.js           SQL 可移植转换
      ddl/                   六库建表语句（sqlite/mysql/postgres/mssql/oracle）
      drivers/               远端驱动句柄（mysql/mariadb/postgres/mssql/oracle/sqlite）
    datasources/
      drivers.js             驱动注册表（22 种数据源类型元数据）
      dialects.js            数据源侧 SQL 方言抽象
      providers/             协议族 Provider（mysql/pg/clickhouse/mssql/es-rest/http/oracle/presto/api-service）
      build-sql.js           构建器编译层（sql/drag/etl 三种定义 → 方言 SQL）
      sql-data-provider.js   外部库表桥接查询引擎
      crypto.js              数据源密码 AES-256-GCM 加解密
    engines/query-engine.js  聚合查询引擎
    services/                业务层（auth/rbac/user/dataset/chart/dashboard/datasource/sync/access/audit/excel）
    jobs/sync-scheduler.js   同步调度器（内存定时器 + 并发闸门）
    routes/                  RESTful 路由（auth/admin/dataset/chart/dashboard/datasource）
    middleware/              认证 / 权限 / 统一响应
    i18n/                    中文原文 → 英文文案查表（en-messages.js + enOf）
    seeds.js                 初始管理员播种
    utils/                   http-error / jwt / pagination
  config.example.json        配置示例
  scripts/
    integration-test.js      集成测试（需后端已启动）
    smoke-ds-dataset.mjs     数据源+数据集全链路 E2E 冒烟（HTTP 直测）
    datasource-live/         9 个实测数据源 Docker Compose
    datasource-live/verify-schema-scope.mjs   schema 结构验证工具
  test/                      node:test 单元 / 集成 / LIVE 冒烟（RUN_LIVE=1）
  data/ kanban.db            默认 SQLite 文件（运行时生成）
```

## Directory Structure

The tree above lists the backend layout: `src/server.js` and `src/app.js` are the entry point and middleware wiring, `src/config/index.js` resolves configuration, `src/db.js` and `src/db/` hold the storage facade with its dialects and per-database DDL, `src/datasources/` holds the driver registry and protocol-family providers, `src/engines/` the aggregation engine, `src/services/` the business layer, `src/jobs/` the sync scheduler, `src/routes/` the RESTful routers, `src/middleware/` authentication / authorization / the unified response, `src/i18n/` the Chinese-to-English lookup tables, `src/seeds.js` the initial administrator seeding and `src/utils/` shared helpers. `scripts/` holds the E2E smoke script and the `datasource-live/` Docker Compose stack, `test/` holds the node:test suites and `data/kanban.db` is the default SQLite file generated at runtime.

---

## 常用命令

```bash
npm start                          # 生产
npm run dev                        # 开发热重载

# 单元 + 集成（无外部依赖，仅 sqlite）
npm test

# 全部测试含 LIVE（需先起 docker compose，见下）
RUN_LIVE=1 npm test

node scripts/integration-test.js   # HTTP 集成测试（需后端已启动）
node scripts/smoke-ds-dataset.mjs  # 数据源+数据集 E2E 冒烟（需后端已启动）
```

## Common Commands

`npm start` runs the production server and `npm run dev` runs it with hot reload. `npm test` covers unit and integration tests with no external dependency (SQLite only), while `RUN_LIVE=1 npm test` additionally runs the LIVE cases and needs the Docker Compose stack from below to be up first. The last two commands are the standalone HTTP integration test and the data source + dataset end-to-end smoke test.

### 测试说明（`test/`，node:test）

| 模式 | 命令 | 覆盖 |
| --- | --- | --- |
| 单元/集成 | `npm test` | 全部不依赖外部库的用例：auth/RBAC/audit/engine/builder/驱动元数据/存储门面方言等 |
| LIVE | `RUN_LIVE=1 npm test` | 追加连接真实容器：六库存储后端 + 十一种数据源 provider + 直连/同步链路 |

LIVE 用例失败/跳过会打印原因（如容器未起、端口不通即 skip）。启动容器：

```bash
docker compose -f scripts/datasource-live/docker-compose.yml up -d
```

### Test Notes (`test/`, node:test)

| Mode | Command | Coverage |
| --- | --- | --- |
| Unit/integration | `npm test` | Every case that needs no external database: auth/RBAC/audit/engine/builder/driver metadata/storage facade dialects, etc. |
| LIVE | `RUN_LIVE=1 npm test` | Additionally connects to real containers: six storage backends + eleven data source providers + direct-connect and sync pipelines |

LIVE cases print the reason when they fail or are skipped (for example, they skip when the containers are not up or the port is unreachable). Start the containers with the command above.

---

## 外部数据源接入（与存储后端区分）

数据源记录本身存在**存储后端**表里（密码加密），但查询/浏览/同步打到**外部数据库**，两者相互独立：

- **驱动注册表** `datasources/drivers.js`：22 种类型（MySQL/PG/SQL Server/MariaDB/TiDB/ClickHouse/ES/Oracle/GBASE/Presto/API 等 + 协议兼容族），每种声明协议族、能力（是否能建数据集 / 能否同步）、默认端口。
- **连接测试 / 结构浏览 / 查询**：按协议族分发到 `providers/*`（统一 `testConnection` / `listSchemas` / `listTables` / `listColumns` / `runQuery`）。
- **存储方式二选一**（创建数据源时的 `mode`）：
  - `direct`：只存连接配置，查询实时打源库；
  - `sync`：同步任务把远端表拉到本机存储后端 `sync_*` 物理表（增量水印 + upsert / 全量 DROP 重建，单批 5000 行，跨方言时间水印在 JS 侧归一）。
- **同步调度**：`jobs/sync-scheduler.js` 每分钟 tick，按 `sync_configs` 的 `interval_seconds` 触发；表结构/同步历史见 `sync_configs`、`sync_logs` 表。
- **前置条件**：同步要求源库可执行 SQL 且驱动能力含对应协议族（mysql/pg/mssql/oracle），ClickHouse/Presto/ES/API 不参与同步。

数据源相关 REST 接口列表见根 `README.md`「多数据源接入（M2）」。接口前缀 `/api/datasources`、`/api/datasources/:id/sync-configs`。

## External Data Source Connectivity (Distinct from the Storage Backend)

The data source records themselves live in the **storage backend** table (with encrypted passwords), but querying / browsing / syncing hits the **external database**; the two are independent:

- **The driver registry** `datasources/drivers.js` holds 22 types (MySQL / PG / SQL Server / MariaDB / TiDB / ClickHouse / ES / Oracle / GBASE / Presto / API and protocol-compatible families), each declaring its protocol family, its capabilities (can it back a dataset / can it sync) and its default port.
- **Connection test / schema browsing / querying** is dispatched by protocol family to `providers/*` (a uniform `testConnection` / `listSchemas` / `listTables` / `listColumns` / `runQuery`).
- **Two storage modes** (the `mode` chosen when creating a data source):
  - `direct`: only the connection configuration is stored and queries hit the source database live;
  - `sync`: a sync task pulls the remote table into a local `sync_*` physical table in the storage backend (incremental watermark + upsert, or full DROP and rebuild; 5000 rows per batch, with cross-dialect time watermarks normalized on the JS side).
- **Sync scheduling**: `jobs/sync-scheduler.js` ticks once a minute and fires according to `interval_seconds` in `sync_configs`; see the `sync_configs` and `sync_logs` tables for the schema and sync history.
- **Prerequisites**: sync requires the source database to execute SQL and the driver's capabilities to include the matching protocol family (mysql / pg / mssql / oracle); ClickHouse / Presto / ES / API do not take part in sync.

The list of data source REST endpoints is in the root `README.md` under "多数据源接入（M2）". The prefixes are `/api/datasources` and `/api/datasources/:id/sync-configs`.

---

## 已知限制（后端视角）

- Oracle 存储后端 / Oracle 同步源：每语句自动提交，`transaction` 退化为逐条执行，批量写中途失败不会整体回滚。
- 同步增量默认开启主键对账删除（`sync_configs.reconcile_delete`，默认 1）：每次增量把源端与本地主键比对，删除本地多出的行；大表有全表主键扫描成本，可置 0 关闭。

## Known Limitations (Backend Perspective)

- Oracle as a storage backend, or Oracle as a sync source: auto-commit per statement means `transaction` degrades to statement-by-statement execution, and a mid-batch failure will not roll the whole batch back.
- Incremental sync enables primary-key reconciliation deletion by default (`sync_configs.reconcile_delete`, default 1): every incremental run compares source and local primary keys and deletes the extra local rows. On large tables this costs a full primary-key scan, and you can set it to 0 to turn it off.

---

## 分布式同步锁（多实例安全）

未配置 Redis 时（默认），调度器使用**数据库租约锁**（`sync_locks` 表，元数据库共享即可互斥）：抢占时 `UPDATE ... WHERE locked_until < now`；配了 Redis 后改用 `SET NX PX`，二者选其一（以 `REDIS_URL` 为准）。

- 锁粒度：每个 `sync_configs.id` 一把锁，`lockTtlMs` 默认 30 分钟（`SYNC_LOCK_TTL_MS`）。
- 多实例共享同一元数据库（`DB_TYPE` + `DB_URL`）即自动互斥；若各实例用独立本地 SQLite（开发模式），调度互不干扰但也无互斥。
- `runSync` 内仍以 `last_sync_status` 做幂等二次保障，锁与状态双保险。

## Distributed Sync Locks (Multi-Instance Safety)

When Redis is not configured (the default), the scheduler uses a **database lease lock** (the `sync_locks` table; sharing the metadata database is enough for mutual exclusion): acquisition runs `UPDATE ... WHERE locked_until < now`. Once Redis is configured it switches to `SET NX PX` instead — exactly one of the two is used, decided by `REDIS_URL`.

- Lock granularity: one lock per `sync_configs.id`; `lockTtlMs` defaults to 30 minutes (`SYNC_LOCK_TTL_MS`).
- Multiple instances sharing the same metadata database (`DB_TYPE` + `DB_URL`) are mutually exclusive automatically; if each instance uses its own local SQLite (development mode), the schedulers do not interfere but there is also no mutual exclusion.
- `runSync` still uses `last_sync_status` as a second idempotency guarantee, so the lock and the status work together.

---

## Redis 缓存（可选）

默认关闭（`REDIS_URL` 空），用进程内存 `Map` 带 TTL 惰性淘汰，单实例足够。多实例或需要跨进程共享缓存时，在 `REDIS_URL` / `config.json cache.url` 配置 Redis 地址即可切换，应用启动不依赖 Redis（未连接时自动降级内存，日志 warn）。

目前缓存覆盖范围：数据源目录 `catalogCache`（ETL 列元数据，TTL 60s `CACHE_TTL_MS`）。RBAC 映射直接查库，无需缓存（权限变更即时生效）。

## Redis Cache (Optional)

It is disabled by default (`REDIS_URL` empty): an in-process `Map` with lazy TTL eviction, which is enough for a single instance. For multiple instances or a cache shared across processes, configure the Redis address via `REDIS_URL` / `config.json cache.url`. Application startup does not depend on Redis — when it cannot connect, it automatically falls back to memory and logs a warning.

The current cache coverage is the data source catalog `catalogCache` (ETL column metadata, TTL 60s via `CACHE_TTL_MS`). RBAC mappings query the database directly and need no cache, so permission changes take effect immediately.

---

## 数据迁移脚本

解决「旧库 → 新库自动数据迁移」：`scripts/migrate-data.mjs`，ESM + CJS 混用（`createRequire` 风格，匹配 seed 脚本）。

```bash
# 元数据 + 全部数据表（默认）
node scripts/migrate-data.mjs \
  --from sqlite@data/kanban.db \
  --to postgres@postgresql://kanban:kanban@127.0.0.1:15432/kanban

# 仅元数据表
node scripts/migrate-data.mjs --from sqlite@data/kanban.db --to sqlite@data/kanban_new.db --skip-data

# 指定表 + dry-run
node scripts/migrate-data.mjs --from sqlite@data/kanban.db --to postgres@postgresql://... \
  --tables users,roles,permissions --dry-run
```

复制顺序：先 FK 安全的 14 张元数据表（`users` → `roles` → `permissions` → `data_sources` → `datasets` → `dataset_fields` → `charts` → `dashboards` → `sync_configs` → `sync_logs` → `refresh_tokens` → `user_roles` → `role_permissions` → `audit_logs`），再复制剩余数据表（`ds_*` / `sync_*` 等动态表，包含同步落库数据）。

列类型跨方言自省映射为 canonical（`integer/number/string/date/boolean`），目标方言 `typeMapping` 重建表；自增序列迁移后按方言重置（PG `setval` / MySQL `AUTO_INCREMENT` / MSSQL `DBCC CHECKIDENT` / SQLite `sqlite_sequence`，Oracle best-effort）。

**注意**：目标库 `DATASOURCE_SECRET`（数据源密码解密）与 `JWT_SECRET`（刷新令牌签名）必须与旧库一致，否则数据源配置无法解密、旧 refresh token 失效。

## Data Migration Script

For "automatically migrate data from the old database to the new one": `scripts/migrate-data.mjs`, which mixes ESM and CJS (the `createRequire` style, matching the seed scripts). The commands above copy metadata plus all data tables (the default), metadata tables only (`--skip-data`), or specific tables with a dry run (`--tables` / `--dry-run`).

Copy order: first the 14 foreign-key-safe metadata tables (`users` → `roles` → `permissions` → `data_sources` → `datasets` → `dataset_fields` → `charts` → `dashboards` → `sync_configs` → `sync_logs` → `refresh_tokens` → `user_roles` → `role_permissions` → `audit_logs`), then the remaining data tables (dynamic tables such as `ds_*` / `sync_*`, including synced data).

Column types are introspected per dialect and mapped to canonical ones (`integer/number/string/date/boolean`), and the target dialect's `typeMapping` recreates the table; auto-increment sequences are reset per dialect after the migration (PG `setval` / MySQL `AUTO_INCREMENT` / MSSQL `DBCC CHECKIDENT` / SQLite `sqlite_sequence`, best-effort for Oracle).

**Note**: `DATASOURCE_SECRET` (data source password decryption) and `JWT_SECRET` (refresh token signing) on the target database must match the old database, otherwise data source configuration cannot be decrypted and old refresh tokens stop working.
