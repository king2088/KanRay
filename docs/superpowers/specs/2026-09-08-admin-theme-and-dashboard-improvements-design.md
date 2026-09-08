# 后台管理能力 + 分页 + 看板编辑器体验 设计方案

日期：2026-09-08
范围：前端（Vue3 + Pinia + Element Plus 2.10）与后端（Express + SQLite）两端的改动。

---

## 1. 主题系统

### 1.1 设计要点
- Element Plus 自带暗黑模式：`<html class="dark">` + 引入 `element-plus/theme-chalk/dark/css-vars.css`。
- 主题色运行时切换：改写 `--el-color-primary` 及其 light-3/5/7/8/9、dark-2 变量与自定义 `--app-primary*` 变量。
- 应用启动前同步应用持久化设置，避免刷新闪白。

### 1.2 新增/修改文件
- 新增 `src/stores/app.js`（Pinia）：
  - state：`{ layout: 'vertical' | 'horizontal' | 'mixed', collapsed: boolean, dark: boolean, primaryColor: '#409eff' }`
  - 持久化：localStorage key `kanban-app-settings`（JSON）；store 初始化时读取并合并默认值。
  - action 修改状态时自动 `applyTheme()` 并持久化。
- 新增 `src/utils/theme.js`：
  - `mixColor(hex, target, amount)`：把基色与白/黑按比例混合，返回 hex。
  - `applyTheme({ dark, primaryColor })`：
    - `document.documentElement.classList.toggle('dark', dark)`
    - 写入：`--el-color-primary`、light-3/5/7/8/9（与白色按 30%/50%/70%/80%/90% 混合）、`--el-color-primary-dark-2`（与黑 20%）；同步写 `--app-primary`、`--app-primary-light`（90% 白）、`--app-primary-darker`（10% 黑）。
- `src/main.js`：
  - `import 'element-plus/theme-chalk/dark/css-vars.css'`
  - 创建 pinia 后同步读 store 并 `applyTheme`，再 `app.mount`。
- `src/assets/main.css`：
  - 新增 `html.dark` 段覆盖 app token：`--app-bg`（#121212）、`--app-card`（#1e1e1e）、文本、边框（#363637 / #4c4d4f）、`--app-hover`（#2a2a2b）、滚动条配色。
- `src/utils/chart-utils.js`：`toEChartsOption` 输出顶层加 `backgroundColor: 'transparent'`（未显式指定时），使图表画布融入暗色卡片。图表文字/系列颜色暂不随主题变化（记录为已知限制）。

## 2. 布局模式

### 2.1 三种模式
- **垂直（vertical）**：左侧 220px（可折叠 64px）菜单栏 + 右侧（头部 + 内容）。为现状。
- **水平（horizontal）**：无侧栏；顶部一排 = logo + 横排菜单（el-menu mode="horizontal"）+ 右部操作；下方为内容区。
- **混合（mixed）**：顶部 = logo + 横排菜单 + 右部操作；下方左侧为 64px 常驻图标窄栏（SideMenu 以 collapsed 渲染，图标 + tooltip）+ 内容区。

### 2.2 组件拆分（MainLayout 重构）
- 新增 `src/components/layout/AppLogo.vue`（props: collapsed）
- 新增 `src/components/layout/SideMenu.vue`（垂直/混合共用菜单渲染）
- 新增 `src/components/layout/TopMenu.vue`（水平菜单条；水平/混合模式下 header 左侧 logo 保留，且 logo 文字显示）+ SideMenu 共用菜单项常量。
- 新增 `src/components/layout/HeaderBar.vue`（折叠按钮 + 面包屑 + 右部操作）
- 新增 `src/components/layout/AppSettingsDrawer.vue`（设置抽屉）
- 菜单项常量（path/title/icon）集中在 `src/router/menu.js`，三处菜单共用。

### 2.3 折叠按钮
- `collapse-btn`：图标 18→20px、点击区约 40px（padding 9px、圆角 4px）、hover 高亮主色、`el-tooltip`「折叠/展开菜单」；**仅 layout==='vertical' 时显示**。

## 3. 设置抽屉

- 右上角新增齿轮图标（el-icon `Setting`）打开右侧抽屉（el-drawer，宽 280）。
- 内容：
  - **布局模式**：三张可点小卡片（垂直/水平/混合），选中态主色描边 + 浅色底。
  - **主题色**：五款预置 swatch：`#409eff` 蓝、`#67c23a` 绿、`#e6a23c` 橙、`#f56c6c` 红、`#9c27b0` 紫。
  - **暗黑模式**：el-switch。
  - **侧边栏折叠**：el-switch，仅 layout==='vertical' 时显示该行。
- 所有改动即时生效并自动保存到 localStorage。

## 4. 列表分页

### 4.1 后端（express 路由）
- `GET /api/datasets`、`GET /api/charts`、`GET /api/dashboards` 支持可选 `page`/`pageSize`：
  - 不带分页参数：返回全量数组（**保持现响应形状，兼容图表选择器/看板画布等全量调用**）。
  - 带分页参数：返回 `{ list, total }`（`total` 为未分页总数，`list` 为该页切片）。
- 实现：services 现有 list 函数结果 `slice`（数据量小，内存切片即可）；routes 解析 page（≥1）、pageSize（1–100）。

### 4.2 前端
- `src/api/index.js` 新增 `listPaged(page, pageSize)`：datasetApi / chartApi / dashboardApi（现有 `list()` 保持返回数组不变）。
- 三个列表页改造：
  - **DatasetList** / **ChartList** / **DashboardList**：改用 `listPaged`；新增 `el-pagination`（`background`、布局 `total, sizes, prev, pager, next`，页大小 10/20/50，默认 10），放在 page-card 底部。
  - 统计条数值改用 `total`。
  - 删除/改名后刷新当前页；若当前页越界则回退到上一页。
  - ChartList 的「已被看板引用」统计仍需**全量** `dashboardApi.list()` 计算 used chartId（一次轻量查询，不受分页影响）。

## 5. 看板编辑器：右侧图表库

- 编辑页 body 改 flex 行：左侧画布（flex:1）+ 右侧新增 `ChartLibraryPanel.vue`（宽 260px，白卡片）：
  - **图表** 区块：列出全部图表（名称 + 类型图标），**保留 `.chart-palette-item` 类名**（e2e 兼容）；已在看板的图表置灰并标「已在看板」且点击无效；未使用的可点击添加到看板末尾，也可 `draggable` 拖到画布（onCanvasDrop 逻辑不变）。
  - **通用组件** 区块：「添加文本」「添加筛选」两个按钮，沿用 DashboardEditor 现有弹窗（dialog 逻辑从工具栏迁到面板按钮触发，文案不变）。
- DashboardCanvas：**移除** `v-if="editable"` 顶部“添加图表”工具栏；保留网格、空态、drop 添加；空态文案改为「从右侧图表库点击或拖入」。

## 6. 看板编辑器：拖拽重排重做

### 6.1 问题根因
现有 `startReorder`：14px 小手柄 + mousemove 过程**实时 splice 重排**。流式布局中拖拽项随重排互相追赶，`elementFromPoint` 常命中自身或产生索引抖动，导致「拖不动/无法从前往后拖」。

### 6.2 新方案
- **拖拽区 = 整张卡片头部**（标题区，含 drag-handle 图标；点击落在 `.item-actions` 内则不触发）。
- **拖动过程只做视觉指示，不重排**：mousemove 时按鼠标落点计算目标插入位并高亮（`dragOverIdx` ref，目标项加描边），**mouseup 一次性 emit 新顺序**。
  - 插入位计算：落点在某卡片边界盒上 → 以卡片水平中线为界判前/后插入；落点在所有卡片下方/右方 → 追加到末尾。
- **前移/后移兜底按钮**：每张卡片头部加 `ArrowUp`（前移，swap 与上一位）与 `ArrowDown`（后移），边界处 disabled；stopPropagation 防止触发拖拽。
- 面板点击添加 / 拖到画布添加两条路径保留。

## 7. 验证与回归

- 后端：`node backend/scripts/integration-test.js`（列表接口不带分页参数时形状不变，应全绿）。
- 前端：`cd front-end && npm run build`。
- e2e 冒烟：`node scripts/e2e-smoke.cjs`，并**新增轻量断言**：
  - 数据集页出现 `.el-pagination`；
  - 打开设置抽屉、切暗黑 → 断言 `html.dark` 出现，随后恢复正常；
  - 看板编辑器右侧出现 `.chart-library-panel`，`.chart-palette-item` 仍在。
- 已知限制：暗黑模式下图表仅背景透明，系列/文字颜色不随主题变化；本次不做 i18n。