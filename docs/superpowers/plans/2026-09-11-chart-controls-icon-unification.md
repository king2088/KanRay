# 图标统一 + 九宫格位置选择器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用一套统一的自绘 SVG 图标替换全部方向/布局控件的 EP 图标；标题与图例位置改用九宫格选择器；配置键保持不变。

**Architecture:** 新增 `control-icons.js` 提供 render-function 自绘图标组件，经现有 `buttonGroup` 的 `icon` 字段与 `<component :is>` 机制渲染。新增 `positionGrid` 控件类型：单个 schema 字段通过 `keys` 声明读写两个同级配置键（left/top），`getDefaultsFromSchema` 将其 default flatten 到真实键；SchemaForm 双键读写；SchemaControl 新增 3×3 网格渲染。EP 图标 import 全部移除。

**Tech Stack:** Vue 3（render function + `h`）+ Element Plus 2.10.4 + Vite 8。验证 = `vite build` + Playwright e2e + 浏览器检查。

**Spec:** `docs/superpowers/specs/2026-09-11-chart-controls-icon-unification-design.md`

---

## Task 1: 新建 control-icons.js

**Files:**
- Create: `front-end/src/components/charts/control-icons.js`

全部自绘 SVG 组件，基于 Vue render-function：

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

// ① 九宫格单元格：框 + 点
const CELL = { x: 3.2, y: 3.2, w: 17.6, h: 17.6, rx: 3 }
const cell = (cx, cy) => () => svg([
  h('rect', { x: CELL.x, y: CELL.y, width: CELL.w, height: CELL.h, rx: CELL.rx, fill: 'none' }),
  h('circle', { cx, cy, r: 2.1, fill: 'currentColor', stroke: 'none' }),
])
const XS = [7, 12, 17], YS = [7, 12, 17]
export const posTopLeft = cell(XS[0], YS[0])
export const posTopCenter = cell(XS[1], YS[0])
export const posTopRight = cell(XS[2], YS[0])
export const posMidLeft = cell(XS[0], YS[1])
export const posMidCenter = cell(XS[1], YS[1])
export const posMidRight = cell(XS[2], YS[1])
export const posBotLeft = cell(XS[0], YS[2])
export const posBotCenter = cell(XS[1], YS[2])
export const posBotRight = cell(XS[2], YS[2])

// ② 方向：三格方块
const blk = (x, y, op) => h('rect', { x, y, width: 4.6, height: 5.6, rx: 1.2, fill: 'currentColor', stroke: 'none', opacity: op })
export const dirH = () => svg([blk(3.5, 9.2, 1), blk(9.7, 9.2, 0.6), blk(15.9, 9.2, 0.28)])
export const dirV = () => svg([blk(9.2, 3.5, 1), blk(9.2, 9.7, 0.6), blk(9.2, 15.9, 0.28)])

// ③ 数据标签位置：柱子 + 点
const bar = h('rect', { x: 7, y: 9.2, width: 10, height: 5.6, rx: 1.5, fill: 'currentColor', stroke: 'none', opacity: 0.85 })
const dot = (cx, cy, fill = 'currentColor') => h('circle', { cx, cy, r: 2, fill, stroke: 'none' })
export const lblTop = () => svg([bar, dot(12, 4.6)])
export const lblBot = () => svg([bar, dot(12, 19.4)])
export const lblLeft = () => svg([bar, dot(4.6, 12)])
export const lblRight = () => svg([bar, dot(19.4, 12)])
export const lblIn = () => svg([bar, dot(12, 12, '#fff')])

// ④ 饼图标签：圆 + 点
const ring = h('circle', { cx: 11.5, cy: 12, r: 7 })
export const pieOut = () => svg([ring, dot(20, 12)])
export const pieIn = () => svg([ring, dot(14.6, 15.4)])
export const pieCenter = () => svg([ring, dot(11.5, 12)])
```

---

## Task 2: getDefaultsFromSchema + SchemaControl/SchemaForm positionGrid 支持

**Files:**
- Modify: `front-end/src/config/chart-configs.js:479-489`（`getDefaultsFromSchema`）
- Modify: `front-end/src/components/charts/SchemaForm.vue`
- Modify: `front-end/src/components/charts/SchemaControl.vue`

### getDefaultsFromSchema（chart-configs.js）

在字段循环最前面插入 positionGrid 处理，将 default 左右上平铺到真实键：

```js
export function getDefaultsFromSchema(schema) {
  const result = {}
  for (const [key, field] of Object.entries(schema || {})) {
    if (field.type === 'positionGrid' && field.keys) {
      const def = field.default || {}
      for (const k of field.keys) result[k] = def[k] ?? ''
      continue
    }
    if (field.type === 'group' && field.children) {
      result[key] = getDefaultsFromSchema(field.children)
    } else if ('default' in field) {
      result[key] = field.default
    }
  }
  return result
}
```

### SchemaControl 新增 positionGrid 渲染（在 `el-alert` 之前插入）

模板：

```html
<div v-else-if="field.type === 'positionGrid'" class="pos-grid" :title="field.label">
  <table class="pos-grid-table">
    <tr v-for="(rowVal, r) in ROW_VALS" :key="rowVal">
      <td v-for="(colVal, c) in COL_VALS" :key="colVal">
        <button
          type="button"
          class="pos-grid-cell"
          :class="{ 'is-active': isGridActive(r, c) }"
          @click="emit('change', { left: colVal, top: rowVal })"
        >
          <el-icon :size="14"><component :is="GRID_ICONS[r][c]" /></el-icon>
        </button>
      </td>
    </tr>
  </table>
</div>
```

脚本（import + const，放在现有 props 之前）：

```js
import { posTopLeft, posTopCenter, posTopRight,
  posMidLeft, posMidCenter, posMidRight,
  posBotLeft, posBotCenter, posBotRight } from './control-icons'

const COL_VALS = ['left', 'center', 'right']
const ROW_VALS = ['top', 'middle', 'bottom']
const GRID_ICONS = [
  [posTopLeft, posTopCenter, posTopRight],
  [posMidLeft, posMidCenter, posMidRight],
  [posBotLeft, posBotCenter, posBotRight],
]

function isGridActive(r, c) {
  const v = props.value || {}
  return COL_VALS[c] === v.left && ROW_VALS[r] === v.top
}
```

（`props` 在下方已有定义，`isGridActive` 通过闭包或延迟解析可正常访问；Vue setup 中先 import const 再读 props 不影响。）

样式（追加到 `</script>` 之后或新增 `<style scoped>`）：

```css
.pos-grid-table { border-collapse: separate; border-spacing: 2px; }
.pos-grid-table td { padding: 0; }
.pos-grid-cell {
  width: 26px; height: 26px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: 4px; background: #fff; cursor: pointer;
  color: #6b7280; padding: 0;
}
.pos-grid-cell:hover { border-color: #409EFF; color: #409EFF; }
.pos-grid-cell.is-active { border-color: #409EFF; color: #409EFF; background: #ecf5ff; }
```

### SchemaForm 双键读写

在 `getModelValue` / `setModelValue` / `buildModel` 中处理 positionGrid：

`getModelValue`：
```js
function getModelValue(key) {
  const f = props.schema[key]
  if (f?.type === 'positionGrid' && f.keys) {
    const out = {}
    for (const k of f.keys) out[k] = localModel.value[k]
    return out
  }
  return localModel.value[key]
}
```

`setModelValue`：
```js
function setModelValue(key, val) {
  const f = props.schema[key]
  if (f?.type === 'positionGrid' && f.keys && val && typeof val === 'object') {
    let changed = false
    for (const k of f.keys) {
      if (localModel.value[k] !== val[k]) { localModel.value[k] = val[k]; changed = true }
    }
    if (changed) emitUpdate()
    return
  }
  if (localModel.value[key] !== val) {
    localModel.value[key] = val
    emitUpdate()
  }
}
```

`buildModel`（跳过 positionGrid 虚拟键，left/top 由 getDefaultsFromSchema 已填充）：

```js
function buildModel(source) {
  const result = { ...(source || {}) }
  for (const [key, field] of Object.entries(props.schema)) {
    if (field?.type === 'positionGrid' && field.keys) continue
    if (!(key in result)) {
      result[key] = getDefaultValue(field)
    }
    if (field.type === 'group' && field.children && (!result[key] || typeof result[key] !== 'object')) {
      result[key] = {}
    }
  }
  return result
}
```

构建验证 + commit。

---

## Task 3: chart-configs 接线（移除 EP 图标，引入新图标 + positionGrid）

**Files:**
- Modify: `front-end/src/config/chart-configs.js`

### 3a: 替换 import

移除：
```js
import {
  Aim, ArrowDown, ArrowDownBold, ArrowLeft, ArrowLeftBold,
  ArrowRight, ArrowRightBold, ArrowUp, ArrowUpBold, Expand, Fold, Position,
} from '@element-plus/icons-vue'
```

新增（control-icons.js 路径）：
```js
import { dirH, dirV, lblTop, lblBot, lblLeft, lblRight, lblIn, pieOut, pieIn, pieCenter } from '../components/charts/control-icons'
```

### 3b: 替换共享常量

删除 `H_POS_OPTIONS`、`V_POS_OPTIONS`（九宫格取代）；替换 `ORIENT_OPTIONS`、`LABEL_POS_OPTIONS`、`PIE_LABEL_POS_OPTIONS`：

```js
const ORIENT_OPTIONS = [
  { label: '横排', title: '横排', value: 'horizontal', icon: dirH },
  { label: '竖排', title: '竖排', value: 'vertical', icon: dirV },
]
const LABEL_POS_OPTIONS = [
  { label: '上', title: '上', value: 'top', icon: lblTop },
  { label: '下', title: '下', value: 'bottom', icon: lblBot },
  { label: '左', title: '左', value: 'left', icon: lblLeft },
  { label: '右', title: '右', value: 'right', icon: lblRight },
  { label: '内', title: '内', value: 'inside', icon: lblIn },
]
const PIE_LABEL_POS_OPTIONS = [
  { label: '外', title: '外', value: 'outside', icon: pieOut },
  { label: '内', title: '内', value: 'inside', icon: pieIn },
  { label: '居中', title: '居中', value: 'center', icon: pieCenter },
]
```

### 3c: title.children 重写

把 `left`/`top` 两个按钮组替换为一个 positionGrid：

```js
position: { type: 'positionGrid', label: '位置', default: { left: 'center', top: 'top' }, keys: ['left', 'top'] },
```

同时移除 `left:` / `top:` 两个字段。

### 3d: legend.children 重写

同理，把 `left`/`top` 替换为 positionGrid；orient 保留 buttonGroup（去掉 row 标志，单独成行）：

```js
position: { type: 'positionGrid', label: '位置', default: { left: 'center', top: 'bottom' }, keys: ['left', 'top'] },
orient: { type: 'buttonGroup', label: '方向', default: 'horizontal', options: ORIENT_OPTIONS, row: true },
```

### 3e: label / pie / doughnut / treemap 的 options

字段保持 `type: 'buttonGroup'`（或保留），仅 `options` 引用新常量。

构建验证 + commit。

---

## Task 4: 回归验证 + e2e 适配

**Files:**
- Modify: `front-end/scripts/e2e-config-panel.cjs`（若有断言被扰动）

- `npm run build` 通过。
- 起前后端（`cd backend && npm start`）+ 前端（`npm run dev`，确认端口）。
- 跑 e2e：`sed -e "s|C:/Program Files/Google/Chrome/Application/chrome.exe|/Applications/Google Chrome.app/Contents/MacOS/Google Chrome|" -e "s|http://localhost:5173|http://localhost:XXXX|g" scripts/e2e-config-panel.cjs > scripts/.e2e-mac.cjs && node scripts/.e2e-mac.cjs`。
- 期望：18/18（或调整后全通过）；若因九宫格取代 buttonGroup 导致字段 locator 找不到，则同步 e2e（例如图例行现为 positionGrid，不再有 `left`/`top` 的 row-field 标签；但 e2e 原来未引用 title.left/top，图例行的形状/宽/高不受影响）。数据标签 '位置' 字段如果在 e2e 被引用（`fieldRow(gLabel, '位置')`）需要验证仍可命中（positionGrid 渲染不产出 `.row-field` 内的文本"位置"——label 标签在 `pos-grid :title` 上，不在 DOM 文本里）。检查并按需适配。

有改动则单独提交。