# 部署 / 数据库 / Redis 配置文档重写设计（2026-09-19）

## 背景

用户反馈正式文档完全缺少对「部署、数据库配置、Redis 配置」的可用说明。排查发现：

- `docs/05-部署运维手册.md` §3.1 使用了代码中**不存在**的环境变量（`DB_DRIVER` / `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD`），实际代码只认 `DB_TYPE` / `DB_URL` / `DB_PATH`。
- §2.2 环境变量表漏掉 `DB_TYPE` / `DB_URL` / `DB_PATH` / `REDIS_URL` / `CACHE_TTL_MS` / `DATA_DIR` / `UPLOAD_DIR` / `DATASOURCE_SECRET`。
- Redis 的正确说明只存在于 `backend/README.md`（开发者视角），运维文档完全没有。
- 无非 Docker（systemd/pm2）部署、无多实例/分布式部署章节。
- 根 `README.md`「已知限制」与代码自相矛盾：写「多实例无分布式锁」「缓存层仍为内存、无 Redis」，实际代码有 `sync_locks` 表租约锁 + Redis 锁、`REDIS_URL` 已支持。

## 目标

以代码为唯一事实源（`backend/src/config/index.js`、`backend/README.md`、`deploy/` 实测行为），重写 `docs/05-部署运维手册.md` 为完整运维手册，并修正根 `README.md` 与代码矛盾之处。

## 方案 A（已确认）

### 1. 重写 `docs/05-部署运维手册.md`（十章节）

1. 部署形态总览：Docker compose / 源码+systemd / 多实例分布式 三选一决策表
2. Docker 一键部署：保留现有 `deploy/` 行为（`deploy.sh` 子命令 up/down/restart/logs/ps、首次生成 `.env` 随机密钥、三容器 postgres+backend+frontend(nginx)、`:8080` 外联、Swagger `/api/open/docs`、数据卷 pgdata/kanban_data/kanban_uploads）
3. 源码 + systemd 部署（新增）：`npm ci --omit=dev`、systemd unit 示例（配 `WorkingDirectory` / `Environment` / `EnvironmentFile`）、前端 `npm run build` + nginx 反代、pm2 备选
4. 环境变量全表：合并且与 `config/index.js` 逐项一致，含 `config.json` 等价写法（`config.example.json` 结构 `{ db: { type, url, sqlitePath }, cache: { url } }`），写明优先级 env > config.json > 默认值
5. 数据库（存储后端）配置：6 库（sqlite/mysql/mariadb/postgres/sqlserver/oracle）连接串示例、切换注意事项（无自动迁移、`DATASOURCE_SECRET` 一致性、Oracle 事务、`sync_*` 表跟随）；删除伪变量
6. Redis 配置（新增）：作用（共享 catalog 缓存 + 分布式锁 `SET NX PX`）、URL 格式（`redis://` / `rediss://` 带密码库号）、未配置时回退（内存 Map + `sync_locks` 表租约锁）、缓存覆盖范围（catalogCache，TTL `CACHE_TTL_MS`，RBAC 直查库）
7. 多实例 / 分布式部署（新增）：前提清单（共享元数据库非 sqlite、`JWT_SECRET` 一致、上传目录共享 NFS/对象存储、建议 `REDIS_URL`）、免粘性会话（JWT 无状态、无 WebSocket）、调度器多实例安全原理（`withLock` 抢占 + `last_sync_status` 双保险）、限流为每实例内存计数（全局需外部限流）、backend replicas compose 示例、sqlite 禁用多实例
8. 密钥管理与轮换：保留（JWT_SECRET / DATASOURCE_SECRET）
9. 备份与恢复：保留 compose/pg_dump 场景，补充 sqlite 停服备份与 -wal checkpoint 提示
10. 安全加固清单 / 已知限制：保留并更新与代码一致

### 2. 修正根 `README.md`

- 366/420 行「单实例内存调度（多实例部署无分布式锁，重复实例会各自触发）」→ 改为「调度器内置分布式锁（`sync_locks` 表租约 / Redis `SET NX PX`），多实例共享元数据库即互斥」
- 421 行「缓存层仍为内存（无 Redis 分布式缓存）」→ 改为「默认内存缓存，配 `REDIS_URL` 可启用 Redis 共享缓存与锁」
- 部署段落补充指向 05 手册的 DB/Redis 配置说明

### 3. 核对 `docs/快速开始.md`

对照 05 校验链接与表述，预期零改动或微调（它已正确链接 05）。

## 验证

- 全文 `grep` 不再出现 `DB_DRIVER` 等伪变量
- 手册变量名与 `config/index.js` 逐项比对一致
- 根 README「已知限制」不再与代码矛盾
- 文档与 `deploy/` 实际编排（Dockerfile / nginx.conf / deploy.sh）核对一致

## 不在本次范围

- 不改动 `deploy/docker-compose.yml`（不新增 Redis 服务、不增加 backend 副本）——文档以示例形式给出多副本与 Redis 扩展
- 不改代码