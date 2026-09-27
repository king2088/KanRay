# Docker Deployment (kanray)

> 中文: [README.md](./README.md)

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
    ├── nginx-main.conf        # nginx 主配置（COPY 为 /etc/nginx/nginx.conf；非 root 运行，临时文件路径迁到 /tmp）
    └── nginx.conf             # server 段（COPY 为 conf.d/default.conf）：listen 8080，/api/ → backend:3001，resolver 动态解析
```

The directory tree above is language-neutral, so it is listed only once.

```bash
cd deploy/docker
./deploy.sh                    # 默认 PostgreSQL stack，构建并后台启动
./deploy.sh up --stack sqlite  # 或 mysql / mariadb
# default PostgreSQL stack, build and start in the background / or mysql / mariadb
```

## Quick start

After startup, open `http://localhost:8080` (the port is adjustable via `KANRAY_PORT` in `deploy/docker/.env`); the Swagger docs are at `http://localhost:8080/api/open/docs`.

On the first run, if `.env` is missing, it is copied from `.env.example` and random values are injected into `JWT_SECRET` / `DATASOURCE_SECRET` / each database's `*_PASSWORD`; the initial administrator is `admin@kanray.local / admin123` (change it in production).

```bash
./deploy.sh down         # 停机（保留数据卷）
./deploy.sh down -v      # 停机并清除全部数据（-v 删卷，不可恢复！）
./deploy.sh restart      # 重启容器（保留数据）
./deploy.sh logs         # 跟随日志
./deploy.sh ps           # 容器状态
# stop (data volumes kept) / stop and wipe all data (-v deletes the volumes, irreversible!) / restart the containers (data kept) / follow the logs / container status
```

## Subcommands

Stop the stack while keeping the data volumes (`down`), stop it and wipe all data (`down -v` deletes the volumes — irreversible), restart the containers while keeping the data (`restart`), follow the logs (`logs`), or show container status (`ps`).

```bash
APP_LANG=en-US ./deploy.sh up
```

## Environment Variables

The language of `deploy.sh`'s **own console output** is controlled by the `APP_LANG` environment variable. It is deliberately not `LANG` (a POSIX variable that most systems already set — reusing it would make the output language depend on the host locale). Only the exact value `en-US` selects English; any other value (including empty / unset) falls back to Chinese.

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_LANG` | `zh-CN` | The language of `deploy.sh`'s own console output. Deliberately not `LANG` (a POSIX variable that most systems already set — reusing it would make the output language depend on the host locale). Only the exact value `en-US` selects English; any other value (including empty / unset) falls back to Chinese. Valid values: `zh-CN` / `en-US` |

> **Note**: `APP_LANG` only affects the script's own output (check names, progress, summaries, errors); it does not change the application's UI language. The `APP_LANG=en-US ./deploy.sh up` command is listed once, above.

|-------|----------|----------|
| `mysql` | `docker-compose.mysql.yml` | MySQL 8.0 |
| `mariadb` | `docker-compose.mariadb.yml` | MariaDB 11 |

## About the Stacks

| Stack | Compose file | Metadata database |
|-------|--------------|-------------------|
| `pg` (default) | `docker-compose.yml` | PostgreSQL |
| `sqlite` | `docker-compose.sqlite.yml` | SQLite (demo, does not support multiple replicas) |
| `mysql` | `docker-compose.mysql.yml` | MySQL 8.0 |
| `mariadb` | `docker-compose.mariadb.yml` | MariaDB 11 |

## Volumes

| Volume | Purpose |
|--------|---------|
| `pgdata` / `mysqldata` / `mariadbdata` | Database data directory |
| `redisdata` | Redis AOF persistence |
| `kanray_data` | Runtime data directory (the SQLite stack stores `kanray.db` here) |
| `kanray_uploads` | Uploaded Excel / CSV files |

> **Note**: Volume names and the deployment identifiers (`KANRAY_PORT`, `POSTGRES_USER/DB`, etc.) have been unified under `kanray`. If you have an old volume such as `kanban_data` and need to keep using the old data, migrate it first with `docker volume rename` — do not delete the volume outright.

## Differences from the k8s Deployment

- Frontend reverse proxy: this directory uses `resolver 127.0.0.11` plus a variable so that `backend` is resolved at request time, so a container rebuild that changes the IP does not cause a 502; `deploy/k8s` uses stable in-cluster DNS and configures `proxy_pass http://backend:3001;` directly.
- The backend/worker images are built inside this directory with the tag `kanray-backend:1.0.0`; the k8s side uses its own Dockerfiles under `deploy/k8s/` together with the `kanray-backend` / `kanray-frontend` images.
- Configuration injection: compose reads everything from `.env`; k8s uses a ConfigMap + Secret and does not read this directory's `.env`.
