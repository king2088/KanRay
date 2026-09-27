# KanRay Kubernetes Deployment

> 中文: [README.md](./README.md)

Deploy the KanRay frontend and backend to any Kubernetes cluster with native K8s manifests.
Suitable for single-replica / small-scale production, and for local verification on any
Kubernetes distribution (kind / minikube / k3s, etc.).

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

## Architecture

The diagram above is language-neutral, so it is shown only once.

- `backend` is a stateless API: health check `GET /api/health`, horizontally scalable (raise `DB_POOL_MAX` at the same time).
- `worker` is a standalone sync process: task claiming relies on a conditional UPDATE on `sync_jobs` plus lease-based mutual exclusion, and it exits gracefully on SIGTERM.
- `frontend` is Nginx: it serves the static build output and reverse-proxies `/api/` to `backend:3001`.
- Components talk to each other over Service DNS; `DB_URL`/`REDIS_URL` point at the `postgres`/`redis` service names.

## Prerequisites

- A Kubernetes cluster (v1.24+) that `kubectl` can reach.
- Docker installed on the machine that builds the images.
- Local verification: pick any single-node distribution (kind / minikube / k3s, etc.); this document is not tied to any particular software.

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
# 1) build the images  2) deploy (a random Secret is generated on the first run; pass same-named
#     environment variables to reuse existing secrets)  3) access: port-forward / NodePort / initial admin
```

## Quick start

`deploy.sh` subcommands: `up` / `down` (`--keep-data` keeps the data) / `status` / `logs [target]`.

```bash
APP_LANG=en-US deploy/k8s/scripts/build-images.sh
APP_LANG=en-US deploy/k8s/scripts/deploy.sh up
```

## Environment Variables

The language of the **own console output** of `deploy/k8s/scripts/deploy.sh` and `deploy/k8s/scripts/build-images.sh` is controlled by the `APP_LANG` environment variable. It is deliberately not `LANG` (a POSIX variable that most systems already set — reusing it would make the output language depend on the host locale). Only the exact value `en-US` selects English; any other value (including empty / unset) falls back to Chinese.

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_LANG` | `zh-CN` | The language of both scripts' own console output. Deliberately not `LANG` (a POSIX variable that most systems already set — reusing it would make the output language depend on the host locale). Only the exact value `en-US` selects English; any other value (including empty / unset) falls back to Chinese. Valid values: `zh-CN` / `en-US` |

> **Note**: `APP_LANG` only affects the scripts' own output (check names, progress, summaries, errors); it does not change the application's UI language. The `APP_LANG=en-US` commands are listed once, above.

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

## Directory Layout

The directory tree above is language-neutral, so it is shown only once.

- **Secret `kanray-secrets`**：`JWT_SECRET` / `DATASOURCE_SECRET` / `POSTGRES_*` / `DB_URL` /
  `REDIS_URL` / `ADMIN_INITIAL_PASSWORD`。
  （JWT_SECRET / DATASOURCE_SECRET / POSTGRES_PASSWORD / POSTGRES_USER / POSTGRES_DB /

## Configuration and Secrets

- **ConfigMap `kanray-backend-config`**: non-sensitive configuration, mapped one-to-one onto the keys in `backend/src/config/index.js`.
- **Secret `kanray-secrets`**: `JWT_SECRET` / `DATASOURCE_SECRET` / `POSTGRES_*` / `DB_URL` /
  `REDIS_URL` / `ADMIN_INITIAL_PASSWORD`.
  Random values are generated automatically on the first `deploy.sh up`; to reuse existing secrets,
  pass them in as environment variables of the same name
  (JWT_SECRET / DATASOURCE_SECRET / POSTGRES_PASSWORD / POSTGRES_USER / POSTGRES_DB /
  DB_URL / REDIS_URL / ADMIN_INITIAL_PASSWORD). This deployment directory is **fully self-contained** and reads no file
  under `deploy/docker/`. To rotate secrets: delete the Secret and run `deploy.sh up` again (note that
  this changes the database password).
- Deployment images: by default `kanray-backend:1.0.0` and `kanray-frontend:1.0.0-k8s`. The `-k8s`
  suffix distinguishes them from the docker deployment images so that identically named local tags do
  not overwrite each other. When using a registry in production, set `PUSH_REGISTRY` to build and push,
  and change `image:` in each manifest to the registry path.

## Production Checklist

1. **Images**: set `PUSH_REGISTRY` to push and update `image:` in the manifests; the cluster nodes must be able to pull the images.
2. **Storage** (the most important item):
   - The default `hostPath` PVs in this repo are for **single-node** testing only. Multi-node production must replace them:
     - `kanray-data` / `kanray-uploads`: when backend and worker run **multiple replicas**, they need **ReadWriteMany** shared storage (Longhorn / NFS / CSI, etc.); with a single replica, ReadWriteOnce is enough.
     - `postgres` / `redis` data volumes: ReadWriteOnce on a cloud disk / storage class (delete `pv/hostpath-pv.yaml` and change the StatefulSets' `volumeClaimTemplates.storageClassName: ""` to a storage class name).
   - hostPath data exists only on one fixed node and has no redundancy; backups must be planned separately.
3. **Database and cache (optional managed services)**: when switching to a cloud RDS / managed Redis, just point the Secret's `DB_URL` / `REDIS_URL` at the external instance and remove the `postgres/` and `redis/` manifests (and their PVCs).
4. **Ingress**: NodePort is fine for testing. For production, prefer a LoadBalancer or enable `frontend/ingress.yaml` (the cluster must already have an Ingress Controller; remember to change `ingressClassName` and the host name).
5. **High availability**: the stateless backend can run `replicas>1` (watch the total connection count implied by `DB_POOL_MAX`); multiple worker replicas require kanray-data/uploads to be RWX, and `SYNC_MAX_CONCURRENT` is a per-process concurrency cap, so with multiple replicas the total equals replicas × that value. Data volume backups are handled by storage-layer snapshots (see "Operations"). `restartPolicy` is a pod-spec field and has nothing to do with the storage layer: neither `backend/deployment.yaml` nor `worker/deployment.yaml` sets one, so it takes the Kubernetes default `Always` — change it in the manifests yourself if you need different behaviour.
6. **Quotas and elasticity**: the manifests already carry requests/limits; adjust them as needed and configure an HPA and network policies.

  `deploy/k8s/scripts/deploy.sh down --keep-data`。

## Operations

- Rolling update: `kubectl -n kanray set image deployment/backend backend=...` (the worker stops claiming tasks within 30s and waits for in-flight tasks to finish; unfinished tasks are reclaimed by other workers once the lease times out).
- Backup: for PG use `kubectl -n kanray exec -it postgres-0 -- pg_dump -U kanray kanray`; kanray-data / kanray-uploads are handled by storage-layer snapshots.
- Wipe everything: `deploy/k8s/scripts/deploy.sh down` (including PVC/PV); to stop only the app and keep the data: `deploy/k8s/scripts/deploy.sh down --keep-data`.

## Points to Re-verify on a Real Cluster

This document has not yet been rolled out on a real cluster; verify the following on the target cluster before and after deployment:

- The schema-level validation of `kubectl apply` and the actual `rollout status` all report ready.
- The frontend's Nginx `/api/` reverse proxy forwards correctly (note that `proxy_pass` has no variable/URI, so the host name is resolved at startup).
- The PVCs auto-generated by the StatefulSets (`pgdata-postgres-0` / `redisdata-redis-0`) bind successfully to the hostPath PVs.
- How PVs that use hostPath behave in a non-single-node environment (strongly recommended: switch to shared storage / a storage class).
