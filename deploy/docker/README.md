# Docker 部署（kanray）

本目录是 **Docker compose 一键部署**的独立实现，与 `deploy/k8s/`（Kubernetes 部署）**不共用任何文件**，二选一执行即可。

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

## 快速开始

```bash
cd deploy/docker
./deploy.sh                    # 默认 PostgreSQL stack，构建并后台启动
./deploy.sh up --stack sqlite  # 或 mysql / mariadb
```

启动后访问 `http://localhost:8080`（`deploy/docker/.env` 的 `KANRAY_PORT` 可调整端口），Swagger 文档在 `http://localhost:8080/api/open/docs`。

首次运行无 `.env` 时自动从 `.env.example` 复制并随机注入 `JWT_SECRET` / `DATASOURCE_SECRET` / 各库 `*_PASSWORD`；初始管理员 `admin@kanray.local / admin123`（生产务必改密）。

## 子命令

```bash
./deploy.sh down         # 停机（保留数据卷）
./deploy.sh down -v      # 停机并清除全部数据（-v 删卷，不可恢复！）
./deploy.sh restart      # 重启容器（保留数据）
./deploy.sh logs         # 跟随日志
./deploy.sh ps           # 容器状态
```

## stack 说明

| stack | 编排文件 | 元数据库 |
|-------|----------|----------|
| `pg`（默认） | `docker-compose.yml` | PostgreSQL |
| `sqlite` | `docker-compose.sqlite.yml` | SQLite（演示，不支持多副本） |
| `mysql` | `docker-compose.mysql.yml` | MySQL 8.0 |
| `mariadb` | `docker-compose.mariadb.yml` | MariaDB 11 |

## 数据卷

| 卷 | 用途 |
|----|------|
| `pgdata` / `mysqldata` / `mariadbdata` | 数据库数据目录 |
| `redisdata` | Redis AOF 持久化 |
| `kanray_data` | 运行时数据目录（SQLite 栈存 `kanray.db`） |
| `kanray_uploads` | 上传的 Excel / CSV 文件 |

> 卷名与部署标识（`KANRAY_PORT`、`POSTGRES_USER/DB` 等）已统一为 `kanray`。若此前有 `kanban_data` 等旧卷需沿用旧数据，请先 `docker volume rename` 迁移，勿直接删卷。

## 与 k8s 部署的差异

- 前端反代：本目录使用 `resolver 127.0.0.11` + 变量动态解析 `backend`，容器重建 IP 变化不 502；`deploy/k8s` 为集群内固定 DNS，配置直接 `proxy_pass http://backend:3001;`。
- backend/worker 镜像在本目录内构建，tag 为 `kanray-backend:1.0.0`；k8s 侧用 `deploy/k8s/` 独立 Dockerfile 与 `kanray-backend` / `kanray-frontend` 镜像。
- 配置注入：compose 全部走 `.env`；k8s 走 ConfigMap + Secret，不读取本目录的 `.env`。