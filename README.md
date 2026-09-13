# 看板管理低代码系统（第一阶段）

一个对标 Apache Superset、面向"小白"的看板低代码平台：**单用户** + **Excel 数据** + **看板编排**。

> 技术栈：ExpressJS 5（后端） + Vue 3 + Element Plus + ECharts（前端），前后端分离。
> 需求文档见 `需求清单-第一阶段.md`、`需求清单-第二阶段.md`。

## 快速开始

### 1. 启动后端（端口 3001）

```bash
cd backend
npm install
npm run dev        # 或 npm start
```

首次启动会自动创建 `backend/data/kanban.db`（SQLite）。

### 2. 启动前端（端口 5173）

```bash
cd front-end
npm install
npm run dev
```

访问 http://localhost:5173 ，Vite 会把 `/api` 代理到后端。

## 核心流程（四步）

1. **数据管理 → 上传数据**：上传一个 Excel/CSV，系统自动识别字段类型并预览
2. **图表中心 → 新建图表**：选择数据集 → 选择图表类型 → 把字段拖入「维度 / 指标」→ 实时预览 → 保存
3. **看板中心**：输入名称新建看板 → 进入编辑 → 从上方拖入已保存的图表
4. **看板预览**：添加筛选组件（选数据源 + 字段），切换筛选值，所有同数据源图表联动刷新

## 支持的功能

- **数据集**：Excel(.xlsx/.xls/.csv) 上传、字段类型自动识别/手工调整、字段别名、数据分页预览、重命名/删除
- **图表**：柱状/折线/饼图/环形/条形/表格/数值统计卡；多维度（第二维度作系列）、多指标、聚合方式（求和/平均/计数/去重计数/最大/最小）、时间粒度（日/月/年）、分组排序
- **看板**：12 列 flow-grid 布局、拖拽添加图表、标题/文本组件（HTML）、跨图表筛选联动、全屏预览、自动保存布局
- **查询引擎**：统一聚合 SQL 生成 + 字段白名单校验，数据访问层抽象（为第二阶段多数据库预留）

## 目录结构

```
backend/                    ExpressJS 5 后端
  src/
    config/                 配置（端口/上传限制/路径）
    db.js                   SQLite 连接 + 元数据表
    engines/query-engine.js 聚合查询引擎（DataProvider）
    services/               数据集/图表/看板 业务层
    routes/                 RESTful 路由
    middleware/response.js  统一响应 + 错误处理
  scripts/integration-test.js  全流程 API 集成测试
front-end/                  Vue 3 前端
  src/
    views/                  DatasetList/Upload/Detail + ChartList/Builder + DashboardList/Editor/View
    components/charts/      EChartRenderer
    components/dashboard/   DashboardCanvas / ChartTile / FilterComponent
    api/                    统一 axios 封装
    utils/                  ECharts 按需引入 + 图表 option 构建
```

## 常用命令

```bash
# 后端集成测试（需后端已启动）
cd backend && node scripts/integration-test.js

# 端到端浏览器冒烟测试（需前后端均已启动，自动调用本机 Chrome）
cd front-end && npm run dev   # 另一个终端：npm run dev（后端）
cd front-end && node scripts/e2e-smoke.cjs

# 权限回归 e2e（需前后端均已启动；macOS 用 CHROME_PATH 指定本机 Chrome）
cd front-end && node scripts/e2e-rbac.cjs

# 前端生产构建
cd front-end && npm run build
```

## 多用户与权限（M1）

第二阶段 M1 已交付多用户认证 + RBAC + 管理后台：

- **认证**：邮箱+密码注册/登录，JWT 访问令牌（默认 15 分钟）+ 刷新令牌（默认 7 天，服务端哈希存储、单次使用轮换）；登出/改密/禁用即吊销
- **内置角色**：管理员（全部 27 个权限点）、数据工程师/分析师、看板编辑者、查看者（只读）；支持自定义角色与用户多角色分配
- **资源隔离**：数据集/图表/看板按 owner 隔离，管理与越权访问统一返回 403
- **默认管理员**：首次启动自动创建 `admin@kanban.local / admin123`（请尽快改密）

### 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `ADMIN_EMAIL` | `admin@kanban.local` | 初始管理员邮箱 |
| `ADMIN_INITIAL_PASSWORD` | `admin123` | 初始管理员密码 |
| `JWT_SECRET` | `dev-secret-change-me` | JWT 签名密钥（生产必须注入） |
| `ACCESS_TTL` | `15m` | 访问令牌有效期 |
| `REFRESH_TTL_DAYS` | `7` | 刷新令牌有效期（天） |

### 认证接口（/api/auth）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/register` | 注册（默认查看者角色） |
| POST | `/api/auth/login` | 登录，返回 access/refresh 令牌 |
| POST | `/api/auth/refresh` | 刷新令牌轮换 |
| POST | `/api/auth/logout` | 登出（吊销刷新令牌） |
| GET / PATCH | `/api/auth/me` | 查看 / 修改个人资料 |
| PUT | `/api/auth/password` | 修改密码 |

### 管理接口（/api/admin，需对应权限点）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET / POST / PATCH / DELETE | `/api/admin/users[/:id]` | 用户管理（分配角色、重置密码、启停、禁止删自己） |
| GET / POST / PATCH / DELETE | `/api/admin/roles[/:id]` | 角色管理（内置角色只读） |
| GET | `/api/admin/permissions` | 权限点列表 |
| GET | `/api/admin/audit` | 操作审计日志 |

## 多数据源接入（M2）

第二阶段 M2 已交付多数据源接入：统一驱动注册表 + 协议族 Provider 架构，支持数据源 CRUD、连接测试、库表结构浏览、表→数据集注册，并把外部数据库接入既有图表/看板查询链路。

### 支持的数据源（共 22 种）

| 状态 | 数量 | 数据源 |
| --- | --- | --- |
| ✅ 本期实测 | 8 | MySQL、PostgreSQL、SQL Server、MariaDB、TiDB、ClickHouse、Elasticsearch（仅连接测试/结构浏览）、API/Web Service（仅连接测试） |
| ◐ 协议兼容 | 6 | Apache Doris、StarRocks、Greenplum、人大金仓 KingbaseES、GaussDB、Amazon Redshift（复用 mysql/pg 协议族，未逐一生资实测） |
| ○ 规划中 | 8 | Oracle、DB2、达梦 DM、南大通用 GBASE、Apache Hive、Impala、Presto、阿里云 MaxCompute（接入对话框中暂禁用） |

> 说明：仅 `dataset: true` 的类型可注册为数据集建图表；Elasticsearch 与 API 类型本期不参与数据集。

### 架构

- **驱动注册表** `backend/src/datasources/drivers.js`：22 条驱动元数据（类型、分类、协议族、状态、能力、字段表单、默认端口）
- **协议族 Provider** `backend/src/datasources/providers/`：`mysql` / `pg` / `clickhouse` / `mssql` / `es-rest` / `http` 六个 Provider，统一实现 `testConnection` / `listSchemas` / `listTables` / `listColumns` / `runQuery`
- **SQL 方言抽象** `backend/src/datasources/dialects.js`：标识符引用、占位符（`?` / `$n` / `@pN`）、`LIMIT`/`TOP`、时间粒度、聚合函数映射
- **SqlDataProvider** `backend/src/datasources/sql-data-provider.js`：外部库表桥接查询引擎，聚合 SQL 供图表/看板消费，表/字段名仅取自已注册元数据
- **配置加密**：密码字段 AES-256-GCM 加密存储（`iv:tag:ciphertext` 三段 base64），接口出参统一脱敏

### 数据源接口（/api/datasources，需对应权限点）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/datasources/drivers` | 驱动注册表 |
| GET / POST | `/api/datasources[/:id]` | 数据源列表 / 新建（PATCH 编辑、DELETE 删除） |
| POST | `/api/datasources/test` | 保存前连接测试 |
| POST | `/api/datasources/:id/test` | 已保存数据源的连接测试 |
| GET | `/api/datasources/:id/schemas` | Schema 列表 |
| GET | `/api/datasources/:id/schemas/:schema/tables` | 表/视图列表 |
| GET | `/api/datasources/:id/schemas/:schema/tables/:table/columns` | 字段列表 |
| POST | `/api/datasources/:id/register-table` | 注册表 → 数据集（SQL 数据集） |

### 本地实测环境（Docker）

`backend/scripts/datasource-live/docker-compose.yml` 提供 7 个容器（MySQL / MariaDB / PostgreSQL / ClickHouse / SQL Server / TiDB / Elasticsearch），端口全部映射到高位避免冲突：

```bash
docker compose -f backend/scripts/datasource-live/docker-compose.yml up -d   # 启动
docker compose -f backend/scripts/datasource-live/docker-compose.yml ps      # 状态
docker compose -f backend/scripts/datasource-live/docker-compose.yml down -v # 停止清理
```

### 生产注意事项

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DATASOURCE_SECRET` | `kanban-dev-datasource-secret-32b!` | 数据源密码加密主密钥（SHA-256 派生 AES-256-GCM 密钥），**生产必须注入 ≥32 字节强随机值** |

- **在创建首个数据源之前固定 `DATASOURCE_SECRET`**，密钥变更会导致历史密码无法解密；轮换需重新保存各数据源密码。
- SQL 拼装全程使用标识符引用 + 参数化占位符，表/字段名来源于连接元数据而非用户自由输入，避免 SQL 注入。

## 已知限制

- 共享授权（grants）、看板级访问控制、RLS 规划于后续里程碑（M3/M4，见 `需求清单-第二阶段.md`）
- 数据生命周期 20 万行 / 20MB 以内
- 看板布局为 flow-grid（按数组顺序流式排布），第二维度作系列时显示为多系列