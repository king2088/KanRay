import assert from 'node:assert/strict'
import {
  GRID_COLS, ROW_H, GAP,
  clamp, intersects,
  findFreeCell,
  normalizeLayout, flattenItems, clampChildren, resolveDrop, applyDrop, cellFromPointer,
  cardHeightPx, rowsForHeight, normGap, pullUpBelow, alignRows, alignTree,
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
const rowTop = (row) => (row - 1) * (ROW_H + GAP)

// ---- normalizeLayout：迁移铺位 + 越界修剪 + 递归 ----
t('normalize: 旧数据按顺序铺入（像素 top，旧行换算等值）', () => {
  const out = normalizeLayout([
    { id: 'a', type: 'chart', chartId: 1 },
    { id: 'b', type: 'text', content: 'x' },
    { id: 'c', type: 'chart', chartId: 2 },
  ])
  assert.equal(out[0].w, 6); assert.equal(out[0].hPx, 2 * ROW_H + GAP); assert.deepEqual({ col: out[0].col, top: out[0].top }, { col: 1, top: 0 })
  assert.equal(out[1].w, 12); assert.equal(out[1].hPx, ROW_H); assert.deepEqual({ col: out[1].col, top: out[1].top }, { col: 1, top: rowTop(3) })
  assert.deepEqual({ col: out[2].col, top: out[2].top }, { col: 7, top: 0 }, 'a 占 1-6 列，c 落右侧第 7 列首行')
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
  assert.equal(out[2].col, 7, 'row 无效走铺位，落 b 下方')
  assert.equal(out[2].top, rowTop(2))
  assert.equal(out[2].w, 5)
  assert.equal(out[2].hPx, Math.round(1.6) * ROW_H + (Math.round(1.6) - 1) * GAP)
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
      { id: 'b', type: 'chart', chartId: 2 }, // 第二个应排到子网格下一行（w=6 占满）
    ] },
  ])
  const kids = out[0].children
  assert.deepEqual({ col: kids[0].col, top: kids[0].top }, { col: 1, top: 0 })
  assert.deepEqual({ col: kids[1].col, top: kids[1].top }, { col: 1, top: 2 * ROW_H + 2 * GAP }, '6 列棋盘，第二个 w6 落 a 下方一格')
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

// ---- findFreeCell ----
t('findFreeCell: 基于 items 像素矩形计算空位（含 columns 参数）', () => {
  const items = [{ id: 'a', col: 1, top: 0, w: 6, hPx: 2 * ROW_H + GAP }]
  assert.deepEqual(findFreeCell(items, 6, 2 * ROW_H + GAP, 6), { col: 1, top: 2 * ROW_H + 2 * GAP }, '6 列棋盘，w6 无同排空位 → 下一行')
  assert.deepEqual(findFreeCell(items, 3, ROW_H, 6), { col: 1, top: 2 * ROW_H + 2 * GAP }, 'a 占满 6 列，w3 也下行')
})

// ---- resolveDrop / applyDrop ----
t('resolveDrop: 无冲突仅移动该卡', () => {
  const items = [
    { id: 'a', type: 'chart', chartId: 1, col: 1, top: 0, w: 6, hPx: 2 * ROW_H + GAP },
    { id: 'b', type: 'text', content: '', col: 1, top: rowTop(3), w: 6, hPx: ROW_H },
  ]
  const out = resolveDrop(items, { id: 'a', col: 4, top: rowTop(5), w: 6, hPx: 2 * ROW_H + GAP })
  assert.deepEqual({ col: out[0].col, top: out[0].top }, { col: 4, top: rowTop(5) })
  assert.deepEqual({ col: out[1].col, top: out[1].top }, { col: 1, top: rowTop(3) })
  noOverlap(out)
})

t('resolveDrop: 冲突自动让位，且间距精确 = gap.y（不再按行量化）', () => {
  const items = [
    { id: 'a', type: 'chart', chartId: 1, col: 1, top: 0, w: 6, hPx: 2 * ROW_H + GAP },
    { id: 'b', type: 'chart', chartId: 2, col: 7, top: 0, w: 6, hPx: 2 * ROW_H + GAP },
  ]
  const out = resolveDrop(items, { id: 'a', col: 4, top: 0, w: 6, hPx: 2 * ROW_H + GAP })
  assert.deepEqual({ col: out[0].col, top: out[0].top }, { col: 4, top: 0 })
  assert.equal(out[1].top, 2 * ROW_H + 2 * GAP, `b 贴 a 底部 + gap：top = a.bottom + ${GAP}`)
  assert.equal(out[1].col, 7, 'b 列保持不动')
  noOverlap(out)
})

t('resolveDrop: piece 列越界被 clamp', () => {
  const items = [{ id: 'a', type: 'chart', chartId: 1, col: 1, top: 0, w: 6, hPx: 2 * ROW_H + GAP }]
  assert.equal(resolveDrop(items, { id: 'a', col: 99, top: 0, w: 6, hPx: 2 * ROW_H + GAP })[0].col, 7)
  assert.equal(resolveDrop(items, { id: 'a', col: 99, top: 0, w: 6, hPx: 2 * ROW_H + GAP }, 4)[0].col, 1, '4 列棋盘 w6 超宽应被裁到 1')
})

t('applyDrop: 原地替换，数组引用不变', () => {
  const items = [
    { id: 'a', type: 'chart', chartId: 1, col: 1, top: 0, w: 6, hPx: 2 * ROW_H + GAP },
    { id: 'b', type: 'text', content: 'hi', col: 7, top: 0, w: 6, hPx: ROW_H },
  ]
  const ref = items
  applyDrop(items, { id: 'a', col: 7, top: 2 * ROW_H + 2 * GAP, w: 6, hPx: 2 * ROW_H + GAP })
  assert.strictEqual(items, ref)
  assert.equal(items.find((x) => x.id === 'b').content, 'hi')
  noOverlap(items)
})

// ---- clampChildren ----
t('clampChildren: 容器缩小后子卡列号回收', () => {
  const kids = [{ id: 'c', type: 'chart', col: 9, top: 0, w: 3, hPx: ROW_H }, { id: 'ct2', type: 'container', col: 1, top: 0, w: 2, hPx: ROW_H, children: [{ id: 'd', type: 'chart', col: 8, top: 0, w: 3, hPx: ROW_H }] }]
  clampChildren(kids, 5)
  assert.equal(kids[0].col, 3, '5 列棋盘 w3 → col 3')
  assert.equal(kids[1].children[0].col, 1, '子容器 w2 内 col8+w3 越界 → 1')
})

// ---- cellFromPointer ----
const gridRect = { left: 100, top: 200, width: 1200 }
t('cellFromPointer: 左上角 → (1, 0)', () => {
  assert.deepEqual(cellFromPointer(100, 200, gridRect, 6), { col: 1, top: 0 })
})
t('cellFromPointer: 第二格中点 → (2, top)', () => {
  const colWidth = (1200 - GAP * 11) / 12 // 89
  assert.deepEqual(cellFromPointer(100 + colWidth + 12 + 40, 220, gridRect, 6), { col: 2, top: 20 })
})
t('cellFromPointer: w=6 右边缘越界 → clamp 到 (7, top)', () => {
  assert.deepEqual(cellFromPointer(1300, 200, gridRect, 6), { col: 7, top: 0 })
})
t('cellFromPointer: 纵向像素 free（不再量化到行）', () => {
  assert.deepEqual(cellFromPointer(1300, 200 + ROW_H + GAP, gridRect, 12), { col: 1, top: 162 })
})
t('cellFromPointer: 4 列子棋盘换算', () => {
  const sub = { left: 0, top: 0, width: 500 } // 4 列、GAP12 → 列宽 (500-36)/4=116
  assert.deepEqual(cellFromPointer(0, 0, sub, 2, 4), { col: 1, top: 0 })
  assert.deepEqual(cellFromPointer(130, 0, sub, 2, 4), { col: 2, top: 0 })
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
  assert.deepEqual({ col: out[0].col, top: out[0].top }, { col: 1, top: 0 })
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
  const o48 = normalizeLayout([{ id: 'a', type: 'chart', chartId: 1, hPx: 300 }], 12, g48)
  assert.equal(o48[0].h, 2)
})

// ---- pullUpBelow：像素 + 精确间距 ----
t('pullUpBelow: 卡片缩短后下方同列卡上移到紧贴 origin + gap（不再停在行边界）', () => {
  // 大卡 A（600px 占 4 行）+ 下方 B（同列 w12，300px）+ C（其它列）
  const items = [
    { id: 'a', col: 1, top: 0, w: 6, hPx: 600 },
    { id: 'b', col: 1, top: 612, w: 6, hPx: 300 },
    { id: 'c', col: 7, top: 648, w: 6, hPx: 150 },
  ]
  items[0].hPx = 35 // 用户缩 A 到最小高度
  pullUpBelow(items, 'a', 12)
  assert.equal(items[0].top, 0)   // A 不动
  assert.equal(items[1].top, 47, 'B 上移到 35+12，间距精确 = gap.y') // 若仍按行量化会停在 162，死区 115px
  assert.equal(items[2].top, 648, 'C（列 7-12 不相交）保持不动')
  noOverlap(items)
})

t('pullUpBelow: 下方卡被其它卡挡住时不跳过，落在可放的最靠上位置（含 gap）', () => {
  const items = [
    { id: 'a', col: 1, top: 0, w: 6, hPx: 150 },
    { id: 'wall', col: 4, top: 162, w: 6, hPx: 300 }, // 卡在 B 上移路径的同列右侧
    { id: 'b', col: 1, top: 648, w: 3, hPx: 150 },
  ]
  pullUpBelow(items, 'a', 12)
  // a 底 = 150 → B 最低可到 162（wall 占 162-462 的列 4-9，B 在列 1-3 不冲突）
  assert.equal(items[2].top, 162)
  noOverlap(items)
})

t('pullUpBelow: 反向加高被推下的卡片也会被拉回', () => {
  const items = [
    { id: 'a', col: 1, top: 0, w: 6, hPx: 600 },
    { id: 'b', col: 1, top: 612, w: 6, hPx: 150 },
  ]
  pullUpBelow(items, 'a', 12) // 加高状态：B 在 612，无可拉空间
  assert.equal(items[1].top, 612)
  items[0].hPx = 150 // 缩回
  pullUpBelow(items, 'a', 12)
  assert.equal(items[1].top, 162, 'B 回贴 A 底 + gap')
  noOverlap(items)
})

t('pullUpBelow: 无 origin 或空下方时不产生任何移动', () => {
  const items = [
    { id: 'a', col: 1, top: 0, w: 12, hPx: 312 },
    { id: 'b', col: 1, top: 324, w: 12, hPx: 150 },
  ]
  pullUpBelow(items, 'zzz', 12) // 不存在的 origin
  assert.equal(items[0].top, 0)
  assert.equal(items[1].top, 324)
  pullUpBelow(items, 'b', 12)   // B 已是最后一个，没有下方卡
  assert.equal(items[1].top, 324)
})

t('pullUpBelow: 尊重自定义 gap-y（>=16 的语义按 y 收紧）', () => {
  const g = { x: 12, y: 32 }
  const items = [
    { id: 'a', col: 1, top: 0, w: 12, hPx: 150 },
    { id: 'b', col: 1, top: 500, w: 12, hPx: 150 },
  ]
  pullUpBelow(items, 'a', 12, g)
  assert.equal(items[1].top, 182, '150 + gap.y(32)')
  noOverlap(items)
})

// ---- alignRows：同行顶对齐 + 行高跟随最高卡 + 同列链联动 ----
t('alignRows: 容差内同行顶对齐（TOL=9 默认）', () => {
  const items = [
    { id: 'a', col: 1, top: 0, w: 6, hPx: 150 },
    { id: 'b', col: 7, top: 9, w: 6, hPx: 150 },
  ]
  alignRows(items, 12)
  assert.equal(items[0].top, 0)
  assert.equal(items[1].top, 0, '9 ≤ TOL 吸附到同行顶')
  noOverlap(items)
})

t('alignRows: 容差外不强对齐', () => {
  const items = [
    { id: 'a', col: 1, top: 0, w: 6, hPx: 150 },
    { id: 'b', col: 7, top: 20, w: 6, hPx: 150 },
  ]
  alignRows(items, 12)
  assert.equal(items[0].top, 0)
  assert.equal(items[1].top, 20, '20 > TOL，不吸附')
})

t('alignRows: 瀑布流：下排卡只被本列上卡约束（不被同行更高卡推下）', () => {
  const items = [
    { id: 'a', col: 1, top: 0, w: 3, hPx: 150 },
    { id: 'b', col: 4, top: 0, w: 3, hPx: 300 },
    { id: 'c', col: 1, top: 162, w: 3, hPx: 150 },
  ]
  alignRows(items, 12)
  assert.equal(items[2].top, 162, 'c 贴 a 底 150+12，不受同行 b(300) 影响')
  noOverlap(items)
})

t('alignRows: 瀑布流占位：第一行 70/150 双卡，新卡可贴 70px 卡下方（82）', () => {
  const items = [
    { id: 'a', col: 1, top: 0, w: 6, hPx: 70 },
    { id: 'b', col: 7, top: 0, w: 6, hPx: 150 },
    { id: 'c', col: 1, top: 82, w: 6, hPx: 150 },
  ]
  alignRows(items, 12)
  assert.equal(items[2].top, 82, 'c 停留在 a 底 70+12，不再被推到 b 底 162')
  noOverlap(items)
})

t('alignRows: 缩卡上移（origin）→ 同列下卡紧贴新底 + gap', () => {
  const items = [
    { id: 'a', col: 1, top: 0, w: 6, hPx: 600 },
    { id: 'b', col: 1, top: 612, w: 6, hPx: 150 },
  ]
  items[0].hPx = 35
  alignRows(items, 12, GAP, { originId: 'a' })
  assert.equal(items[0].top, 0)
  assert.equal(items[1].top, 47, '35 + 12，间距精确 = gap.y')
  noOverlap(items)
})

t('alignRows: 无 origin 孤立卡保持原位（12c 拖到空白区）', () => {
  const items = [
    { id: 'a', col: 1, top: 0, w: 6, hPx: 150 },
    { id: 'x', col: 7, top: 854, w: 6, hPx: 300 },
  ]
  alignRows(items, 12)
  assert.equal(items[0].top, 0)
  assert.equal(items[1].top, 854, '非受影响带不吸附回顶')
})

t('alignRows: 缩卡只拉同列链，不共享列的卡保持原位', () => {
  const items = [
    { id: 'a', col: 1, top: 0, w: 6, hPx: 600 },
    { id: 'b', col: 7, top: 612, w: 6, hPx: 150 },
  ]
  items[0].hPx = 35
  alignRows(items, 12, GAP, { originId: 'a' })
  assert.equal(items[0].top, 0)
  assert.equal(items[1].top, 612, 'b 列 7-12 与 a 不共享，不拉')
  noOverlap(items)
})

t('alignRows: 缩卡沿同列链级联上移', () => {
  const items = [
    { id: 'a', col: 1, top: 0, w: 6, hPx: 600 },
    { id: 'b', col: 1, top: 612, w: 6, hPx: 150 },
    { id: 'c', col: 1, top: 774, w: 6, hPx: 150 },
  ]
  items[0].hPx = 35
  alignRows(items, 12, GAP, { originId: 'a' })
  assert.equal(items[1].top, 47)
  assert.equal(items[2].top, 209, '47+150+12 逐级传递')
  noOverlap(items)
})

t('alignRows: 加高推下同列下卡（12b1）', () => {
  const items = [
    { id: 'a', col: 1, top: 0, w: 6, hPx: 150 },
    { id: 'b', col: 1, top: 162, w: 6, hPx: 150 },
  ]
  items[0].hPx = 600
  alignRows(items, 12, GAP, { originId: 'a' })
  assert.equal(items[0].top, 0)
  assert.equal(items[1].top, 612, '600 + 12')
  noOverlap(items)
})

t('alignRows: 瀑布流：缩卡后同列下卡紧贴本列新底（不受同行高卡约束）', () => {
  const items = [
    { id: 'a', col: 1, top: 0, w: 3, hPx: 150 },
    { id: 'b', col: 4, top: 0, w: 3, hPx: 300 },
    { id: 'c', col: 1, top: 312, w: 3, hPx: 150 },
  ]
  items[0].hPx = 35
  alignRows(items, 12, GAP, { originId: 'a' })
  assert.equal(items[0].top, 0)
  assert.equal(items[2].top, 47, 'c 贴 a 新底 35+12，b(300) 不拦住 c')
  noOverlap(items)
})

t('alignRows: 吸附上移仅对本列链重排，异列卡不动', () => {
  const items = [
    { id: 'a', col: 1, top: 0, w: 6, hPx: 150 },
    { id: 'b', col: 7, top: 8, w: 6, hPx: 150 },
    { id: 'c', col: 1, top: 170, w: 6, hPx: 150 },
  ]
  alignRows(items, 12)
  assert.equal(items[1].top, 0, '8 ≤ TOL 吸附')
  assert.equal(items[2].top, 170, 'a 未动，c 保持原留白（不因 b 吸附被拉）')
  noOverlap(items)
})

t('alignRows: 尊重自定义 gap-y 的容差与拉紧', () => {
  const g = { x: 12, y: 32 } // TOL = 24
  const items = [
    { id: 'a', col: 1, top: 0, w: 6, hPx: 150 },
    { id: 'b', col: 7, top: 20, w: 6, hPx: 150 },
    { id: 'c', col: 1, top: 300, w: 6, hPx: 150 },
  ]
  alignRows(items, 12, g)
  assert.equal(items[1].top, 0, '20 ≤ TOL(24) 吸附')
  assert.equal(items[2].top, 300, 'a 未动，c 保持原留白（不受 b 吸附影响）')
  noOverlap(items)
})

t('alignRows: 自定义 gap-y 参与 required（origin 拉紧按 32）', () => {
  const g = { x: 12, y: 32 }
  const items = [
    { id: 'a', col: 1, top: 0, w: 6, hPx: 150 },
    { id: 'b', col: 1, top: 300, w: 6, hPx: 150 },
  ]
  items[0].hPx = 35
  alignRows(items, 12, g, { originId: 'a' })
  assert.equal(items[0].top, 0)
  assert.equal(items[1].top, 67, '35 + gap(32)')
  noOverlap(items)
})

t('alignTree: 递归对齐容器 children', () => {
  const tree = [
    { id: 'ct', type: 'container', col: 1, top: 0, w: 12, hPx: 312, children: [
      { id: 'a', col: 1, top: 0, w: 6, hPx: 150 },
      { id: 'b', col: 7, top: 9, w: 6, hPx: 150 },
    ] },
  ]
  alignTree(tree, 12)
  assert.equal(tree[0].children[0].top, 0)
  assert.equal(tree[0].children[1].top, 0)
  noOverlap(tree[0].children)
})

console.log(`grid-layout 测试：${passed} 项通过`)