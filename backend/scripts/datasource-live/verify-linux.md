# Linux 真连准备文档（db2/dameng/impala/hive/maxcompute）

在 Linux 上对 5 个「原生驱动家族」做真实环境测试。
macOS arm64 缺 ibm_db/odbc 原生驱动且 hive-driver×HS2 有上游兼容问题，因此走本流程。

> 实测环境：Fedora 42 **aarch64**（4 核 / 8.9Gi）、docker + qemu amd64 模拟。
> 注意：本机为 arm64 —— ibm_db 编译期直接拒绝（"ARM64 processor is not supported on linux platform"），
> odbc 的 node-pre-gyp 也会失败；仅在 **x86_64** 主机（或用 Rosetta/amd64 容器）可装。
> 若宿主是 x86_64，跳过「已知边界」里的 arm64 限制即可。

## 1. 系统依赖（apt/Ubuntu 为例）

```bash
sudo apt update
sudo apt install -y build-essential python3 g++ make unixODBC unixodbc-dev \
  git curl ca-certificates docker.io docker-compose-v2
```

## 2. 前端源码与原生驱动

```bash
# 首次只安装 js 常规依赖（不触发原生编译，供 verify/dialect 等用即可）
npm install

# 原生驱动（会本地编译，需要 build-essential）：
cd backend
npm install ibm_db        # DB2；依赖 gcc/g++；约 2-5 分钟
npm install odbc          # 达梦 DM；需要 unixODBC（已装）
npm install hive-driver   # Hive/Impala HS2（纯 JS，Mac 上已装）
```

### 达梦 DM ODBC 驱动注册（odbcinst.ini）

odbc npm 走 unixODBC，需要 DM ODBC 驱动。从达梦官网下载 Linux(x86) ODBC 驱动包解压，
再在 `~/.odbcinst.ini` 或 `/etc/odbcinst.ini` 登记：

```ini
[DM8]
Description = DM ODBC Driver
Driver = /opt/dm/dmdbms/bin/libdodbc.so
```

验证：`isql -v DM8 SYSTEM SYSDBA001` 能连上 5236 端口即 OK。

## 3. 启动 Docker 数据库（13 容器）

```bash
cd <repo>/backend/scripts/datasource-live
docker compose pull
docker compose up -d            # 启动全部；或只启原生族：
docker compose up -d hive db2 dameng impala
# 等待 healthy：docker compose ps（db2/dm 首次初始化约 1-3 分钟）
```

- DB2：`db2inst1 / Kanban@123`，库 `TESTDB`（首次自动建）。
- 达梦：`SYSDBA / SYSDBA001`，端口 5236。
- Impala：单节点镜像，HS2 21050。若 4.1.0 启动参数有变，参考镜像 README 调整。
- Hive：HS2 11000，内嵌 Derby metastore。

## 4. 跑真连用例

```bash
cd backend
# 全量真连（含 10 族浏览+查询，mysql/mssql 6500 行 keyset 全量同步，
#         db2/dameng/impala 建表→浏览→全量同步，hive HS2 带 60s 超时保护）
node scripts/datasource-live/live-e2e.mjs
```

脚本会自动给空库预植幂等种子表（`live_seed`/ES 索引），全新容器也能通过浏览+查询。

### aarch64（Fedora 42 + qemu）实测结果 2026-09-20：10 PASS / 1 FAIL

```
[PASS] mysql / mariadb / tidb / postgres / clickhouse 浏览+查询（预植后命中真表）
[PASS] presto(trino) 浏览+查询 schema=information_schema table=applicable_roles
[PASS] elasticsearch 浏览+查询 schema=live_seed 列2 行1
[PASS] db2 / dameng 原生驱动缺失 → 友好报错（ibm_db 拒绝 arm64；odbc 无驱动）
[PASS] MySQL 真实全量同步 6500 行 → 本地 6500 行（keyset 分页）
[SKIP] hive HS2 openSession 超时（上游 AHA 兼容问题，Linux/Mac 一致复现）
[SKIP] DB2/达梦/Impala 真连（arm64 装不了原生驱动；impala/dm8 镜像在 CN 镜像源 403/not-found）
[SKIP] MaxCompute（未提供 MC_* 环境变量——需阿里云账号）
[FAIL] SQL Server 真实全量同步 —— 镜像在 arm64+qemu 下 Segfault（Exited 139）
```

结论：x86_64 原生族跑通（浏览/查询/真同步）；hive 服务端容器健康与否不影响判断，
HS2 驱动层超时两平台一致复现，属上游问题。

## 5. MaxCompute（阿里云，无容器）——用真实账号

填环境变量再跑同一脚本（脚本会检测到并自动执行 maxcompute 段）：

```bash
export MC_ENDPOINT='https://service.cn-hangzhou.maxcompute.aliyun.com/api'
export MC_ACCESS_KEY_ID='LTAI...'
export MC_ACCESS_KEY_SECRET='...'
export MC_PROJECT='your_project'
export MC_TABLE='your_table'   # 可选：再跑一次 listColumns + runQuery
node scripts/datasource-live/live-e2e.mjs
```

## 6. 已知边界

- hive-driver 1.0.1 × HiveServer2 二进制 openSession 存在上游兼容问题（上游 AHA）。
  macOS 实测 JDBC beeline 可连、驱动层挂起；若 Linux 上仍复现，脚本超时后归 SKIP，
  可改用 Impala（同 HS2 协议）覆盖。
- db2 社区镜像需要 privileged + amd64；`TESTDB` 为内置示例库。
- 三族（db2/dameng/impala）真连同步仅验证小数据量（100/100/10 行）全量链路；
  >5000 行 keyset 分页已在 MySQL/SQL Server 真库上验证。
- **aarch64 + qemu 限制（本文档实测机）**：
  - mssql 容器必崩（SQL Server on Linux 仅 x86_64），其 keyset 同步只能在 x86 平台验证。
  - `apache/impala:4.1.0`、`qinjx/dm8-single` 在可用镜像源（daocloud/1ms/1panel/rat.dev 等）
    全部 403/not-found（直连 Docker Hub 超时）；dm8 已改 `docker.io/qinjx/dm8-single` 待 x86 机拉取。
  - 若需覆盖 db2/dameng 真连，改用 x86_64（或 amd64 容器内 npm i ibm_db/odbc），
    DM 的 `libdodbc.so` 需官网注册下载；DB2 client 由 ibm_db 从 IBM CDN 拉取。