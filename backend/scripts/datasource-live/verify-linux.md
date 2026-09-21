# Linux 真连准备文档（db2/dameng/impala/hive/maxcompute）

在 Linux 上对 5 个「原生驱动家族」做真实环境测试。
macOS arm64 缺 ibm_db/odbc 原生驱动，因此走本流程。

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

#### aarch64 无官网驱动时的取法（本文档实测机）

官网只提供 x86 驱动包；arm64 可从 `dm8-arm64` 容器镜像内直接提取：

```bash
docker pull swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/qinchz/dm8-arm64:latest-linuxarm64
# 镜像内驱动目录通常在 /opt/dmdbms/bin，提取到宿主 /home/<user>/dm-odbc：
docker create --name dm-extract <image>
docker cp dm-extract:/opt/dmdbms/bin/libdodbc.so   /home/<user>/dm-odbc/
docker cp dm-extract:/opt/dmdbms/bin/libdmdpi.so   /home/<user>/dm-odbc/
docker cp dm-extract:/opt/dmdbms/bin/libdmfldr.so  /home/<user>/dm-odbc/
docker cp dm-extract:/opt/dmdbms/bin/libcrypto.so  /home/<user>/dm-odbc/
docker cp dm-extract:/opt/dmdbms/bin/libssl.so     /home/<user>/dm-odbc/
docker rm dm-extract
```

容器内运行时把 `/home/<user>/dm-odbc` 挂载为 `/dm-odbc`，并设 `LD_LIBRARY_PATH=/dm-odbc`；
`odbcinst.ini` 的 `Driver=/dm-odbc/libdodbc.so`。

> 密码：该镜像默认口令实为 `SYSDBA`（非文档常写的 SYSDBA001），需进容器用 `disql` 改成配置期望的口令。
> 连接串：unixODBC 的 `SQLDriverConnect` 必须显式带 `DRIVER=DM8;`（provider 已补默认值，见下）。

## 3. 启动 Docker 数据库（16 容器，含 Impala quickstart 四服务）

```bash
cd <repo>/backend/scripts/datasource-live
docker compose pull
docker compose up -d            # 启动全部；或只启原生族：
docker compose up -d hive db2 dameng impala-hms impala-statestored impala-catalogd impala-impalad
# 等待 healthy：docker compose ps（db2/dm 首次初始化约 1-3 分钟）
```

- DB2：`db2inst1 / Kanban@123`，库 `TESTDB`（首次自动建）。
- 达梦：`SYSDBA / SYSDBA001`，端口 5236。
- Hive：HS2 `127.0.0.1:11000`，内嵌 Derby metastore。
  - 镜像默认用相对路径 `metastore_db`（实际 `/opt/hive/metastore_db`，位于容器层）。
  - 重启时 entrypoint 会再次 `initSchema` 并因 `NUCLEUS_ASCII already exists` 退出；
    compose 已用标记文件 `/opt/hive/.hive_schema_ok` 判断：首次初始化，之后 `IS_RESUME=true` 跳过。
  - **必须 `auth_type=plain`**（SASL PLAIN）；见第 6 节。
- Impala：官方 quickstart **四服务**（`impala-hms`/`impala-statestored`/`impala-catalogd`/`impala-impalad`），
  HS2 `127.0.0.1:21050`。Docker Hub 无 4.1.0、也无单容器镜像，只有 `apache/impala:4.5.0-<role>`；
  国内直连 Docker Hub 不通时给镜像加镜像站前缀（如 `docker.m.daocloud.io/`），
  配置见 `quickstart_conf/hive-site.xml`（`hive.metastore.uris=thrift://quickstart-hive-metastore:9083`）。

## 4. 跑真连用例

```bash
cd backend
# 全量真连（含 10 族浏览+查询，mysql/mssql 6500 行 keyset 全量同步，
#         db2/dameng/impala 建表→浏览→全量同步，hive HS2 建表→浏览→全量同步）
node scripts/datasource-live/live-e2e.mjs
```

脚本会自动给空库预植幂等种子表（`live_seed`/ES 索引），全新容器也能通过浏览+查询。

### aarch64（Fedora 42 + qemu）实测结果 2026-09-21

同一脚本在两个容器内跑（宿主 arm64，缺 x86 原生驱动时自动友好降级/SKIP）：

- **arm64 容器**（node:22-slim，`odbc` + `better-sqlite3` 源码编译，挂载 arm64 依赖副本）：**14 PASS / 0 FAIL**
- **amd64 容器**（node:22-slim，qemu，`ibm_db` x86）：**13 PASS / 0 FAIL**

```
[PASS] mysql / mariadb / tidb / postgres / clickhouse 浏览+查询（预植后命中真表）
[PASS] presto(trino) 浏览+查询 schema=information_schema table=applicable_roles
[PASS] elasticsearch 浏览+查询 schema=live_seed 列2 行1
[PASS] db2 真连（amd64 容器）：浏览+查询 schema=DB2INST1 table=LIVE_ORDERS 列3 行5
[PASS] DB2 真连全量同步 → 本地 101 行
[PASS] dameng 真连（arm64 容器）：浏览+查询 schema=SYSDBA table=LIVE_ORDERS 列3 行5
[PASS] 达梦 DM 真连全量同步 → 本地 100 行
[PASS] MySQL / SQL Server 真实全量同步 6500 行 → 本地 6500 行（keyset 分页）
[SKIP] hive HS2 openSession 超时（上游 AHA 兼容问题，Linux/Mac 一致复现）
[SKIP] Impala（apache/impala:4.1.0 仅 amd64，CN 镜像源无可用源）
[SKIP] MaxCompute（未提供 MC_* 环境变量——需阿里云账号）
```

结论：**db2 与 dameng 原生族均在 Linux 上真连跑通**（浏览/查询/建表/全量同步）。
db2 需 x86_64（ibm_db 拒绝 arm64），dameng 可在 arm64 上真连（见下方驱动取法）。

### impala/hive 补测结果 2026-09-21（arm64 容器）

上表两处 SKIP 已定位并修复，同一 arm64 容器复跑：**10 PASS / 1 FAIL**
（唯一 FAIL 为内存不足被停掉的 SQL Server 容器，与本次改动无关）。

```
[PASS] hive HS2 真实连接 浏览+查询 schema=default 列3 行2
[PASS] hive HS2 真实全量同步 本地 2 行
[PASS] Impala 真连 浏览+查询 schema=default table=live_orders 列3 行5
[PASS] Impala 真连全量同步 → 本地 10 行
```

Impala 集群：`apache/impala:4.5.0-{impala_quickstart_hms,statestored,catalogd,impalad_coord_exec}`
（经 `docker.m.daocloud.io` 镜像站拉取），四容器 `mem_limit=2gb`、`JAVA_TOOL_OPTIONS=-Xmx1g`。

### 本次修复的 provider 缺陷

- `dameng.js`：
  - `connString` 补 `DRIVER=<name>;`（unixODBC 的 `SQLDriverConnect` 不带 DRIVER/DSN 会报
    「Data source name not found」）。
  - `listSchemas` 由 `ALL_TABLES` 改 `ALL_USERS`（并把当前用户排首位）。
  - `listTables` 由 `ALL_TABLES` 改 `SYSOBJECTS t JOIN SYSOBJECTS s`（`s.TYPE$='SCH'`）按 schema 过滤。
  - **原因**：DM arm64 ODBC 驱动对 `ALL_TABLES` 视图的 prepare/execute **必然失败**（与参数无关）；
    `ALL_TAB_COLUMNS`/`ALL_USERS`/`SYSOBJECTS`/`USER_TABLES` 正常。
- `db2.js`：`connString` 支持可选 `SECURITY=` 段。
- `live-e2e.mjs`：dameng 段改为幂等（`DROP TABLE IF EXISTS` 后由 insertFn 建表）+ 预植种子表
  `LIVE_SEED`；`odbc` 可加载但未注册 `[DM8]` 时优雅 SKIP 而非 FAIL。
  Impala/hive 段同样改为幂等（`DROP TABLE IF EXISTS` + `CREATE TABLE`），否则重复运行时
  源表累积重复主键，导致本地同步表 `UNIQUE constraint failed`。
- `hs2.js`（Impala fetch 报错）：
  - `execute` 统一显式传 `utils.fetchAll(op, FETCH_NEXT)`。
  - **原因**：hive-driver 内部 `FetchOrientation.FETCH_NEXT=1`，与其 thrift 生成枚举
    `TFetchOrientation.FETCH_NEXT=0` **不同**；`HiveOperation.fetch` 依据内部枚举判断方向，
    不传则默认走 `firstFetch()`（线缆上发 `FETCH_FIRST`）。Impala 收到 `FETCH_FIRST` 会调用
    `RestartFetch()`，未开启 query result caching 时直接报
    `Restarting of fetch requires enabling of query result caching.`（DROP/CREATE/SELECT 全中，
    INSERT 无结果集故不报）。Hive/Impala 均支持 `FETCH_NEXT`，故统一用之。
- `hs2.js`（Hive openSession 挂起）：
  - `makeAuth` 的 plain 分支改用 `cfg.username || cfg.user`（UI 字段名是 `user`）。
  - **原因**：HiveServer2 3.x 二进制传输即使 `hive.server2.authentication=NONE` 也走 SASL 分帧
    （`TSaslTransport`）；而 hive-driver 的 `NoSaslAuthentication` 用 `TBufferedTransport`（无分帧），
    服务端无法解析请求 → `openSession` 永久挂起。改用 `auth_type=plain`（SASL PLAIN +
    `TFramedTransport`）即可；Impala 接受 TBuffered，故 `none` 仍可用。
- `drivers.js`：Hive 的 `auth_type` 选项补 `plain` 并设为默认（`none` 对 Hive 3.x 实际不可用）。

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

- hive-driver 1.0.1 × HiveServer2 二进制 openSession「挂起」并非上游缺陷，而是**认证模式选择错误**：
  Hive 3.x 即使 `auth=NONE` 也要 SASL 分帧，须配 `auth_type=plain`（SASL PLAIN）才能建会话；
  用默认 `none`（`TBufferedTransport`）会永久挂起。Impala 对两者都接受，故 `none` 可用于 Impala。
  另：hive-driver 的 `FETCH_NEXT` 内部枚举值（1）与 thrift 枚举（0）不同，provider 已显式传内部值。
- db2 社区镜像需要 privileged + amd64；`TESTDB` 为内置示例库。
- 三族（db2/dameng/impala）真连同步仅验证小数据量（100/100/10 行）全量链路；
  >5000 行 keyset 分页已在 MySQL/SQL Server 真库上验证。
- **aarch64 原生驱动限制（本文档实测机）**：
  - `ibm_db` 直接拒绝 arm64（"ARM64 processor is not supported on linux platform"），
    DB2 真连须在 **x86_64**（或 amd64 容器）内 `npm i ibm_db`。
  - `odbc` 可在 arm64 源码编译（需 g++/make/python3/unixodbc-dev），DM 驱动从
    `dm8-arm64` 镜像提取（见第 2 节），无需官网 x86 包。
  - **DM arm64 ODBC 驱动对 `ALL_TABLES` 视图不可用**（prepare/execute 必败），
    provider 已改用 `SYSOBJECTS` 自关联；如换用其他驱动版本请回归验证。
- **aarch64 + qemu 限制**：
  - mssql 容器必崩（SQL Server on Linux 仅 x86_64），其 keyset 同步只能在 x86 平台验证。
  - Impala 无单容器镜像：Docker Hub 只有 `apache/impala:4.5.0-<role>` quickstart 四服务。
    直连 Docker Hub 超时，经 `docker.m.daocloud.io/apache/impala:4.5.0-*` 可拉取；
    `docker.1ms.run`/`dockerproxy.net` 也可用，`ddn-k8s` 镜像现需登录。
    四容器合计约 4-5 GiB 内存，低内存机建议 `mem_limit=2gb` + `JAVA_TOOL_OPTIONS=-Xmx1g`。
  - 达梦镜像：`swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/qinchz/dm8-arm64:latest-linuxarm64`
    （arm64）可直接拉取；`qinjx/dm8-single`（x86）在华为云需认证，暂不可用。