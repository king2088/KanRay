# Docker 一键部署 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `deploy/` 目录，实现 `./deploy.sh` 一键部署三容器（postgres + backend + frontend(nginx)），前端文档入口（/api/open/docs）通过 nginx 反代正常可达。

**Architecture:** 后端与前端分别写 Dockerfile（multi-stage），Nginx 反代 `/api` → 后端并托管静态 SPA；deploy.sh 自动生成带随机密钥的 `.env`、`docker compose up -d --build`；PostgreSQL 仅内部暴露、数据持久卷备份。

**Tech Stack:** Node 20 Alpine, npm, nginx 1.27 Alpine, postgres 16 Alpine, docker compose v5，bash。

---

### Task 1: 创建仓库根 `.dockerignore`（镜像上下文排除）

**Files:**
- Create: `/Users/tony/Workspace/kanban/.dockerignore`
- Verify: `docker build --no-cache .. 2>&1 | grep node_modules` 应无拷贝行为（镜像构建不包含 dist/node_modules/data 等）。

- [ ] **Step 1: 新建 `.dockerignore`**

```text
# Dependencies
**/node_modules

# Build outputs
**/dist
**/dist-ssr

# Runtime data
backend/data
backend/uploads
backend/test-data
backend/config.json

# Deployment scaffold & docs
deploy
docs

# Dev/VCS/editor
.git
.vscode
.idea
.DS_Store
Thumbs.db
.superpowers
```

- [ ] **Step 2: 验证上下文大小缩减（构建前探测）**

Run:
```bash
docker build --no-cache -f deploy/backend/Dockerfile .. 2>&1 | head -12
```
Expected: 看到 `COPY backend/package.json backend/package-lock.json`，无 COPY node_modules；构建过程中不会出现 `Cannot find package` 等错误（此步待 Dockerfile 建立后完整验证）。

- [ ] **Step 3: 提交**

```bash
git add .dockerignore
git commit -m "chore: 新增 .dockerignore（镜像上下文排除 node_modules/data/dist）"
```

---

### Task 2: 创建 backend Dockerfile

**Files:**
- Create: `/Users/tony/Workspace/kanban/deploy/backend/Dockerfile`

- [ ] **Step 1: 新建 `deploy/backend/Dockerfile`**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY backend/src backend/src
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "backend/src/server.js"]
```

- [ ] **Step 2: 构建镜像验证**

Run:
```bash
docker build --no-cache -f deploy/backend/Dockerfile -t kanban-backend-test .. 2>&1 | tail -20
```
Expected: `successfully built image kanban-backend-test`（无 COPY/权限/路径错误）。

- [ ] **Step 3: 提交**

```bash
git add deploy/backend/Dockerfile
git commit -m "chore(deploy): backend multi-stage Dockerfile（node:20-alpine，npm ci --omit=dev）"
```

---

### Task 3: 创建 frontend Dockerfile 与 nginx.conf

**Files:**
- Create: `/Users/tony/Workspace/kanban/deploy/frontend/nginx.conf`
- Create: `/Users/tony/Workspace/kanban/deploy/frontend/Dockerfile`

- [ ] **Step 1: 新建 `deploy/frontend/nginx.conf`**

```nginx
server {
    listen 80;
    server_name _;
    client_max_body_size 32m;

    root /usr/share/nginx/html;
    index index.html;

    # API 反代（保留 URI 路径）
    location /api/ {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_read_timeout 300s;
        proxy_buffering off;
    }

    # 前端 SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 2: 新建 `deploy/frontend/Dockerfile`**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app/front-end
COPY front-end/package.json front-end/package-lock.json ./
RUN npm ci
COPY front-end/ ./
RUN npm run build

FROM nginx:1.27-alpine
RUN rm -f /etc/nginx/conf.d/default.conf
COPY deploy/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/front-end/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 3: 构建镜像验证**

Run:
```bash
docker build --no-cache -f deploy/frontend/Dockerfile -t kanban-frontend-test .. 2>&1 | tail -20
```
Expected: `successfully built image kanban-frontend-test`；可继续验证静态文件是否被正确放入。

- [ ] **Step 4: 提交**

```bash
git add deploy/frontend/Dockerfile deploy/frontend/nginx.conf
git commit -m "chore(deploy): frontend multi-stage Dockerfile + nginx.conf（SPA + /api 反代）"
```

---

### Task 4: 创建 docker-compose.yml 与 .env.example

**Files:**
- Create: `/Users/tony/Workspace/kanban/deploy/docker-compose.yml`
- Create: `/Users/tony/Workspace/kanban/deploy/.env.example`
- Modify: 无需修改（`.gitignore` 已覆盖 `.env`；`.dockerignore` 已排除 `deploy/`）。

- [ ] **Step 1: 新建 `deploy/.env.example`**

```env
KANBAN_PORT=8080
POSTGRES_USER=kanban
POSTGRES_PASSWORD=
POSTGRES_DB=kanban
JWT_SECRET=
DATASOURCE_SECRET=
ADMIN_INITIAL_PASSWORD=admin123
```

- [ ] **Step 2: 新建 `deploy/docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    env_file: .env
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER}"]
      interval: 3s
      timeout: 3s
      retries: 10
    restart: unless-stopped

  backend:
    build:
      context: ..
      dockerfile: deploy/backend/Dockerfile
    env_file: .env
    environment:
      DB_TYPE: postgres
      DB_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      DATA_DIR: /data
      UPLOAD_DIR: /uploads
      PORT: "3001"
    volumes:
      - kanban_data:/data
      - kanban_uploads:/uploads
    depends_on:
      postgres:
        condition: service_healthy
    expose:
      - "3001"
    restart: unless-stopped

  frontend:
    build:
      context: ..
      dockerfile: deploy/frontend/Dockerfile
    ports:
      - "${KANBAN_PORT:-8080}:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  pgdata:
  kanban_data:
  kanban_uploads:
```

- [ ] **Step 3: 验证 compose 配置（仅 dry run）**

Run:
```bash
cd deploy && docker compose config >/dev/null && echo OK || echo FAIL
```
Expected: OK（无语法错误；依赖未注入仍通过解析）。

- [ ] **Step 4: 提交**

```bash
git add deploy/docker-compose.yml deploy/.env.example
git commit -m "chore(deploy): docker-compose.yml（postgres/backend/frontend）+ .env.example"
```

---

### Task 5: 创建 deploy.sh 一键脚本

**Files:**
- Create: `/Users/tony/Workspace/kanban/deploy/deploy.sh`
- Verify: `bash -n` + 覆盖 up/down/logs/ps 子命令，以及 `.env` 自动生成。

- [ ] **Step 1: 新建 `deploy/deploy.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ---------- helpers ----------
rand_b64() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 32 | tr -d '\n'
  else
    head -c 32 /dev/urandom | base64 | tr -d '\n/+=' | head -c 32
  fi
}

die() { echo "[error] $*" >&2; exit 1; }

# ---------- 前置检查 ----------
command -v docker >/dev/null 2>&1 || die "需要安装 docker"
docker compose version >/dev/null 2>&1 || die "需要 docker compose v2+"

# ---------- .env 生成 ----------
if [[ ! -f .env ]]; then
  echo '[deploy] 未检测到 .env，从 .env.example 生成并注入随机密钥'
  [[ -f .env.example ]] || die ".env.example 不存在"
  cp .env.example .env
  rand_jwt="$(rand_b64)"
  rand_ds="$(rand_b64)"
  rand_pg="$(rand_b64)"
  sed -i.bak -E \
    -e "s#^(JWT_SECRET=).*#JWT_SECRET=${rand_jwt}#" \
    -e "s#^(DATASOURCE_SECRET=).*#DATASOURCE_SECRET=${rand_ds}#" \
    -e "s#^(POSTGRES_PASSWORD=).*#POSTGRES_PASSWORD=${rand_pg}#" \
    .env
  # 兼容 macOS / GNU sed 产生的 .bak
  rm -f .env.bak
  echo '[deploy] .env 已生成（JWT_SECRET / DATASOURCE_SECRET / POSTGRES_PASSWORD 已自动填充）'
  echo '[deploy] 管理员初始密码：admin123（生产环境请修改 ADMIN_INITIAL_PASSWORD）'
fi

# ---------- 子命令 ----------
ACTION="${1:-up}"
shift || true

case "$ACTION" in
  up)
    docker compose up -d --build "$@"
    docker compose ps
    PORT="${KANBAN_PORT:-8080}"
    echo
    echo "[deploy] 访问地址：http://localhost:${PORT}"
    echo "[deploy] Swagger 文档：http://localhost:${PORT}/api/open/docs"
    echo "[deploy] 初始管理员：admin@kanban.local / admin123（请尽快改密）"
    ;;
  down)
    docker compose down "$@"
    ;;
  restart)
    docker compose restart "$@"
    ;;
  logs)
    docker compose logs -f "$@"
    ;;
  ps)
    docker compose ps
    ;;
  *)
    echo "用法：$0 {up|down|restart|logs|ps} [docker compose 参数]"
    exit 1
    ;;
esac
```

- [ ] **Step 2: 设置可执行权限并语法检查**

Run:
```bash
chmod +x deploy/deploy.sh
bash -n deploy/deploy.sh && echo SYNTAX_OK || echo SYNTAX_FAIL
```
Expected: SYNTAX_OK

- [ ] **Step 3: 提交**

```bash
git add deploy/deploy.sh
git commit -m "feat(deploy): deploy.sh 一键脚本（生成 .env、随机密钥、up/down/logs/ps）"
```

---

### Task 6: 集成冒烟验证（部署端到端）

**Files:** 无需新建/改动（纯验证）。
**前置条件：** Docker 可用，端口 8080 空闲。

- [ ] **Step 1: 构建并启动**

Run:
```bash
./deploy.sh up
```
Expected: 输出 `访问地址：http://localhost:8080`、`Swagger 文档`、`初始管理员` 信息；`docker compose ps` 显示三个容器均 Up。

- [ ] **Step 2: 探活**

Run:
```bash
# 前端 SPA
curl -sI http://localhost:8080 | head -1
# Swagger UI HTML
curl -s http://localhost:8080/api/open/docs/ | head -1
# 后端健康
curl -s http://localhost:8080/api/health
# spec JSON（6 端点）
curl -s http://localhost:8080/api/open/v1/openapi.json | python3 -c "import sys,json; print(sorted(json.load(sys.stdin)['paths'].keys()))"
# 登录接口
curl -s -X POST http://localhost:8080/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@kanban.local","password":"admin123"}' | python3 -c "import sys,json; print('login_ok' if json.load(sys.stdin).get('data',{}).get('accessToken') else 'login_fail')"
```
Expected: `HTTP/1.1 200 OK`、Swagger 返回 `<html`、health 返回 `{"code":0}`、6 端点列表、`login_ok`。

- [ ] **Step 3: 停机保留数据，再次 up 验证数据持久**

Run:
```bash
./deploy.sh down
sleep 2
./deploy.sh up
curl -s http://localhost:8080/api/health | python3 -c "import sys,json; print('persist_ok' if json.load(sys.stdin).get('code')==0 else 'persist_fail')"
```
Expected: `persist_ok`（PostgreSQL 卷内种子仍存在）。

- [ ] **Step 4: 完全清理**

Run:
```bash
./deploy.sh down -v
```
Expected: `Removed ...` 显示 pgdata 等卷被清除；`docker compose ps` 无容器。

- [ ] **Step 5: 提交（固定可复现信息）**

```bash
git add -A deploy/
git commit -m "test(deploy): 集成冒烟通过（构建/探活/数据持久/清理）"
```

---

### Task 7: README 补充 Docker 一键部署章节

**Files:**
- Modify: `/Users/tony/Workspace/kanban/README.md`

- [ ] **Step 1: 在「启动后端」章节之后（或目录结构之后）新增部署章节**

在 `## 目录结构` 之后、`## 多用户与权限（M1）` 之前插入：

```markdown
## Docker 一键部署

快速启动三容器全栈（postgres + backend + frontend(nginx)），无需手动安装 Node/PostgreSQL：

```bash
cd deploy
./deploy.sh          # 自动生成 .env（含随机密钥）并构建启动
./deploy.sh logs     # 查看日志
./deploy.sh down     # 停机（保留数据卷）
./deploy.sh down -v  # 停机并清除所有数据
```

- 访问地址：`http://localhost:8080`（可通过 `KANBAN_PORT` 环境变量修改）
- Swagger 文档：`http://localhost:8080/api/open/docs`
- 管理员：`admin@kanban.local / admin123`（生产环境请修改 `deploy/.env` 中的 `ADMIN_INITIAL_PASSWORD` 与密钥）
```

- [ ] **Step 2: 提交**

```bash
git add README.md
git commit -m "docs(readme): 新增「Docker 一键部署」章节"
```
