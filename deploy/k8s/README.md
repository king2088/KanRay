# KanRay Kubernetes 部署

> English: [README_EN.md](./README_EN.md)

将 KanRay 前后端以原生 K8s 清单部署到任意 Kubernetes 集群。适用单副本/小规模生产，
以及任意 Kubernetes 发行版（kind / minikube / k3s 等）做本地验证。

## 架构

```
                    ┌──────────────────────── 命名空间 kanray ───────────────────────┐
浏览器 ──NodePort:30080 / Ingress──▶ frontend (nginx 容器 :8080，Service :80)         │
                                        │  /api/ 反代                                  │
                                        ▼                                             │
  backend (kanray-backend:1.0.0, :3001)  ◀────  API 路由 /api/health 探针             │
  worker  (kanray-backend:1.0.0, backend/src/worker/main.js)                          │
        │ 共享卷：kanray-data (/data) · kanray-uploads (/uploads)                     │
        ▼                                                                             │
  postgres:5432 (StatefulSet) ── 元数据 / 同步任务队列（sync_jobs 租约互斥）          │
  redis:6379   (StatefulSet) ── 缓存 / 分布式锁                                       │
                                                                                      ┘
```

- `backend` 无状态 API：健康检查 `GET /api/health`，可水平扩容（同时调大 `DB_POOL_MAX`）。
- `worker` 独立同步进程：任务领取靠 `sync_jobs` 条件 UPDATE + 租约互斥，SIGTERM 优雅退出。
- `frontend` 为 Nginx：托管静态产物并反代 `/api/` 到 `backend:3001`。
- 组件间通过 Service DNS 通信，`DB_URL`/`REDIS_URL` 指向 `postgres`/`redis` 服务名。

## 前置要求

- 一个 Kubernetes 集群（v1.24+），`kubectl` 可访问。
- 构建镜像所在机器装有 Docker。
- 本地验证：任选单节点发行版（kind / minikube / k3s 等）；本文档不绑定任何具体软件。

## 快速开始

```bash
# 1) 构建镜像（默认 kanray-backend:1.0.0 + kanray-frontend:1.0.0-k8s；
#    ImagePullPolicy=IfNotPresent 从本地/节点加载）
deploy/k8s/scripts/build-images.sh

# 2) 部署（首次自动生成随机密钥 Secret，不读取其他部署目录；需要既有密钥时用同名环境变量传入）
deploy/k8s/scripts/deploy.sh up

# 3) 访问
#    端口转发：kubectl -n kanray port-forward svc/frontend 8080:80  →  http://localhost:8080
#    NodePort：http://<节点IP>:30080
#    初始管理员：admin@kanray.local / admin123（请尽快改密）
# EN: 1) build the images  2) deploy (a random Secret is generated on the first run; pass same-named
#     environment variables to reuse existing secrets)  3) access: port-forward / NodePort / initial admin
```

`deploy.sh` 子命令：`up` / `down`（`--keep-data` 保留数据）/ `status` / `logs [目标]`。

## 环境变量

`deploy/k8s/scripts/deploy.sh` 与 `deploy/k8s/scripts/build-images.sh` **自身控制台输出**的语言由环境变量 `APP_LANG` 控制。刻意不用 `LANG`（POSIX 标准变量，多数系统已被占用，复用会让输出语言取决于宿主机 locale）。仅精确取值 `en-US` 时输出英文；其他任意取值（含空值 / 未设置）一律回退中文。

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `APP_LANG` | `zh-CN` | 两个脚本自身控制台输出的语言。刻意不用 `LANG`（POSIX 标准变量，多数系统已被占用，复用会让输出语言取决于宿主机 locale）。仅精确取值 `en-US` 时输出英文；其他任意取值（含空值 / 未设置）一律回退中文。有效值：`zh-CN` / `en-US` |

```bash
APP_LANG=en-US deploy/k8s/scripts/build-images.sh
APP_LANG=en-US deploy/k8s/scripts/deploy.sh up
```

> **注意**：`APP_LANG` 只影响脚本自身输出（校验项名称、进度、汇总、报错），不影响应用界面语言。

## 目录结构

```
deploy/k8s/
├── base/
│   ├── namespace.yaml        # 命名空间 kanray
│   ├── configmap.yaml        # 非敏感运行配置（DB_TYPE/SYNC_*/TIMEZONE/OPEN_API_*）
│   └── secret.yaml.example   # Secret 键清单（实际值由 deploy.sh 幂等生成，不落盘）
├── postgres/                 # StatefulSet + Service（PostgreSQL 16）
│   ├── statefulset.yaml
│   └── service.yaml
├── redis/                    # StatefulSet + Service（Redis 7, AOF）
│   ├── statefulset.yaml
│   └── service.yaml
├── pv/
│   ├── hostpath-pv.yaml      # 单节点测试用 hostPath PV（勿用于多节点生产）
│   └── pvc.yaml              # kanray-data / kanray-uploads（backend 与 worker 共享）
├── backend/
│   ├── deployment.yaml       # Deployment（:3001, /api/health 探针）
│   ├── service.yaml          # Service（:3001）
│   └── Dockerfile            # k8s 专属后端镜像（构建自仓库根）
├── worker/
│   └── deployment.yaml       # Deployment（同步 worker）
├── frontend/
│   ├── deployment.yaml       # Deployment（:8080）
│   ├── service.yaml          # NodePort Service（port 80 → targetPort 8080，nodePort 30080）
│   ├── ingress.yaml          # 可选 Ingress（生产入口示例，默认不 apply）
│   ├── Dockerfile            # k8s 专属前端镜像
│   ├── nginx-main.conf       # nginx 主配置（COPY 为 /etc/nginx/nginx.conf；非 root 运行，临时文件路径迁到 /tmp）
│   └── nginx.conf            # server 段（COPY 为 conf.d/default.conf）：listen 8080，/api/ → backend:3001（直写，K8s Service 稳定）
└── scripts/
    ├── build-images.sh       # 构建 kanray-backend / kanray-frontend:*-k8s 镜像（可选 PUSH_REGISTRY）
    └── deploy.sh             # 部署命令行入口
```

## 配置与密钥

- **ConfigMap `kanray-backend-config`**：非敏感配置，与 `backend/src/config/index.js` 键一一对应。
  首次 `deploy.sh up` 时自动生成随机值；需要复用既有密钥时，用同名环境变量传入
  DB_URL / REDIS_URL / ADMIN_INITIAL_PASSWORD）。本部署目录**完全自包含**，不读取 `deploy/docker/` 下的任何文件。
  轮换密钥：删除 Secret 后重新 `deploy.sh up`（注意会改动数据库口令）。
- 部署镜像：默认 `kanray-backend:1.0.0` 与 `kanray-frontend:1.0.0-k8s`。`-k8s` 后缀用于与
  docker 部署镜像区分，避免本地同名 tag 互相覆盖。生产用注册表时设置 `PUSH_REGISTRY`
  构建推送，并把各清单 `image:` 改为注册表路径。

## 生产化清单

1. **镜像**：设置 `PUSH_REGISTRY` 推送并更新清单 `image:`；集群节点应能拉取镜像。
2. **存储**（最重要）：
   - 本仓库默认 `hostPath` PV 仅供**单节点**测试。多节点生产必须替换：
     - `kanray-data` / `kanray-uploads`：backend 与 worker **多副本**时需要 **ReadWriteMany**
       共享存储（Longhorn / NFS / CSI 等）；单副本时保持 ReadWriteOnce 即可。
     - `postgres` / `redis` 数据卷：ReadWriteOnce，用云盘/存储类（删除
       `pv/hostpath-pv.yaml`，把 StatefulSet 的 `volumeClaimTemplates.storageClassName: ""`
       改为存储类名）。
   - hostPath 数据仅存在于固定节点，且无冗余；备份必须单独规划。
3. **数据库与缓存（可选托管）**：改用云 RDS / 托管 Redis 时，只需把 Secret 的 `DB_URL` /
   `REDIS_URL` 指向外部实例，并移除 `postgres/`、`redis/` 清单（及对应 PVC）。
4. **入口**：NodePort 适合测试。生产建议 LoadBalancer 或启用 `frontend/ingress.yaml`
   （需集群已装 Ingress Controller，注意改 `ingressClassName` 与域名）。
5. **高可用**：backend 无状态可 `replicas>1`（留意 `DB_POOL_MAX` 总连接）；worker 多副本
   依赖 kanray-data/uploads 为 RWX，且 `SYNC_MAX_CONCURRENT` 是单进程并发上限，多副本时
   总量=副本数×该值。数据卷备份由存储层快照保证（见「运维」）。`restartPolicy` 是 Pod spec 字段，与存储层无关：
   `backend/deployment.yaml` 与 `worker/deployment.yaml` 均未设置，取 K8s 默认值 `Always`，需要别的行为请自行在清单中改写。
6. **配额与弹性**：清单已带 requests/limits，可按需调整并配置 HPA 与网络策略。

## 运维

- 滚动更新：`kubectl -n kanray set image deployment/backend backend=...`（worker 会在 30s
  内停止领取并等待在途任务结束，未完成任务由租约超时回收到其他 worker）。
- 备份：PG 用 `kubectl -n kanray exec -it postgres-0 -- pg_dump -U kanray kanray`；
  kanray-data / kanray-uploads 由存储层快照。
- 完全清空：`deploy/k8s/scripts/deploy.sh down`（含 PVC/PV）；只停应用保留数据：

## 建议在真集群复验的点

本文档尚未在真实集群实际 rollout，以下点建议部署前/后在目标集群验证：

- `kubectl apply` 的 schema 级校验与实际 `rollout status` 全部就绪。
- frontend 的 Nginx `/api/` 反代能正确转发（注意 proxy_pass 不带变量/URI，主机名启动时解析）。
- StatefulSet 自动生成的 PVC（`pgdata-postgres-0` / `redisdata-redis-0`）与 hostPath PV 绑定成功。
- 非单节点环境使用 hostPath 的 PV 绑定行为（强烈建议直接换共享存储/存储类）。
