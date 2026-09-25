# KanRay

![大屏预览](docs/images/30-big-screen-preview.png)

KanRay 是一款开源的一站式 BI（商业智能）平台，面向业务与数据团队，覆盖「**数据接入 → 数据建模 → 可视化分析 → 数据看板/大屏 → 表单填报**」完整链路。无需编写代码或 SQL：上传 Excel/CSV 或直连/同步外部数据库后，即可通过拖拽式数据集构建器建模，可视化配置图表，快速搭建可交互、可分享、可联动筛选的数据看板与像素级自由布局的数据大屏；内置表单中心，可将任意字段组合发布为在线填报表单，提交数据自动回写数据集，闭环数据采集与分析。

核心能力：**多用户与角色权限（RBAC）+ 22 种数据源接入 + 数据集构建器 + 图表与指标库 + 看板编排 + 大屏设计 + 表单填报 + 开放 API**。

> 技术栈：ExpressJS 5（后端） + Vue 3 + Element Plus + ECharts（前端），前后端分离。
> **完整产品说明书见 [docs/README.md（文档中心）](docs/README.md)**——按角色覆盖从安装部署到日常使用的全流程。

## 核心功能

- **数据集**：Excel(.xlsx/.xls/.csv) 上传、字段类型自动识别/手工调整、字段别名、数据分页预览、重命名/删除
- **数据集构建器**：纯 SQL / 拖拉拽 / ETL 三种形态将外部数据库表组合为可分析数据集（详见 [数据源与构建器](docs/03-数据源与构建器.md)）
- **图表**：柱状/折线/饼图/环形/条形/表格/数值统计卡；多维度（第二维度作系列）、多指标、聚合方式（求和/平均/计数/去重计数/最大/最小）、时间粒度（日/月/年）、分组排序；内置**指标库**（原子/复合/衍生指标，可跨图表复用）
- **看板**：12 列 flow-grid 布局、拖拽添加图表、标题/文本组件（HTML）、跨图表筛选联动、全屏预览、自动保存布局、分享看板（密码门禁 + JWT 鉴权 + 启停控制 + 过期策略）
- **大屏设计**：自由画布式可视化大屏（像素级布局、组件自由缩放/对齐吸附），组件库含图表 / 表格 / 文本 / 媒体 / DataV 装饰，支持静态数据 / API 请求（定时刷新）/ 数据集绑定、PC 与移动端预览、系统预设与「我的模板」、JSON 导入导出、密码/公开分享大屏（详见 [大屏设计器使用手册](docs/07-大屏设计器使用手册.md)）

  ![大屏设计器](docs/images/29-big-screen-designer.png)

- **表单中心**：可视化表单字段设计（输入 / 文本域 / 下拉 / 多选 / 评分 / 分节说明等）、发布 / 关闭 / 订阅状态管理、密码或公开分享、在线填报与提交记录管理，提交数据自动回写数据集进入分析链路（详见 [表单中心使用手册](docs/08-表单中心使用手册.md)）
- **多用户与权限**：邮箱+密码注册/登录，JWT 令牌（访问 + 刷新轮换）；内置管理员 / 数据工程师 / 分析师 / 看板编辑者 / 查看者角色，支持自定义角色；数据集/图表/看板按 owner 隔离，越权统一 403；首次启动自动创建 `admin@kanray.local / admin123`（请尽快改密）
- **开放 API**：`/api/open/v1` + API Key / PAT 长效凭证，提供图表/数据集/看板发现、取数、数据集自定义聚合、看板快照导出（JSON / CSV），Swagger 文档（详见 [开放 API 集成指南](docs/04-开放API集成指南.md)）

## 核心流程（四步）

1. **数据管理 → 上传数据**：上传一个 Excel/CSV，系统自动识别字段类型并预览
2. **图表中心 → 新建图表**：选择数据集 → 选择图表类型 → 把字段拖入「维度 / 指标」→ 实时预览 → 保存

   ![图表构建器：拖入维度/指标并复用指标库](docs/images/21-chart-builder-metric-lib.png)

3. **看板中心**：输入名称新建看板 → 进入编辑 → 从上方拖入已保存的图表
4. **看板预览**：添加筛选组件（选数据源 + 字段），切换筛选值，所有同数据源图表联动刷新
5. **表单中心**：设计并发布填报表单 → 密码或公开分享 → 提交记录自动回写数据集，继续进入图表/看板分析链路

   ![表单设计器](docs/images/24-form-designer.png)

## 支持的数据库

作为**外部数据源**可接入 22 种数据库（直连或同步到本地离线分析）：

| 状态 | 数量 | 数据源 |
| --- | --- | --- |
| ✅ 本期实测 | 16 | MySQL、PostgreSQL、SQL Server、MariaDB、TiDB、ClickHouse、Elasticsearch、API/Web Service、Oracle、南大通用 GBASE、Presto、DB2、达梦 DM、Apache Hive、Apache Impala、阿里云 MaxCompute |
| ◐ 协议兼容 | 6 | Apache Doris、StarRocks、Greenplum、人大金仓 KingbaseES、GaussDB、Amazon Redshift（复用 mysql/pg 协议族） |

数据源支持**直连**（`direct`，实时查询打源库）与**同步**（`sync`，按任务把远端表定时拉到本机存储后端）两种存储方式，全量/增量（水印）同步，支持增量主键对账删除。

作为**存储后端**（元数据库：用户/角色/数据源/数据集/图表/看板/同步配置），可选 `sqlite` / `mysql` / `mariadb` / `postgres` / `sqlserver` / `oracle`，默认 SQLite 零运维。

## 快速开始

### 1. 启动后端（端口 3001）

```bash
cd backend
npm install
npm run dev        # 或 npm start
```

首次启动会自动创建 `backend/data/kanban.db`（SQLite，默认鉴权库/元数据库均为本地文件）。需要把元数据改用 MySQL / PostgreSQL / SQL Server / Oracle 之一时，见下节「存储后端配置」。

### 2. 启动前端（端口 5173）

```bash
cd front-end
npm install
npm run dev
```

访问 http://localhost:5173 ，Vite 会把 `/api` 代理到后端。

## 常用命令

```bash
# 后端：启动 / 开发热重载 / 测试
cd backend && npm start          # 生产
cd backend && npm run dev        # 开发（node --watch）
cd backend && npm test           # 单元 + 集成测试（无外部依赖）

# 前端：启动 / 生产构建
cd front-end && npm run dev      # 开发（端口 5173）
cd front-end && npm run build    # 生产构建
```

## 目录结构

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

## Docker 一键部署

默认启动 PostgreSQL 生产栈（postgres + redis + backend + 同步 worker + frontend(nginx)），无需手动安装 Node/PostgreSQL/Redis：

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

- 访问地址：`http://localhost:8080`（可通过修改 `deploy/docker/.env` 中的 `KANRAY_PORT` 调整）
- 管理员：`admin@kanray.local / admin123`（生产环境请修改 `deploy/docker/.env` 中的 `ADMIN_INITIAL_PASSWORD` 与密钥）
- Swagger 文档：`http://localhost:8080/api/open/docs`
- **Kubernetes 部署**：进入 `deploy/k8s/`，用 `deploy/k8s/scripts/build-images.sh` 构建镜像、`deploy/k8s/scripts/deploy.sh up` 部署（详见 `deploy/k8s/README.md`）。docker 与 k8s 两套部署各自独立、不共用文件
- 本地开发默认 **SQLite 且不启用 Redis**：`cd backend && npm run dev` 即可，无需任何中间件

更多生产运维细节（多实例分布式部署、密钥管理、备份恢复等）见 [部署运维手册](docs/05-部署运维手册.md)。

## 存储后端配置

所有**元数据**（用户/角色/数据源/数据集/图表/看板/同步配置）由统一存储门面读写。默认 SQLite 零运维；也可换成 MySQL / MariaDB / PostgreSQL / SQL Server / Oracle 之一。

配置优先级：**环境变量 > config.json > 默认值**（示例见 `backend/config.example.json`）。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DB_TYPE` | `sqlite` | `sqlite` / `mysql` / `mariadb` / `postgres` / `sqlserver` / `oracle` |
| `DB_URL` | 空 | 非 sqlite 时的 JDBC 风格连接串（见下方示例） |
| `DB_PATH` | `data/kanban.db` | sqlite 文件路径（支持绝对路径） |
| `PORT` | `3001` | 后端端口 |
| `DATA_DIR` / `UPLOAD_DIR` | `backend/data` / `backend/uploads` | 运行时数据目录 |

**切换存储示例（PostgreSQL）**：

```bash
cd backend
# 方式一：环境变量（优先）
DB_TYPE=postgres DB_URL='postgresql://kanray:kanray@127.0.0.1:15432/kanray?sslmode=disable' npm start
# 方式二：config.json（backend/config.json）
# { "db": { "type": "postgres", "url": "postgresql://kanray:kanray@127.0.0.1:15432/kanray?sslmode=disable" } }
```

首次启动即对所选库执行幂等建表 + 老库列补齐（`IF NOT EXISTS` / 列存在性探测），之后正常使用。

**各库连接串示例**：

| DB_TYPE | 连接串示例 |
| --- | --- |
| sqlite | `DB_PATH=data/kanban.db` |
| mysql / mariadb | `mysql://root:Kanban%40123@127.0.0.1:13306/testdb` |
| postgres | `postgresql://postgres:Kanban%40123@127.0.0.1:15432/testdb` |
| sqlserver | `mssql://sa:Kanban%40123@127.0.0.1:11433/testdb` |
| oracle | `oracle://SYSTEM:Kanban%40123@127.0.0.1:11521/FREEPDB1` |

生产注意事项与迁移工具等见 [部署运维手册](docs/05-部署运维手册.md) 及 [后端 README](backend/README.md)。

## 已知限制

- 数据生命周期 20 万行 / 20MB 以内（上传数据集）；同步落库表由 `max_rows` 控制，不受该上限约束
- 看板布局为 flow-grid（按数组顺序流式排布），第二维度作系列时显示为多系列
- 存储后端为 Oracle 时每语句自动提交，批量写中途失败不会整体回滚（其余方言支持显式事务）
- 多实例部署前提：共享元数据库（非 sqlite）+ 一致的 `JWT_SECRET` / `DATASOURCE_SECRET` + 共享上传存储，建议配 `REDIS_URL`
- 存量数据不做**自动迁移**：切换存储后端前请确认部署形态，或用 `backend/scripts/migrate-data.mjs` 迁移
- Excel 文件数据源不支持同步存储方式