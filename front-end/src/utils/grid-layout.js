export const GRID_COLS = 12
export const ROW_H = 150
export const GAP = 12

export function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

/** 卡片渲染高度（px）：显式 hPx 优先，否则按行计算 */
export function cardHeightPx(item) {
  const hpx = Number(item.hPx)
  if (Number.isFinite(hpx) && hpx > 0) return Math.max(1, hpx)
  const h = Math.max(1, Math.round(Number(item.h) || 1))
  return h * ROW_H + (h - 1) * GAP
}

/** 像素高度 → 占用的行数（用于碰撞/铺位） */
export function rowsForHeight(px) {
  const v = Number(px)
  if (!Number.isFinite(v) || v <= 0) return 1
  return Math.max(1, Math.round((v + GAP) / (ROW_H + GAP)))
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

/** 行主序（先列后行）查找第一个能放下 w×h 的空格，从 fromRow 起；columns 为当前棋盘列数 */
export function nextFreeCell(occupied, w, h, fromRow = 1, columns = GRID_COLS) {
  const cols = Math.max(1, columns)
  const start = Math.max(1, Math.round(fromRow || 1))
  let rowLimit = start
  for (const key of occupied) {
    const r = Number(key.split('_')[0])
    if (r + 1 > rowLimit) rowLimit = r + 1
  }
  rowLimit += h
  for (let row = start; row <= rowLimit; row++) {
    for (let c = 1; c <= cols - w + 1; c++) {
      if (regionFree(occupied, c, row, w, h)) return { col: c, row }
    }
  }
  return { col: 1, row: rowLimit }
}

/** items 成员需含 col/row/w/h；找出能放下 w×h 的第一空位 */
export function findFreeCell(items, w, h, columns = GRID_COLS) {
  const occupied = new Set()
  items.forEach((it) => occupy(occupied, it.col, it.row, it.w, it.h))
  return nextFreeCell(occupied, w, h, 1, columns)
}

/** 递归铺位/矫正：旧数据（无 col/row）按顺序铺入，越界裁剪，children 以父容器 w 为列数 */
export function normalizeLayout(items, columns = GRID_COLS) {
  const cols = Math.max(1, columns)
  const occupied = new Set()
  return items.map((it) => {
    const w = clamp(Math.round(Number(it.w) || (it.type === 'chart' || it.type === 'container' ? 6 : 12)), 1, cols)
    let h = Math.max(1, Math.round(Number(it.h) || (it.type === 'chart' ? 2 : it.type === 'container' ? 3 : 1)))
    const hPx = Number(it.hPx)
    if (Number.isFinite(hPx) && hPx > 0) h = rowsForHeight(hPx)
    const hasCol = Number.isFinite(Number(it.col)) && Math.round(Number(it.col)) >= 1
    const hasRow = Number.isFinite(Number(it.row)) && Math.round(Number(it.row)) >= 1
    let col, row
    if (hasCol && hasRow) {
      col = clamp(Math.round(Number(it.col)), 1, Math.max(1, cols - w + 1))
      row = Math.max(1, Math.round(Number(it.row)))
    } else {
      const cell = nextFreeCell(occupied, w, h, 1, cols)
      col = cell.col
      row = cell.row
    }
    occupy(occupied, col, row, w, h)
    const children = Array.isArray(it.children) ? normalizeLayout(it.children, w) : (it.children || [])
    return { ...it, w, h, col, row, children }
  })
}

/** 递归拍平，返回含 items 的数组（不包含容器卡自身，仅叶子/业务卡） */
export function flattenItems(items, out = []) {
  items.forEach((it) => {
    if (it.type === 'container') {
      flattenItems(it.children || [], out)
    } else {
      out.push(it)
    }
  })
  return out
}

/** 容器缩放后，把 children 的 col 裁剪回容器新列数（原地修改） */
export function clampChildren(children, columns) {
  const cols = Math.max(1, columns)
  children.forEach((it) => {
    it.col = clamp(Math.round(it.col), 1, Math.max(1, cols - it.w + 1))
    if (it.type === 'container') clampChildren(it.children || [], it.w)
  })
}

/**
 * 落位（含自动让位）：返回新数组，把 piece 移到 (col,row)。
 * piece 需含 id/col/row/w/h；columns 为棋盘列数。
 */
export function resolveDrop(items, piece, columns = GRID_COLS) {
  const cols = Math.max(1, columns)
  const col = clamp(Math.round(piece.col), 1, Math.max(1, cols - piece.w + 1))
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
    const cell = nextFreeCell(occupied, d.w, d.h, d.row, cols)
    occupy(occupied, cell.col, cell.row, d.w, d.h)
    moved.set(d.id, { col: cell.col, row: cell.row })
  })

  return items.map((it) => {
    if (it.id === piece.id) return { ...it, col, row }
    const m = moved.get(it.id)
    return m ? { ...it, ...m } : it
  })
}

/**
 * 原地版 resolveDrop：result = resolveDrop(...) 后整组 replace。
 * 数组引用（含父容器 children 引用）保持不变，子网格递归时安全。
 */
export function applyDrop(items, piece, columns = GRID_COLS) {
  const result = resolveDrop(items, piece, columns)
  items.splice(0, items.length, ...result)
}

/** 指针坐标 → 网格行列（列按 w 与 columns 裁剪），rect 为网格容器 getBoundingClientRect() */
export function cellFromPointer(clientX, clientY, rect, w, columns = GRID_COLS) {
  const cols = Math.max(1, columns)
  const colWidth = (rect.width - GAP * (cols - 1)) / cols
  const rawCol = Math.floor((clientX - rect.left) / (colWidth + GAP)) + 1
  const rawRow = Math.floor((clientY - rect.top) / (ROW_H + GAP)) + 1
  return {
    col: clamp(rawCol, 1, Math.max(1, cols - w + 1)),
    row: Math.max(1, rawRow),
  }
}