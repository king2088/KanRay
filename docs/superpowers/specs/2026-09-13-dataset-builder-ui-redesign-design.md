# 数据集构建器 UI 重做设计（M3.5）

日期：2026-09-13
状态：已评审（brainstorming 通过）
范围：前端重做，后端零改动

## 1. 背景与问题

M3 已交付可用的数据集构建器：纯SQL（textarea）/ 拖拉拽（点按钮+勾选）/ ETL（按钮+步骤条）。用户痛点反馈：

1. 纯 SQL 只是一个输入框，应有真正的代码编辑器体验。
2. 「拖拉拽」名不副实——没有任何拖拽，只是按钮和勾选；期望改为 dataEase 式字段管理。
3. ETL 期望观远 BI Smart ETL 的画布交互：左侧算子托盘 → 拖入画布 → 连线 → 点击节点配置 → 任意节点实时预览。
4. 「纯SQL、库、表格、字段拖拉拽、以及ETL设计」整体观感不佳，需要精修。

本计划在 **后端 `build_definition` 契约零改动** 的前提下重做前端交互与视觉。

## 2. 范围决策（brainstorming 确认）

| 决策点 | 结论 |
| --- | --- |
| 依赖预算 | 允许新增成熟库（CodeMirror 6 / Vue Flow / sortablejs） |
| ETL 语义深度 | 观远式**交互** + 保留「单输入、单条固定链」编译语义；不做多输入/DAG |
| 拖拉拽形态 | dataEase 式字段管理（勾选 + 拖拽排序 + 别名/类型/维度指标 + 关联 tab） |
| 深浅色 | **不改任何现有主题代码**；新增组件样式全部用既有 `--app-*` / `--el-*` CSS 变量，自动跟随 `html.dark` |
| 精修范围 | 构建器主页（三 tab）+ 数据源详情页库表树；数据集列表页不改 |
| 编辑态 tab 自动选中 | 从数据集列表「编辑构建」进入时，按 `build_definition.type` 映射到对应 tab（见 §5.5） |

## 3. 新增依赖（前端）

- `codemirror` + `@codemirror/lang-sql`：纯 SQL 编辑器（语法高亮 + 库表列自动补全）
- `@vue-flow/core` + `@vue-flow/background` + `@vue-flow/controls`：ETL 画布
- `sortablejs`：字段行拖拽排序（仅列表内排序；树→区上架用原生 HTML5 DnD）

## 4. 统一外壳（DataSourceBuilder.vue 改造）

- 页头保留：标题 + 数据源名/类型 + 名称输入 + 保存/返回。
- 三个 tab 不变（纯 SQL / 拖拉拽 / ETL），**编辑态按定义 type 自动选中**（§5.5）。
- 三栏骨架 `左目录面板 / 中编辑区 / 右预览·配置`，三 tab 共用同一套外壳与右栏。
- **目录只拉一次**：builder 页 onMounted 拉 `GET /api/datasources/:id/sql-assist`，构造 库→表→字段 树数据，以 prop 注入三 tab（替换现有各 tab 自拉逻辑）；sql-assist 已带列定义，无需懒加载。
- 共享组件 `SchemaTree`：库→表→字段树，字段按角色/类型给图标与徽标，hover 行操作（插字段 / 上架表 / 打开）。
- 深浅色：新样式一律 `var(--app-bg/card/border/hover/primary/…)`、`var(--el-*)`；不写死色值。

## 5. 三个 tab

### 5.1 纯 SQL（SqlBuilderTab）
- 中区改 CodeMirror 6：`sql()` 方言；自动补全来自共享目录（输入 `库.` 列补全、表名自动建议）；提供「插入字段/插入表」按钮与树双击插入（反引号包裹限定名）。
- 工具栏：预览 SQL → 右下预览表；「导入字段」把预览 fields 写入 `definition.fields`（注册语义不变）；错误内联显示。
- 输出定义结构不变：`{ type:'sql', sql, fields:[{name,label,type}] }`。
- CodeMirror 主题随 `html.dark` 切换（`EditorView.theme(..., {dark:…})`，dark 值监听根节点 class）。

### 5.2 拖拉拽 / 字段管理（DragBuilderTab，dataEase 式）
- 左：目录树，表卡片「上架」按钮 + 可拖到中区上架。
- 中：三个页签 `选字段 / 数据关联 / 聚合`。
- 选字段：上架表一行卡片，列变「字段行」——勾选=选中、别名可改（`fields[].label`）、维度/指标小切换、**行拖拽排序**（sortablejs）、卡片头全选/清空。
- 数据关联：每张额外表一行 join 配置（from.alias.field = to.alias.field，INNER/LEFT/RIGHT），同名列自动预填（现有逻辑保留）。
- 聚合：保留分组维度 + 聚合指标配置（`aggregation` 结构不变），预览走 `preview-aggregate`。
- 输出定义结构不变：`{ type:'builder', tables:[{alias,schema,table}], joins:[{fromAlias,fromField,toAlias,toField,type}], fields:[{alias,field,label,type}], aggregation? }`。
- **明确不做（本轮）**：新建计算字段 / 分组字段 / 字段复制（dataEase 3.7-3.9），留后续迭代。

### 5.3 ETL 画布（EtlBuilderTab 重构为 Vue Flow）
- 左：**算子托盘** 5 类算子图标卡片：`输入源 / JOIN / 过滤 / 聚合 / 输出`，支持拖入画布与点击添加。
- 中：Vue Flow 画布——网格点阵背景、算子类型配色节点卡、连线（反向可连箭头）；节点可拖动；使用 custom node 渲染算子图标/名称/错误态。
- **固定链约束**：全局保持 1 源 → 若干中间节点 → 1 输出；画布拒绝分支（一个输入只能连一条入边）、拒绝成环、拒绝第二源/第二输出；非法连线阻止并提示。输出推导的 `sourceNode` 链语义与后端一致。
- 新增算子上画布自动布局（等距排开）；工具栏：缩放 / 框架适配 / 小地图 / **撤销·重做**（快照栈 ≤30 步，观远同款）。
- 点击节点 → 右栏配置（沿用现有节点表单：源=表选择、JOIN=to/on、过滤=conditions、聚合=groupBy+metrics、输出=limit）；**「预览此节点」** → 右栏下方实时数据表（`preview-node`），预览失败节点标红。
- 数据双向同步：节点/连线/配置变更即时写回 `definition.nodes`；读取既有 `build_definition` 反向重建画布（无坐标时自动布局）。
- 输出定义结构不变：`{ type:'etl', nodes:[{nodeId,nodeType,sourceNode,…}] }`。

### 5.4 数据源详情库/表树（DataSourceDetail.vue）
- 树视觉精修：库/表/字段图标与角色徽标（dimension/metric/time），hover 操作（新建构建 / 创建数据集 / 展开列），保留现有 lazyload 与接口调用逻辑；仅改外观与交互细节。

### 5.5 编辑态 tab 自动映射
- `editDefinition.type` → tab：`sql → 'sql'`、`builder → 'drag'`、`etl → 'etl'`；无 `build_definition` 或未知 type → 默认 `'sql'`。
- 修复现 bug：目前直接 `activeMode = editDefinition.type`，`'builder'` 不是合法 tab 名会导致无选中。

## 6. 数据流与契约（零后端改动）

- 三 tab 各自维护本地定义与 `getDefinition()`；`@change` 更新 `liveDefinition`；保存走 `currentDefinition()` 现有逻辑（含 §5.5 映射）。
- 预览全部走现有接口：`preview-detail` / `preview-aggregate` / `preview-node`；
- 字段注册、`f_<i>` / `__alias__col` 命名、`deriveRegistryFields`、`nodeSql`、`saveBuiltDataset` 均不变。

## 7. 错误处理

- 预览/校验失败：所在区域内联红字提示，保留已编辑内容，不弹窗打扰。
- ETL 非法画布操作：拒连 + 内联提示；预览失败的节点红色描边。

## 8. 验证

- 后端：`npm test` 全绿（130），契约未动应保持不变。
- 前端：`npm run build` 通过。
- 手测/CDP 冒烟：
  - 三形态各从数据集列表「编辑构建」进入，断言 **tab 按定义 type 自动选中** 且定义可还原编辑再保存；
  - 纯 SQL 输入/补全/预览/导入字段；
  - 拖拉拽上架→勾选→排序→关联自动预填→聚合预览→保存；
  - ETL 托盘拖入→连线→逐节点预览→撤销/重做→删除输出被拒→保存；
  - 浅色 + 深色各截屏，确认新增组件无写死颜色、自动跟随主题。

## 9. 流程

brainstorming → 本 spec → writing-plans 实施计划 → 逐 task 实施（前后端回归 + CDP 冒烟）→ 提交。