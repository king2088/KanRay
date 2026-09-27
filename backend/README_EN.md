# KanRay Backend

> 中文: [README.md](./README.md)

ExpressJS 5 backend service (Node.js >= 18, CommonJS). It provides authentication / RBAC, data source connectivity, the dataset builder, chart and dashboard queries, Excel analysis and sync scheduling, and persists all metadata through a unified storage facade onto a pluggable database.

- Entry point: `src/server.js` (production) / `npm run dev` (`node --watch` hot reload)
- Default port: `3001` (override with `PORT`)
- Front end: see the repository root `README.md`; this file focuses on running, configuring and switching the backend's database.

---

```bash
cd backend
npm install
npm run dev        # 或 npm start
```

## Quick Start

The commands above install dependencies and start the service: `npm run dev` reloads on change via `node --watch`, `npm start` runs it in production mode.

On first start it automatically creates `backend/data/kanban.db` (SQLite), creates the schema idempotently, and seeds the initial administrator `admin@kanray.local / admin123` (override with the `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD` environment variables — **change the password in production**).

> **Note**: the local dev convention is **SQLite** with **Redis disabled** by default (caching falls back to process memory, locking goes through the `sync_locks` table), so no middleware needs to be running. Only override `DB_TYPE` / `DB_URL` / `REDIS_URL` as described in the storage-backend sections when you need to integrate against an external database or Redis.

---

```json
{ "db": { "type": "sqlite", "url": "", "sqlitePath": "data/kanban.db" }, "cache": { "url": "" } }
```

## Configuration Overview

Configuration priority: **environment variables > config.json > defaults**.

`config.json` is read in this order: `$DATA_DIR/config.json` (defaults to `backend/data/`) → `backend/config.json`. See `backend/config.example.json` for an example.

### Core Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | Backend port |
| `DB_TYPE` | `sqlite` | Storage backend type: `sqlite` / `mysql` / `mariadb` / `postgres` / `sqlserver` / `oracle` |
| `DB_URL` | empty | JDBC-style connection string for non-sqlite backends |
| `DB_POOL_MAX` | `10` | Storage-driver connection pool cap (minimum 1); with multiple replicas the total is roughly replicas × this value |
| `DB_PATH` | `data/kanban.db` | SQLite file path (absolute paths supported) |
| `DATA_DIR` | `backend/data` | Runtime data directory (also the first location `config.json` is read from) |
| `UPLOAD_DIR` | `backend/uploads` | Upload directory |
| `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD` | `admin@kanray.local` / `admin123` | Initial administrator |
| `JWT_SECRET` | `dev-secret-change-me` | JWT signing secret (must be injected in production) |
| `ACCESS_TTL` / `REFRESH_TTL_DAYS` | `15m` / `7` | Token lifetimes |
| `MAX_FILE_SIZE` / `MAX_ROWS` | `20971520` (20 MiB, in **bytes**) / `200000` | Upload size (bytes) and row-count limits. `MAX_FILE_SIZE` goes through `parseInt`, so it **must be a plain byte number** — writing `20MB` yields `NaN` |
| `DATASOURCE_SECRET` | `kanban-dev-datasource-secret-32b!` | Master key for data source password encryption (must be replaced in production, see below) |
| `SYNC_SCHEDULER_INTERVAL_MS` / `SYNC_MAX_CONCURRENT` / `SYNC_DEFAULT_INTERVAL_SECONDS` / `SYNC_LOCK_TTL_MS` | `60000` / `2` / `86400` / `1800000` | Sync scheduler parameters; `SYNC_LOCK_TTL_MS` is the scheduler lock lease duration in milliseconds |
| `SYNC_MODE` | `inline` | `inline` = scheduling and execution both happen in the API process (the default, single machine / testing); `worker` = scheduling only enqueues and a standalone worker process consumes (multiple replicas / production). Any value other than `worker` falls back to `inline` |
| `SYNC_WORKER_POLL_MS` | `2000` | How often the worker process polls `sync_jobs`, in milliseconds |
| `SYNC_JOB_RETENTION_DAYS` | `7` | Retention in days (minimum 1) for finished (success/failed) sync jobs, cleaned up so that `sync_jobs` cannot grow without bound |
| `REDIS_URL` | empty (disabled) | Redis cache/lock switch, e.g. `redis://127.0.0.1:6379`; when empty an in-memory cache plus database lease locks are used |
| `CACHE_TTL_MS` | `60000` | Data source catalog cache TTL in milliseconds |
| `TIMEZONE` | `Asia/Shanghai` | IANA time zone identifier; the front end renders times in this zone |
| `QUERY_MAX_GROUPS` | `10000` | Group-count cap for aggregation queries when `groupLimit` is not given explicitly (minimum 1), so that huge grouped results are not fully materialised |
| `HTTP_DATASOURCE_BLOCK_PRIVATE` | `false` | Whether http data sources block loopback/private ranges (SSRF guard). Off by default (local dev may point at localhost / a LAN service); recommended on for multi-user production deployments. Cloud metadata endpoints (`169.254/16`, `100.64/10`) are always hard-blocked |
| `OPEN_API_RATE_PER_MIN` | `120` | Open API requests-per-minute cap |
| `OPEN_API_MAX_ROWS` | `10000` | Open API per-response row cap |

---

## Switching the Database (Storage Backend) in Detail
### In One Sentence

`DB_TYPE` / `DB_URL` / `DB_PATH` control the **metadata database** (users / roles / data source configuration / datasets / charts / dashboards / sync configuration `sync_configs` / the local `sync_*` tables that synced data lands in). This is a different thing from an "external data source connection": a data source connection is an independent configuration, encrypted at runtime with `DATASOURCE_SECRET` and stored inside each data source record, and it does not travel with the storage backend.

| --- | --- | --- |
| `mysql` | mysql2 | |
| `postgres` | pg | |
| `sqlserver` | mssql | |

### Supported Storage Backends

| `DB_TYPE` | Driver | Description |
| --- | --- | --- |
| `sqlite` | better-sqlite3 | The default, zero-ops; single file, synchronous API |
| `mysql` | mysql2 | |
| `mariadb` | mysql2 | Same driver as mysql |
| `postgres` | pg | |
| `sqlserver` | mssql | |
| `oracle` | oracledb | Auto-commit per statement (transaction limits see below) |

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

### Switching Method 1: Environment Variables (Recommended, Not Persisted)

Special characters in passwords must be URL-encoded (e.g. `@` → `%40`). The connection-string scheme for `mariadb` may be written as `mysql://`.

```bash
# backend/config.json
{
  "db": { "type": "postgres", "url": "postgresql://kanban:kanban@127.0.0.1:15432/kanban?sslmode=disable" }
}
# 放 backend/data/config.json 同样生效（读取顺序 DATA_DIR 在前）
```

### Switching Method 2: config.json (Persisted with the Deployment)

Placing the same file at `backend/data/config.json` works too, since `DATA_DIR` is read first.

### What Happens on First Start

1. It reads the connection string and checks reachability;
2. It runs **idempotent table creation** on the chosen database (`IF NOT EXISTS` and friends) plus **column back-filling for older databases** (probing the existing schema per dialect and adding missing columns). The DDL lives in `src/db/ddl/*.js`;
3. If the database has no administrator yet, it seeds `admin@kanray.local` automatically;
4. You can start using it right away — no manual schema setup.

For large tables or a production cutover, we recommend rehearsing the bootstrap logic from `src/db/schema.js` against the target database manually first, then switch over real traffic.

```bash
docker compose -f scripts/datasource-live/docker-compose.yml up -d
```

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

### Switching Caveats

- **Existing data is not migrated automatically**: switching the storage backend does not copy metadata out of the old database (such as the default SQLite file) into the new one. Decide on the deployment shape before the new database's first start, or rebuild it with the tooling under `backend/scripts/` or a manual export.
- **`DATASOURCE_SECRET` must stay the same**: data source connection passwords are stored encrypted. If you move metadata from the old database to a new one but change `DATASOURCE_SECRET`, historical passwords can no longer be decrypted (each one has to be re-saved). Fix this key **before** creating the first data source of the SKU.
- **Oracle transaction semantics**: Oracle auto-commits per statement, so `store.transaction(fn)` degrades to statement-by-statement execution and a mid-batch failure will not roll the whole batch back; the other dialects support explicit transactions.
- **Local synced tables follow the storage backend**: the `sync_*` tables that synced data lands in are created in the storage backend database, so they move (or must be recreated) when you switch backends; old tables need to be migrated or re-synced by hand.
- **SQL Server primary-key write-back** relies on the driver's `lastInsertRowid`; see the "Dialects" section below for how each dialect reads back auto-increment values.

---

## Storage Facade and Dialects

The single entry point is `src/db.js`: `prepare()` → `{ run, get, all }`, `exec`, `transaction(fn)`, `dialect`. SQLite exposes a synchronous handle while remote drivers are asynchronous, so callers always `await`.

- **Dialects** live in `src/db/dialects/*.js` plus `src/db/translate.js`: identifier quoting (`` ` ` `` / `"` / `[ ]`), placeholders (`?` / `$1..` / `@p1..` / `:p1..`), time defaults, pagination (`LIMIT` / `OFFSET..FETCH`), and the differences in creating and reading back auto-increment primary keys.
- **Portable SQL conventions**: always quote identifiers with `dialect.quoteIdent`, always bind values through placeholders, and use `dialect.now` for time defaults; following these conventions makes business SQL work across every backend.
- **Adding a new storage backend** (very rarely needed): add `src/db/ddl/<type>.js`, `src/db/drivers/<type>.js` and a dialect, then register it in `STORE_TYPES` in `config/index.js`.

---

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
    migrate-data.mjs          旧库 → 新库元数据/数据迁移（ESM + createRequire）
    seed-form-demo.mjs       表单演示数据播种（「员工满意度调查」，幂等重灌）
    seed-hydro-demo.mjs      水电站行业看板演示数据播种（幂等重灌）
    smoke-ds-dataset.mjs     数据源+数据集全链路 E2E 冒烟（自己起后端做 HTTP 直测；mysql:13306 不通时 exit 0）
    smoke-form.mjs           表单功能端到端 HTTP 冒烟（临时脚本，不入库）
    bench/                    无外部依赖的并发压测（http-bench.js，输出延迟分位与吞吐）
    datasource-live/         9 个实测数据源 Docker Compose（docker-compose.yml + live-e2e.mjs）
    datasource-live/verify-schema-scope.mjs   各 provider schema 结构验证（容器未起时逐个 skip）
    datasource-live/quickstart_conf/          Hive 连接配置样例（hive-site.xml）
  test/                      node:test 单元 / 集成 / LIVE 冒烟（RUN_LIVE=1）
  data/ kanban.db            默认 SQLite 文件（运行时生成）
```

## Directory Structure

The tree above lists the backend layout: `src/server.js` and `src/app.js` are the entry point and middleware wiring, `src/config/index.js` resolves configuration, `src/db.js` and `src/db/` hold the storage facade with its dialects and per-database DDL, `src/datasources/` holds the driver registry and protocol-family providers, `src/engines/` the aggregation engine, `src/services/` the business layer, `src/jobs/` the sync scheduler, `src/routes/` the RESTful routers, `src/middleware/` authentication / authorization / the unified response, `src/i18n/` the Chinese-to-English lookup tables, `src/seeds.js` the initial administrator seeding and `src/utils/` shared helpers. `scripts/` holds `migrate-data.mjs` (old-to-new database migration), the two `seed-*-demo.mjs` demo-data seeders, the `smoke-ds-dataset.mjs` / `smoke-form.mjs` end-to-end HTTP smoke scripts, the `bench/http-bench.js` load generator and the `datasource-live/` Docker Compose stack (with `verify-schema-scope.mjs` and `quickstart_conf/`), `test/` holds the node:test suites and `data/kanban.db` is the default SQLite file generated at runtime.

---

```bash
npm start                          # 生产
npm run dev                        # 开发热重载

# 仅 node:test 单元/集成（无外部依赖，仅 sqlite）
npm run test:unit

# test:unit + test:smoke + test:providers（后两者容器未起时逐个 skip 并 exit 0）
npm test

# 全部测试含 LIVE（需先起 docker compose，见下）
npm run test:live
RUN_LIVE=1 npm test

# 仅 PostgreSQL LIVE 矩阵
npm run test:pg

node scripts/smoke-ds-dataset.mjs  # 数据源+数据集 E2E 冒烟（自己起后端；mysql:13306 不通时 exit 0）
node scripts/smoke-form.mjs        # 表单功能 E2E 冒烟（自己起后端，临时 SQLite）
node scripts/datasource-live/verify-schema-scope.mjs   # 各 provider schema 结构验证
node scripts/bench/http-bench.js --url http://127.0.0.1:3001 --path /api/health   # 并发压测
```

## Common Commands

`npm start` runs the production server and `npm run dev` runs it with hot reload. `npm run test:unit` runs the node:test suites only (no external dependency, SQLite only), while `npm test` is `test:unit` chained with `test:smoke` and `test:providers` — the latter two self-exit 0 (skipping each case) when their containers are down, so they need no external dependency but are not literally unit-only. `npm run test:live` and `RUN_LIVE=1 npm test` additionally run the LIVE cases and need the Docker Compose stack from below to be up first; `npm run test:pg` narrows that to the PostgreSQL matrix. The last four commands are the two standalone end-to-end HTTP smoke scripts (each spawns its own backend), the provider schema-scope verifier, and the concurrency load generator.

```bash
docker compose -f scripts/datasource-live/docker-compose.yml up -d
```

### Test Notes (`test/`, node:test)

| Mode | Command | Coverage |
| --- | --- | --- |
| Unit/integration | `npm run test:unit` (`npm test` chains `test:smoke` + `test:providers` on top of it; they skip each case and exit 0 when their containers are down) | Every case that needs no external database: auth/RBAC/audit/engine/builder/driver metadata/storage facade dialects, etc. |
| LIVE | `npm run test:live` / `RUN_LIVE=1 npm test` (use `npm run test:pg` for the PostgreSQL matrix only) | Additionally connects to real containers: six storage backends + eleven data source providers + direct-connect and sync pipelines |

LIVE cases print the reason when they fail or are skipped (for example, they skip when the containers are not up or the port is unreachable). Start the containers with the command above.

---

## External Data Source Connectivity (Distinct from the Storage Backend)

The data source records themselves live in the **storage backend** table (with encrypted passwords), but querying / browsing / syncing hits the **external database**; the two are independent:

- **The driver registry** `datasources/drivers.js` holds 22 types (MySQL / PG / SQL Server / MariaDB / TiDB / ClickHouse / ES / Oracle / GBASE / Presto / API and protocol-compatible families), each declaring its protocol family, its capabilities (can it back a dataset / can it sync) and its default port.
- **Connection test / schema browsing / querying** is dispatched by protocol family to `providers/*` (a uniform `testConnection` / `listSchemas` / `listTables` / `listColumns` / `runQuery`).
- **Two storage modes** (the `mode` chosen when creating a data source):
  - `direct`: only the connection configuration is stored and queries hit the source database live;
  - `sync`: a sync task pulls the remote table into a local `sync_*` physical table in the storage backend (incremental watermark + upsert, or full DROP and rebuild; 5000 rows per batch, with cross-dialect time watermarks normalized on the JS side).
- **Sync scheduling**: `jobs/sync-scheduler.js` ticks once a minute and fires according to `interval_seconds` in `sync_configs`; see the `sync_configs` and `sync_logs` tables for the schema and sync history.
- **Prerequisites**: sync requires the source database to execute SQL and the driver's capabilities to include the matching protocol family (mysql / pg / mssql / oracle); ClickHouse / Presto / ES / API do not take part in sync.

---

## Known Limitations (Backend Perspective)

- Oracle as a storage backend, or Oracle as a sync source: auto-commit per statement means `transaction` degrades to statement-by-statement execution, and a mid-batch failure will not roll the whole batch back.
- Incremental sync enables primary-key reconciliation deletion by default (`sync_configs.reconcile_delete`, default 1): every incremental run compares source and local primary keys and deletes the extra local rows. On large tables this costs a full primary-key scan, and you can set it to 0 to turn it off.

---

## Distributed Sync Locks (Multi-Instance Safety)

When Redis is not configured (the default), the scheduler uses a **database lease lock** (the `sync_locks` table; sharing the metadata database is enough for mutual exclusion): acquisition runs `UPDATE ... WHERE locked_until < now`. Once Redis is configured it switches to `SET NX PX` instead — exactly one of the two is used, decided by `REDIS_URL`.

- Lock granularity: one lock per `sync_configs.id`; `lockTtlMs` defaults to 30 minutes (`SYNC_LOCK_TTL_MS`).
- Multiple instances sharing the same metadata database (`DB_TYPE` + `DB_URL`) are mutually exclusive automatically; if each instance uses its own local SQLite (development mode), the schedulers do not interfere but there is also no mutual exclusion.
- `runSync` still uses `last_sync_status` as a second idempotency guarantee, so the lock and the status work together.

---

## Redis Cache (Optional)

It is disabled by default (`REDIS_URL` empty): an in-process `Map` with lazy TTL eviction, which is enough for a single instance. For multiple instances or a cache shared across processes, configure the Redis address via `REDIS_URL` / `config.json cache.url`. Application startup does not depend on Redis — when it cannot connect, it automatically falls back to memory and logs a warning.

The current cache coverage is the data source catalog `catalogCache` (ETL column metadata, TTL 60s via `CACHE_TTL_MS`). RBAC mappings query the database directly and need no cache, so permission changes take effect immediately.

---

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

## Data Migration Script

For "automatically migrate data from the old database to the new one": `scripts/migrate-data.mjs`, which mixes ESM and CJS (the `createRequire` style, matching the seed scripts). The commands above copy metadata plus all data tables (the default), metadata tables only (`--skip-data`), or specific tables with a dry run (`--tables` / `--dry-run`).

Copy order: first the 14 foreign-key-safe metadata tables (`users` → `roles` → `permissions` → `data_sources` → `datasets` → `dataset_fields` → `charts` → `dashboards` → `sync_configs` → `sync_logs` → `refresh_tokens` → `user_roles` → `role_permissions` → `audit_logs`), then the remaining data tables (dynamic tables such as `ds_*` / `sync_*`, including synced data).

Column types are introspected per dialect and mapped to canonical ones (`integer/number/string/date/boolean`), and the target dialect's `typeMapping` recreates the table; auto-increment sequences are reset per dialect after the migration (PG `setval` / MySQL `AUTO_INCREMENT` / MSSQL `DBCC CHECKIDENT` / SQLite `sqlite_sequence`, best-effort for Oracle).

**Note**: `DATASOURCE_SECRET` (data source password decryption) and `JWT_SECRET` (refresh token signing) on the target database must match the old database, otherwise data source configuration cannot be decrypted and old refresh tokens stop working.
