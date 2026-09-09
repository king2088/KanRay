import assert from 'node:assert/strict'
import {
  GRID_COLS, ROW_H, GAP,
  clamp, intersects, nextFreeCell, findFreeCell,
  normalizeLayout, flattenItems, clampChildren, resolveDrop, applyDrop, cellFromPointer,
  cardHeightPx, rowsForHeight, normGap, pullUpBelow,
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

// ---- normalizeLayout：迁移铺位 + 越界修剪 + 递归 ----
t('normalize: 旧数据按顺序铺入网格', () => {
  const out = normalizeLayout([
    { id: 'a', type: 'chart', chartId: 1 },
    { id: 'b', type: 'text', content: 'x' },
    { id: 'c', type: 'chart', chartId: 2 },
  ])
  assert.equal(out[0].w, 6); assert.equal(out[0].h, 2); assert.deepEqual({ col: out[0].col, row: out[0].row }, { col: 1, row: 1 })
  assert.equal(out[1].w, 12); assert.equal(out[1].h, 1); assert.deepEqual({ col: out[1].col, row: out[1].row }, { col: 1, row: 3 })
  assert.deepEqual({ col: out[2].col, row: out[2].row }, { col: 7, row: 1 }, 'a 占 1-6 列，c 行主序落右侧 7 列')
  noOverlap(out)
})

t('normalize: 已有坐标保留，越界被修剪', () => {
  const out = normalizeLayout([
    { id: 'a', type: 'chart', chartId: 1, col: 1, row: 1, w: 6, h: 2 },
    { id: 'b', type: 'chart', chartId: 2, col: 9, row: 1, w: 6, h: 1 },
    { id: 'c', type: 'text', content: '', col: 15, row: -2, w: 5, h: 1.6 },
  ])
  assert.equal(out[0].col, 1)
  assert.equal(out[1].col, 7, 'col9 + w6 越界应修剪到 7')
  assert.equal(out[2].col, 7, 'row 无效走铺位，落 b 下方 (7,2)')
  assert.equal(out[2].row, 2)
  assert.equal(out[2].w, 5)
  assert.equal(out[2].h, Math.round(1.6))
  noOverlap(out)
})

t('normalize: 保留 item 业务字段', () => {
  const out = normalizeLayout([{ id: 'a', type: 'chart', chartId: 7, config: { x: 1 } }])
  assert.equal(out[0].chartId, 7)
  assert.deepEqual(out[0].config, { x: 1 })
})

t('normalize: 容器 children 递归铺位，子列数 = 父 w', () => {
  const out = normalizeLayout([
    { id: 'ct', type: 'container', col: 1, row: 1, w: 6, h: 3, children: [
      { id: 'a', type: 'chart', chartId: 1 },
      { id: 'b', type: 'chart', chartId: 2 }, // 第二个应排到子网格第 4 列（w=6 占满）
    ] },
  ])
  const kids = out[0].children
  assert.deepEqual({ col: kids[0].col, row: kids[0].row }, { col: 1, row: 1 })
  assert.deepEqual({ col: kids[1].col, row: kids[1].row }, { col: 1, row: 3 }, '6 列棋盘，第二个 w6 落 a 下方')
  noOverlap(kids)
})

t('normalize: 子卡越界在容器内被裁剪', () => {
  const out = normalizeLayout([
    { id: 'ct', type: 'container', col: 1, row: 1, w: 4, h: 2, children: [
      { id: 'a', type: 'chart', chartId: 1, col: 9, row: 1, w: 3, h: 1 },
    ] },
  ])
  assert.equal(out[0].children[0].col, 2, '容器 w=4 → 子卡 col9+w3 越界，裁剪到 4-3+1=2')
})

// ---- flattenItems ----
t('flattenItems: 递归拍平容器', () => {
  const tree = [
    { id: 'a', type: 'chart', chartId: 1 },
    { id: 'ct', type: 'container', children: [
      { id: 'b', type: 'filter', field: 'x' },
      { id: 'ct2', type: 'container', children: [{ id: 'c', type: 'text' }] },
    ] },
  ]
  const flat = flattenItems(tree)
  assert.deepEqual(flat.map((x) => x.id), ['a', 'b', 'c'])
})

// ---- nextFreeCell / findFreeCell ----
t('nextFreeCell: 跳过占用格，行主序第一空位', () => {
  const occ = new Set()
  for (let c = 1; c <= 6; c++) occ.add(`1_${c}`)
  const cell = nextFreeCell(occ, 6, 2, 1)
  assert.deepEqual(cell, { col: 7, row: 1 })
})

t('findFreeCell: 基于 items 计算空位（含 columns 参数）', () => {
  const items = [{ id: 'a', col: 1, row: 1, w: 6, h: 2 }]
  assert.deepEqual(findFreeCell(items, 6, 2, 6), { col: 1, row: 3 }, '6 列棋盘，w6 无空行 → 下一行')
  assert.deepEqual(findFreeCell(items, 3, 1, 6), { col: 1, row: 3 }, 'a 占满 6 列，w3 也下行')
})

// ---- resolveDrop / applyDrop ----
t('resolveDrop: 无冲突仅移动该卡', () => {
  const items = [
    { id: 'a', type: 'chart', chartId: 1, col: 1, row: 1, w: 6, h: 2 },
    { id: 'b', type: 'text', content: '', col: 1, row: 3, w: 6, h: 1 },
  ]
  const out = resolveDrop(items, { id: 'a', col: 4, row: 5, w: 6, h: 2 })
  assert.deepEqual({ col: out[0].col, row: out[0].row }, { col: 4, row: 5 })
  assert.deepEqual({ col: out[1].col, row: out[1].row }, { col: 1, row: 3 })
  noOverlap(out)
})

t('resolveDrop: 冲突自动让位且无重叠', () => {
  const items = [
    { id: 'a', type: 'chart', chartId: 1, col: 1, row: 1, w: 6, h: 2 },
    { id: 'b', type: 'chart', chartId: 2, col: 7, row: 1, w: 6, h: 2 },
  ]
  const out = resolveDrop(items, { id: 'a', col: 4, row: 1, w: 6, h: 2 })
  assert.deepEqual({ col: out[0].col, row: out[0].row }, { col: 4, row: 1 })
  const b = out[1]
  assert.ok(b.row > 1 || b.col < 4 || b.col > 9, `b 让位：(col${b.col},row${b.row})`)
  noOverlap(out)
})

t('resolveDrop: piece 列越界被 clamp', () => {
  const items = [{ id: 'a', type: 'chart', chartId: 1, col: 1, row: 1, w: 6, h: 2 }]
  assert.equal(resolveDrop(items, { id: 'a', col: 99, row: 1, w: 6, h: 2 })[0].col, 7)
  assert.equal(resolveDrop(items, { id: 'a', col: 99, row: 1, w: 6, h: 2 }, 4)[0].col, 1, '4 列棋盘 12-6 超宽 w 应被裁到 1')
})

t('applyDrop: 原地替换，数组引用不变', () => {
  const items = [
    { id: 'a', type: 'chart', chartId: 1, col: 1, row: 1, w: 6, h: 2 },
    { id: 'b', type: 'text', content: 'hi', col: 7, row: 1, w: 6, h: 1 },
  ]
  const ref = items
  applyDrop(items, { id: 'a', col: 7, row: 1, w: 6, h: 2 })
  assert.strictEqual(items, ref)
  assert.equal(items.find((x) => x.id === 'b').content, 'hi')
  noOverlap(items)
})

// ---- clampChildren ----
t('clampChildren: 容器缩小后子卡列号回收', () => {
  const kids = [{ id: 'c', type: 'chart', col: 9, row: 1, w: 3, h: 1 }, { id: 'ct2', type: 'container', col: 1, row: 1, w: 2, h: 2, children: [{ id: 'd', type: 'chart', col: 8, row: 1, w: 3, h: 1 }] }]
  clampChildren(kids, 5)
  assert.equal(kids[0].col, 3, '5 列棋盘 w3 → col 3')
  assert.equal(kids[1].children[0].col, 1, '子容器 w2 内 col8+w3 越界 → 1')
})

// ---- cellFromPointer ----
const gridRect = { left: 100, top: 200, width: 1200 }
t('cellFromPointer: 左上角 → (1,1)', () => {
  assert.deepEqual(cellFromPointer(100, 200, gridRect, 6), { col: 1, row: 1 })
})
t('cellFromPointer: 第二格中点 → (2,1)', () => {
  const colWidth = (1200 - GAP * 11) / 12 // 89
  assert.deepEqual(cellFromPointer(100 + colWidth + 12 + 40, 200, gridRect, 6), { col: 2, row: 1 })
})
t('cellFromPointer: w=6 右边缘越界 → clamp 到 (7,1)', () => {
  assert.deepEqual(cellFromPointer(1300, 200, gridRect, 6), { col: 7, row: 1 })
})
t('cellFromPointer: 行计算 + w=12 恒第一列', () => {
  assert.deepEqual(cellFromPointer(1300, 200 + ROW_H + GAP, gridRect, 12), { col: 1, row: 2 })
})
t('cellFromPointer: 4 列子棋盘换算', () => {
  const sub = { left: 0, top: 0, width: 500 } // 4 列、GAP12 → 列宽 (500-36)/4=116
  assert.deepEqual(cellFromPointer(0, 0, sub, 2, 4), { col: 1, row: 1 })
  assert.deepEqual(cellFromPointer(130, 0, sub, 2, 4), { col: 2, row: 1 })
})

// ---- 常量 ----
t('常量: GRID_COLS=12, ROW_H=150, GAP=12', () => {
  assert.equal(GRID_COLS, 12)
  assert.equal(ROW_H, 150)
  assert.equal(GAP, 12)
})

// ---- 像素高度 ----
t('cardHeightPx: hPx 优先，否则按行', () => {
  assert.equal(cardHeightPx({ hPx: 35, h: 3 }), 35)
  assert.equal(cardHeightPx({ h: 2 }), 2 * 150 + 12)
  assert.equal(cardHeightPx({ h: 2, hPx: 0 }), 2 * 150 + 12)
})

t('rowsForHeight: 35px→1 行，600px→4 行', () => {
  assert.equal(rowsForHeight(35), 1)
  assert.equal(rowsForHeight(150), 1)
  assert.equal(rowsForHeight(300), 2)
  assert.equal(rowsForHeight(600), 4)
  assert.equal(rowsForHeight(0), 1)
})

t('normalize: hPx 同步 h', () => {
  const out = normalizeLayout([{ id: 'a', type: 'chart', chartId: 1, hPx: 35, h: 3 }])
  assert.equal(out[0].h, 1)
  assert.equal(out[0].hPx, 35)
})

t('normalize: hideTitle 字段保留', () => {
  const out = normalizeLayout([{ id: 'a', type: 'text', content: '', hideTitle: true }])
  assert.equal(out[0].hideTitle, true)
})

t('normGap: 默认与异常回退', () => {
  assert.deepEqual(normGap(undefined), { x: GAP, y: GAP })
  assert.deepEqual(normGap({ x: 20, y: 8 }), { x: 20, y: 8 })
  assert.deepEqual(normGap({ x: 0, y: 0 }), { x: GAP, y: GAP })
  assert.deepEqual(normGap({ x: 20 }), { x: 20, y: GAP })
})

t('cardHeightPx/rowsForHeight 尊重 gap-y', () => {
  const g = { x: 12, y: 32 }
  assert.equal(cardHeightPx({ h: 2 }, g), 2 * ROW_H + 32)
  assert.equal(rowsForHeight(182, g), 1)
  assert.equal(rowsForHeight(332, g), 2)
})

t('normalizeLayout 用 gap-y 推导 h', () => {
  const g8 = { x: 12, y: 8 }
  const o8 = normalizeLayout([{ id: 'a', type: 'chart', chartId: 1, hPx: 158 }], 12, g8)
  assert.equal(o8[0].h, 1)
  const g48 = { x: 12, y: 48 }
  // (some + 48) / 198，要让 round=2 需 some >= 297
  const o48 = normalizeLayout([{ id: 'a', type: 'chart', chartId: 1, hPx: 300 }], 12, g48)
  assert.equal(o48[0].h, 2)
})

t('pullUpBelow: 卡片缩短后下方卡（同列）上移填洞', () => {
  // 大卡 A（row1, h3）+ 下方 B、C（同列 w12 / w6）
  const items = [
    { id: 'a', col: 1, row: 1, w: 6, h: 3 },
    { id: 'b', col: 1, row: 4, w: 6, h: 1 },
    { id: 'c', col: 7, row: 5, w: 6, h: 1 },
  ]
  items[0].h = 1 // 用户缩 A 高度
  pullUpBelow(items, 'a', 12)
  assert.equal(items[0].row, 1)  // A 不动
  assert.equal(items[1].row, 2)  // B（同列）从 row4 上移到 row2 贴住 A
  assert.equal(items[2].row, 5)  // C（列 7-12 不相交）保持不动
  noOverlap(items)
})

t('pullUpBelow: 下方卡被其它卡挡住时不跳过，落在可放的最靠上位置', () => {
  const items = [
    { id: 'a', col: 1, row: 1, w: 6, h: 1 },
    { id: 'wall', col: 4, row: 2, w: 6, h: 2 }, // 卡住 B 的上移路线
    { id: 'b', col: 1, row: 5, w: 3, h: 1 },
  ]
  pullUpBelow(items, 'a', 12)
  // wall 占 row2-3 的列 4-9，B(col1-3) 可上移到 row2（不与 wall 相交）
  assert.equal(items[2].row, 2)
  noOverlap(items)
})

t('pullUpBelow: 反向加高被推下的卡片也会被拉回', () => {
  // A 先加高到 h4 把 B 推到 row5，再缩回 h1 后 B 应该回到贴住 A
  const items = [
    { id: 'a', col: 1, row: 1, w: 6, h: 4 },
    { id: 'b', col: 1, row: 5, w: 6, h: 1 },
  ]
  pullUpBelow(items, 'a', 12) // 加高状态：B 在 row5，无可拉空间
  assert.equal(items[1].row, 5)
  items[0].h = 1 // 缩回
  pullUpBelow(items, 'a', 12)
  assert.equal(items[1].row, 2)
  noOverlap(items)
})

t('pullUpBelow: 无 origin 或空下方时不产生任何移动', () => {
  const items = [
    { id: 'a', col: 1, row: 1, w: 12, h: 2 },
    { id: 'b', col: 1, row: 3, w: 12, h: 1 },
  ]
  pullUpBelow(items, 'zzz', 12) // 不存在的 origin
  assert.equal(items[0].row, 1)
  assert.equal(items[1].row, 3)
  pullUpBelow(items, 'b', 12)   // B 已是最后一个，没有下方卡
  assert.equal(items[1].row, 3)
})

console.log(`grid-layout 测试：${passed} 项通过`)