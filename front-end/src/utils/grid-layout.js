export const GRID_COLS = 12
export const ROW_H = 150
export const GAP = 12

const DEFAULT_GAP = { x: GAP, y: GAP }

/** 规范化 gap；两个方向分别为水平（x）与垂直（y）间距 */
export function normGap(gap) {
  return {
    x: Number(gap?.x) > 0 ? Number(gap.x) : GAP,
    y: Number(gap?.y) > 0 ? Number(gap.y) : GAP,
  }
}

/* ---- 卡片全局样式（看板级） ---- */

export const DEFAULT_CARD_STYLE = {
  border: true,
  radius: 6,
  titleHeight: 34,
  titleFontSize: 13,
  titleUnderline: true,
  showTitle: true,
}

const CARD_STYLE_RANGES = {
  radius: [0, 20, 6],
  titleHeight: [24, 52, 34],
  titleFontSize: [12, 20, 13],
}

/** 规范化卡片全局样式：越界取默认值，布尔缺省为打开 */
export function normCardStyle(cs) {
  const next = { ...DEFAULT_CARD_STYLE }
  if (!cs || typeof cs !== 'object') return next
  Object.entries(CARD_STYLE_RANGES).forEach(([k, [lo, hi, dflt]]) => {
    const v = Number(cs[k])
    next[k] = Number.isFinite(v) ? clamp(v, lo, hi) : dflt
  })
  next.border = cs.border !== false
  next.titleUnderline = cs.titleUnderline !== false
  next.showTitle = cs.showTitle !== false
  return next
}

export function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

/** 卡片渲染高度（px）：显式 hPx 优先，否则按行计算 */
export function cardHeightPx(item, gap = DEFAULT_GAP) {
  const g = normGap(gap)
  const hpx = Number(item.hPx)
  if (Number.isFinite(hpx) && hpx > 0) return Math.max(1, hpx)
  const h = Math.max(1, Math.round(Number(item.h) || 1))
  return h * ROW_H + (h - 1) * g.y
}

/** 像素高度 → 占用的行数（用于高度语义/遗产换算） */
export function rowsForHeight(px, gap = DEFAULT_GAP) {
  const g = normGap(gap)
  const v = Number(px)
  if (!Number.isFinite(v) || v <= 0) return 1
  return Math.max(1, Math.round((v + g.y) / (ROW_H + g.y)))
}

/* ---- 像素纵向模型：卡片水平用列（col/w），垂直用像素（top/hPx） ---- */

export function itemCol(it) {
  return Math.max(1, Math.round(Number(it?.col) || 1))
}

export function itemW(it) {
  return Math.max(1, Math.round(Number(it?.w) || 1))
}

/** 卡片顶点（px）：显式 top 优先；旧数据按 row 换算出等值像素位置 */
export function pxTop(it, gap = DEFAULT_GAP) {
  const t = Number(it?.top)
  if (Number.isFinite(t) && t >= 0) return t
  const g = normGap(gap)
  const row = Math.max(1, Math.round(Number(it?.row) || 1))
  return (row - 1) * (ROW_H + g.y)
}

export function intersects(a, b) {
  const aCol = itemCol(a)
  const aW = itemW(a)
  const aTop = pxTop(a)
  const aH = cardHeightPx(a)
  const bCol = itemCol(b)
  const bW = itemW(b)
  const bTop = pxTop(b)
  const bH = cardHeightPx(b)
  return !(aCol + aW <= bCol || bCol + bW <= aCol || aTop + aH <= bTop || bTop + bH <= aTop)
}

/** 纵向是否同列重叠（仅列范围判断） */
function colOverlap(a, b) {
  const aCol = itemCol(a)
  const aW = itemW(a)
  const bCol = itemCol(b)
  const bW = itemW(b)
  return aCol < bCol + bW && bCol < aCol + aW
}

function sharesCol(a, b) {
  return a.members.some((ma) => b.members.some((mb) => colOverlap(ma, mb)))
}

/** 找第一个能放下 w×hPx 的空位（上→下、左→右）：{ col, top } */
export function findFreeCell(items, w, hPx, columns = GRID_COLS, gap = DEFAULT_GAP) {
  const g = normGap(gap)
  const cols = Math.max(1, columns)
  const ww = Math.max(1, Math.round(w) || 1)
  const hp = Math.max(1, Number(hPx) || ROW_H)
  const tops = [0]
  items.forEach((it) => tops.push(pxTop(it, g) + cardHeightPx(it, g) + g.y))
  tops.sort((a, b) => a - b)
  for (const top of tops) {
    for (let c = 1; c <= cols - ww + 1; c++) {
      const rect = { col: c, w: ww, top: Math.max(0, top), hPx: hp }
      if (!items.some((it) => intersects(rect, it))) return { col: c, top: Math.max(0, top) }
    }
  }
  return { col: 1, top: Math.max(0, tops[tops.length - 1]) }
}

/** 归一化布局：旧数据（row/h）换算为像素 top/hPx；无坐标的按序铺入首个空位 */
export function normalizeLayout(items, columns = GRID_COLS, gap = DEFAULT_GAP) {
  const g = normGap(gap)
  const cols = Math.max(1, columns)
  const placed = []
  return items.map((it) => {
    const w = clamp(Math.round(Number(it.w) || (it.type === 'chart' || it.type === 'container' ? 6 : 12)), 1, cols)
    let hPx = Number(it.hPx)
    if (!(Number.isFinite(hPx) && hPx > 0)) {
      const h = Math.max(1, Math.round(Number(it.h) || (it.type === 'chart' ? 2 : it.type === 'container' ? 3 : 1)))
      hPx = h * ROW_H + (h - 1) * g.y
    }
    hPx = Math.max(1, hPx)
    const h = rowsForHeight(hPx, g)
    const hasTop = Number.isFinite(Number(it.top)) && Number(it.top) >= 0
    const hasRow = Number.isFinite(Number(it.row)) && Math.round(Number(it.row)) >= 1
    let col, top
    if (hasTop) {
      col = clamp(Math.round(Number(it.col) || 1), 1, Math.max(1, cols - w + 1))
      top = Math.max(0, Number(it.top))
    } else if (hasRow) {
      col = clamp(Math.round(Number(it.col) || 1), 1, Math.max(1, cols - w + 1))
      top = (Math.round(Number(it.row)) - 1) * (ROW_H + g.y)
    } else {
      const cell = findFreeCell(placed, w, hPx, cols, g)
      col = cell.col
      top = cell.top
    }
    placed.push({ id: it.id, col, w, top, hPx })
    const children = Array.isArray(it.children) ? normalizeLayout(it.children, w, g) : (it.children || [])
    return { ...it, w, h, hPx, col, top, children }
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
 * 落位（含自动让位）：把 piece 放到 (col, top) 像素位。
 * piece 需含 id/col/top/w/hPx；columns 为棋盘列数。
 * 被碰撞卡沿同列下移避让（与上方同列卡保持 gap.y），列位置不变。
 */
export function resolveDrop(items, piece, columns = GRID_COLS, gap = DEFAULT_GAP) {
  const g = normGap(gap)
  const cols = Math.max(1, columns)
  const w = Math.max(1, Math.round(Number(piece.w) || 1))
  const col = clamp(Math.round(Number(piece.col) || 1), 1, Math.max(1, cols - w + 1))
  const top = Math.max(0, Number(piece.top) || 0)
  const hPx = Math.max(1, Math.round(Number(piece.hPx) || 1))
  const target = { col, w, top, hPx }

  if (!items.some((it) => it.id !== piece.id && intersects(target, it))) {
    return items.map((it) => (it.id === piece.id ? { ...it, col, top } : it))
  }

  const working = items
    .filter((it) => it.id !== piece.id)
    .map((it) => ({ ...it, top: pxTop(it, g) }))
  const bottomOf = (it) => pxTop(it, g) + cardHeightPx(it, g)

  const colliding = working.filter((it) => intersects(target, it))
  colliding.sort((a, b) => pxTop(a, g) - pxTop(b, g))
  for (const m of colliding) {
    let t = pxTop(m, g)
    let guard = 0
    for (;;) {
      if (++guard > 5000) break
      const mRect = { col: itemCol(m), w: itemW(m), top: Math.max(t, 0), hPx: cardHeightPx(m, g) }
      const blockers = working.filter((p) => p.id !== m.id && intersects(mRect, p))
      const hitTarget = intersects(mRect, target)
      if (!blockers.length && !hitTarget) break
      let below = 0
      if (blockers.length) below = Math.max(...blockers.map((p) => bottomOf(p, g) + g.y))
      if (hitTarget) below = Math.max(below, bottomOf(target) + g.y)
      t = below
    }
    m.top = Math.max(t, 0)
  }

  const movedTop = new Map()
  colliding.forEach((m) => movedTop.set(m.id, m.top))
  return items.map((it) => {
    if (it.id === piece.id) return { ...it, col, top }
    const t = movedTop.get(it.id)
    return Number.isFinite(t) ? { ...it, top: Math.max(t, pxTop(it, g)) } : it
  })
}

/**
 * 定向上移：卡片 origin 高度变化后，仅把"列范围重叠且位于其下方（>= origin 底 + gap）"的
 * 卡片尽量上移到紧贴 origin 底 + gap.y 的空位。其它列保持不动，不破坏用户手动摆放的留白。
 * 原地修改 items。返回 items（引用不变）。
 */
export function pullUpBelow(items, originId, columns = GRID_COLS, gap = DEFAULT_GAP) {
  const g = normGap(gap)
  const cols = Math.max(1, columns)
  const origin = items.find((it) => it.id === originId)
  if (!origin) return items
  const oCol = itemCol(origin)
  const oW = itemW(origin)
  const oTop = pxTop(origin, g)
  const oBottom = oTop + cardHeightPx(origin, g)
  const minTop = oBottom + g.y

  const movable = items.filter((it) => {
    if (it.id === originId) return false
    return colOverlap(it, origin) && pxTop(it, g) >= minTop - 0.5
  })
  if (!movable.length) return items

  const staticRects = items
    .filter((it) => it !== origin && !movable.includes(it))
    .map((it) => ({ id: it.id, col: itemCol(it), w: itemW(it), top: pxTop(it, g), hPx: cardHeightPx(it, g) }))
  const originH = Math.max(1, cardHeightPx(origin, g))
  const placed = [...staticRects, { id: origin.id, col: oCol, w: oW, top: oTop, hPx: originH }]

  const sorted = [...movable].sort((a, b) => pxTop(a, g) - pxTop(b, g))
  const finalTop = new Map()
  sorted.forEach((it) => {
    const c = clamp(itemCol(it), 1, Math.max(1, cols - itemW(it) + 1))
    const w = itemW(it)
    const hPx = cardHeightPx(it, g)
    const curTop = pxTop(it, g)
    let top = minTop
    let guard = 0
    while (guard++ < 5000) {
      const rect = { id: it.id, col: c, w, top, hPx }
      if (!placed.some((p) => p.id !== it.id && intersects(rect, p))) break
      top++
    }
    // 只允许更靠上；找不到更高位则保持原位并登记，避免后续卡算错
    if (top < curTop) {
      placed.push({ id: it.id, col: c, w, top, hPx })
      finalTop.set(it.id, top)
    } else {
      placed.push({ id: it.id, col: c, w, top: curTop, hPx })
    }
  })
  items.forEach((it) => {
    const t = finalTop.get(it.id)
    if (Number.isFinite(t)) it.top = t
  })
  return items
}

/** 原地版 resolveDrop：result = resolveDrop(...) 后整组 replace。
 * 数组引用（含父容器 children 引用）保持不变，子网格递归时安全。
 */
export function applyDrop(items, piece, columns = GRID_COLS, gap = DEFAULT_GAP) {
  const result = resolveDrop(items, piece, columns, gap)
  items.splice(0, items.length, ...result)
}

/* ---- 自动对齐：同行卡顶对齐 + 行高跟随最高卡 + 同列链联动 ---- */

/** 对齐容差：top 差距 ≤ TOL 视为同一行（默认 gap 12 → 9px） */
function snapTolerance(g) {
  return Math.max(4, Math.round(g.y * 0.75))
}

function rectLike(it, top, g) {
  return { col: itemCol(it), w: itemW(it), top, hPx: cardHeightPx(it, g) }
}

/**
 * 自动对齐（原地修改 items）——瀑布流语义：
 *  1. 按 top 邻近度（≤ TOL）聚成"行带"，带内顶对齐（仅为视觉对齐，不做高度约束）；
 *  2. seed = originId 卡，或吸附上移的卡；
 *  3. 每张卡按其"列范围"进行独立重排（瀑布流）：
 *     - required = 上方所有共享列的卡底 + gap.y 的最大值；
 *     - seed 卡与其共享列的后继卡"拉紧"到 required（缩卡上移）；
 *     - 其余卡仅安全下推（max(吸附顶, required)）。
 * 受影响范围仅沿共享列链扩散；无关列 / 拖到底部的孤立卡保持原位。
 * opts：{ originId }（高度变更等定向操作传入）。返回 items（引用不变）。
 */
export function alignRows(items, columns = GRID_COLS, gap = DEFAULT_GAP, opts = {}) {
  const g = normGap(gap)
  const originId = opts?.originId
  if (!Array.isArray(items) || items.length < 2) return items
  const TOL = snapTolerance(g)

  const origTop = new Map()
  items.forEach((it) => origTop.set(it, pxTop(it, g)))

  /* 1) 顶对齐：邻近 top 吸附到带最顶（防重叠；仅视觉，不参与行高） */
  const sorted = items.slice().sort((a, b) => pxTop(a, g) - pxTop(b, g))
  const bands = []
  for (const it of sorted) {
    const last = bands[bands.length - 1]
    const t = pxTop(it, g)
    if (!last || t - last.minTop > TOL) bands.push({ members: [it], minTop: t })
    else last.members.push(it)
  }
  const bandOf = new Map()
  bands.forEach((b) => b.members.forEach((it) => bandOf.set(it, b)))
  for (const band of bands) {
    const others = items.filter((it) => bandOf.get(it) !== band)
    for (const it of band.members) {
      const t = band.minTop
      const cur = pxTop(it, g)
      if (t < cur && others.some((o) => intersects(rectLike(it, t, g), o))) it.top = cur
      else it.top = t
    }
  }

  /* 2) seed：origin 卡 / 吸附上移的卡 */
  const seeds = new Set()
  items.forEach((it) => {
    if (it.id === originId) seeds.add(it)
    else if (pxTop(it, g) < origTop.get(it)) seeds.add(it)
  })

  /* 3) 瀑布重排（每卡级）：required = 上方共享列卡底 + gap；受影响拉紧，其余仅安全下推 */
  const order = items.slice().sort((a, b) => origTop.get(a) - origTop.get(b))
  const fin = new Map() // item -> { finalBottom, affected }
  for (const it of order) {
    let required = 0
    let hasSharingAbove = false
    let affectedAbove = false
    for (const [Y, rec] of fin) {
      if (!colOverlap(Y, it)) continue
      hasSharingAbove = true
      required = Math.max(required, rec.finalBottom + g.y)
      if (rec.affected) affectedAbove = true
    }
    const affected = seeds.has(it) || affectedAbove
    const snappedTop = pxTop(it, g)
    let finalTop
    if (affected && hasSharingAbove) finalTop = required
    else if (affected) finalTop = snappedTop
    else finalTop = Math.max(snappedTop, required)
    finalTop = Math.max(0, Math.round(finalTop))

    it.top = finalTop
    fin.set(it, { finalBottom: finalTop + cardHeightPx(it, g), affected })
  }
  return items
}

/** 递归对齐：先对齐各容器 children（子列数 = 容器 w），再对齐本层 */
export function alignTree(items, columns = GRID_COLS, gap = DEFAULT_GAP, opts = {}) {
  if (!Array.isArray(items)) return items
  items.forEach((it) => {
    if (it?.type === 'container' && Array.isArray(it.children)) {
      alignTree(it.children, Math.max(1, Math.round(it.w) || 6), gap, opts)
    }
  })
  return alignRows(items, columns, gap, opts)
}

/** 指针坐标 → { col, top }（列按 w 与 columns 裁剪，纵向为自由像素） */
export function cellFromPointer(clientX, clientY, rect, w, columns = GRID_COLS, gap = DEFAULT_GAP) {
  const g = normGap(gap)
  const cols = Math.max(1, columns)
  const colWidth = (rect.width - g.x * (cols - 1)) / cols
  const rawCol = Math.floor((clientX - rect.left) / (colWidth + g.x)) + 1
  const rawTop = clientY - rect.top
  return {
    col: clamp(rawCol, 1, Math.max(1, cols - w + 1)),
    top: Math.max(0, rawTop),
  }
}