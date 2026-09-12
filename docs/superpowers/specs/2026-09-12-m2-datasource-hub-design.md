# M2 数据源接入（多数据库）设计

> 日期：2026-09-12 ｜ 分支：`feature/m2-datasources` ｜ 状态：已评审通过
> 上游需求：`需求清单-第二阶段.md` 3.1 多数据源接入（DB-01~05）+ 3.2 物理数据集（DS-01）

## 1. 目标

数据源中心支持接入用户清单中的数据库/数据源（清单 23 项、去重后 22 种，人大金仓在「关系型」与「国产」重复列出，按一种计），采用**统一架构（驱动注册表 + 协议族 Provider）**，本期用本地 Docker **实测核心 8 种**，并打通「添加数据源 → 测试连接 → Schema 浏览 → 从表创建数据集 → 图表/看板可用」的完整闭环。

## 2. 范围

### 2.1 接入清单（三档状态）

| 数据源 | 分类 | 协议族 | 状态 | 能力（连接测试/浏览/建数据集） |
| --- | --- | --- | --- | --- |
| MySQL | 关系型 | mysql | ✅ 已实测 | ✓ / ✓ / ✓ |
| PostgreSQL | 关系型 | pg | ✅ 已实测 | ✓ / ✓ / ✓ |
| SQL Server | 关系型 | mssql | ✅ 已实测 | ✓ / ✓ / ✓ |
| MariaDB | 关系型 | mysql | ✅ 已实测 | ✓ / ✓ / ✓ |
| TiDB | 关系型·国产 | mysql | ✅ 已实测 | ✓ / ✓ / ✓ |
| ClickHouse | 分析型 | clickhouse-http | ✅ 已实测 | ✓ / ✓ / ✓ |
| Elasticsearch | 其他 | es-rest | ✅ 已实测(受限) | ✓ / ✓ / ✗（建数据集排后续） |
| API/Web Service | 其他 | http | ✅ 已实测(受限) | ✓ / ✗ / ✗（仅连接探测） |
| Apache Doris | 分析型 | mysql | 🟡 协议兼容 | ✓ / ✓ / ✓（未实机验证） |
| StarRocks | 分析型 | mysql | 🟡 协议兼容 | ✓ / ✓ / ✓（未实机验证） |
| Greenplum | 关系型 | pg | 🟡 协议兼容 | ✓ / ✓ / ✓（未实机验证） |
| 人大金仓 KingbaseES | 关系型·国产 | pg | 🟡 协议兼容 | ✓ / ✓ / ✓（未实机验证） |
| GaussDB | 国产 | pg | 🟡 协议兼容 | ✓ / ✓ / ✓（未实机验证） |
| Amazon Redshift | 其他 | pg | 🟡 协议兼容 | ✓ / ✓ / ✓（未实机验证） |
| Oracle | 关系型 | — | ⚪ 待接入 | 注册占位，UI 禁用 |
| DB2 | 关系型 | — | ⚪ 待接入 | 注册占位，UI 禁用 |
| 达梦 DM | 国产 | — | ⚪ 待接入 | 注册占位，UI 禁用 |
| 南大通用 GBASE | 国产 | — | ⚪ 待接入 | 注册占位，UI 禁用 |
| Apache Hive | 分析型 | — | ⚪ 待接入 | 注册占位，UI 禁用 |
| Apache Impala | 分析型 | — | ⚪ 待接入 | 注册占位，UI 禁用 |
| Presto | 分析型 | — | ⚪ 待接入 | 注册占位，UI 禁用 |
| 阿里云 MaxCompute | 其他 | — | ⚪ 待接入 | 注册占位，UI 禁用 |

- 🟡 协议兼容：与 MySQL/PG 族**同一代码路径**，架构默认可用，UI 标注「协议兼容·未实机验证」。
- ⚪ 待接入：注册表占位、UI 禁用。原因：Oracle/DB2/达梦/GBASE 需厂商驱动且无公开 Docker 镜像；Hive/Impala Node 生态弱（thrift）；Presto/MaxCompute 走专用 REST 协议，排后续里程碑。

### 2.2 功能范围

**包含**：数据源 CRUD、启停、连接测试（含失败原因）、Schema/表/字段浏览、从表创建物理数据集、图表/看板直接使用 SQL 数据集。

**不包含（排后续）**：虚拟数据集（DS-02 SQL 定义）、计算指标（DS-04）、ES/API 数据集化、SSL/TLS 配置（DB-06）、数据源级共享授权（DB-07，本期仅 owner 隔离）、连接监控（DB-08）。

## 3. 架构

### 3.1 后端组件

```
backend/src/datasources/
  drivers.js            # 22 种元数据注册表：{ type, name, category, family, status,
                        #   capabilities:{test,browse,dataset}, defaultPort, fields:[表单字段schema], domestic? }
  crypto.js             # AES-256-GCM 加解密（密钥 env DATASOURCE_SECRET，dev 默认值）
  dialects.js           # 各族 SQL 方言：quoteIdent / limit / dateTrunc / typeMapping / 聚合表达式
  providers/
    index.js            # getProvider(family) + 连接池缓存（按 datasource id + config hash 失效）
    mysql-family.js     # mysql2/promise 池（3306/4000/9030）
    pg-family.js        # pg Pool（5432/54321/8000/5439）
    clickhouse.js       # 原生 HTTP（8123），无新依赖
    mssql.js            # mssql 包（tedious，纯 JS）
    elasticsearch.js    # REST：_cluster/health + _cat/indices + _mapping
    api-service.js      # 通用 HTTP 探测（可配 method/headers/期望状态码）
```

- 统一 provider 接口：`testConnection(cfg)`、`listSchemas(cfg)`、`listTables(cfg, schema)`、`listColumns(cfg, schema, table)`、`runQuery(cfg, sql, params)`。`capabilities.browse=false` 的驱动仅实现 `testConnection`，浏览与查询接口不实现。
- 新增依赖仅 3 个：`mysql2`、`pg`、`mssql`。

### 3.2 数据流

```
前端数据源页 → /api/datasources → datasource.service → provider.testConnection → 目标库
Schema 树 → /:id/schemas|tables|columns → provider → information_schema/system catalog
从表建数据集 → /:id/register-table → dataset.service 创建 source_type='sql' 数据集
图表渲染 → /api/charts/:id/data → query-engine 分派：
    source_type='excel' → 现有 SQLite 聚合（不变）
    source_type='sql'  → SqlDataProvider（方言建 SQL → provider 池执行 → {columns,rows}）
```

## 4. 数据模型变更

- 新表 `data_sources`：`id, name, type, config TEXT(JSON,密码字段加密), is_active INTEGER, owner_id INTEGER, last_test_at TEXT, last_test_ok INTEGER, last_test_msg TEXT, created_at, updated_at`；索引 `(owner_id)`、`(type)`。
- `datasets` 增列（幂等 ALTER）：`source_type TEXT NOT NULL DEFAULT 'excel'`、`datasource_id INTEGER`、`schema_name TEXT`、`table_name TEXT`。
- `access.service` 的 `RESOURCE_TABLES` 增加 `datasource → data_sources`（owner 隔离，admin 全量）。

## 5. API（`/api/datasources`，`requireUser` + `requirePermission('datasource', *)`）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/drivers` | 22 类型元数据（分类/状态/能力/字段 schema） |
| GET | `/` | 列表（owner 隔离；config 脱敏，仅回显非敏感字段） |
| POST | `/` | 创建（zod 校验；密码加密入库；仅保存，前端通常先调 `/test` 再保存） |
| GET | `/:id` | 详情（密码掩码，不回传明文） |
| PATCH | `/:id` | 更新（密码留空=不变；`is_active` 启停同接口） |
| DELETE | `/:id` | 删除（被数据集引用时拒绝并提示数量） |
| POST | `/test` | 测试未保存配置 `{type, config}` |
| POST | `/:id/test` | 测试已保存，回写 `last_test_*` |
| GET | `/:id/schemas` | `[{name}]` |
| GET | `/:id/schemas/:schema/tables` | `[{name, type:table\|view}]` |
| GET | `/:id/schemas/:schema/tables/:table/columns` | `[{name, type, role:dimension\|metric}]` |
| POST | `/:id/register-table` | `{schema, table, name}` → 创建 SQL 数据集 |

- 写操作（增/改/删/启停）与连接测试记审计（复用 audit.service）。
- 越权：非 owner 且非 admin 访问 → 403（assertResource）；无 `datasource:*` 权限 → 403。

## 6. 查询引擎集成

- `dialects.js` 每族实现：`quoteIdent`（mysql `` ` ``；pg/clickhouse `"`；mssql `[]`）、`limit`（`LIMIT n`；mssql `TOP n`）、`dateTrunc(field, unit)`（`DATE_FORMAT` / `DATE_TRUNC` / `toStartOfMonth` / `DATETRUNC`）、维度分组、聚合（sum/avg/count/countd/max/min）、排序与 `?` 参数占位。
- `SqlDataProvider`：`buildAggSql(dataset, {dimensions, metrics, filters, sort, limit})` → `runQuery` → 统一返回 `{columns:[{name,label,type}], rows:[...]}`，与 Excel 路径完全一致。
- `query-engine.js` 按 `dataset.source_type` 分派，**图表/看板/筛选联动层零改动**。
- 标识符安全：schema/table/column 只允许来自 catalog 查询的白名单值，禁止任意字符串拼接进 SQL；值过滤全走参数占位。

## 7. 安全

- 密码 AES-256-GCM 加密存储，密钥环境变量 `DATASOURCE_SECRET`（dev 默认值仅本地，README 标注生产必须注入）。
- API 永不回传密码明文；编辑时留空表示不变。
- 建议连接账号为只读（README 说明）；SQL 注入防护见 §6 白名单 + 参数占位。
- RBAC：`datasource:*` 权限点已内置（admin/analyst 有，editor/viewer 无，满足 viewer 不可见数据源管理）。

## 8. 前端

- 菜单：「数据源」（`/datasources`，`datasource:read`，图标 Connection/Coin），置于「数据集」上方。
- `DataSourceList.vue`：表格（名称/类型徽标+状态 tag/地址/启用开关/最近测试/操作：详情·编辑·测试·删除）+ 类型筛选 + 新建。
- `DataSourceFormDialog.vue`：类型选择器（按分类分组，带状态 tag，⚪ 禁用）→ 动态表单（按驱动 `fields` 渲染，密码 type=password）→ 「测试连接」（成功/失败原因 ElAlert）→ 保存。
- `DataSourceDetail.vue`：基本信息 + Schema 浏览树（el-tree 懒加载 schema→table→columns）+ 表节点「创建数据集」按钮 + 「测试连接」。
- `DatasetList.vue`：新建入口拆「上传 Excel」/「从数据库表」（跳数据源详情选表）；列表加来源徽标。
- `api/index.js`：`datasourceApi`。

## 9. Docker 实测

`backend/scripts/datasource-live/`：
- `docker-compose.yml`：`mysql:8.0`、`postgres:16`、`clickhouse/clickhouse-server:24.8`、`mariadb:11`、`mcr.microsoft.com/mssql/server:2022-latest`（ACCEPT_EULA+强 SA 密码）、`pingcap/tidb`（`-store unistore` 单容器）、`elasticsearch:8.15`（single-node、关闭安全）；API 用测试脚本内嵌 Node http 服务。全部映射高位端口防冲突。
- `seed.sh/js`：每库建 `sales` 表并插入样例行。
- `live-test.js`：compose up → 逐库 `testConnection/listSchemas/listTables/listColumns/register-table/聚合查询` → PASS/FAIL 汇总 → compose down。

## 10. 测试策略

- `backend/test/taskN-drivers.test.js`：注册表 22 条完整性、分类/状态/能力/字段 schema 合法性。
- `taskN-crypto.test.js`：AES 加解密往返、篡改检测、掩码。
- `taskN-dialects.test.js`：各族 `quoteIdent/dateTrunc/buildAggSql` 生成断言。
- `taskN-datasource-api.test.js`：CRUD/403/owner 隔离/密码脱敏/测试连接（**mock provider**，单测不依赖 Docker）。
- `taskN-engine-sql.test.js`：`source_type` 分派 + SqlDataProvider 聚合（mock provider）。
- CDP e2e（docker 仅起 mysql+pg 轻量集）：新建 MySQL 数据源 → 测试 → Schema 树 → 从表建数据集 → 建图表渲染。
- 全量回归：`npm test`、`npm run build`、mac e2e（config-panel）、rbac e2e。
- 需求清单标注：DB-01~05 `[已实现 M2]`。

## 11. 任务拆分（实施计划）

1. 驱动注册表 + dialects + crypto + 单测
2. `data_sources` 表 + CRUD/测试/启停 API + RBAC/owner/审计 + 单测
3. mysql/pg family provider + live docker 冒烟（mysql/postgres/mariadb/tidb）
4. clickhouse/mssql provider + live 冒烟
5. ES/API provider + live 冒烟（连接/浏览受限能力）
6. 查询引擎 SqlDataProvider + `register-table` + 单测
7. 前端数据源页 + Schema 树 + 建数据集入口 + CDP e2e
8. 全量回归 + 八库 live 全量 + README/需求清单标注 + 安全自查

## 12. 风险与诚实边界

- 🟡 协议兼容 6 种与 ⚪ 待接入 8 种**本期不实测**，UI 明确标注；后续按需补驱动（Oracle 需 oracledb+instant client；DB2 需 ibm_db 原生编译；达梦/GBASE 需厂商包；Hive/Impala 需 thrift；Presto/MaxCompute 需专用 REST）。
- TiDB 用 `-store unistore` 单容器验证协议层，非生产集群形态。
- ES 仅连接+浏览、API 仅连接，二者数据集化排后续。
- SQL Server/ES 镜像较大（约 1.5GB/1GB），live 冒烟需预留磁盘与内存。
