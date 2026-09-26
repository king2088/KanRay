# Docker 部署（kanray）

本目录是 **Docker compose 一键部署**的独立实现，与 `deploy/k8s/`（Kubernetes 部署）**不共用任何文件**，二选一执行即可。

# Docker Deployment (kanray)

This directory is a **standalone one-click Docker compose deployment**. It shares **no file at all** with `deploy/k8s/` (the Kubernetes deployment) — run one or the other.

```text
deploy/docker/
├── deploy.sh                  # 部署入口脚本（--stack 选择数据库栈）
├── docker-compose.yml         # 默认 stack：postgres + redis + backend(API) + worker(同步) + frontend
├── docker-compose.sqlite.yml  # SQLite 演示栈：backend(inline) + frontend（无 PG/Redis/worker）
├── docker-compose.mysql.yml   # MySQL 8.0 栈：mysql + redis + backend + worker + frontend
├── docker-compose.mariadb.yml # MariaDB 11 栈：mariadb + redis + backend + worker + frontend
├── .env.example               # 环境变量模板
├── .env                       # 实际配置（首次运行自动生成）
├── backend/Dockerfile         # 后端 + worker 镜像（独立自包含，不依赖 deploy/k8s）
└── frontend/
    ├── Dockerfile             # 前端 Nginx 镜像
    └── nginx.conf             # 反代配置（/api/ → backend:3001，resolver 动态解析）
```

The directory tree above is language-neutral, so it is listed only once.

## 快速开始

```bash
cd deploy/docker
./deploy.sh                    # 默认 PostgreSQL stack，构建并后台启动
./deploy.sh up --stack sqlite  # 或 mysql / mariadb
# EN: default PostgreSQL stack, build and start in the background / or mysql / mariadb
```

启动后访问 `http://localhost:8080`（`deploy/docker/.env` 的 `KANRAY_PORT` 可调整端口），Swagger 文档在 `http://localhost:8080/api/open/docs`。

首次运行无 `.env` 时自动从 `.env.example` 复制并随机注入 `JWT_SECRET` / `DATASOURCE_SECRET` / 各库 `*_PASSWORD`；初始管理员 `admin@kanray.local / admin123`（生产务必改密）。

## Quick start

After startup, open `http://localhost:8080` (the port is adjustable via `KANRAY_PORT` in `deploy/docker/.env`); the Swagger docs are at `http://localhost:8080/api/open/docs`.

On the first run, if `.env` is missing, it is copied from `.env.example` and random values are injected into `JWT_SECRET` / `DATASOURCE_SECRET` / each database's `*_PASSWORD`; the initial administrator is `admin@kanray.local / admin123` (change it in production).

## 子命令

```bash
./deploy.sh down         # 停机（保留数据卷）
./deploy.sh down -v      # 停机并清除全部数据（-v 删卷，不可恢复！）
./deploy.sh restart      # 重启容器（保留数据）
./deploy.sh logs         # 跟随日志
./deploy.sh ps           # 容器状态
# EN: stop (data volumes kept) / stop and wipe all data (-v deletes the volumes, irreversible!) / restart the containers (data kept) / follow the logs / container status
```

## Subcommands

Stop the stack while keeping the data volumes (`down`), stop it and wipe all data (`down -v` deletes the volumes — irreversible), restart the containers while keeping the data (`restart`), follow the logs (`logs`), or show container status (`ps`).

## 环境变量

`deploy.sh` **自身控制台输出**的语言由环境变量 `APP_LANG` 控制。刻意不用 `LANG`（POSIX 标准变量，多数系统已被占用，复用会让输出语言取决于宿主机 locale）。仅精确取值 `en-US` 时输出英文；其他任意取值（含空值 / 未设置）一律回退中文。

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `APP_LANG` | `zh-CN` | `deploy.sh` 自身控制台输出的语言。刻意不用 `LANG`（POSIX 标准变量，多数系统已被占用，复用会让输出语言取决于宿主机 locale）。仅精确取值 `en-US` 时输出英文；其他任意取值（含空值 / 未设置）一律回退中文。有效值：`zh-CN` / `en-US` |

```bash
APP_LANG=en-US ./deploy.sh up
```

> **注意**：`APP_LANG` 只影响脚本自身输出（校验项名称、进度、汇总、报错），不影响应用界面语言。

## Environment Variables

The language of `deploy.sh`'s **own console output** is controlled by the `APP_LANG` environment variable. It is deliberately not `LANG` (a POSIX variable that most systems already set — reusing it would make the output language depend on the host locale). Only the exact value `en-US` selects English; any other value (including empty / unset) falls back to Chinese.

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_LANG` | `zh-CN` | The language of `deploy.sh`'s own console output. Deliberately not `LANG` (a POSIX variable that most systems already set — reusing it would make the output language depend on the host locale). Only the exact value `en-US` selects English; any other value (including empty / unset) falls back to Chinese. Valid values: `zh-CN` / `en-US` |

> **Note**: `APP_LANG` only affects the script's own output (check names, progress, summaries, errors); it does not change the application's UI language. The `APP_LANG=en-US ./deploy.sh up` command is listed once, above.

## stack 说明

| stack | 编排文件 | 元数据库 |
|-------|----------|----------|
| `pg`（默认） | `docker-compose.yml` | PostgreSQL |
| `sqlite` | `docker-compose.sqlite.yml` | SQLite（演示，不支持多副本） |
| `mysql` | `docker-compose.mysql.yml` | MySQL 8.0 |
| `mariadb` | `docker-compose.mariadb.yml` | MariaDB 11 |

## About the Stacks

| Stack | Compose file | Metadata database |
|-------|--------------|-------------------|
| `pg` (default) | `docker-compose.yml` | PostgreSQL |
| `sqlite` | `docker-compose.sqlite.yml` | SQLite (demo, does not support multiple replicas) |
| `mysql` | `docker-compose.mysql.yml` | MySQL 8.0 |
| `mariadb` | `docker-compose.mariadb.yml` | MariaDB 11 |

## 数据卷

| 卷 | 用途 |
|----|------|
| `pgdata` / `mysqldata` / `mariadbdata` | 数据库数据目录 |
| `redisdata` | Redis AOF 持久化 |
| `kanray_data` | 运行时数据目录（SQLite 栈存 `kanray.db`） |
| `kanray_uploads` | 上传的 Excel / CSV 文件 |

## Volumes

| Volume | Purpose |
|--------|---------|
| `pgdata` / `mysqldata` / `mariadbdata` | Database data directory |
| `redisdata` | Redis AOF persistence |
| `kanray_data` | Runtime data directory (the SQLite stack stores `kanray.db` here) |
| `kanray_uploads` | Uploaded Excel / CSV files |

> **注意**：卷名与部署标识（`KANRAY_PORT`、`POSTGRES_USER/DB` 等）已统一为 `kanray`。若此前有 `kanban_data` 等旧卷需沿用旧数据，请先 `docker volume rename` 迁移，勿直接删卷。

> **Note**: Volume names and the deployment identifiers (`KANRAY_PORT`, `POSTGRES_USER/DB`, etc.) have been unified under `kanray`. If you have an old volume such as `kanban_data` and need to keep using the old data, migrate it first with `docker volume rename` — do not delete the volume outright.

## 与 k8s 部署的差异

- 前端反代：本目录使用 `resolver 127.0.0.11` + 变量动态解析 `backend`，容器重建 IP 变化不 502；`deploy/k8s` 为集群内固定 DNS，配置直接 `proxy_pass http://backend:3001;`。
- backend/worker 镜像在本目录内构建，tag 为 `kanray-backend:1.0.0`；k8s 侧用 `deploy/k8s/` 独立 Dockerfile 与 `kanray-backend` / `kanray-frontend` 镜像。
- 配置注入：compose 全部走 `.env`；k8s 走 ConfigMap + Secret，不读取本目录的 `.env`。

## Differences from the k8s Deployment

- Frontend reverse proxy: this directory uses `resolver 127.0.0.11` plus a variable so that `backend` is resolved at request time, so a container rebuild that changes the IP does not cause a 502; `deploy/k8s` uses stable in-cluster DNS and configures `proxy_pass http://backend:3001;` directly.
- The backend/worker images are built inside this directory with the tag `kanray-backend:1.0.0`; the k8s side uses its own Dockerfiles under `deploy/k8s/` together with the `kanray-backend` / `kanray-frontend` images.
- Configuration injection: compose reads everything from `.env`; k8s uses a ConfigMap + Secret and does not read this directory's `.env`.
