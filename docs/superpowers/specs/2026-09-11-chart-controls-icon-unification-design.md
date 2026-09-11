# 图表配置面板 · 图标统一 + 九宫格位置选择器

日期：2026-09-11
状态：已批准（v2 按用户反馈修订）
取代：2026-09-11-chart-position-controls-design.md（EP 图标方案，已被本设计取代）

> **v2 修订（用户反馈）**：
> 1. 九宫格原先被推挤到面板右侧 → 改为 `.field-row` 内左对齐，紧跟在左侧标签后（positionGrid 与带图标 buttonGroup 行均左对齐）。
> 2. 九宫格每格「框+小圆点」在小按钮里看不清 → 改为**点阵式**：9 格共用单个大圆点图标（r=4.2），位置由 3×3 单元格本身表达，选中格整体高亮；格子放大到 32×32、图标 20px。
> 3. 方向 / 数据标签 / 饼图图标按钮太小 → 放大（按钮 ≥30×24、图标 18px），把 `el-button-group` 换成自定义 `.icon-btn-group`。
> 4. 全部方向 / 布局按钮无提示 → 每个 buttonGroup 按钮、九宫格格子、toggle（B/I）外层包 `el-tooltip`（content = 选项 title / 方位名）。

## 背景

用户反馈 EP 矢量图标（ArrowLeftBold / Aim 等）不够形象、不好看。同时图例「方向 / 水平位置 / 垂直位置」三组按钮放同一行，信息密度高但直觉弱。要求：用统一的自绘 SVG 图标语言替换全部方向 / 布局相关控件；图例和标题的位置选择改用九宫格。

## 设计目标

1. **统一图标语言**：所有方向 / 布局图标风格一致（24 viewBox、描边 1.7 圆头、currentColor、选中自动变蓝），EP 图标全部移除。
2. **九宫格位置选择器**：标题 / 图例的 left × top（3 × 3 = 9 组合）改为一个九宫格控件，每格一个「框 + 圆点」定位图标，直观。
3. **方向独立保留**：图例 orient（横排 / 竖排）保持独立控件，用新方向图标；不做智能联动。
4. **配置数据键不变**：title.left / title.top / legend.left / legend.top / legend.orient / label.position / pie.labelPosition / doughnut.labelPosition / treemap.orient —— 值集合不变，已存配置无影响。

## 统一图标家族（全部自绘，基于 Vue render-function）

### ① 位置（图表区域内）—— 九宫格选择器（点阵式）

用于：标题 left×top、legend left×top。

每个格子是**按方位偏移的实心圆点**（r=4.2，无外框）——点落在格子内的对应角落（24 viewBox 内：横 x=[5,12,19]，纵 y=[5,12,19]），点本身即表达该格方位；选中格整体高亮（蓝边框 + 浅蓝底 + 蓝点）。

九格映射：

| 列 \ 行 | row 0 | row 1 | row 2 |
|---|---|---|---|
| **col 0 (left)** | 左上 left=top · top=top | 左中 left=top · top=middle | 左下 left=top · top=bottom |
| **col 1 (center)** | 中上 left=center · top=top | 正中 left=center · top=middle | 中下 left=center · top=bottom |
| **col 2 (right)** | 右上 left=right · top=top | 右中 left=right · top=middle | 右下 left=right · top=bottom |

- 默认值：标题 → 中上 (center/top)，图例 → 中下 (center/bottom)
- 每个格子 32×32px，图标 20px；格子 tooltip = 方位名（左上 / 上中 / …）

### ② 方向（横排 / 竖排）—— 三格方块

用于：图例 orient、treemap orient。

图标：三个小圆角矩形（宽 4.6 × 高 5.6 或互换），分别 opacity 1 / 0.6 / 0.28。

- **横排**：三个方块水平并排，y 居中
- **竖排**：三个方块垂直堆叠，x 居中

### ③ 数据标签位置（上 / 下 / 左 / 右 / 内）—— 柱子 + 标签点

用于：label.position。

图标：中间一个半透明实心圆角矩形（10 × 5.6，rx=1.5，代表柱子 / 数据元素），外加一个小实心圆（r=2）代表标签。

- 上：点在 y=4.6（柱子上方）
- 下：点在 y=19.4（柱子下方）
- 左：点在 x=4.6（柱子左侧）
- 右：点在 x=19.4（柱子右侧）
- 内：点在 x=12, y=12（柱子内部，白色填充以示穿透）

### ④ 饼图 / 环形标签（外 / 内 / 居中）—— 圆饼 + 标签点

用于：pie.labelPosition、doughnut.labelPosition。

图标：圆环（cx=11.5, cy=12, r=7, stroke-only）+ 小实心圆（r=2）。

- 外：点在 x=20（圆右侧外）
- 内：点在 x=14.6, y=15.4（圆内偏右下）
- 居中：点在圆心

### ⑤ 图例对齐（自动 / 左 / 中 / 右）—— 文本行对齐预览

用于：legend.align（原为文本字形 ⇤≡⇥，v3 改为自绘图标）。

- 自动：双向箭头（↔，水平线 + 两端箭头）
- 左：四条对齐到左侧的横线（x1 固定 3，宽 15 / 11 / 14 / 8）
- 中：四条居中横线（围绕 x=12）
- 右：四条对齐到右侧的横线（x2 固定 21）

导出：`alignAuto, alignLeft, alignCenter, alignRight`。

### 不变的控件

- **加粗 / 斜体** toggle（B / I 文字字形）—— 不属于方向 / 布局，保持现状。
- **图例形状**下拉 select，selectWidth:100 —— 保持现状。
- **标题默认字号** 16 —— 保持现状。

## 九宫格控件实现规格

### Schema 声明

```js
// title
position: { type: 'positionGrid', label: '位置', default: { left: 'center', top: 'top' }, keys: ['left', 'top'] }
// legend
position: { type: 'positionGrid', label: '位置', default: { left: 'center', top: 'bottom' }, keys: ['left', 'top'] }
```

- `keys`：指出本控件实际写入的两个同级配置键（left / top），不改变配置结构。
- 原 left / top 独立字段从 schema 中移除。

### getDefaultsFromSchema 处理

positionGrid 字段不写 `result.position = {...}`，而是将其 default 对象 flatten 到 `keys` 对应的真实键上：

```js
if (field.type === 'positionGrid' && field.keys) {
  const def = field.default || {}
  for (const k of field.keys) result[k] = def[k] ?? ''
}
```

结果：`legend.left = 'center'`、`legend.top = 'bottom'`（与现有结构一致）。

### SchemaForm 渲染

- `positionGrid` 类型字段在 layout computed 中作为「单个单元格」渲染（不进入 row-group）。
- get：`{ left: getModelValue('left'), top: getModelValue('top') }`
- set：`setModelValue('left', val.left)` + `setModelValue('top', val.top)`

### SchemaControl 新增 positionGrid 控件

渲染为 3 × 3 表格（每格 32×32，图标 20px）：

```
┌───┬───┬───┐
│ ● │ ● │ ● │   row 0 (top)        ● 实际位于各自格子的左上/上中/右上
├───┼───┼───┤
│ ● │ ● │ ● │   row 1 (middle)     左中/居中/右中
├───┼───┼───┤
│ ● │ ● │ ● │   row 2 (bottom)     左下/下中/右下
└───┴───┴───┘
 col0   col1   col2
left  center  right
```

9 格各自使用对应的方位偏移点图标 `posTopLeft … posBotRight`（同 ① 节），选中格高亮（蓝边框 + `--el-color-primary-light-9` 底色 + 蓝点）；悬停同款高亮。

**tooltip 交互**：采用**单一容器级 tooltip**（非逐格），挂在 `.pos-grid` wrapper 上，`el-tooltip placement="right" enterable=false show-after=150ms hide-after=200ms`。内容随鼠标实时更新（`hoverLabel`），离开网格时回显当前选中方位。tooltip 弹层固定在网格右侧，不遮挡任何格子。

点击格子触发 `emit('change', { left: colMap[col], top: rowMap[row] })`。

行映射：`colMap = ['left', 'center', 'right']`，`rowMap = ['top', 'middle', 'bottom']`。

**布局**：positionGrid 与带图标的 buttonGroup 行在 `.field-row` 中左对齐（`justify-content: flex-start`），紧跟在左侧标签后，不再推挤到面板右侧。

## 图标文件结构

新建 `front-end/src/components/charts/control-icons.js`：

```js
import { h } from 'vue'

const svg = (children) => h('svg', {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 1.7,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
}, children)

// 九宫格单元格（按方位偏移的实心点，格子内角落/边缘）
export const posDotAt = (cx, cy) => () => svg([
  h('circle', { cx, cy, r: 4.2, fill: 'currentColor', stroke: 'none' }),
])

// ... 方向、数据标签、饼图标签组件同理
```

导出命名：`posTopLeft, posTopCenter, posTopRight, posMidLeft, posMidCenter, posMidRight, posBotLeft, posBotCenter, posBotRight`（九宫格 9 格方位偏移点）；`dirH, dirV`（方向）；`lblTop, lblBot, lblLeft, lblRight, lblIn`（数据标签）；`pieOut, pieIn, pieCenter`（饼图）。

这些 Vue 组件通过 `<component :is="opt.icon">` 渲染。图标为 render-function（`typeof opt.icon === 'function'`），SchemaControl 分支同时接受 `object` 与 `function`。

**尺寸与提示**：buttonGroup 按钮 ≥30×24（图标 18px）、九宫格格子 32×32（图标 20px）。全部图标按钮（buttonGroup、toggle B/I）包 `el-tooltip`（`enterable=false`、`show-after=200ms`）；九宫格用单一容器级 tooltip（见九宫格控件节）。

## 实现触点

| 文件 | 改动 |
|---|---|
| `front-end/src/components/charts/control-icons.js` | **新建**：全部自绘 SVG 组件 |
| `front-end/src/config/chart-configs.js` | 移除 EP 图标 import；引入 control-icons；title / legend left+top → positionGrid；label / pie / doughnut / treemap → 自定义图标 buttonGroup |
| `front-end/src/components/charts/SchemaControl.vue` | 新增 `positionGrid` 渲染分支（3×3 点阵网格）；buttonGroup 改自定义 `.icon-btn-group` 并加 `el-tooltip`；toggle 也加 `el-tooltip`；按钮 / 图标放大 |
| `front-end/src/components/charts/SchemaForm.vue` | positionGrid 在 layout 中单独渲染；get/set 读写两个真实键；**全部 `.field-row` 左对齐**（`justify-content: flex-start`，控制紧贴标签），不再按字段类型区分 |
| `front-end/scripts/e2e-config-panel.cjs` | 适配（图例行不再有 left/top row，变成 positionGrid 控件；数据标签/饼图标签图标按钮文本可能变；需要同步） |

## 验证

- `npm run build` 通过。
- 启动前后端，浏览器图表编辑页逐一检查：
  - 标题位置九宫格（3×3 点阵）正确渲染，当前默认格（中上）高亮；**格子位于标签右侧、左对齐**。
  - 点击不同格子后保存，`title.left/title.top` 值正确；悬停格子出现方位名 tooltip。
  - 图例位置九宫格同理，默认中下高亮，点选后 left/top 值正确。
  - 图例方向横排 / 竖排三格方块图标，点击保存 orient 值正确；悬停出现 tooltip。
  - 数据标签位置五个柱子+点图标正常，点击保存 position 值正确。
  - 饼图 / 环形标签三个圆+点图标正常，保存 labelPosition 值正确。
  - treemap 方向两图标正常。
  - 标题字号默认 16，图例形状下拉宽 100px。
  - 无页面报错。
- 跑 `e2e-config-panel.cjs`（适配后）回归。