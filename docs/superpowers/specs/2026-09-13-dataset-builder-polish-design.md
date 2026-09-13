# 构建器 / 目录体验收尾设计（M3.6）

日期：2026-09-13
状态：已评审（brainstorming 通过）
范围：前端构建器三 tab + 数据源详情树 + 后端 catalog 粒度；构建定义与 build-sql 契约零改动

## 1. 背景与问题

M3.5 交付后用户反馈六项体验问题：

1. 构建器左侧目录树过长、展开后节点多导致卡顿（`SchemaTree.vue` 用 `el-tree` 全量渲染整个 catalog）。
2. ETL 左栏仍挂着一个 SchemaTree「表 / 字段」，但 ETL 的表/字段本就在节点配置里选择，属于冗余。
3. 所有数据库表树没有搜索。
4. 数据源管理粒度不合理：连接已绑定单一库（表单 `database` 必填），树/catalog 却把服务器上所有库列出；期待「一个数据源 = 一个库 = 一个 schema 根」。
5. `DataSourceBuilder.vue` 顶部 page-header 与其它页面样式不一致（根类少了 `.page-container` 的 16px 内边距）。
6. 构建界面超过浏览器窗口，需整页滚动很久才能操作；期望 100% 视口高度、内部滚动。

另有一条新交互要求：拖拉拽 tab 的左侧目录**只显示表、不显示字段**；把表从左侧拖到**中间**，中间即展示该表全部字段。

## 2. 范围决策（brainstorming 确认）

| 决策点 | 结论 |
| --- | --- |
| 虚拟滚动方案 | 用 Element Plus 内置 `ElTreeV2`（虚拟滚动、固定行高、只渲染可视行）；项目已全量 `app.use(ElementPlus)`，`<el-tree-v2>` 直接可用，无需新依赖 |
| 目录搜索 | SchemaTree 组件内建搜索框；DataSourceDetail 树加搜索（`filter-node-method`） |
| 数据源粒度 | **最严格**：每个 SQL 驱动的 `listSchemas` 只返回恰一个根（见 §3） |
| PG / MSSQL 取哪个 schema | **固定默认 schema**：PG→`public`、MSSQL→`dbo`；跨 schema 查询不再支持 |
| ES / API 服务类驱动 | 无数据库概念，**保持现状**（ES 列出的是索引，非库） |
| 详情页树虚拟化 | **不做**：保持 lazy 按需加载 + 搜索（ElTreeV2 不支持 lazy，若要虚拟须预拉全量，不划算） |
| ETL 左栏 | 只留算子托盘，删除 SchemaTree |
| 拖拉拽 tab | 左树只显示表（`showFields=false`），中间为拖放目标，拖入后展示该表所有字段 |
| 构建定义 / build-sql | **零改动**：`${schema}.${table}` 沿用真实 schema 名（mysql 系=数据库名，pg=public，mssql=dbo） |
| 主题 | 继续只用 `--app-*` / `--el-*` 变量，深浅色自动跟随 |

## 3. 后端：数据源 = 单库单 schema

### 3.1 各 provider `listSchemas` 收敛

| provider | 修改后返回 |
| --- | --- |
| `mysql-family.js`（mysql/mariadb/tidb 共用） | `cfg.database ? [{ name: cfg.database }] : []` |
| `clickhouse.js` | `cfg.database ? [{ name: cfg.database }] : []` |
| `pg-family.js` | `[{ name: 'public' }]` |
| `mssql.js` | `[{ name: 'dbo' }]` |
| `elasticsearch.js` | 不变（索引清单） |
| `api-service.js` | 不变（无 schema 概念） |

- 由 `listSchemas` 单点收敛，`/schemas` 端点、`buildApi.sqlAssist`、DataSourceDetail 树自动同步为单根，**无需改任何路由/服务/前端目录组装逻辑**。
- `listTables`/`listColumns` 保留原签名（`schema` 入参）；pg/mssql 只会被传入 `public`/`dbo`，查询正确。
- 未配置 `database` 的历史数据源（不应存在，表单已必填；防御性兜底）：mysql 系/clickhouse 返回 `[]`，树显示空并提示配置数据库。
- 等 `#4` 落地后 catalog 天然变小（单 schema），配合 §4 的虚拟滚动，卡顿问题整体缓解。

### 3.2 后端测试

- 现有测试无断言 schemas 列表，全绿不受影响（`task14` 仅 22 驱动断言）。
- 新增 docker live 校验脚本 `backend/scripts/datasource-live/verify-schema-scope.mjs`：连接本机 `kanban-live-mysql`(13306)/`clickhouse`(18123)/`postgres`(15432)/`mssql`(11433) 四容器，逐驱动断言 `listSchemas(cfg)` 精确等于期望单根（mysql/clickhouse→`testdb`，pg→`public`，mssql→`dbo`）。

## 4. SchemaTree 重写（虚拟滚动 + 搜索 + 表目录开关）

### 4.1 结构（API 以本机 element-plus 2.14.5 实测为准）

> API 澄清：`el-tree-v2` 的 `height` 是 **Number**（默认 200），不支持 `"100%"` 字符串；自带 `filterMethod`（与 el-tree 的 `filter-node-method` 语义一致：传递 `(value, data)`，命中节点连同其祖先保留、其余隐身）与 `defaultExpandedKeys`。已核实 `node_modules/element-plus/es/components/tree-v2/src/virtual-tree.mjs`。

```vue
<div class="schema-tree" ref="treeEl">
  <el-input v-model="query" size="small" placeholder="搜索表 / 字段" clearable />
  <el-tree-v2 ref="treeRef" :data="treeData" :props="{ label: 'n', children: 'children' }" node-key="id"
    :height="treeHeight" :default-expanded-keys="defaultExpanded" :filter-method="filterMethod" />
  <!-- 行插槽：图标 + 名称 + 角色 tag + 操作（上架/打开/插入/拖拽） -->
</div>
```

### 4.2 行为

- **虚拟滚动**：仅渲染可视行；行高统一 30px。**高度换算**：`treeEl` 用 `ResizeObserver` 观测容器像素高度 → `treeHeight`（Number）传给 `:height`；宿主面板为 flex 纵向布局，树填满剩余高度自行滚动。
- **展开**：普通态用 `defaultExpandedKeys` 展开 schema 根节点（catalog 单 schema 后即根下直接是表）。搜索态由 `filter` 内在行为保证命中路径展开。
- **搜索**（`query`，两种模式均展示输入框）：`onInput` 调 `treeRef.value.filter(query)`；`filterMethod = (q, data) => !q || data.n.toLowerCase().includes(q.toLowerCase())`，带忽略大小写 + 命中节点保留祖先。
- **字段开关** `showFields`（默认 `true`）：
  - `true`：schema→表→字段，字段行带「插入」按钮（SQL tab）、「指标/维度/时间」tag。
  - `false`：**只渲染 schema→表**（字段节点不下发），表行「上架」按钮 + 可拖拽（拖拽数据仍为 `schema:table`）；「打开」按钮隐藏（无字段可看）。
- **拖拽**：表行 `dragstart` 写入 `text/plain = "${schema}:${table}"`，`effectAllowed=copy`（沿用现有 `onDragStart`）。
- **宿主面板适配**：SQL/拖拽 tab 的左侧面板由 `overflow:auto` 改为 `display:flex; flex-direction:column`，树填满剩余高度自行滚动；面板标题保留。

## 5. 拖拉拽 tab 交互

- 左面板：`<SchemaTree :catalog="schemas" show-fields=false @mount-table="mountTable" />`（内含搜索）；**删除左栏底部虚线 dropzone** 与 `<SchemaTree @drop.prevent>`。
- 中间「选字段」面板 `.drag-builder__mid` 挂 `@dragover.prevent @drop="onDropTable"`：从左侧把表拖入中间 → 现有 `onDropTable`(id→`mountTable`) 触发 → 中间新增该表「字段卡片」，列出全部字段（勾选/别名/维度-指标/全选/清空/移除，沿用现有模型）。
- 「上架」按钮与拖入共用 `mountTable`，逻辑不变；关联 tab / 聚合 tab / 预览不动。

## 6. ETL 左栏

- `EtlBuilderTab.vue`：删除「表 / 字段」分区、`<el-divider />` 与 `<SchemaTree>:18-19`，仅留算子托盘。
- `catalog`（`schemas` prop）保留：source/join 节点的 `filterable` 表下拉用。
- 已移除的 `@pick-field="() => {}"` 一并删除。

## 7. DataSourceDetail 树搜索

- 保持 `lazy` + `loadNode`，新增搜索框（`el-input`，`:filter-node-method="filterNode"` + `@input` 触发 `treeRef.filter(...)`）。
- `filterNode(value, data)`：按 `data.label` 忽略大小写包含匹配；对已 lazy 加载的节点生效（未展开节点不参与过滤，属预期，写进 UI 提示）。

## 8. 构建页布局（header 对齐 + 100% 高度）

`DataSourceBuilder.vue`：

- 根类加 `padding: 16px`（对齐 `.page-container`）。
- `height: calc(100vh - var(--app-header-height))`（`--app-header-height: 52px`），`display:flex; flex-direction:column; overflow:hidden` → 页面永不整页滚动。
- 头 `.page-header`：`flex-shrink:0`。
- `<el-card>`：`flex:1; min-height:0; display:flex; flex-direction:column`，并 `:deep(.el-card__body){ display:flex; flex-direction:column; flex:1; min-height:0 }`。
- `<el-tabs>`：`flex-shrink:0`；内容包裹 div 由 `min-height:520px` 改为 `flex:1; min-height:0; display:flex`。
- 三个 tab 组件根已是 `height:100%`，其内部面板自行滚动；ETL 画布填满剩余高度。
- 侧栏折叠/横向布局不受影响（header 高度恒定）。

## 9. 验证

| 项 | 命令 / 内容 | 期望 |
| --- | --- | --- |
| 后端回归 | `npm test`（backend/） | 133 pass / 0 fail（基线不变） |
| 构建 | `npm run build`（front-end/） | 成功 |
| live 单根校验 | `node backend/scripts/datasource-live/verify-schema-scope.mjs` | mysql→`[testdb]`、clickhouse→`[testdb]`、pg→`[public]`、mssql→`[dbo]` 全部 PASS |
| CDP 回归 | `node test-m35-e2e.mjs` | 9/9 PASS（tab 映射 / cm-editor / ETL 画布 / 深浅截图；tree 变单根不影响断言） |
| 截图抽查 | 复用 CDP 输出目录 | 深浅色跟随 |

人工抽查：拖拉拽 tab——左树仅表级、拖表进中间出现字段卡片；SQL tab——字段仍可见可「插入」；详情页——单根 + 搜索可用。

## 10. Self-Review

| 反馈项 | 对应章节 |
| --- | --- |
| 卡顿/过长 | §4（ElTreeV2 虚拟滚动）+ §3（单 schema 天然缩节点） |
| ETL 左栏冗余 | §6 |
| 所有表树搜索 | §4.2（SchemaTree 内置）+ §7（详情页） |
| 数据源=单库 | §3 |
| page-header 不一致 | §8 |
| 100% 高度不整页滚动 | §8 |
| 拖拉拽：左树只表 + 拖到中间展示字段 | §5 |

**一致性**：拖拽数据格式仍为 `schema:table`；`showFields=false` 时字段节点不下发但不影响 `catalog` 全量注入（SQL tab 仍需字段）；`listSchemas` 单点改动不触碰路由/服务/前端组装。