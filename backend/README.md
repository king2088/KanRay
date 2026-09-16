# 看板管理系统 · 后端

ExpressJS 5 后端服务（Node.js >= 18，CommonJS）。提供鉴权/RBAC、数据源接入、数据集构建器、图表看板查询、Excel 分析、同步调度等能力，并将全部元数据通过统一存储门面落地到可选数据库。

- 入口：`src/server.js`（生产）/ `npm run dev`（`node --watch` 热重载）
- 默认端口：`3001`（`PORT` 可覆盖）
- 前端：见仓库根 `README.md`；本文件专注后端运行、配置与数据库切换。

---

## 快速开始

```bash
cd backend
npm install
npm run dev        # 或 npm start
```

首次启动自动创建 `backend/data/kanban.db`（SQLite），并幂等建表 + 写入初始管理员 `admin@kanban.local / admin123`（环境变量 `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD` 可改，**生产务必改密**）。

---

## 配置总览

配置优先级：**环境变量 > config.json > 默认值**。

`config.json` 读取顺序：`$DATA_DIR/config.json`（默认 `backend/data/`）→ `backend/config.json`。示例见 `backend/config.example.json`：

```json
{ "db": { "type": "sqlite", "url": "", "sqlitePath": "data/kanban.db" }, "cache": { "url": "" } }
```

### 核心环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3001` | 后端端口 |
| `DB_TYPE` | `sqlite` | 存储后端类型：`sqlite` / `mysql` / `mariadb` / `postgres` / `sqlserver` / `oracle` |
| `DB_URL` | 空 | 非 sqlite 时的 JDBC 风格连接串 |
| `DB_PATH` | `data/kanban.db` | sqlite 文件路径（支持绝对路径） |
| `DATA_DIR` | `backend/data` | 运行时数据目录（也决定 `config.json` 首个读取位置） |
| `UPLOAD_DIR` | `backend/uploads` | 上传文件目录 |
| `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD` | `admin@kanban.local` / `admin123` | 初始管理员 |
| `JWT_SECRET` | `dev-secret-change-me` | JWT 密钥（生产必须注入） |
| `ACCESS_TTL` / `REFRESH_TTL_DAYS` | `15m` / `7` | 令牌有效期 |
| `MAX_FILE_SIZE` / `MAX_ROWS` | `20MB` / `200000` | 上传大小与行数上限 |
| `DATASOURCE_SECRET` | `kanban-dev-datasource-secret-32b!` | 数据源密码加密主密钥（生产必须替换，见下文） |
| `SYNC_SCHEDULER_INTERVAL_MS` / `SYNC_MAX_CONCURRENT` / `SYNC_DEFAULT_INTERVAL_SECONDS` / `SYNC_LOCK_TTL_MS` | `60000` / `2` / `86400` / `1800000` | 同步调度参数；`SYNC_LOCK_TTL_MS` 为调度锁租约时长（毫秒） |
| `REDIS_URL` | 空（关闭） | Redis 缓存/锁开关，如 `redis://127.0.0.1:6379`；空则用内存缓存 + 数据库租约锁 |
| `CACHE_TTL_MS` | `60000` | 数据源目录缓存 TTL（毫秒） |
| `TIMEZONE` | `Asia/Shanghai` | 时区标识符（IANA），前端按此时区渲染时间 |

---

## 切换数据库（存储后端）详解

### 一句话说明

`DB_TYPE` / `DB_URL` / `DB_PATH` 控制的是**元数据库**（用户 / 角色 / 数据源配置 / 数据集 / 图表 / 看板 / 同步配置 `sync_configs` / 同步落库的本地表 `sync_*`）。它与「外部数据源连接」是两码事：数据源连接是运行时按 `DATASOURCE_SECRET` 加密、存在各数据源记录里的独立配置，不随存储后端走。

### 支持的存储后端

| `DB_TYPE` | 驱动库 | 说明 |
| --- | --- | --- |
| `sqlite` | better-sqlite3 | 默认，零运维；单文件，同步 API |
| `mysql` | mysql2 | |
| `mariadb` | mysql2 | 与 mysql 同驱动 |
| `postgres` | pg | |
| `sqlserver` | mssql | |
| `oracle` | oracledb | 每语句自动提交（事务限制见下） |

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

### 切换方式二：config.json（随部署持久化）

```bash
# backend/config.json
{
  "db": { "type": "postgres", "url": "postgresql://kanban:kanban@127.0.0.1:15432/kanban?sslmode=disable" }
}
# 放 backend/data/config.json 同样生效（读取顺序 DATA_DIR 在前）
```

### 首次启动会发生什么

1. 读取连接串，检查可达性；
2. 对所选库执行**幂等建表**（`IF NOT EXISTS` 等）+ **老库列补齐**（按方言探测已有表结构并补列）,建表 DDL 见 `src/db/ddl/*.js`；
3. 若库中无管理员则自动播种 `admin@kanban.local`；
4. 直接进入正常使用，无需手工建表。

增量大表 / 生产切换建议先人工在目标库执行 `src/db/schema.js` 对应的引导逻辑演练一遍，再切正式流量。

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

### 切换注意事项

- **不做存量数据自动迁移**：切换存储后端不会把旧库（如默认 SQLite）里的元数据自动搬运到新库。请在新库首次启动前决定部署形态，或用 `backend/scripts/` 下的工具/手工导出重建。
- **`DATASOURCE_SECRET` 必须一致**：数据源连接密码是加密存储的。若把元数据从旧库搬到新库但 `DATASOURCE_SECRET` 变了，历史密码将无法解密（需逐个重新保存）。SKU 在创建首个数据源**之前**固定该密钥。
- **Oracle 事务语义**：Oracle 每语句自动提交，`store.transaction(fn)` 退化为逐条执行，批量写中途失败不会整体回滚；其余方言支持显式事务。
- **本地同步物理表跟着存储后端走**：同步落库的 `sync_*` 表建在存储后端库中，切换后端后这些表也随库移动/换库（旧表需要自行迁移或重同步）。
- **SQL Server 主键回写**依赖驱动 `lastInsertRowid`；不同方言自增值的回取方式见下方「方言」一节。

---

## 存储门面与方言

统一入口 `src/db.js`：`prepare()` → `{ run, get, all }`、`exec`、`transaction(fn)`、`dialect`。SQLite 为同步句柄，远端驱动为异步句柄，调用方一律 `await`。

- **方言** `src/db/dialects/*.js` + `src/db/translate.js`：标识符引用（`` ` ` `` / `"` / `[ ]`）、占位符（`?` / `$1..` / `@p1..` / `:p1..`）、时间默认值、分页（`LIMIT` / `OFFSET..FETCH`）、自增主键的建表与回取差异。
- **可移植 SQL 约定**：标识符一律 `dialect.quoteIdent`，值一律占位符，时间默认值用 `dialect.now`；跨库写业务 SQL 时遵守该约定即可一库通吃。
- **新增一种存储后端**（极少）：加 `src/db/ddl/<type>.js`、`src/db/drivers/<type>.js`、一套 dialect，并在 `config/index.js` 的 `STORE_TYPES` 中登记即可。

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

### 测试说明（`test/`，node:test）

| 模式 | 命令 | 覆盖 |
| --- | --- | --- |
| 单元/集成 | `npm test` | 全部不依赖外部库的用例：auth/RBAC/audit/engine/builder/驱动元数据/存储门面方言等 |
| LIVE | `RUN_LIVE=1 npm test` | 追加连接真实容器：六库存储后端 + 十一种数据源 provider + 直连/同步链路 |

LIVE 用例失败/跳过会打印原因（如容器未起、端口不通即 skip）。启动容器：

```bash
docker compose -f scripts/datasource-live/docker-compose.yml up -d
```

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

---

## 已知限制（后端视角）

- Oracle 存储后端 / Oracle 同步源：每语句自动提交，`transaction` 退化为逐条执行，批量写中途失败不会整体回滚。
- 同步增量不感知源端删除（不本地删行）。

---

## 分布式同步锁（多实例安全）

未配置 Redis 时（默认），调度器使用**数据库租约锁**（`sync_locks` 表，元数据库共享即可互斥）：抢占时 `UPDATE ... WHERE locked_until < now`；配了 Redis 后改用 `SET NX PX`，二者选其一（以 `REDIS_URL` 为准）。

- 锁粒度：每个 `sync_configs.id` 一把锁，`lockTtlMs` 默认 30 分钟（`SYNC_LOCK_TTL_MS`）。
- 多实例共享同一元数据库（`DB_TYPE` + `DB_URL`）即自动互斥；若各实例用独立本地 SQLite（开发模式），调度互不干扰但也无互斥。
- `runSync` 内仍以 `last_sync_status` 做幂等二次保障，锁与状态双保险。

---

## Redis 缓存（可选）

默认关闭（`REDIS_URL` 空），用进程内存 `Map` 带 TTL 惰性淘汰，单实例足够。多实例或需要跨进程共享缓存时，在 `REDIS_URL` / `config.json cache.url` 配置 Redis 地址即可切换，应用启动不依赖 Redis（未连接时自动降级内存，日志 warn）。

目前缓存覆盖范围：数据源目录 `catalogCache`（ETL 列元数据，TTL 60s `CACHE_TTL_MS`）。RBAC 映射直接查库，无需缓存（权限变更即时生效）。

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