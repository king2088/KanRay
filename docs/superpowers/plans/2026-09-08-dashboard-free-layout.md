# 看板编辑器：显式坐标自由摆放 + 边缘缩放 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把看板编辑器从流式布局改为显式坐标（col/row）自由摆放网格（固定 150px 行高、支持留白），卡片头部拖动跟手落位（冲突自动让位），卡片边缘横向/纵向按列取整缩放。

**Architecture:** 新增纯函数模块 `src/utils/grid-layout.js`（常量 + 迁移铺位 + 空格查找 + 落点换算 + 冲突让位），全部可脱离 DOM 测试；`DashboardCanvas.vue` 只负责渲染与指针交互（拖动/缩放都委托给纯函数）；`DashboardEditor` / `DashboardView` 加载时调用 `normalizeLayout` 迁移旧布局。纯函数测试用 `front-end/scripts/grid-layout-test.mjs`（Node ESM 直接跑），端到端回归沿用 `scripts/e2e-smoke.cjs`（Playwright）。

**Tech Stack:** Vue 3 `<script setup>`、Element Plus、Playwright Core（e2e）、Node 原生模块（纯函数测试）。前端 `"type": "module"`，`@` 别名指向 `front-end/src`。

---

## 文件结构

- Create `front-end/src/utils/grid-layout.js` —— 网格纯数学（无 DOM 依赖，唯一数据模型真相）。
- Create `front-end/scripts/grid-layout-test.mjs` —— 纯函数测试（Node 直接跑，无测试框架）。
- Modify `front-end/src/components/dashboard/DashboardCanvas.vue` —— 显式网格渲染、头部拖动落位、边缘缩放手柄、空间化上移/下移、新增组件落位。
- Modify `front-end/src/views/DashboardEditor.vue` —— `load()` 里 `normalizeLayout`。
- Modify `front-end/src/views/DashboardView.vue` —— `load()` 里 `normalizeLayout`。
- Modify `front-end/scripts/e2e-smoke.cjs` —— 12b 改为断言 grid-row 变化；新增拖到空白区、边缘缩放、无重叠不变式断言。

设计 spec：`docs/superpowers/specs/2026-09-08-dashboard-free-layout-design.md`（已批准）。

---

### Task 1: 网格纯函数 `grid-layout.js`（TDD）

**Files:**
- Create: `front-end/scripts/grid-layout-test.mjs`
- Create: `front-end/src/utils/grid-layout.js`

- [ ] **Step 1: Write the failing test**

Create `front-end/scripts/grid-layout-test.mjs`:

```js
import assert from 'node:assert/strict'
import {
  GRID_COLS, ROW_H, GAP,
  clamp, intersects, nextFreeCell, findFreeCell,
  normalizeLayout, resolveDrop, cellFromPointer,
} from '../src/utils/grid-layout.js'

let passed = 0
function t(name, fn) {
  fn()
  passed++
  console.log('  ok -', name)
}
function noOverlap(items) {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      assert.ok(!intersects(items[i], items[j]), `overlap: ${items[i].id} vs ${items[j].id}`)
    }
  }
}

// ---- normalizeLayout：旧流式数据迁移铺位 + 越界修剪 ----
t('normalize: 旧数据按顺序铺入网格', () => {
  const out = normalizeLayout([
    { id: 'a', type: 'chart', chartId: 1 },
    { id: 'b', type: 'text', content: 'x' },
    { id: 'c', type: 'chart', chartId: 2 },
  ])
  assert.equal(out[0].w, 6); assert.equal(out[0].h, 2); assert.deepEqual({ col: out[0].col, row: out[0].row }, { col: 1, row: 1 })
  assert.equal(out[1].w, 12); assert.equal(out[1].h, 1); assert.deepEqual({ col: out[1].col, row: out[1].row }, { col: 1, row: 3 })
  assert.deepEqual({ col: out[2].col, row: out[2].row }, { col: 1, row: 4 })
  noOverlap(out)
})

t('normalize: 已有坐标保留，越界被修剪', () => {
  const out = normalizeLayout([
    { id: 'a', type: 'chart', chartId: 1, col: 1, row: 1, w: 6, h: 2 },
    { id: 'b', type: 'chart', chartId: 2, col: 9, row: 1, w: 6, h: 1 },
    { id: 'c', type: 'text', content: '', col: 15, row: -2, w: 5, h: 1.6 },
  ])
  assert.deepEqual({ col: out[0].col, row: out[0].row }, { col: 1, row: 1 })
  assert.equal(out[1].col, 7, 'col9 + w6 越界应修剪到 7') // 12-6+1=7
  assert.equal(out[2].col, 1, '越界 col15 回退到 1')
  assert.equal(out[2].row, 1, '负行裁剪到 1')
  assert.equal(out[2].w, Math.round(5))
  assert.equal(out[2].h, Math.round(1.6))
})

t('normalize: 保留 item 业务字段', () => {
  const out = normalizeLayout([{ id: 'a', type: 'chart', chartId: 7, config: { x: 1 } }])
  assert.equal(out[0].chartId, 7)
  assert.deepEqual(out[0].config, { x: 1 })
})

// ---- nextFreeCell / findFreeCell ----
t('nextFreeCell: 跳过占用格，按行主序返回第一空位', () => {
  const occ = new Set()
  const a = { col: 1, row: 1, w: 6, h: 2 }
  for (let r = a.row; r < a.row + a.h; r++) for (let c = a.col; c < a.col + a.w; c++) occ.add(`${r}_${c}`)
  const cell = nextFreeCell(occ, 6, 2, 1)
  assert.deepEqual(cell, { col: 7, row: 1 }, 'a 占 1-6 列，w6 应落在第 7 列')
})

t('findFreeCell: 基于 items 计算第一个空位', () => {
  const items = [{ id: 'a', col: 1, row: 1, w: 6, h: 2 }]
  assert.deepEqual(findFreeCell(items, 6, 2), { col: 7, row: 1 })
  assert.deepEqual(findFreeCell(items, 12, 1), { col: 1, row: 3 })
})

// ---- resolveDrop：落位 + 自动让位 ----
t('resolveDrop: 落点无冲突 → 仅移动该卡', () => {
  const items = [
    { id: 'a', type: 'chart', chartId: 1, col: 1, row: 1, w: 6, h: 2 },
    { id: 'b', type: 'text', content: '', col: 1, row: 3, w: 6, h: 1 },
  ]
  const out = resolveDrop(items, { id: 'a', col: 4, row: 5, w: 6, h: 2 })
  assert.deepEqual({ col: out[0].col, row: out[0].row }, { col: 4, row: 5 })
  assert.deepEqual({ col: out[1].col, row: out[1].row }, { col: 1, row: 3 }, 'b 不动')
  noOverlap(out)
})

t('resolveDrop: 落点与其它卡冲突 → 自动让位且无重叠', () => {
  const items = [
    { id: 'a', type: 'chart', chartId: 1, col: 1, row: 1, w: 6, h: 2 },
    { id: 'b', type: 'chart', chartId: 2, col: 7, row: 1, w: 6, h: 2 },
  ]
  const out = resolveDrop(items, { id: 'a', col: 4, row: 1, w: 6, h: 2 })
  assert.deepEqual({ col: out[0].col, row: out[0].row }, { col: 4, row: 1 }, 'a 落（4,1）占 4-9 列')
  const b = out[1]
  assert.ok(b.row > 1 || b.col < 4 || b.col > 9, `b 被让位到不在 a 区域内：(col${b.col},row${b.row})`)
  noOverlap(out)
})

t('resolveDrop: piece 列越界被 clamp', () => {
  const items = [{ id: 'a', type: 'chart', chartId: 1, col: 1, row: 1, w: 6, h: 2 }]
  const out = resolveDrop(items, { id: 'a', col: 99, row: 1, w: 6, h: 2 })
  assert.equal(out[0].col, 7, '12-6+1=7')
})

t('resolveDrop: 让位后业务字段保留', () => {
  const items = [
    { id: 'a', type: 'chart', chartId: 1, col: 1, row: 1, w: 6, h: 2 },
    { id: 'b', type: 'text', content: 'hi', col: 7, row: 1, w: 6, h: 1 },
  ]
  const out = resolveDrop(items, { id: 'a', col: 7, row: 1, w: 6, h: 2 })
  const b = out.find((x) => x.id === 'b')
  assert.equal(b.content, 'hi')
  noOverlap(out)
})

// ---- cellFromPointer：指针 → 行列 ----
const gridRect = { left: 100, top: 200, width: 1200 } // 12 列、GAP 12 → 列宽 (1200-132)/12=89，节距 101；行距 162
t('cellFromPointer: 左上角 → (1,1)', () => {
  assert.deepEqual(cellFromPointer(100, 200, gridRect, 6), { col: 1, row: 1 })
})
t('cellFromPointer: 第二格中点 → (2,1)', () => {
  assert.deepEqual(cellFromPointer(100 + 89 + 12 + 44, 200, gridRect, 6), { col: 2, row: 1 })
})
t('cellFromPointer: w=6 右边缘越界 → clamp 到 (7,1)', () => {
  assert.deepEqual(cellFromPointer(1300, 200, gridRect, 6), { col: 7, row: 1 })
})
t('cellFromPointer: 行计算 + w=12 恒在第一列', () => {
  assert.deepEqual(cellFromPointer(1300, 200 + 162, gridRect, 12), { col: 1, row: 2 })
})

// ---- 常量 ----
t('常量: GRID_COLS=12, ROW_H=150, GAP=12', () => {
  assert.equal(GRID_COLS, 12)
  assert.equal(ROW_H, 150)
  assert.equal(GAP, 12)
})

console.log(`grid-layout 测试：${passed} 项通过`)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/grid-layout-test.mjs`（workdir `front-end`）
Expected: FAIL —— `ERR_MODULE_NOT_FOUND` / `Cannot find module ... grid-layout.js`（模块尚不存在）。

- [ ] **Step 3: Write minimal implementation**

Create `front-end/src/utils/grid-layout.js`:

```js
export const GRID_COLS = 12
export const ROW_H = 150
export const GAP = 12

export function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

function regionKey(r, c) {
  return `${r}_${c}`
}

function occupy(occupied, col, row, w, h) {
  for (let r = row; r < row + h; r++) {
    for (let c = col; c < col + w; c++) occupied.add(regionKey(r, c))
  }
}

function regionFree(occupied, col, row, w, h) {
  for (let r = row; r < row + h; r++) {
    for (let c = col; c < col + w; c++) {
      if (occupied.has(regionKey(r, c))) return false
    }
  }
  return true
}

export function intersects(a, b) {
  return !(a.col + a.w <= b.col || b.col + b.w <= a.col || a.row + a.h <= b.row || b.row + b.h <= a.row)
}

/** 行主序（先列后行）查找第一个能放下 w×h 的空格，从 fromRow 起 */
export function nextFreeCell(occupied, w, h, fromRow = 1) {
  const start = Math.max(1, Math.round(fromRow || 1))
  let rowLimit = start
  for (const key of occupied) {
    const r = Number(key.split('_')[0])
    if (r + 1 > rowLimit) rowLimit = r + 1
  }
  rowLimit += h
  for (let row = start; row <= rowLimit; row++) {
    for (let c = 1; c <= GRID_COLS - w + 1; c++) {
      if (regionFree(occupied, c, row, w, h)) return { col: c, row }
    }
  }
  return { col: 1, row: rowLimit }
}

/** items 成员需含 col/row/w/h；找出能放下 w×h 的第一空位 */
export function findFreeCell(items, w, h) {
  const occupied = new Set()
  items.forEach((it) => occupy(occupied, it.col, it.row, it.w, it.h))
  return nextFreeCell(occupied, w, h)
}

/** 旧流式数据迁移 / 越界修剪；返回新数组，业务字段原样保留 */
export function normalizeLayout(items) {
  const occupied = new Set()
  return items.map((it) => {
    const w = clamp(Math.round(Number(it.w) || (it.type === 'chart' ? 6 : 12)), 1, GRID_COLS)
    const h = Math.max(1, Math.round(Number(it.h) || (it.type === 'chart' ? 2 : 1)))
    const hasCol = Number.isFinite(Number(it.col)) && Math.round(Number(it.col)) >= 1
    const hasRow = Number.isFinite(Number(it.row)) && Math.round(Number(it.row)) >= 1
    let col, row
    if (hasCol && hasRow) {
      col = clamp(Math.round(Number(it.col)), 1, GRID_COLS - w + 1)
      row = Math.max(1, Math.round(Number(it.row)))
    } else {
      const cell = nextFreeCell(occupied, w, h, 1)
      col = cell.col
      row = cell.row
    }
    occupy(occupied, col, row, w, h)
    return { ...it, w, h, col, row }
  })
}

/**
 * 落位（含自动让位）：把 piece 移到 (col,row)，与其相交的其它卡按行主序平移到最近空格。
 * piece 需含 id/col/row/w/h；不修改入参，返回新数组。
 */
export function resolveDrop(items, piece) {
  const col = clamp(Math.round(piece.col), 1, GRID_COLS - piece.w + 1)
  const row = Math.max(1, Math.round(piece.row))
  const target = { ...piece, col, row }

  const others = items.filter((it) => it.id !== piece.id)
  const displaced = others.filter((it) => intersects(target, it))
  if (displaced.length === 0) {
    return items.map((it) => (it.id === piece.id ? { ...it, col, row } : it))
  }

  const occupied = new Set()
  others.forEach((it) => occupy(occupied, it.col, it.row, it.w, it.h))
  occupy(occupied, col, row, target.w, target.h)

  displaced.sort((a, b) => (a.row - b.row) || (a.col - b.col))
  const moved = new Map()
  displaced.forEach((d) => {
    const cell = nextFreeCell(occupied, d.w, d.h, d.row)
    occupy(occupied, cell.col, cell.row, d.w, d.h)
    moved.set(d.id, { col: cell.col, row: cell.row })
  })

  return items.map((it) => {
    if (it.id === piece.id) return { ...it, col, row }
    const m = moved.get(it.id)
    return m ? { ...it, ...m } : it
  })
}

/** 指针坐标 → 网格行列（列按 w 裁剪），gridRect 为 .grid-body 的 getBoundingClientRect() */
export function cellFromPointer(clientX, clientY, gridRect, w) {
  const colWidth = (gridRect.width - GAP * (GRID_COLS - 1)) / GRID_COLS
  const rawCol = Math.floor((clientX - gridRect.left) / (colWidth + GAP)) + 1
  const rawRow = Math.floor((clientY - gridRect.top) / (ROW_H + GAP)) + 1
  return {
    col: clamp(rawCol, 1, GRID_COLS - w + 1),
    row: Math.max(1, rawRow),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/grid-layout-test.mjs`（workdir `front-end`）
Expected: `grid-layout 测试：15 项通过`（全部 ok）。

- [ ] **Step 5: Commit**

```bash
git add front-end/src/utils/grid-layout.js front-end/scripts/grid-layout-test.mjs
git commit -m "feat(grid-layout): pure grid math with layout normalize, free-cell find and auto-shift drop"
```

---

### Task 2: 显式网格渲染 + 旧布局迁移 + 空间化上移/下移

**Files:**
- Modify: `front-end/src/components/dashboard/DashboardCanvas.vue`
- Modify: `front-end/src/views/DashboardEditor.vue`
- Modify: `front-end/src/views/DashboardView.vue`
- Modify: `front-end/scripts/e2e-smoke.cjs:157-165`（12b 断言改空间化）

- [ ] **Step 1: DashboardCanvas —— 网格容器与卡片定位**

在 `DashboardCanvas.vue`：

（1）`<script setup>` 顶部 import 换成 grid-layout 常量（**删除**本地 `const GRID_COLS = 12`）：

```js
import { cellFromPointer, clamp, findFreeCell, normalizeLayout, resolveDrop, GRID_COLS, ROW_H, GAP } from '@/utils/grid-layout'
```

（2）删除 `const gridItems = ref([])`，改为 `const gridBodyRef = ref(null)`。

（3）`itemStyle` 改为显式定位：

```js
function itemStyle(item) {
  return {
    gridColumn: `${item.col ?? 1} / span ${Math.min(item.w || GRID_COLS, GRID_COLS)}`,
    gridRow: `${item.row ?? 1} / span ${Math.max(1, item.h || 1)}`,
  }
}
```

（4）`moveItem` 从"数组换位"改为"空间平移"（上移/下移一行，冲突自动让位）：

```js
function moveItem(idx, dir) {
  const it = props.items[idx]
  if (!it) return
  const row = Math.max(1, it.row + dir)
  if (row === it.row) return
  emit('update:items', resolveDrop(props.items, { ...it, row }))
}
```

（5）`setWidth` 改为 emit、且按 `col` 裁剪：

```js
function setWidth(item, w) {
  const maxW = GRID_COLS - (item.col || 1) + 1
  const nw = clamp(w, 1, maxW)
  emit('update:items', props.items.map((it) => (it.id === item.id ? { ...it, w: nw } : it)))
}
```

（6）模板：`.grid-body` 加 `ref="gridBodyRef"`；删除卡片 `:ref="gridItems"` 与 `:class` 里的无关项不动（`--dragging` 保留）。下拉 options 增加越界禁用：

```html
<el-dropdown-item v-for="w in [4, 6, 8, 10, 12]" :key="w" :command="w"
  :disabled="item.w === w || w > GRID_COLS - (item.col || 1) + 1">
  占 {{ w }} 列
</el-dropdown-item>
```

（7）`<style scoped>`：`.grid-body` 行高改为固定 150px：

```css
.grid-body {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-auto-rows: 150px;
  gap: 12px;
  align-content: start;
}
```

保留 `--dragging` 透明/虚线样式（仍在）。

- [ ] **Step 2: DashboardEditor / DashboardView 加载迁移**

`DashboardEditor.vue` `load()`：

```js
items.value = normalizeLayout(dash.layout)
```

`DashboardView.vue` `load()`（注意 import 顶部新增）：

```js
items.value = normalizeLayout(dash.layout)
```

两文件 `script` 顶部都补：

```js
import { normalizeLayout } from '@/utils/grid-layout'
```

- [ ] **Step 3: e2e 12b 改为断言 grid-row 变化**

`DashboardCanvas` 仍忽略拖拽（Task 3 才接上），但 12b 必须适配空间化上移/下移。`e2e-smoke.cjs:157-165` 整块替换为：

```js
// 9b. 空间化移动：上移/下移应改变 grid-row
const rowOf = (el) => (el.getAttribute('style') || '').match(/grid-row:\s*(\d+)/)?.[1] || null;
const firstRowBefore = await page.locator('.grid-item').nth(0).evaluate(rowOf);
await page.locator('.grid-item').nth(0).locator('.item-actions .act-btn').nth(1).click(); // ArrowDown
await sleep(400);
const firstRowAfter = await page.locator('.grid-item').nth(0).evaluate(rowOf);
log('12b 下移前 row =', firstRowBefore, '| 下移后 row =', firstRowAfter);
if (!firstRowAfter || firstRowAfter === firstRowBefore) throw new Error('空间移动未生效');
await page.locator('.grid-item').nth(0).locator('.item-actions .act-btn').nth(0).click(); // ArrowUp 还原
await sleep(400);
```

`rowOf` 取 `style` 里的 `grid-row: N / span M`（nth(0) 是新筛选卡或第一个图表，取决于数组序；下移 1 行必变）。

- [ ] **Step 4: Build**

Run: `npm run build`（workdir `front-end`）
Expected: `built in …`，无 error。

- [ ] **Step 5: 全量 e2e（此时覆盖 12b 新断言）**

Run: `node scripts/e2e-smoke.cjs`（workdir `front-end`，前置：后端 :3001、前端 :5173 已启动）
Expected: `SMOKE TEST PASSED`，`=== 页面错误 === 无`。

- [ ] **Step 6: Commit**

```bash
git add front-end/src/components/dashboard/DashboardCanvas.vue front-end/src/views/DashboardEditor.vue front-end/src/views/DashboardView.vue front-end/scripts/e2e-smoke.cjs
git commit -m "feat(dashboard): render items on explicit col/row grid with legacy layout migration"
```

---

### Task 3: 头部拖动 → 跟手落位（自由摆放）

**Files:**
- Modify: `front-end/src/components/dashboard/DashboardCanvas.vue`（`beginDrag` / `buildGhost` 保留 / 删 `targetIndexAt`）

- [ ] **Step 1: 重写拖拽逻辑**

删除 `targetIndexAt` 函数。将 `beginDrag` 整体替换为（落点换算只用指针 + 容器几何，实时 emit `resolveDrop`）：

```js
function beginDrag(e, idx) {
  if (!props.editable) return
  if (e.target.closest('.item-actions') || e.target.closest('.resize-handles')) return
  if (e.button !== 0) return
  e.preventDefault()

  const item = props.items[idx]
  if (!item) return
  selectedId.value = item.id
  draggingId.value = item.id

  const gridRect = gridBodyRef.value.getBoundingClientRect()
  const startX = e.clientX
  const startY = e.clientY
  let started = false
  ghostEl = null

  const onMove = (ev) => {
    if (!started) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return
      started = true
      ghostEl = buildGhost(item)
      document.body.classList.add('is-dragging-card')
    }
    moveGhost(ev)
    const cur = props.items.find((i) => i.id === item.id)
    if (!cur) return
    const { col, row } = cellFromPointer(ev.clientX, ev.clientY, gridRect, cur.w)
    if (col === cur.col && row === cur.row) return
    emit('update:items', resolveDrop(props.items, { ...cur, col, row }))
  }

  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    draggingId.value = null
    if (ghostEl) {
      ghostEl.remove()
      ghostEl = null
    }
    document.body.classList.remove('is-dragging-card')
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}
```

`buildGhost` / `moveGhost` / `onBeforeUnmount` 清理逻辑保持不变。

- [ ] **Step 2: Build**

Run: `npm run build`（workdir `front-end`）
Expected: `built in …`，无 error。

- [ ] **Step 3: 手动探针验证拖到空白区**

用 Node + Playwright 执行（workdir `front-end`；后端 :3001、前端 :5173 已启动）：

```bash
node -e "const{chromium}=require('playwright-core');(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const p=await b.newPage({viewport:{width:1440,height:900}});await p.goto('http://localhost:5173/dashboards',{waitUntil:'networkidle'});const rows=await p.\$\$eval('tbody tr',els=>els.map(e=>e.textContent.trim()).filter(x=>x));console.log('dash rows',rows.length);await b.close()})().catch(e=>{console.error(e.message);process.exit(1)})"
```

（该探针仅确认看板列表可达；真正拖拽验证在 Task 5 的 e2e 断言里固化。若想即时验证，可临时进编辑器用浏览器手动拖拽。）

- [ ] **Step 4: Commit**

```bash
git add front-end/src/components/dashboard/DashboardCanvas.vue
git commit -m "feat(dashboard): drag card to free grid cells with auto-shift, following pointer"
```

---

### Task 4: 卡片边缘缩放 + 下拉裁剪

**Files:**
- Modify: `front-end/src/components/dashboard/DashboardCanvas.vue`

- [ ] **Step 1: 模板加缩放手柄**

在 `.item-actions` 结束标签之后、`</div>`（`.item-header`）之前加入（选中卡片时才显示）：

```html
<span v-if="editable && selectedId === item.id" class="resize-handles">
  <span class="rh rh--e" :title="`宽度 ${item.w} 列`" @mousedown.stop="beginResize($event, 'e', item)" />
  <span class="rh rh--s" :title="`高度 ${item.h} 行`" @mousedown.stop="beginResize($event, 's', item)" />
  <span class="rh rh--se" @mousedown.stop="beginResize($event, 'se', item)" />
</span>
```

注意：`.item-actions` 内 `@click.stop` 已阻止冒泡；手柄用 `.stop` 防止触发 beginDrag（beginDrag 顶部也有 `.resize-handles` 守卫，双保险）。

- [ ] **Step 2: 新增 beginResize 逻辑**

在 `setWidth` 之后加入：

```js
function beginResize(e, dir, item) {
  e.preventDefault()
  e.stopPropagation()
  if (e.button !== 0) return

  const gridRect = gridBodyRef.value.getBoundingClientRect()
  const colWidth = (gridRect.width - GAP * (GRID_COLS - 1)) / GRID_COLS
  const baseCol = item.col || 1
  const baseRow = item.row || 1
  const cardLeft = gridRect.left + (baseCol - 1) * (colWidth + GAP)
  const cardTop = gridRect.top + (baseRow - 1) * (ROW_H + GAP)
  let curW = item.w
  let curH = item.h

  const onMove = (ev) => {
    let w = curW
    let h = curH
    if (dir.includes('e')) {
      w = clamp(Math.max(1, Math.round((ev.clientX - cardLeft) / (colWidth + GAP))), 1, GRID_COLS - baseCol + 1)
    }
    if (dir.includes('s')) {
      h = Math.max(1, Math.round((ev.clientY - cardTop) / (ROW_H + GAP)))
    }
    if (w === curW && h === curH) return
    curW = w
    curH = h
    emit('update:items', props.items.map((it) => (it.id === item.id ? { ...it, w, h } : it)))
  }

  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}
```

- [ ] **Step 3: 样式**

`.grid-item` 加 `position: relative;`，并新增：

```css
.resize-handles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.rh {
  position: absolute;
  pointer-events: auto;
}

.rh--e { top: 34px; right: -5px; bottom: 0; width: 10px; cursor: col-resize; }
.rh--s { left: 0; right: 0; bottom: -5px; height: 10px; cursor: row-resize; }
.rh--se { right: -5px; bottom: -5px; width: 16px; height: 16px; cursor: nwse-resize; }
.rh:hover { background: rgba(64, 158, 255, 0.25); }
```

- [ ] **Step 4: Build**

Run: `npm run build`（workdir `front-end`）
Expected: `built in …`，无 error。

- [ ] **Step 5: Commit**

```bash
git add front-end/src/components/dashboard/DashboardCanvas.vue
git commit -m "feat(dashboard): edge resize handles snapped to grid columns and rows"
```

---

### Task 5: 新增组件落位 + e2e 新增断言 + 全量回归

**Files:**
- Modify: `front-end/src/components/dashboard/DashboardCanvas.vue`（`addChart` / `addText` / `addFilter`）
- Modify: `front-end/scripts/e2e-smoke.cjs`

- [ ] **Step 1: 新增组件放入第一个空格**

三个 add 函数改为落位到 `findFreeCell`：

```js
function addChart(chart) {
  const id = `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const cell = findFreeCell(props.items, 6, 2)
  emit('add-item', { id, type: 'chart', chartId: chart.id, w: 6, h: 2, col: cell.col, row: cell.row })
}

function addText(content) {
  const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const cell = findFreeCell(props.items, 12, 1)
  emit('add-item', { id, type: 'text', content: content || '', w: 12, h: 1, col: cell.col, row: cell.row })
}

function addFilter(opts) {
  const id = `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const cell = findFreeCell(props.items, 12, 1)
  emit('add-item', { id, type: 'filter', ...opts, w: 12, h: 1, col: cell.col, row: cell.row })
}
```

- [ ] **Step 2: e2e 加固 —— 在 12b 块之后（第 165 行后）插入新断言**

```js
// 9c. 头部拖动到画布底部空白区 → grid-row 应增大（自由落位）
const dragHeaderTo = async (itemIndex, targetX, targetY) => {
  const hb = await page.locator('.grid-item').nth(itemIndex).locator('.item-header').boundingBox();
  const target = await page.locator('.grid-body').boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + targetX, target.y + targetY, { steps: 15 });
  await page.mouse.up();
  await sleep(600);
};
const rowBefore = await page.locator('.grid-item').nth(0).evaluate(rowOf);
await dragHeaderTo(0, 600, 620); // 落点远离当前卡片，进入底部空白
const rowAfter = await page.locator('.grid-item').nth(0).evaluate(rowOf);
log('12c 拖到空白区 前 row =', rowBefore, '| 后 row =', rowAfter);
if (!rowAfter || Number(rowAfter) <= Number(rowBefore)) throw new Error('拖到空白区未移动');

// 12d 整体无重叠不变式（解析每卡 grid-column/grid-row）
const parseGrid = (styleText) => {
  const col = styleText.match(/grid-column:\s*(\d+)\s*\/\s*span\s*(\d+)/);
  const row = styleText.match(/grid-row:\s*(\d+)\s*\/\s*span\s*(\d+)/);
  return col && row ? { col: +col[1], w: +col[2], row: +row[1], h: +row[2], style: styleText } : null;
};
const cards = await page.$$eval('.grid-item', (els) => els.map((e) => e.getAttribute('style')));
const parsed = cards.map(parseGrid).filter(Boolean);
for (let i = 0; i < parsed.length; i++) {
  for (let j = i + 1; j < parsed.length; j++) {
    const a = parsed[i], b = parsed[j];
    const overlap = !(a.col + a.w <= b.col || b.col + b.w <= a.col || a.row + a.h <= b.row || b.row + b.h <= a.row);
    if (overlap) throw new Error(`20 卡片重叠: ${a.style} vs ${b.style}`);
  }
}
log('12d 布局无重叠 ✓');

// 12e. 边缘缩放：先点击选中第一卡，拖右缘手柄增宽 → grid-column span 增大
await page.locator('.grid-item').nth(0).click();
await sleep(300);
const spanBefore = await page.locator('.grid-item').nth(0).locator('.item-header').evaluate(
  (el) => { const s = el.closest('.grid-item').getAttribute('style'); const m = s.match(/grid-column:\s*\d+\s*\/\s*span\s*(\d+)/); return m ? +m[1] : 0; }
);
const handle = await page.locator('.grid-item').nth(0).locator('.rh--e').boundingBox();
const gb = await page.locator('.grid-body').boundingBox();
const colSlot = (gb.width - 12 * 11) / 12 + 12;
await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
await page.mouse.down();
await page.mouse.move(handle.x + handle.width / 2 + colSlot * 2, handle.y + handle.height / 2, { steps: 12 });
await page.mouse.up();
await sleep(600);
const spanAfter = await page.locator('.grid-item').nth(0).locator('.item-header').evaluate(
  (el) => { const s = el.closest('.grid-item').getAttribute('style'); const m = s.match(/grid-column:\s*\d+\s*\/\s*span\s*(\d+)/); return m ? +m[1] : 0; }
);
log('12e 右缘缩放 span', spanBefore, '→', spanAfter);
if (!(spanAfter > spanBefore)) throw new Error('边缘缩放未生效');
```

注意：`parseGrid` / `rowOf` 在 12b 已定义位置共享；`dragHeaderTo` 落点 `(600, 620)` 相对 `.grid-body` 左上，第一卡在 `(1,1)` 附近，新卡是 12 列宽的筛选/文本在下方，落点 600px 右、620px 下大概率进入底部空行（行距 162px），row 必 > 原值。若第一卡已是整行 12 列卡（filter/text），仍可落（拖动会同时把同行的其它卡让位）。

- [ ] **Step 3: Build + 全量 e2e**

Run: `npm run build`（workdir `front-end`）→ `built in …`
Run: `node scripts/grid-layout-test.mjs`（workdir `front-end`）→ `grid-layout 测试：15 项通过`
Run: `node scripts/e2e-smoke.cjs`（workdir `front-end`，后端 :3001、前端 :5173 已启动）→ `SMOKE TEST PASSED`，`=== 页面错误 === 无`

- [ ] **Step 4: Commit**

```bash
git add front-end/src/components/dashboard/DashboardCanvas.vue front-end/scripts/e2e-smoke.cjs
git commit -m "feat(dashboard): place new items into first free cell; e2e covers free drag, resize and no-overlap invariant"
```

---

## 回归清单（最终验收）

- [ ] `front-end`：`npm run build` 无错误
- [ ] `front-end`：`node scripts/grid-layout-test.mjs` 15 项通过
- [ ] `front-end`：`node scripts/e2e-smoke.cjs` SMOKE TEST PASSED、无页面错误
- [ ] 数据看板：旧看板打开正常（col/row 自动迁移），预览与编辑观感一致