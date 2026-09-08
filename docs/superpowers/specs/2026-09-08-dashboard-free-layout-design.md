# 看板编辑器：显式坐标自由摆放 + 边缘缩放 设计方案

日期：2026-09-08
范围：前端（Vue3 + Element Plus）。本方案**取代** `2026-09-08-admin-theme-and-dashboard-improvements-design.md` 第 6 节（旧"拖拽重排重做"）；第 5 节（右侧图表库）保留不变。
用户已确认的两个决策：**固定行高 150px**；冲突时**自动让位**。

---

## 1. 背景与根因

用户反馈编辑看板时：
- 拖放不跟手，无法拖到卡片区域后方的空白处（"让前面变空白"做不到）；
- 拖到其他卡片前/后难以控制；
- 无法在卡片边缘直接拖拽调整宽高，只能选"占几列"，希望保留选列的同时支持边缘缩放（按列/行取整）。

现有实现为 CSS Grid **流式布局**（`grid-auto-flow: row`），根因：
1. 流式布局自动从第一格左到右、上到下紧凑排布，**不存在空单元格**，因此"前空后满"在 CSS 层就无法表达；
2. 拖拽目标用 `document.elementFromPoint` 反查**实时重排后的 DOM**，位置互相追赶导致索引抖动（"超级难以控制"）；
3. 空白区域没有卡片可 hover，`closest('.grid-item')` 为空 → 无法拖到末尾；
4. 同行内只按垂直中线判定前后，多卡片同行时不精确。

结论：必须把棋盘改为**显式坐标（col/row）自由摆放**，空位成为一等公民。

## 2. 数据模型

看板 item 结构（保存到 `layout`，旧字段保留不动）：

```
{
  id, type: 'chart' | 'text' | 'filter',
  // …既有业务字段（chartId / content / datasetId / field / label 等）
  col: 1..12,      // 网格列起点（1 基）
  row: 1..,        // 网格行起点（1 基）
  w: 1..12,        // 占列数
  h: 1..,          // 占行数
}
```

- 行高固定 150px，12 列，`gap: 12px`。
- 网格纵向无上限（CSS Grid `grid-auto-rows` 自动向下延伸）。

## 3. 渲染

`.grid-body`：

- `display: grid; grid-template-columns: repeat(12, 1fr); grid-auto-rows: 150px; gap: 12px;`
- 每项显式定位：`grid-column: col / span w; grid-row: row / span h`。
- **移除** `grid-auto-flow` 依赖（不填满空位；空单元格直接留白）。
- `DashboardCanvas` 编辑/预览共用同一渲染；查看模式同样用 col/row 定位。

行高带来的观感：图表默认 `h:2` ≈ 292px 卡片高；表格 `max-height:100%`、数值卡、ECharts 均填满卡片（ChartTile 已 `height:100%`）。

## 4. 拖放（跟手 + 自由落位）

- 手柄：整张卡片头部（现状）；`mousedown` 落点在 `.item-actions`、缩放手柄内时不触发。
- 阈值 5px 后启动：复用现有 `drag-ghost`（`pointer-events:none`）跟随指针。
- **落点换算只基于指针 + 容器几何，不反查卡片 DOM**（这是解决抖动与"拖不动"的关键）：
  - 列：`col = clamp(1, 13 - w, floor((clientX - gridLeft) / (colWidth + gap)) + 1)`；
  - 行：`row = max(1, floor((clientY - gridTop) / (150 + gap)) + 1)`；
  - 列宽 `colWidth` 与容器内距在 dragstart 时测量一次。
- 拖动过程中目标格变化即实时更新该卡片 col/row（emit `update:items`），卡片**跟手移动**；mouseup 收尾。
- 拖到网格内任意空白处均有效（含底部空白区 → 行号增大）。

### 4.1 冲突与自动让位

- 目标区域与其它卡片相交时，按**行主序**（先列后行）扫描被占卡片：
  1. 收集与落点相交的其它卡片，按 `(row, col)` 排序；
  2. 逐个把相交卡片移动到"行主序已放置占位之外的下一个空格"（从自身位置起扫描；若全满则落到网格最下一个新空行）。
- 单趟确定性让位，无递归级联；网格无底 ⇒ 必有解。
- 纯函数 `resolveDrop(allItems, piece)` 在 `grid-layout.js`，可独立测试。

## 5. 边缘缩放

- 仅编辑模式；选中卡片后显示三个薄手柄：**右缘（改 w）、下缘（改 h）、右下角（同时改 w、h）**，命中区约 10px，cursor 分别 `col-resize` / `row-resize` / `nwse-resize`。
- 拖动即实时按列/行取整：
  - 右缘：`w = clamp(1, 12 - col + 1, round(拖拽终点的列跨度))`；
  - 下缘：`h = clamp(1, 无上限, round(拖拽终点的行跨度))`；
  - 右下角：两者同时。
- 保留现有「占 N 列」下拉（`Operation` 图标）作为快捷设置；`setWidth` 同时校验 `col + w ≤ 13` 否则回退。
- 缩放手柄在卡片缩放时保持可再次拖拽（不因指针移出卡片而中断；用 `setPointerCapture` 或 document 级监听）。

## 6. 旧布局迁移

- 纯函数 `normalizeLayout(items)`：
  - 已含 `col/row` 的项保持不变（容忍越界：`col` 裁剪到 `1..12`，`w` 裁剪到 `1..12-col+1`，`h ≥ 1`）；
  - 缺失 `col/row` 的项（旧流式数据）按**数组顺序**行主序铺入网格：从第一格起逐格尝试放下 `w×h`，跳过越界到下一格/下一行。
- `DashboardEditor.load()` 与 `DashboardView.load()` 统一调用 `normalizeLayout(dash.layout)`（内存态）；保存不变（layout 原样提交，此时已含 col/row）。旧看板零迁移成本。

## 7. 新增组件落位

`addChart` / `addText` / `addFilter` 新卡放入**行主序第一个空格**（`findFreeCell(items, w, h)`），与自动让位风格一致；不强制放最后。

## 8. 代码边界

- 新增 `src/utils/grid-layout.js`（**纯函数，无 DOM**）：
  - `normalizeLayout(items)`
  - `findFreeCell(items, w, h)`
  - `resolveDrop(items, piece)`（含自动让位）
  - `cellFromPointer({ clientX, clientY }, gridRect, gridGap, ROW_H, w)`（含列宽/行号换算；纯数学即可测）
  - 常量 `GRID_COLS = 12`、`ROW_H = 150`、`GAP = 12`
- `DashboardCanvas.vue`：渲染 + 指针交互（拖放、缩放），所有计算委托给 grid-layout；
- `DashboardView.vue` / `DashboardEditor.vue`：加载时 `normalizeLayout`。

## 9. 验证与回归

- 后端不动；前端 `npm run build`。
- grid-layout 纯函数：新增 `front-end/scripts/grid-layout-test.cjs`（Node 直接 import 纯函数断言）：
  - 迁移铺位（含 w=6/12、越界修剪）；
  - 冲突让位（相交卡被移到空位，最终无重叠）；
  - 落点换算（边界、列内距、行号）。
- e2e `scripts/e2e-smoke.cjs` 全量保持通过，并**新增**：
  - 头部拖到画布底部空白区 → 断言该卡 `grid-column`/`grid-row`（style）已变化；
  - 拖右缘手柄 → 断言 `w` 对应 `grid-column` 跨度增大（或「占 N 列」下拉联动）；
  - 冲突让位：拖 A 盖住 B → 断言 A、B 的 col/row 不重叠。
- 集成测试 `backend/scripts/integration-test.js` 与既有 e2e 断言（`.el-pagination`、暗黑切换、面板计数、12b 排序按钮）不回归。

## 10. 不做 / 已知限制

- 不做卡片自由层级（无 z-index 层叠布局）；
- 缩放只做右缘/下缘/右下角三个手柄；左缘、上缘、其它角落暂不做；
- 不做撤销/重做（本次范围外）。