# 一键部署（Docker Compose）设计

> 日期：2026-09-17
> 目标：新增 `deploy/` 目录，包含前后端 Docker 化部署文件与一键脚本，实现 `./deploy.sh` 起全栈。

## 1. 背景与约束

- 现状：后端为 Node.js（`>=18`）+ Express，默认 SQLite，支持外部存储（`DB_TYPE`/`DB_URL`）与 Redis；前端为 Vite + Vue，`npm run build` 产出 `dist/`，目前仅开发态 `vite dev` 托管且 `/api` 代理到 `:3001`，后端无静态托管。
- 部署形态：**方案 A**——三容器（backend + frontend(nginx) + postgres），**不改任何应用代码**。
- 存储：**内置 PostgreSQL 容器**（用户选定）；sqlite 不再是默认但目录/卷仍兼容。
- 一键：需要 `./deploy.sh` 自动生成 `.env`（随机密钥）、校验依赖、`docker compose up -d --build`。
- 本机 Docker 29.7.2 + Compose v5.5.1 可用于构建与冒烟验证。

## 2. 目录结构

```
deploy/
├── docker-compose.yml        # postgres + backend + frontend 三服务
├── .env.example              # 模板（密钥/密码留空，由脚本填充）
├── deploy.sh                 # 一键脚本：生成 .env → 校验 → up -d --build
├── backend/
│   └── Dockerfile            # backend 生产镜像（npm ci --omit=dev）
└── frontend/
    ├── Dockerfile            # 两段：node 构建 dist → nginx 托管
    └── nginx.conf            # 静态托管 + /api 反代 + SPA fallback
```

根目录新增 `.dockerignore`：排除 `.git`、`backend/node_modules`、`backend/data`、`backend/uploads`、`backend/test`、`front-end/node_modules`、`front-end/dist`、`deploy`、`docs` 等非镜像所需内容。构建 context 为仓库根目录（`..`），dockerfile 位置 `deploy/*/Dockerfile`；镜像内只 COPY 需要路径。

## 3. 镜像与服务

### 3.1 backend
- 基础镜像 `node:20-alpine`：
  - `COPY backend/package.json backend/package-lock.json ./` → `npm ci --omit=dev`
  - `COPY backend/src backend/src`
  - `CMD ["node", "src/server.js"]`，`EXPOSE 3001`。
- 运行时目录 `DATA_DIR=/data`、`UPLOAD_DIR=/uploads` 挂持久卷（兼容 sqlite 时代存储布局）。

### 3.2 frontend
- Stage 1：`node:20-alpine`，`COPY front-end/package.json front-end/package-lock.json ./` + `npm ci`，`COPY front-end/ .`，`npm run build` 产出 `/app/dist`。
- Stage 2：`nginx:1.27-alpine`，拷入 `nginx.conf` → `/etc/nginx/conf.d/default.conf`，`COPY --from=build /app/dist /usr/share/nginx/html`，`EXPOSE 80`。
- nginx 要点：
  - `location /api/` → `proxy_pass http://backend:3001;`（保留 URI），带 `Host` / `X-Real-IP` / `X-Forwarded-For` / `X-Forwarded-Proto`，`proxy_http_version 1.1`。
  - `location /` → `try_files $uri $uri/ /index.html;`（history 路由）。
  - `client_max_body_size 32m`（数据集上传，默认 20MB）。

### 3.3 postgres
- `postgres:16-alpine`，`pgdata` 卷，healthcheck `pg_isready -U $POSTGRES_USER`。

### 3.4 docker-compose.yml
```yaml
services:
  postgres:
    image: postgres:16-alpine
    env_file: .env            # POSTGRES_USER/PASSWORD/DB
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER}"], interval: 3s, timeout: 3s, retries: 10 }
    restart: unless-stopped
  backend:
    build: { context: .., dockerfile: deploy/backend/Dockerfile }
    env_file: .env
    environment:
      DB_TYPE: postgres
      DB_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      DATA_DIR: /data
      UPLOAD_DIR: /uploads
      PORT: "3001"
    volumes: [kanban_data:/data, kanban_uploads:/uploads]
    depends_on: { postgres: { condition: service_healthy } }
    expose: ["3001"]
    restart: unless-stopped
  frontend:
    build: { context: .., dockerfile: deploy/frontend/Dockerfile }
    ports: ["${KANBAN_PORT:-8080}:80"]
    depends_on: [backend]
    restart: unless-stopped
volumes: { pgdata: {}, kanban_data: {}, kanban_uploads: {} }
```
- 不对外暴露 postgres 端口（仅 internal）；backend 用 `expose` 不映射宿主端口。

## 4. 环境变量与一键脚本

### 4.1 .env.example
```
KANBAN_PORT=8080
POSTGRES_USER=kanban
POSTGRES_PASSWORD=
POSTGRES_DB=kanban
JWT_SECRET=
DATASOURCE_SECRET=
ADMIN_INITIAL_PASSWORD=admin123
```
- `JWT_SECRET` / `DATASOURCE_SECRET` / `POSTGRES_PASSWORD` 留空，由脚本生成随机值（`openssl rand -base64 32`）。
- `.env` 加入 `.gitignore`（若未覆盖），严禁提交。

### 4.2 deploy.sh（bash，`set -euo pipefail`，可 BSD/GNU sed 兼容）
- 子命令：`up`（默认）| `down` | `logs` | `ps` | `restart`。
- 前置检查：`docker`、`docker compose` 存在。
- `.env` 缺失时：从 `.env.example` 复制并用临时文件替换占位值为随机值（JWT/DATASOURCE/POSTGRES 三密钥），`ADMIN_INITIAL_PASSWORD` 保留模板默认并提示。
- `up`：`docker compose up -d --build`，随后 `docker compose ps` 汇总，打印：
  - 访问地址 `http://localhost:${KANBAN_PORT}`
  - Swagger 文档 `http://localhost:${KANBAN_PORT}/api/open/docs`
  - 管理员默认账号与「生产必须修改」提示。
- `down`：`docker compose down`（保留数据卷）；`down -v` 才清卷（不设为默认）。

## 5. 验证

- `docker build` 两个镜像可成功（本地 Docker 可用）。
- `./deploy.sh up` 三容器 Healthy → 探活：
  - `GET /` 返回前端 HTML；
  - `GET /api/health`（或登录页/接口）通；
  - `GET /api/open/v1/openapi.json` 返回 spec；
  - 后端日志无 seed/迁移错误。
- `./deploy.sh down` 收尾；再次 `up` 数据仍在（卷持久化）。

## 6. 不动的部分

- 零应用代码改动（src/ 前后端均不改）。
- 不影响 `backend/scripts/datasource-live/docker-compose.yml` 等既有内容。
- README 增补一章「Docker 一键部署」（deploy 使用说明），其余 README 不动。

## 7. 已知限制

- 单实例 compose 部署（与外部存储/同步调度既有限制一致）；生产作反向代理置于 nginx 之前需要自定义 KANBAN_PORT 或额外入口。
- 未纳入 Redis（缓存默认内存），如需 Redis 可在后续加 `redis` 服务与 `REDIS_URL`。
- 数据卷基于命名卷，跨主机迁移需 `docker compose down -v` + 卷导出/或改为 bind mount（文档注明）。