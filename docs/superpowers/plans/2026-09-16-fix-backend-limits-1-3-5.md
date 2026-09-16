# 2026-09-16 修复后端已知限制 #1 / #3 / #5

## 目标
解决 `backend/README.md`「已知限制（后端视角）」中三条可解项：

1. **#1 单实例内存同步调度，多实例部署无分布式锁** → 调度锁默认走数据库租约（`sync_locks` 表，共享元数据库即互斥），配置 Redis 后改用 `SET NX PX`。
2. **#3 不做旧库 → 新库自动数据迁移（含 `sync_*`）** → 提供跨方言迁移脚本，元数据表 + 全部数据表（`ds_*` / `sync_*`）一并复制。
3. **#5 缓存层为内存（无 Redis）** → Redis 做成配置开关，默认关闭（内存 `Map`），配 `REDIS_URL` 后启用，多实例可共享缓存。

不做：#2 Oracle 事务（部分可解，需改驱动，超范围）、#4 同步源端删除感知（需源端配合）。

## 决策（用户已确认）
- 未配置 Redis 时，调度锁**默认使用数据库租约锁**（不是只靠 Redis），多实例共享元数据库即生效。
- 迁移脚本**默认复制元数据 + 全部数据表**，`--skip-data` 可排除大表。

## 变更清单

### 配置（backend/src/config/index.js）
- config.json 解析增加 `cache.url`（与 `db` 并行读取）。
- 新增段：
  ```js
  cache: {
    type: process.env.REDIS_URL || fileCache.url ? 'redis' : 'memory',
    url: process.env.REDIS_URL || fileCache.url || '',
    ttlMs: Math.max(1, parseInt(process.env.CACHE_TTL_MS || '60000', 10)),  // 原 catalogCache TTL=60s 默认
  },
  sync: { ...既有, lockTtlMs: parseInt(process.env.SYNC_LOCK_TTL_MS || '1800000', 10) },
  ```

### 缓存门面（backend/src/cache.js，新）
- 导出 `get(key)` / `set(key, value, ttlMs=config.cache.ttlMs)` / `del(key)` / `flush()` / `isRedis()`。
- Redis 仅当 `cache.type==='redis'` 时懒加载 `ioredis`；命令失败或未开启自动回退内存 `Map`（每项带 expire 时间戳，读时惰性清除）。
- Redis 值 JSON 序列化；连接断开打印 error 并降级为内存，绝不让应用崩溃。

### 缓存接入（backend/src/datasources/sql-data-provider.js）
- 删除 `catalogCache = new Map()` 与 `CATALOG_TTL_MS` 常量。
- `resolveEtlCatalog`：`getTab` 改为 `await cache.get(key)`（key 不变），未命中 `await cache.set(key, columns)`（默认 TTL=60s）。函数本就 async，调用方不变。

### 分布式锁（backend/src/services/lock.js，新）
- 接口：`withLock(name, ttlMs, fn)` 返回 `fn` 结果，抢不到返回 `null`；以及底层 `acquire(name, ttlMs) -> { ok, token, release }`（release 幂等）。
- **Redis 后端**：`SET lock:kanban:<name> <token> PX <ttl> NX` 抢锁（`set` 返回 `OK` 即成功）；释放用 Lua `if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end`。token 用 `crypto.randomUUID()`。
- **DB 租约后端（默认）**：
  - 建 `sync_locks` 表（见下）；首次先尝试 `INSERT ... (lock_name)`，撞唯一键忽略（跨方言用 try/catch）。
  - 抢占（原子单条）：
    `UPDATE sync_locks SET locked_by=?, locked_until=? WHERE lock_name=? AND (locked_until IS NULL OR locked_until < ?)`，`changes===1` 即成功（`until = Date.now()+ttlMs`）。
  - 释放：`UPDATE sync_locks SET locked_until=NULL, locked_by=NULL WHERE lock_name=? AND locked_by=?`。

### DDL（5 个方言文件各追加）
```sql
CREATE TABLE IF NOT EXISTS sync_locks (
  lock_name    TEXT/NVARCHAR(128)/VARCHAR(128)/VARCHAR2(128) NOT NULL PRIMARY KEY,
  locked_by    TEXT/VARCHAR(64)...
  locked_until BIGINT/NUMBER(20) NOT NULL DEFAULT 0,   -- 毫秒时间戳，跨方言可比较
  updated_at   TEXT NOT NULL
)
```
- mssql/oracle 无 IF NOT EXISTS：现有 `runDdl` 的「查表存在性跳过」逻辑已覆盖，重启自动建表，无需手工 DDL 迁移。

### 调度接入（backend/src/jobs/sync-scheduler.js）
- `tick()` 对每个到期配置：`running.add(id)` 后
  `withLock('sync:'+sc.id, config.sync.lockTtlMs, () => runSync(sc.id))`；
  返回 `null` 记 `[sync] cfg X 已由其它实例执行，跳过`，`.finally(() => running.delete(sc.id))`。
- 保留同实例 `running` Set（并发上限不受影响）。

### 迁移（backend/src/db/index.js + backend/src/migrate.js + backend/scripts/migrate-data.mjs）
- `createStore(override)`：可选 `{ type, url, sqlitePath }`，sqlite 相对路径按 `config.root` 解析，缺省仍读 `config.db`（向后兼容）。
- **backend/src/migrate.js（CJS 库）**导出：
  - `parseConn(s)` -> `{ type, url }`（`TYPE@URL`）。
  - `introspect(store, table)`：各方言取列名 + 类型 → canonical（string/int/decimal/datetime/text/boolean），sqlite `PRAGMA table_info` / mysql `SHOW FULL COLUMNS` / pg·mssql `information_schema.columns` / oracle `ALL_TAB_COLUMNS`。
  - `copyTable(src, dst, table, { preserveIds=true })`：目标无表则用目标方言 `typeMapping[canonical]` + `quoteIdent` 重建；逐行 `SELECT *` → `INSERT INTO <t> (显式列) VALUES`。`--tables` 之外的元数据表也保留 ID。
  - `migrate(from, to, opts)`：目标 `ensureSchema`；按 FK 安全顺序复制元数据表，再复制剩余数据表；每表复制后重置目标自增序列（pg `setval` / mysql `AUTO_INCREMENT` / mssql `DBCC CHECKIDENT` / sqlite `sqlite_sequence`，oracle best-effort 跳过）；返回每表行数汇总。`--dry-run` 只统计不复制。
  - 结尾打印：目标库 `DATASOURCE_SECRET` / `JWT_SECRET` 必须与旧库一致（否则数据源配置无法解密、refresh token 失效）。
- **backend/scripts/migrate-data.mjs（CLI，ESM，复用 seed-demo-data.mjs 的 createRequire 风格）**：
  `node backend/scripts/migrate-data.mjs --from sqlite@data/kanban.db --to postgres@postgresql://... [--tables a,b,c] [--skip-data] [--dry-run]`

### 元数据表复制顺序（FK 安全）
users → roles → permissions → data_sources → datasets → dataset_fields → charts → dashboards → sync_configs → sync_logs → refresh_tokens → user_roles → role_permissions → audit_logs
（此集合之外的表一律视为数据表：`ds_*`、`sync_*` 等。）

### 测试（backend/test/，node --test）
- `cache.test.js`：内存后端 get/set/命中/过期/del；未配置 Redis 时断言 `isRedis()===false`。
- `lock.test.js`：临时 sqlite（env `DB_PATH` 指向临时文件）验证互斥——acquire 成功、第二个 acquire 返回 `null`、release 后重建、TTL 过期自动释放。
- `migrate.test.js`：源/目标各一个临时 sqlite，源库写入 users + datasets + 动态 `ds_x` 表，`migrate()` 后断言行数与 ID 保留、目标表存在。

### 文档
- `backend/README.md`：删「已知限制」中 231/233/235 三条，保留 Oracle 与源端删除；新增「分布式锁 / 缓存 / 数据迁移」小节 + env 表（`REDIS_URL`、`CACHE_TTL_MS`、`SYNC_LOCK_TTL_MS`）。
- `backend/config.example.json`：补 `"cache": { "url": "" }`。
- `backend/package.json`：`dependencies` 增 `"ioredis"`。

## 验证
- `cd backend && npm test`（新增 3 个测试文件 + 既有回归）。
- `node backend/src/server.js` 默认 sqlite 无 Redis 冒烟启动（锁走 DB 租约，缓存走内存）。
- `node backend/scripts/migrate-data.mjs --from sqlite@<临时源> --to sqlite@<临时目标> --dry-run` 输出行数；再实跑一次核对元数据 + `ds_*` 行数。
- 可选：本机若有 Redis，`REDIS_URL=redis://127.0.0.1:6379` 启动，验证切换 redis 锁/缓存路径。
- 前端无改动。