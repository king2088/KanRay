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

# 前端生产构建
cd front-end && npm run build
```

## 已知限制（第一阶段）

- 单用户、无鉴权（第二阶段加入 RBAC）
- 数据生命周期 20 万行 / 20MB 以内
- 看板布局为 flow-grid（按数组顺序流式排布），第二维度作系列时显示为多系列