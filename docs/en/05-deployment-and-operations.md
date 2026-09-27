# 05 Deployment & Operations Manual

> 中文: [05-部署运维手册.md](../05-部署运维手册.md)

Written for operations engineers. It covers choosing a deployment topology, Docker / systemd deployment, the full environment-variable reference, database (storage backend) configuration, Redis configuration, multi-replica distributed deployment, key management and hardening, and backup & restore.

> Source of truth: the variable names in this document follow `backend/src/config/index.js`; connection strings and dialect behaviour are cross-checked against `backend/README.md` and live containers.

---

## I. Deployment Options at a Glance

| Topology | When to use | Metadata database | Redis | Upload storage |
|----------|-------------|--------------------|-------|----------------|
| **One-click Docker compose** | Fast single-host trials, small-to-medium production | PostgreSQL (in-container volume) | Optional (see the examples in Section 6) | Local data volume `kanray_uploads` |
| **Source + systemd** | You already have a server / data centre and want host-level control | Anything (sqlite or an external engine) | Optional | Local directory |
| **Multi-replica distributed** | High availability / horizontal scaling | **External engine only** (MySQL / PostgreSQL, etc.; **sqlite is forbidden**) | Recommended | **Shared storage (NFS / object storage)** |

> One-line decision: Docker compose is the fastest path for a single host; for multiple replicas / high availability you must move the metadata database to an external engine and put the upload directory on shared storage — see Section 7.

---

```
deploy/docker/
├── deploy.sh                    # 部署入口脚本（--stack 选择数据库栈）
├── docker-compose.yml           # 默认 stack：postgres + redis + backend(API) + worker(同步) + frontend
├── docker-compose.sqlite.yml    # SQLite 演示栈：backend(inline) + frontend（无 PG/Redis/worker）
├── docker-compose.mysql.yml     # MySQL 8.0 栈：mysql + redis + backend + worker + frontend
├── docker-compose.mariadb.yml   # MariaDB 11 栈：mariadb + redis + backend + worker + frontend
├── .env.example                 # 环境变量模板
└── .env                         # 实际配置（首次运行自动生成）
```

## II. One-Click Docker Deployment
### 2.1 Directories and Files

> Deployment uses two independent directories: **Docker compose** (`deploy/docker/`) and **Kubernetes** (`deploy/k8s/`, whose manifests and usage are documented in `deploy/k8s/README.md`); the two **share no files at all**. This chapter covers Docker compose only.

The frontend is an Nginx container (`deploy/docker/frontend/nginx.conf`): it serves the build output directly and reverse-proxies `/api/` to `backend:3001` (`client_max_body_size` 32m, read timeout 300s).

```bash
cd deploy/docker
./deploy.sh              # = up：默认 PostgreSQL stack，构建并后台启动全部容器
./deploy.sh up           # 同上
./deploy.sh up --stack sqlite    # 切换到 SQLite 演示栈（也可用 STACK=sqlite ./deploy.sh up）
./deploy.sh up --stack mysql     # MySQL 栈
./deploy.sh up --stack mariadb   # MariaDB 栈
./deploy.sh down         # 停机（保留数据卷）
./deploy.sh down -v      # 停机并清除全部数据（-v 删卷，不可恢复！）
./deploy.sh restart      # 重启容器（保留数据）
./deploy.sh logs         # 跟随日志
./deploy.sh ps           # 容器状态
```

### 2.2 Subcommands

> `--stack` only decides which compose file is used (`pg` is the default); `.env` is shared by all stacks.

### 2.3 First-Run Behaviour

1. If no `.env` is found, it is copied from `.env.example` and **random secrets are injected**: `JWT_SECRET` and `DATASOURCE_SECRET` (base64, 32 bytes), plus `POSTGRES_PASSWORD` / `MYSQL_ROOT_PASSWORD` / `MARIADB_ROOT_PASSWORD` (hex, 24 bytes — each stack uses the one it needs)
2. `docker compose -f <compose file> up -d --build` builds and starts the containers for the selected stack
3. On first start the backend automatically creates tables **idempotently** and seeds the admin account; the PG/MySQL/MariaDB stacks default to `SYNC_MODE=worker` (sync jobs run in the worker container), while the SQLite demo stack uses `inline`

After startup, open `http://localhost:8080` (change `KANRAY_PORT` in `deploy/docker/.env` to use a different port); the Swagger docs are at `http://localhost:8080/api/open/docs`.

### 2.4 deploy/docker/.env Settings (Injected by Compose)

All stacks share a single `.env`; the template is `deploy/docker/.env.example`. Each database's `*_PASSWORD` is used only between containers and is never exposed externally.

| Variable | Default | Description |
|----------|---------|-------------|
| `KANRAY_PORT` | `8080` | Externally exposed HTTP port (frontend nginx port mapping) |
| `POSTGRES_USER` / `POSTGRES_DB` | `kanray` / `kanray` | Metadata database user and database name for the PG stack |
| `POSTGRES_PASSWORD` | random (generated on first run) | Metadata database password for the PG stack |
| `MYSQL_ROOT_PASSWORD` / `MYSQL_DATABASE` | random (generated on first run) / `kanray` | Metadata database password and database name for the MySQL stack |
| `MARIADB_ROOT_PASSWORD` / `MARIADB_DATABASE` | random (generated on first run) / `kanray` | Metadata database password and database name for the MariaDB stack |
| `REDIS_URL` | `redis://redis:6379/0` | Optional; overrides the connection string for an external or password-protected Redis |
| `JWT_SECRET` | random (generated on first run) | Signing secret for user tokens |
| `DATASOURCE_SECRET` | random (generated on first run) | Master key used to encrypt data source passwords |
| `ADMIN_INITIAL_PASSWORD` | `admin123` | Initial admin password (change it in production) |

### 2.5 Data Volumes

| Volume | Mount point / purpose | Stacks |
|--------|-----------------------|--------|
| `pgdata` | PostgreSQL data directory | pg |
| `mysqldata` / `mariadbdata` | MySQL / MariaDB data directories | mysql / mariadb |
| `redisdata` | Redis AOF persistence | pg / mysql / mariadb |
| `kanray_data` | Runtime data directory; the SQLite stack keeps `kanray.db` here | all |
| `kanray_uploads` | Uploaded Excel / CSV files | all |

### 2.6 Choosing a Database Stack

| Stack | Compose file | Containers | Best for |
|-------|--------------|------------|----------|
| `pg` (default) | `docker-compose.yml` | postgres + redis + backend + worker + frontend | Production / recommended for multiple replicas |
| `mysql` | `docker-compose.mysql.yml` | mysql + redis + backend + worker + frontend | Teams that already run MySQL |
| `mariadb` | `docker-compose.mariadb.yml` | mariadb + redis + backend + worker + frontend | Teams that already run MariaDB |
| `sqlite` | `docker-compose.sqlite.yml` | backend(inline) + frontend | Demos / acceptance testing / small single-host installs, **no multi-replica support** |

> SQLite is a single file with a single writer; for multiple replicas / high availability pick `pg` (or mysql/mariadb) — see Section 7.

```bash
cd backend
npm ci
npm run dev                 # node --watch，默认 DB_TYPE=sqlite、REDIS_URL 为空
# 前端：cd front-end && npm ci && npm run dev
```

### 2.7 Local Development (SQLite, No Redis)

Local dev **defaults to SQLite with Redis disabled**, so there is no middleware to start.

- The metadata database lives in `backend/data/kanban.db` (override with `DB_PATH`).
- Caching uses in-process memory, and locking uses the `sync_locks` table (no Redis needed).
- To point at an external engine temporarily for integration work: `DB_TYPE=postgres DB_URL='postgresql://...' npm run dev`; add `REDIS_URL=redis://127.0.0.1:6379/0 npm run dev` when you do want Redis. Neither is a **prerequisite** for local development.

---

```bash
# /etc/kanray/backend.env（0600，含密钥请限制权限）
PORT=3001
JWT_SECRET=$(openssl rand -base64 32)
DATASOURCE_SECRET=$(openssl rand -base64 32)
ADMIN_INITIAL_PASSWORD=change-me-now
# DB_TYPE=postgres
# DB_URL=postgresql://kanray:kanray@127.0.0.1:5432/kanray?sslmode=disable
# REDIS_URL=redis://:pass@127.0.0.1:6379/0
```

## III. Source + systemd Deployment

Suited to existing servers, air-gapped intranets, or setups where you want to manage the process directly.

### 3.1 Requirements

- Node.js ≥ 18 (`20-alpine` is what production is tested on), npm
- Run the backend under `systemd`; serve the frontend build output with Nginx and reverse-proxy the API through it

### 3.2 Install Dependencies

```bash
cd /opt/kanray/backend
npm ci --omit=dev          # 生产仅装运行依赖
```

### 3.3 Configure the Environment File

> The backend **does not read `.env` automatically on startup**: export the variables in your shell or use `EnvironmentFile` (see below). The full variable list is in Section 4.

### 3.4 systemd Unit

```ini
# /etc/systemd/system/kanray-backend.service
[Unit]
Description=Kanray Backend
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/kanray/backend
EnvironmentFile=/etc/kanray/backend.env
ExecStart=/usr/local/bin/node src/server.js
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now kanray-backend
systemctl status kanray-backend
```

### 3.5 Frontend Build + Nginx

```bash
cd /opt/kanray/front-end
npm ci
npm run build              # 产物输出 front-end/dist
```

```nginx
# /etc/nginx/conf.d/kanray.conf
server {
    listen 80;
    server_name _;
    client_max_body_size 32m;

    root /opt/kanray/front-end/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout             10s;
        proxy_read_timeout                300s;
        proxy_buffering                   off;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 3.6 pm2 as an Alternative

```bash
npm i -g pm2
pm2 start src/server.js --name kanray-backend
pm2 save && pm2 startup
```

---

```json
{
  "db": { "type": "sqlite", "url": "", "sqlitePath": "data/kanban.db" },
  "cache": { "url": "" }
}
```

|------|--------|------|
| `DB_TYPE` | `sqlite` | `sqlite` / `mysql` / `mariadb` / `postgres` / `sqlserver` / `oracle` |

```bash
APP_LANG=en-US ./deploy.sh up
APP_LANG=en-US ../k8s/scripts/deploy.sh up
APP_LANG=en-US ../k8s/scripts/build-images.sh
node backend/scripts/seed-form-demo.mjs -l en-US
node backend/scripts/seed-hydro-demo.mjs --locale=en-US
```

## IV. Environment Variable Reference

### 4.1 Precedence

**Environment variable > `config.json` > default**.

`config.json` is looked up in this order: `$DATA_DIR/config.json` → `backend/config.json` (see `backend/config.example.json` for an example).

The three `db` fields map one-to-one onto `DB_TYPE` / `DB_URL` / `DB_PATH`; `cache.url` maps to `REDIS_URL`.

### 4.2 Runtime and Directories

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Port the backend listens on |
| `DATA_DIR` | `backend/data` | Runtime data directory; also the first place `config.json` is read from (the directory holding the default sqlite file) |
| `UPLOAD_DIR` | `backend/uploads` | Directory for uploaded Excel / CSV files |
| `TIMEZONE` | `Asia/Shanghai` | IANA timezone used by the frontend to render timestamps |
| `NODE_ENV` | — | Set to `production` in production (already baked into the Docker image) |

### 4.3 Storage Backend (Metadata Database)

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_TYPE` | `sqlite` | `sqlite` / `mysql` / `mariadb` / `postgres` / `sqlserver` / `oracle` |
| `DB_URL` | empty | URL-style connection string for non-sqlite engines (examples in Section 5) |
| `DB_PATH` | `data/kanban.db` | Path to the sqlite file (absolute paths supported) |
| `DB_POOL_MAX` | `10` | Connection pool cap for the postgres / mysql application storage drivers; with multiple replicas the total connection count is replicas × this value |

### 4.4 Cache and Locks

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | empty (off) | Switch for the Redis cache/lock, e.g. `redis://:pass@127.0.0.1:6379/0`; when empty the in-memory cache plus database lease locks are used (see Section 6) |
| `CACHE_TTL_MS` | `60000` | TTL of the data source catalog cache (milliseconds) |

### 4.5 Authentication and Secrets

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | `dev-secret-change-me` | Signing secret for access/refresh tokens; **must be random in production** and identical across replicas |
| `ACCESS_TTL` | `15m` | Access token lifetime (ms/s/m/h/d supported) |
| `REFRESH_TTL_DAYS` | `7` | Refresh token lifetime (days) |
| `ADMIN_EMAIL` | `admin@kanray.local` | Initial admin email (seed data) |
| `ADMIN_INITIAL_PASSWORD` | `admin123` | Initial admin password; **must be changed in production** |
| `DATASOURCE_SECRET` | `kanban-dev-datasource-secret-32b!` | Master key used to encrypt data source passwords (AES-256-GCM key derivation); **must be random and ≥32 bytes in production, and identical across replicas** (see 8.2) |

### 4.6 Upload and Import

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_FILE_SIZE` | `20971520` | Maximum upload size in bytes (20MB by default) |
| `MAX_ROWS` | `200000` | Maximum number of rows when importing a dataset |

### 4.7 Sync Scheduling

| Variable | Default | Description |
|----------|---------|-------------|
| `SYNC_MODE` | `inline` | `inline`: both scheduling and execution happen inside the API process (single host / testing); `worker`: the API only enqueues into `sync_jobs` and a separate worker process consumes it (multi-replica / production, see Section 7) |
| `SYNC_SCHEDULER_INTERVAL_MS` | `60000` | Scheduler scan interval in milliseconds; in `worker` mode this is the interval at which due configurations are enqueued |
| `SYNC_WORKER_POLL_MS` | `2000` | Interval at which the worker process polls for `sync_jobs` to claim (milliseconds) |
| `SYNC_MAX_CONCURRENT` | `2` | Upper bound on concurrent sync jobs (in-process concurrency for `inline`, per-process claim concurrency for `worker`) |
| `SYNC_DEFAULT_INTERVAL_SECONDS` | `86400` | Default sync refresh interval (seconds) |
| `SYNC_LOCK_TTL_MS` | `1800000` | Duration of the per-sync lock claim / job lease (milliseconds, 30 minutes by default); after a worker crash, jobs past their lease can be reclaimed and re-run |
| `SYNC_JOB_RETENTION_DAYS` | `7` | How long the worker keeps finished (`success`/`failed`) `sync_jobs` records before cleanup, preventing unbounded growth of the queue table |

### 4.8 Query and Performance

| Variable | Default | Description |
|----------|---------|-------------|
| `QUERY_MAX_GROUPS` | `10000` | Cap on the number of groups in an aggregate query when no explicit group limit is given, preventing huge group results from being fully materialised; an explicit `groupLimit` wins |

### 4.9 Open API

| Variable | Default | Description |
|----------|---------|-------------|
| `OPEN_API_RATE_PER_MIN` | `120` | Open API rate limit per key per minute |
| `OPEN_API_MAX_ROWS` | `10000` | Maximum rows for a single Open API fetch / aggregate / dashboard export (larger results are truncated and return `truncated:true`) |

### 4.10 Output Language of the Deploy and Seed Scripts (`APP_LANG`)

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_LANG` | `zh-CN` | The language of the **scripts' own console output**. Deliberately not `LANG` (a POSIX variable that most systems already set — reusing it would make the output language depend on the host locale). Only the exact value `en-US` selects English; any other value (including empty / unset) falls back to Chinese. Valid values: `zh-CN` / `en-US` |

Scope: `deploy/docker/deploy.sh`, `deploy/k8s/scripts/deploy.sh` and `deploy/k8s/scripts/build-images.sh` read the `APP_LANG` environment variable; `backend/scripts/seed-form-demo.mjs` and `backend/scripts/seed-hydro-demo.mjs` read the `-l` / `--locale` flag (`--locale=en-US` works as well).

> `APP_LANG` only affects the scripts' own output (check names, progress, summaries, errors). The demo data the seed scripts write into the database (form names, field labels, station names, chart names, dashboard names, …) **stays Chinese on purpose** — it is "user-supplied data" and does not follow the UI language.

---

|-----------|--------|------------|
| `mysql` / `mariadb` | mysql2 | `mysql://root:Kanban%40123@127.0.0.1:13306/testdb` |
| `postgres` | pg | `postgresql://postgres:Kanban%40123@127.0.0.1:15432/testdb?sslmode=disable` |
| `sqlserver` | mssql | `mssql://sa:Kanban%40123@127.0.0.1:11433/testdb` |
| `oracle` | oracledb | `oracle://SYSTEM:Kanban%40123@127.0.0.1:11521/FREEPDB1` |

```bash
cd backend
# 方式一：环境变量（推荐，不落盘）
DB_TYPE=postgres DB_URL='postgresql://kanray:kanray@127.0.0.1:15432/kanray?sslmode=disable' npm start
# 方式二：config.json（backend/config.json，随部署持久化）
# { "db": { "type": "postgres", "url": "postgresql://kanray:kanray@127.0.0.1:15432/kanray?sslmode=disable" } }
```

## V. Database (Storage Backend) Configuration

### 5.1 What This Is

`DB_TYPE` / `DB_URL` / `DB_PATH` control the **metadata database**: users / roles / permissions / data source configurations / datasets / charts / dashboards / sync configurations (`sync_configs`) and the local physical tables that sync jobs materialise (`sync_*`).

This is a different thing from "external data source connections": data source connection passwords are encrypted inside each data source record, and queries/sync jobs hit the external database — none of that follows the storage backend.

### 5.2 Supported Backends and Connection Strings

| `DB_TYPE` | Driver library | Connection string example |
|-----------|----------------|---------------------------|
| `sqlite` | better-sqlite3 | `DB_PATH=data/kanban.db` (single file) |
| `mysql` / `mariadb` | mysql2 | `mysql://root:Kanban%40123@127.0.0.1:13306/testdb` |
| `postgres` | pg | `postgresql://postgres:Kanban%40123@127.0.0.1:15432/testdb?sslmode=disable` |
| `sqlserver` | mssql | `mssql://sa:Kanban%40123@127.0.0.1:11433/testdb` |
| `oracle` | oracledb | `oracle://SYSTEM:Kanban%40123@127.0.0.1:11521/FREEPDB1` |

> Passwords containing special characters must be URL-encoded (e.g. `@` → `%40`); for `mariadb` you may write the `mysql://` scheme.

**Quick switch example (PostgreSQL)** — the two options, environment variable and `config.json`, are shown in the snippet above.

### 5.3 What Happens on First Start

1. The connection string is read and its reachability is checked;
2. Tables are created **idempotently** on the selected engine (`IF NOT EXISTS` and the like) + **missing columns are added to existing tables** (the current schema is probed per dialect and columns are appended);
3. If the database has no admin account, `admin@kanray.local` is seeded automatically;
4. You can start using the product straight away — no manual DDL required.

### 5.4 Things to Watch When Switching

- **Existing data is not migrated automatically**: switching the storage backend does not move metadata out of the old database (such as the default SQLite file). Decide on the topology before the first start on the new engine, or rebuild it with the tools in `backend/scripts/` / by exporting and importing manually.
- **`DATASOURCE_SECRET` must stay consistent**: existing data source passwords are stored encrypted, so changing the key makes them impossible to decrypt (you have to re-save them one by one). Fix this secret **before** the first data source is created.
- **Oracle transaction semantics**: Oracle auto-commits per statement, so `transaction(fn)` degrades to statement-by-statement execution and a batch write that fails midway is not rolled back as a whole; the other dialects support explicit transactions.
- **The physical `sync_*` tables follow the storage backend**: tables materialised by sync jobs are created in the storage-backend database, so they move with it (or must be migrated / re-synced after a switch).
- **Local test containers**: `backend/scripts/datasource-live/docker-compose.yml` provides a live test stack for the five non-sqlite storage backends (MySQL 13306 / MariaDB 13307 / PostgreSQL 15432 / SQL Server 11433 / Oracle 11521); the same compose file also starts clickhouse / tidb / elasticsearch / trino / hive / db2 / dameng / impala, which are used to test connectivity to external data sources.

---

```bash
REDIS_URL='redis://:mypass@127.0.0.1:6379/0' npm start
```

## VI. Redis Configuration

### 6.1 What It Is For

1. **Shared cache**: currently covering data source catalog metadata (`catalogCache` — ETL column metadata, TTL `CACHE_TTL_MS`, 60s by default); RBAC mappings are queried straight from the database and are not cached, so permission changes take effect immediately.
2. **Distributed locks**: with Redis configured, sync scheduling and concurrent writes use `SET ... NX PX` (released by a Lua script that carries a holder token), which gives stronger mutual exclusion across replicas.

### 6.2 Enabling It and Falling Back

- **To enable**: set `REDIS_URL` (or `cache.url` in `config.json`). The URL format is `redis://[:password@]host:port/db`; use `rediss://` for TLS.
- **Without Redis (the default)**: caching uses an in-process `Map` (lazily evicted by TTL), and locking uses **database lease locks** (the `sync_locks` table, with an atomic `UPDATE ... WHERE locked_until < now`) — replicas sharing the same metadata database are mutually exclusive that way, so **Redis is not required**.
- **No hard dependency on Redis**: application startup does not depend on Redis; when it cannot connect it falls back to the in-memory cache and logs a warning (startup is not blocked).

### 6.3 Redis in Docker Compose

The `pg` / `mysql` / `mariadb` stacks **already bundle a Redis service** (`redis:7-alpine` with AOF persistence in the `redisdata` volume) and inject `REDIS_URL=redis://redis:6379/0` into both backend and worker, so nothing has to be added by hand.

- **Local development (sqlite)**: Redis is not enabled. Plain `npm run dev` gives you SQLite + in-memory cache + lease locks in the `sync_locks` table, with no extra service required (see 2.6 and `backend/README.md`).
- **The SQLite demo stack**: likewise contains no Redis.
- **External / password-protected Redis**: override `REDIS_URL` in `.env`, for example `REDIS_URL=redis://:mypass@redis:6379/0`. In production, set a password on the Redis container and expose it only on the internal network (the official `redis:` image has no authentication by default — that is fine for demos only).

---

```yaml
  worker:
    build: { context: ../.., dockerfile: deploy/docker/backend/Dockerfile }
    command: ["node", "backend/src/worker/main.js"]
    environment:
      DB_TYPE: postgres
      DB_URL: postgresql://kanray:kanray@postgres:5432/kanray
      SYNC_MODE: worker
      SYNC_MAX_CONCURRENT: "4"
    restart: unless-stopped
```

```bash
curl http://<backend>:3001/api/health
# {"code":0,"data":{"status":"ok",...}}
```

```bash
curl http://<backend>:3001/api/metrics
# 含 uptimeSeconds、eventLoop(p50/p99/max)、memory(rss/heap)、
# http(请求数/错误数/状态码分布/耗时直方图)、sync(同步次数/失败/行数/删除数)
```

```yaml
  backend:
    build:
      context: ../..
      dockerfile: deploy/docker/backend/Dockerfile
    environment:
      DB_TYPE: postgres
      DB_URL: postgresql://kanray:kanray@postgres:5432/kanray
      REDIS_URL: redis://redis:6379/0
      JWT_SECRET: ${JWT_SECRET}
      DATASOURCE_SECRET: ${DATASOURCE_SECRET}
      UPLOAD_DIR: /uploads   # 需替换为共享卷 / 对象存储挂载
    deploy:
      replicas: 3
```

## VII. Multi-Replica / Distributed Deployment

The backend is designed for **stateless replicas** (stateless JWT, no WebSocket/SSE, no sticky sessions required), so it scales horizontally. Here is the checklist.

### 7.1 Prerequisites

| # | Prerequisite | Notes |
|---|--------------|-------|
| 1 | **Move the metadata database to a shared external engine** | `DB_TYPE=postgres` (or mysql, …) plus a single shared `DB_URL`. **sqlite is a single file with a single writer and must never be shared across replicas** |
| 2 | **Identical `JWT_SECRET` everywhere** | Access tokens are stateless signatures; replicas that disagree will reject each other's tokens |
| 3 | **Put the upload directory on shared storage** | Excel/CSV files land in the local `UPLOAD_DIR`; multiple replicas must mount the same NFS / object storage, otherwise an upload received by replica A cannot be read by replica B |
| 4 | **Configure `REDIS_URL` (recommended)** | Shared cache + Redis locks; without it, lease locks in the `sync_locks` table still provide mutual exclusion |
| 5 | **Idempotent seed data** | Safe to start replicas simultaneously: tables use `IF NOT EXISTS`, resources use `INSERT OR IGNORE`, and the admin account is deduplicated by email |

### 7.2 Sync Execution: the `inline` and `worker` Modes

`SYNC_MODE` decides where sync jobs run:

- **`inline` (default)**: scheduled and executed inside the API process — good for a single host / testing. With multiple replicas every instance runs a scheduler, and they exclude each other through the distributed lock:
  - without Redis: a lease lock in the `sync_locks` table (atomic UPDATE with an expiry, `SYNC_LOCK_TTL_MS`, 30 minutes by default);
  - with Redis: `SET NX PX` to claim the lock;
  - an instance that loses the race prints `[sync] cfg <id> 已由其它实例执行，跳过`; `runSync` additionally re-checks idempotency via `last_sync_status='running'`.
- **`worker` (recommended for production)**: the API only writes due configurations into the `sync_jobs` queue table (`POST .../run` also enqueues), and a **separate worker process/container** consumes them. With multiple replicas, jobs are claimed through conditional row-level UPDATEs on `sync_jobs`, and the `lease_until` lease lets crashed workers' jobs be reclaimed and re-run.

Both modes guarantee that **a given sync job has exactly one executor at any time**, with no leader election. The benefits of a separate worker: it is a single-purpose process, long or failing sync jobs do not occupy the API event loop, and it can be scaled independently according to load.

Deploy the worker on its own — the snippet above shares the image with the API and only changes the entry point.

> The worker and the API must point at the same metadata database, and `SYNC_MODE` should be set to `worker` on both sides — otherwise the API process still runs a local scheduler. `deploy/docker/docker-compose.yml` already ships this service.

### 7.3 Health Checks and Traffic Ingress

Put a load balancer (Nginx / K8s Service) in front and distribute `/api/` across several backend replicas; `trust proxy` is already enabled, so `X-Forwarded-*` headers pass through a reverse proxy correctly.

The snippet above returns a runtime observability snapshot (aggregated in-process, no external dependency).

> To restrict access, set `METRICS_TOKEN` and then pass either `X-Metrics-Token: <token>` or `?token=<token>`; when it is unset the endpoint is public, just like `/api/health`. The load-testing script is `backend/scripts/bench/http-bench.js`.

### 7.4 Multi-Replica Example (Docker Compose)

The snippet above declares 3 replicas; you can also just run `docker compose up -d --scale backend=3`. If you run with `SYNC_MODE=worker`, scale the sync workload separately: `docker compose up -d --scale worker=2` (job claims are mutually exclusive through `sync_jobs` row locks, so nothing runs twice).

> Watch the total connection count when scaling out: `replicas × DB_POOL_MAX` (10 by default) should stay below the metadata database's `max_connections`.

### 7.5 Limits of Distributed Deployment

- **Open API rate limiting is counted in each replica's memory** (express-rate-limit's default store plus `OPEN_API_RATE_PER_MIN`). If you need a strict global quota across replicas you must implement it at the gateway layer (this project ships no shared rate-limit store).
- The in-memory cache is per replica (shared once Redis is configured); the only consistency impact is catalog metadata within the TTL, which is acceptable.
- Shared storage for uploads (NFS / object storage) is **mandatory** for multiple replicas — do not forget it when planning.

---

## VIII. Key Management and Rotation

### 8.1 JWT_SECRET

- Purpose: signs and verifies user access tokens and refresh tokens
- Rotation: after a change, **every existing session is invalidated immediately** and users must sign in again (refresh tokens are stored hashed on the server); with multiple replicas you must change it everywhere and do a rolling restart

### 8.2 DATASOURCE_SECRET

- Purpose: derives an AES-256-GCM key used to encrypt external data source connection passwords
- **It must be fixed before the first data source is created**; changing it makes existing connection passwords undecryptable, so every data source password has to be re-saved
- In production, inject a strong random value of ≥32 bytes (`openssl rand -base64 32`); it must be identical across replicas

### 8.3 Handling a Leak

- Access tokens leak → change `JWT_SECRET` (logs everyone out) or disable the affected accounts specifically
- An API key leaks → Administration → Open API → disable / roll / delete that key

---

- **Compose / Postgres**：
- **SQLite**：

## IX. Backup and Restore

- All metadata lives in the metadata database (the Postgres volume in Compose scenarios; the sqlite file or the chosen external engine in source mode).
- **Compose / Postgres**:
  - online backup: `cd deploy/docker && docker compose exec postgres pg_dump -U kanray kanray > backup.sql`
  - restore: `cd deploy/docker && ./deploy.sh down --remove-orphans` → recreate the volume → `./deploy.sh up` → `docker compose exec -T postgres psql -U kanray kanray < backup.sql`
- **SQLite**:
  - online backup (recommended, consistency guaranteed): `sqlite3 backend/data/kanban.db ".backup '/path/backup-kanban.db'"`
  - or copy `kanban.db` directly after stopping the service; if WAL mode was used before, first make sure the `-wal` file has been checkpointed, then copy `kanban.db` + `-wal` back together on restore (or delete `-wal`/`-shm` and keep only the main file)
- **Restore caveat**: the tables materialised by data source sync jobs (`sync_*`) also live in the metadata database, so back them up and restore them together with it.

---

## X. Hardening and Known Limitations

### 10.1 Hardening Checklist

1. Change the initial admin password (`ADMIN_INITIAL_PASSWORD`)
2. Make sure `JWT_SECRET` / `DATASOURCE_SECRET` are random values (for Docker deployment, `deploy.sh` injects them on the first run; for K8s deployment, `deploy/k8s/scripts/deploy.sh` generates a Secret of the same name)
3. Give Redis a password and expose it only on the internal network; grant database accounts least privilege and disable direct public access
4. Grant Open API credentials least privilege and set an expiry time
5. Apply least privilege to external data source accounts
7. Share links require a password of at least 4 characters; disable links that should stop working
8. Run behind a reverse proxy / TLS (`trust proxy` is built in, but make sure only trusted proxies are trusted)

### 10.2 Known Limitations

- **Open API rate limiting**: counted in each replica's memory; a global quota across replicas must be implemented at the gateway layer
- **sqlite is single-instance only**: multi-replica deployments must switch to an external engine
- Uploaded files are stored on local disk, so multiple replicas need shared storage
- Custom expiry times for share links are supported: when you create a share you can pick a specific expiry in the dialog, and the link stops working once it passes (leave it empty for a link that never expires)
- File-based data sources do not support sync mode
- Per-file upload limits: 20MB / 200,000 rows
- Incremental sync enables primary-key reconciliation deletes by default (locally deleting rows already removed at the source); on large tables each sync re-scans the source primary keys, which you can turn off in the job configuration (`reconcile_delete=0`)
- Oracle as a storage backend / Oracle as a sync source: auto-commit per statement, so a batch write that fails midway is not rolled back as a whole
- Open API output allowlist: the generated SQL, table names, connection information and secrets are never returned
