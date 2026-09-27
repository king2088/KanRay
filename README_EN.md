# KanRay

> 中文: [README.md](./README.md)

![Big screen preview (English UI)](docs/images/en/30-big-screen-preview.png)

KanRay is an open-source, all-in-one BI (business intelligence) platform for business and data teams. It covers the whole chain of "**data ingestion → data modeling → visual analysis → dashboards / big screens → form submission**" — with no code and no SQL required. Upload an Excel/CSV file, or connect to / sync an external database, and you can model it with the drag-and-drop dataset builder, configure charts visually, and rapidly assemble interactive, shareable dashboards with cross-chart filtering as well as pixel-precise, freely laid out big screens. The built-in Forms turns any combination of fields into an online submission form, and submitted data is written back to the dataset automatically, closing the loop between data collection and analysis.

Core capabilities: **multi-user access with role-based permissions (RBAC) + 22 data source types + a dataset builder + a chart and metric library + dashboard composition + big-screen design + form submission + an Open API**.

> Tech stack: ExpressJS 5 (backend) + Vue 3 + Element Plus + ECharts (frontend), with the frontend and backend decoupled.
> **The complete product manual lives in [docs/en/README.md (Documentation Hub)](docs/en/README.md)** — it covers everything from installation and deployment to day-to-day use, organised by role.

## Core Features
- **Datasets**: Excel (.xlsx/.xls/.csv) upload, automatic field type detection / manual adjustment, field aliases, paginated data preview, rename / delete
- **Dataset builder**: three modes — pure SQL / drag-and-drop / ETL — for combining external database tables into analysable datasets (see [Data sources & builder](docs/en/03-data-sources-and-builder.md))
- **Charts**: column / line / pie / doughnut / bar / table / numeric stat cards; multiple dimensions (the second dimension becomes the series), multiple metrics, aggregations (sum / average / count / distinct count / max / min), time granularity (day / month / year), grouping and sorting; a built-in **metric library** (atomic / composite / derived metrics, reusable across charts)
- **Dashboards**: 12-column flow-grid layout, drag-and-drop chart insertion, title / text components (HTML), cross-chart filter linking, full-screen preview, automatic layout saving, dashboard sharing (password gate + JWT authentication + enable/disable control + expiry policy)

![Big screen designer (English UI)](docs/images/en/29-big-screen-designer.png)

- **Big-screen design**: free-canvas big screens (pixel-precise layout, freely resizable components with snapping and alignment), a component library covering charts / tables / text / media / DataV decorations, static data / API requests (scheduled refresh) / dataset binding, PC and mobile preview, system presets and "My templates", JSON import/export, and password-protected or public big-screen sharing (see [Big-screen designer manual](docs/en/07-big-screen-designer.md))
- **Forms**: visual form field design (input / textarea / dropdown / multi-select / rating / section notes, etc.), publish / close / subscription status management, password-protected or public sharing, online filling and submission record management, with submitted data written back into datasets and into the analysis chain (see [Forms manual](docs/en/08-forms-manual.md))
- **Users and permissions**: sign-up / sign-in with email + password, JWT tokens (access + refresh rotation); built-in administrator / data engineer / analyst / dashboard editor / viewer roles, plus custom roles; datasets / charts / dashboards are isolated by owner, with out-of-scope access uniformly returning 403; `admin@kanray.local / admin123` is created automatically on first launch (change this password as soon as possible)

44 built-in permission points covering datasets / charts / dashboards / big screens / data sources / forms / API keys, named as `resource:action`; custom roles can combine them freely. `apikey:manage` governs API key management for the Open API.
- **Open API**: `/api/open/v1` with long-lived API Key / PAT credentials, offering chart / dataset / dashboard discovery, data retrieval, custom dataset aggregation, and dashboard snapshot export (JSON / CSV), plus Swagger documentation (see [Open API integration guide](docs/en/04-open-api-integration.md))

## Core Workflow (Five Steps)
1. **Data management → Upload data**: upload an Excel/CSV file, and the system detects the field types automatically and shows a preview

![Reusing the metric library in the builder (English UI)](docs/images/en/21-chart-builder-metric-lib.png)

2. **Charts → New chart**: pick a dataset → pick a chart type → drag fields into "Dimensions / Metrics" → live preview → save
3. **Dashboards**: enter a name to create a dashboard → enter the editor → drag saved charts in from the panel above
4. **Dashboard preview**: add a filter component (choose a data source + a field); switching the filter value refreshes every chart bound to the same data source

![Form designer (English UI)](docs/images/en/24-form-designer.png)

5. **Forms**: design and publish a submission form → share it with a password or publicly → submissions are written back to the dataset and flow onward into the chart / dashboard analysis chain

22 database engines can be connected as **external data sources** (either queried directly, or synced locally for offline analysis):

| --- | --- | --- |
| Status | Count | Data source |

Data sources support two storage modes: **direct** (`direct`, which queries the source database in real time) and **sync** (`sync`, which pulls remote tables into the local storage backend on a schedule). Both full and incremental (watermark) syncs are available, and reconciliation-based deletion via incremental primary keys is supported.

As a **storage backend** (the metadata database, holding users / roles / data sources / datasets / charts / dashboards / sync configuration), you can choose `sqlite` / `mysql` / `mariadb` / `postgres` / `sqlserver` / `oracle`; SQLite is the zero-ops default.

## Supported Databases

```bash
cd backend
npm install
npm run dev        # 或 npm start
```

```bash
cd front-end
npm install
npm run dev
```

## Quick Start

### 1. Start the backend (port 3001)

On first launch, `backend/data/kanban.db` is created automatically (SQLite — both the auth database and the metadata database default to a local file). To store metadata in MySQL / PostgreSQL / SQL Server / Oracle instead, see "Storage Backend Configuration" below.

### 2. Start the frontend (port 5173)

Open http://localhost:5173 — Vite proxies `/api` to the backend.

```bash
# 后端：启动 / 开发热重载 / 测试
cd backend && npm start          # 生产
cd backend && npm run dev        # 开发（node --watch）
cd backend && npm test           # 单元 + 集成测试（无外部依赖）

# 前端：启动 / 生产构建
cd front-end && npm run dev      # 开发（端口 5173）
cd front-end && npm run build    # 生产构建
```

## Common Commands

```
backend/                    ExpressJS 5 后端
  src/
    config/                 配置（端口/上传限制/存储选择，env > config.json > 默认值）
    db.js                   存储门面（prepare/exec/transaction/dialect 统一入口）
    db/
      schema.js             方言 DDL 幂等引导 + 列补齐 + ensureDatasetTable(PK)
      dialects/             方言（标识符/占位符/时间/分页/自增）
      translate.js          SQL 可移植转换
      ddl/                  六库建表语句（sqlite/mysql/postgres/mssql/oracle）
      drivers/              远端驱动（mysql/pg/mssql/oracle）
    datasources/            数据源注册表 + 协议族 Provider + SQL 方言抽象 + SqlDataProvider
    engines/query-engine.js 聚合查询引擎（DataProvider）
    services/               数据集/图表/看板/数据源业务层
    jobs/sync-scheduler.js  同步调度器（内存定时器 + 并发闸门）
    routes/                 RESTful 路由
    middleware/response.js  统一响应 + 错误处理
front-end/                  Vue 3 前端
  src/
    views/                  DatasetList/Detail + ChartList/Builder + Dashboard + BigScreenList + DataSource{List,Detail,Builder,FormDialog}
    components/charts/      EChartRenderer
    components/dashboard/   DashboardCanvas / ChartTile / FilterComponent
    screen-designer/        大屏设计器（Designer/Preview/Settings/Share 视图 + Canvas/LeftPanel/RightPanel/TopToolbar + 组件注册表/预设模板）
    api/                    统一 axios 封装（datasourceApi / syncApi）
    utils/                  ECharts 按需引入 + 图表 option 构建
```

## Directory Structure

```bash
cd deploy/docker
./deploy.sh                    # 默认 PG 栈：自动生成 .env（含随机密钥）并构建启动
./deploy.sh up --stack sqlite  # SQLite 演示栈（免外部库/Redis，单机）
./deploy.sh up --stack mysql   # MySQL 栈（含 redis + worker）
./deploy.sh up --stack mariadb # MariaDB 栈（含 redis + worker）
./deploy.sh logs               # 查看日志
./deploy.sh down               # 停机（保留数据卷）
./deploy.sh down -v            # 停机并清除所有数据（-v 删除数据卷，不可恢复）
```

- URL: `http://localhost:8080` (adjustable via `KANRAY_PORT` in `deploy/docker/.env`)
- Administrator: `admin@kanray.local / admin123` (in production, change `ADMIN_INITIAL_PASSWORD` and the secrets in `deploy/docker/.env`)
- Swagger docs: `http://localhost:8080/api/open/docs`
- **Kubernetes deployment**: go to `deploy/k8s/`, build the images with `deploy/k8s/scripts/build-images.sh`, and deploy with `deploy/k8s/scripts/deploy.sh up` (see `deploy/k8s/README.md`). The docker and k8s deployments are fully independent and share no files
- Local development defaults to **SQLite with Redis disabled**: just run `cd backend && npm run dev` — no middleware needed

For further production operations detail (multi-instance distributed deployment, key management, backup and restore, etc.), see [Deployment & operations manual](docs/en/05-deployment-and-operations.md).

## One-Click Docker Deployment

| --- | --- | --- |
| `DB_TYPE` | `sqlite` | `sqlite` / `mysql` / `mariadb` / `postgres` / `sqlserver` / `oracle` |

| Variable | Default | Description |
| --- | --- | --- |
| `DB_TYPE` | `sqlite` | `sqlite` / `mysql` / `mariadb` / `postgres` / `sqlserver` / `oracle` |
| `DB_URL` | empty | JDBC-style connection string for non-sqlite backends (see the examples below) |
| `DB_PATH` | `data/kanban.db` | sqlite file path (absolute paths supported) |
| `PORT` | `3001` | Backend port |
| `DATA_DIR` / `UPLOAD_DIR` | `backend/data` / `backend/uploads` | Runtime data directories |

```bash
cd backend
# 方式一：环境变量（优先）
DB_TYPE=postgres DB_URL='postgresql://kanray:kanray@127.0.0.1:15432/kanray?sslmode=disable' npm start
# 方式二：config.json（backend/config.json）
# { "db": { "type": "postgres", "url": "postgresql://kanray:kanray@127.0.0.1:15432/kanray?sslmode=disable" } }
```

| --- | --- |
| sqlite | `DB_PATH=data/kanban.db` |
| mysql / mariadb | `mysql://root:Kanban%40123@127.0.0.1:13306/testdb` |
| postgres | `postgresql://postgres:Kanban%40123@127.0.0.1:15432/testdb` |
| sqlserver | `mssql://sa:Kanban%40123@127.0.0.1:11433/testdb` |
| oracle | `oracle://SYSTEM:Kanban%40123@127.0.0.1:11521/FREEPDB1` |

| DB_TYPE | Connection string example |
| --- | --- |
| sqlite | `DB_PATH=data/kanban.db` |
| mysql / mariadb | `mysql://root:Kanban%40123@127.0.0.1:13306/testdb` |
| postgres | `postgresql://postgres:Kanban%40123@127.0.0.1:15432/testdb` |
| sqlserver | `mssql://sa:Kanban%40123@127.0.0.1:11433/testdb` |
| oracle | `oracle://SYSTEM:Kanban%40123@127.0.0.1:11521/FREEPDB1` |

## Storage Backend Configuration

All **metadata** (users / roles / data sources / datasets / charts / dashboards / sync configuration) is read and written through a unified storage facade. The zero-ops default is SQLite; you can also switch to MySQL / MariaDB / PostgreSQL / SQL Server / Oracle.

Configuration precedence: **environment variable > config.json > default value** (see `backend/config.example.json` for an example).

**Switching storage (example: PostgreSQL)**:

On first launch, idempotent table creation plus column back-filling for pre-existing databases is run against the selected database (`IF NOT EXISTS` / column-existence probing); after that it is used as normal.

**Connection string examples per database**:

For production notes and migration tooling, see [Deployment & operations manual](docs/en/05-deployment-and-operations.md) and the [backend README](backend/README_EN.md).

- The data lifecycle limit is 200,000 rows / 20MB (for uploaded datasets); synced tables are governed by `max_rows` and are not bound by that limit
- Dashboard layout is flow-grid (items flow in array order), and a second dimension is rendered as multiple series
- When the storage backend is Oracle, every statement is auto-committed, so a mid-batch write failure will not roll the whole batch back (the other dialects support explicit transactions)
- Preconditions for multi-instance deployment: a shared metadata database (non-sqlite), a consistent `JWT_SECRET` / `DATASOURCE_SECRET`, and shared upload storage; setting `REDIS_URL` is recommended
- Existing data is **not migrated automatically**: confirm your deployment topology before switching the storage backend, or migrate it with `backend/scripts/migrate-data.mjs`
- Excel file data sources do not support the sync storage mode

## Known Limitations

KanRay is designed, built, and documented by a single independent creator, and every part of it — from the architecture to the features to these docs — has taken a great deal of spare time and effort. **Sustaining an open-source project alone is not easy**, and every bit of support you give is what keeps it going.

If KanRay has been useful to you, feel free to buy me a coffee:

<img src="docs/images/wechat.jpg" width="400" alt="WeChat donations">

<img src="docs/images/alipay.jpg" width="400" alt="Alipay donations">

> Your donation will go toward continued development. You are equally welcome to support the project by [opening an issue / PR](https://github.com/) — code contributions are just as good an encouragement for open source.

Thank you to everyone who uses and supports KanRay!

## Support and Sponsoring
