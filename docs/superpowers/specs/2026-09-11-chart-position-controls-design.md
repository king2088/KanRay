# 图表配置面板：位置/方向控件图标化 + 标题默认字号 + 形状下拉宽度

日期：2026-09-11
状态：已批准

## 背景

图表编辑右侧配置面板中，标题、图例、数据标签等分组的位置/布局配置使用下拉选框（如「水平位置」「垂直位置」「布局方向」），层级深、需逐行点击。用户要求：

1. 默认标题文字大小改为 16。
2. 所有位置/方向下拉改为图标按钮组，并在各配置组内合并为一行显示（组间用分隔线）。
3. 图例「形状」行的下拉选项宽度固定为 100px。

## 目标

- 位置/方向控件全部图标化，更直观、更省空间。
- 配置数据键**完全不变**（`left`/`top`/`orient`/`position`/`labelPosition`/`shape` 等），已保存的图表配置不受影响。
- 新图表标题默认字号 16；图例/提示框文字默认仍为 12。

## 方案

### 1. 图标映射（全部使用 Element Plus 原生图标 `@element-plus/icons-vue`）

| 控件 | 值 | EP 图标 |
|---|---|---|
| 方向（orient，水平/垂直布局） | 水平 | `ArrowRightBold`（→） |
| 方向 | 垂直 | `ArrowDownBold`（↓） |
| 水平位置（left） | 左/中/右 | `ArrowLeftBold` / `Aim` / `ArrowRightBold` |
| 垂直位置（top） | 上/中/底 | `ArrowUpBold` / `Aim` / `ArrowDownBold` |
| 数据标签位置 | 上/下/左/右/内 | `ArrowUp` / `ArrowDown` / `ArrowLeft` / `ArrowRight` / `Position`(◎) |
| 饼图/环形图标签位置 | 外/内/居中 | `Expand` / `Fold` / `Aim` |

- 水平中与垂直中都使用 `Aim`（准星），靠「组」语境区分。
- 每个按钮 `title` 显示中文提示（沿用现有 `el-button :title` 机制）。

### 2. 一行布局（各配置组内）

```
标题组：  水平[← ≡ →]  ┇  垂直[↑ ≡ ↓]
图例组：  方向[→ ↓] · 水平[← ≡ →]  ┇  垂直[↑ ≡ ↓]
数据标签：位置[↑ ↓ ← → ◎]                      （单组一行）
饼图/环形：标签位置[外 内 居中]                 （单组一行）
treemap： 方向[→ ↓]                            （单组一行）
```

- 一行内不同「组」之间渲染细分隔线（`┇`）—— 新增字段标志 `separator`。
- 图例组布局：`方向` 与 `水平位置` 一组，`垂直位置` 一组（与 `方向` 组通过分隔线/间距隔开）。
- 图例既有 `对齐` 字段保持现状（独立一行，不属于位置语义）。
- 行内标签缩为两字：「水平」「垂直」「方向」。
- 图例「形状」下拉宽度固定 **100px**。

### 3. 尺寸约束（面板宽 300px）

- 图标按钮收紧为 `min-width: 24px`、`padding: 4px`（当前 buttonGroup 为 30px）。
- 行内字段标签字号 12px、label 与控件间距 4px。

### 4. 标题默认字号 16

- 新增独立 `STYLE_TITLE` 文字样式（`STYLE_TEXT` 副本，仅 `fontSize` 默认改 16），只用于 `title.textStyle`。
- 图例/提示框继续用 `STYLE_TEXT`（默认 12）。
- `EChartRenderer.vue` 标题回退值 `?? 14` → `?? 16`（空数据/占位标题保持 14 不动）。

## 实现触点

| 文件 | 改动 |
|---|---|
| `front-end/src/config/chart-configs.js` | 上述字段 `select`→`buttonGroup`，加 `row`/`separator` 标志；导入 EP 图标；新增 `STYLE_TITLE` |
| `front-end/src/components/charts/SchemaControl.vue` | `buttonGroup` 支持渲染 Vue 图标组件（`<component :is>`）；紧凑图标按钮样式 |
| `front-end/src/components/charts/SchemaForm.vue` | row 行内支持 `separator` 分隔线渲染 |
| `front-end/src/components/charts/EChartRenderer.vue` | 标题回退字号 16 |
| `front-end/scripts/e2e-config-panel.cjs` | 同步标签/选择器 |

## 验证

- `npm run build`（front-end）通过。
- 启动前后端，浏览器打开图表编辑页，人工/脚本检查：
  - 标题组、图例组、数据标签组图标按钮正确显示，不溢出 300px。
  - 点击图标后保存，`config.options.title.left/top`、`legend.orient/left/top`、`label.position` 等值与选择一致。
  - 新图表标题字号默认 16。
  - 图例「形状」下拉宽 100px。
- 跑 `front-end/scripts/e2e-config-panel.cjs`（按需适配 mac 环境）回归。