<template>
  <div ref="boardEl" class="grid-board" :data-board="boardKey" :class="{ 'grid-board--editable': editable }">
    <div
      ref="bodyEl"
      class="grid-body"
      :style="bodyStyle"
      @dragover.prevent
      @drop="onBoardHtmlDrop"
    >
      <template v-if="items.length">
        <div v-if="previewStyle" class="drop-preview" :style="previewStyle"></div>
        <div
          v-for="(item, idx) in items"
          :key="item.id"
          class="grid-item"
          :data-item-id="item.id"
          :class="{
            'grid-item--editable': editable,
            'grid-item--container': item.type === 'container',
            'grid-item--selected': state.selectedId === item.id,
            'grid-item--dragging': state.draggingId === item.id,
          }"
          :style="itemStyle(item)"
          @mousedown="editable && select(item.id)"
        >
          <!-- 组件头部（可作拖拽手柄；隐藏标题时变细条 + 选中浮出操作条） -->
          <div
            class="item-header"
            :class="{
              editable,
              'item-header--min': item.hideTitle,
              'item-header--hidden': cardHeightPx(item, gapValue) <= 35,
              'item-header--compact': !item.hideTitle && cardHeightPx(item, gapValue) > 35 && cardHeightPx(item, gapValue) <= 80,
              'item-header--sel': state.selectedId === item.id,
            }"
            @mousedown.stop="editable && beginDrag($event, item)"
          >
            <span v-if="!item.hideTitle" class="item-title">{{ itemTitle(item) }}</span>
            <span v-if="editable" class="item-actions">
              <el-icon class="act-btn" size="15" @click.stop="nudge(item, -1)"><ArrowUp /></el-icon>
              <el-icon class="act-btn" size="15" @click.stop="nudge(item, 1)"><ArrowDown /></el-icon>
              <el-dropdown trigger="click" size="small" @command="(cmd) => setWidth(item, cmd)">
                <el-icon class="act-btn" size="15"><Operation /></el-icon>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      v-for="w in widthOptions"
                      :key="w"
                      :command="w"
                      :disabled="item.w === w"
                    >
                      宽 {{ w }} 列
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-dropdown trigger="click" size="small" @command="(cmd) => setHeight(item, cmd)">
                <el-icon class="act-btn" size="15"><Expand /></el-icon>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      v-for="v in HEIGHT_OPTIONS"
                      :key="v"
                      :command="v"
                      :disabled="cardHeightPx(item, gapValue) === v"
                    >
                      高 {{ v }}px
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-tooltip :content="item.hideTitle ? '显示标题' : '隐藏标题'" placement="top" :show-after="500">
                <el-icon class="act-btn" size="15" @click.stop="toggleTitle(item)">
                  <component :is="item.hideTitle ? 'View' : 'Hide'" />
                </el-icon>
              </el-tooltip>
              <el-icon class="act-btn act-btn--danger" size="15" @click.stop="remove(item.id)"><Delete /></el-icon>
            </span>
          </div>

          <!-- 组件内容 -->
          <div class="item-body" :class="{ 'item-body--container': item.type === 'container' }">
            <template v-if="item.type === 'chart'">
              <ChartTile
                v-if="chartLoaded[item.chartId]"
                :chart="chartMap[item.chartId]"
                :external-filters="externalFilters"
                :height-scale="item.h"
              />
              <el-empty v-else-if="!chartMap[item.chartId]" description="图表已删除" :image-size="60" />
            </template>

            <template v-else-if="item.type === 'text'">
              <div class="text-component" v-html="item.content || ''" />
            </template>

            <template v-else-if="item.type === 'filter'">
              <FilterComponent
                v-model="filterValues[item.field]"
                :field="item.field"
                :dataset-id="item.datasetId"
                :label="item.label"
              />
            </template>

            <GridBoard
              v-else-if="item.type === 'container' && item.children"
              :items="item.children"
              :charts="charts"
              :editable="editable"
              :board-key="item.id"
              :columns="Math.max(1, item.w || 6)"
              :gap="gap"
            />
            <el-empty
              v-else-if="item.type === 'container'"
              class="grid-empty"
              description="拖入卡片，或选中后在右侧添加"
              :image-size="48"
            />
          </div>

          <!-- 边缘缩放手柄（选中时显示） -->
          <template v-if="editable && state.selectedId === item.id">
            <span class="resize-e" @mousedown.stop.prevent="beginResize($event, item, 'e')"></span>
            <span class="resize-s" @mousedown.stop.prevent="beginResize($event, item, 's')"></span>
            <span class="resize-se" @mousedown.stop.prevent="beginResize($event, item, 'se')"></span>
          </template>
        </div>
      </template>

      <el-empty
        v-else
        class="grid-empty"
        :description="boardKey === 'root' ? '从右侧图表库点击或拖拽图表到此处' : '拖入卡片，或选中容器后在右侧添加'"
        :image-size="60"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, defineOptions, inject, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowUp, ArrowDown, Operation, Expand, Delete } from '@element-plus/icons-vue'
import ChartTile from './ChartTile.vue'
import FilterComponent from './FilterComponent.vue'
import {
  alignRows, applyDrop, cardHeightPx, cellFromPointer, clampChildren, findFreeCell, GAP, GRID_COLS, normGap, ROW_H, rowsForHeight,
} from '@/utils/grid-layout'

defineOptions({ name: 'GridBoard' })

const HEIGHT_OPTIONS = [35, 70, 150, 300, 600]

const props = defineProps({
  items: { type: Array, required: true },
  charts: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
  boardKey: { type: String, required: true },
  columns: { type: Number, default: GRID_COLS },
  gap: { type: Object, default: () => ({ x: GAP, y: GAP }) },
})

const state = inject('boardState', null)
const api = inject('gridBoardApi', null)
const chartMap = inject('chartMap', ref({}))
const chartLoaded = inject('chartLoaded', ref({}))
const filterValues = inject('filterValues', ref({}))
const externalFilters = inject('externalFilters', null)

const boardEl = ref(null)
const bodyEl = ref(null)

const cols = computed(() => Math.max(1, props.columns))
const gapValue = computed(() => normGap(props.gap))

/** 供调色板/子组件引用的当前棋盘高度逻辑（像素纵向） */
const bodyStyle = computed(() => {
  let bottom = 0
  props.items.forEach((it) => {
    const b = (Number(it.top) >= 0 ? Number(it.top) : 0) + cardHeightPx(it, gapValue.value)
    if (b > bottom) bottom = b
  })
  return { height: `${bottom}px`, minHeight: '100%' }
})

const widthOptions = computed(() => [4, 6, 8, 10, 12].filter((w) => w <= cols.value))

function itemTitle(item) {
  if (item.type === 'chart') return chartMap.value?.[item.chartId]?.name || '图表'
  if (item.type === 'text') return '文本'
  if (item.type === 'filter') return item.label || `筛选：${item.field}`
  return '容器'
}

/** 单元格矩形（px 计算；横向按列、纵向按像素 top） */
function cellRectStyle(col, top, w, heightPx) {
  const c = cols.value
  const g = gapValue.value
  const cellW = `((100% - ${(c - 1) * g.x}px) / ${c})`
  return {
    left: `calc(${Math.max(0, col - 1)} * (${cellW} + ${g.x}px))`,
    top: `${Math.max(0, top) || 0}px`,
    width: `calc(${Math.max(1, w)} * ${cellW} + ${Math.max(0, w - 1) * g.x}px)`,
    height: `${heightPx}px`,
  }
}

function headerHeight(heightPx) {
  if (heightPx <= 35) return 0
  if (heightPx <= 80) return 22
  return 34
}

function itemInnerStyle(item) {
  const h = cardHeightPx(item, gapValue.value)
  const hh = headerHeight(h)
  return {
    ...cellRectStyle(item.col, item.top, item.w, h),
    '--hh': hh + 'px',
    padding: h <= 35 ? '4px' : '0',
  }
}

/** 显式像素定位（自由摆放网格） */
function itemStyle(item) {
  return itemInnerStyle(item)
}

/** 拖动落位参考框 */
const previewStyle = computed(() => {
  const p = state?.dropPreview
  if (!p || p.boardKey !== props.boardKey) return null
  return cellRectStyle(p.col, p.top, p.w, p.height)
})

function select(id) {
  if (state) state.selectedId = id
}

function notify() {
  api?.notify?.()
}

/* ---- 自动对齐：origin 传入 → 整条同列链重排（缩卡上移/加高下推）；否则仅做同行吸附对齐 ---- */
function alignBoard(originId) {
  if (!props.items.length) return
  alignRows(props.items, cols.value, gapValue.value, originId != null ? { originId } : undefined)
  notify()
}

/* ---- 上移/下移（像素纵向：按一个行高步进，冲突自动让位） ---- */
function nudge(item, dir) {
  const g = gapValue.value
  const cur = Number(item.top) || 0
  const top = Math.max(0, cur + dir * (ROW_H + g.y))
  if (top === cur) return
  applyDrop(props.items, { id: item.id, col: item.col, top, w: item.w, hPx: cardHeightPx(item, g) }, cols.value, g)
  alignBoard()
}

/* ---- 宽度调整 ---- */
function setWidth(item, w) {
  const maxW = cols.value
  const nw = Math.min(w, maxW)
  const col = Math.min(item.col, Math.max(1, maxW - nw + 1))
  applyDrop(props.items, { id: item.id, col, top: Number(item.top) || 0, w: nw, hPx: cardHeightPx(item, gapValue.value) }, cols.value, gapValue.value)
  if (item.type === 'container') clampChildren(item.children || [], nw)
  alignBoard()
}

/* ---- 高度调整（下拉选值）：先让位，再整条同列链重排 ---- */
function setHeight(item, px) {
  item.hPx = px
  item.h = rowsForHeight(px, gapValue.value)
  applyDrop(props.items, { id: item.id, col: item.col, top: Number(item.top) || 0, w: item.w, hPx: px }, cols.value, gapValue.value)
  alignBoard(item.id)
}

/* ---- 标题显隐 ---- */
function toggleTitle(item) {
  item.hideTitle = !item.hideTitle
  notify()
}

function remove(id) {
  api?.removeItem?.(id)
}

/* ---- HTML5 拖入（图表库调色板） ---- */
function onBoardHtmlDrop(e) {
  if (!props.editable) return
  const raw = e.dataTransfer.getData('text/plain')
  if (!raw) return
  try {
    const data = JSON.parse(raw)
    if (data.type === 'chart') {
      const chart = props.charts?.find?.((c) => c.id === data.chartId) || chartMap.value[data.chartId]
      if (!chart) return
      const g = gapValue.value
      const cell = findFreeCell(props.items, 6, cardHeightPx({ h: 2 }, g), cols.value, g)
      const item = {
        id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, type: 'chart', chartId: chart.id,
        w: 6, h: 2, hPx: cardHeightPx({ h: 2 }, g), col: cell.col, top: cell.top,
      }
      props.items.push(item)
      select(item.id)
      alignBoard()
    }
  } catch (err) {
    /* ignore */
  }
}

/* ---- 头部拖动（显式网格：跟手落点 + 自动让位；悬停其它棋盘时移交） ---- */
let ghostEl = null
let pendingBoardKey = null
let lastPiece = null

function scrollNearEdges(ev) {
  const scroller = boardEl.value?.closest?.('.dash-canvas')
  if (!scroller) return
  if (ev.clientY > window.innerHeight - 60) scroller.scrollTop += 24
  else if (ev.clientY < 100) scroller.scrollTop -= 24
}

function buildGhost(item) {
  const g = document.createElement('div')
  g.className = 'drag-ghost'
  g.innerHTML = '<span class="drag-ghost__grip"></span><span class="drag-ghost__title"></span>'
  const titleEl = g.querySelector('.drag-ghost__title')
  titleEl.textContent = itemTitle(item) + (item.type === 'container' ? '（容器）' : '')
  document.body.appendChild(g)
  return g
}

function beginDrag(e, item) {
  if (!props.editable) return
  if (e.target.closest && e.target.closest('.item-actions')) return
  if (e.button !== 0) return
  e.preventDefault()

  if (state) state.selectedId = item.id
  if (state) state.draggingId = item.id

  const startX = e.clientX
  const startY = e.clientY
  const rect = () => bodyEl.value?.getBoundingClientRect() || null
  let started = false
  ghostEl = null
  pendingBoardKey = null
  lastPiece = null

  const setPreview = (boardKey, col, top) => {
    if (state) state.dropPreview = { boardKey, col, top, w: item.w, height: cardHeightPx(item, gapValue.value) }
  }

  const onMove = (ev) => {
    if (!started) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return
      started = true
      ghostEl = buildGhost(item)
      document.body.classList.add('is-dragging-card')
    }
    if (!ghostEl) return
    ghostEl.style.transform = `translate3d(${ev.clientX - 14}px, ${ev.clientY - 8}px, 0)`
    scrollNearEdges(ev)

    // 几何判定目标棋盘：命中容器等其它板时不再实时让位（避免目标被顶走），等待 mouseup 重挂
    const targetKey = api?.pickTarget ? api.pickTarget(ev.clientX, ev.clientY, props.boardKey) : null
    if (targetKey) {
      pendingBoardKey = targetKey
      const c = api.cellIn(targetKey, ev.clientX, ev.clientY, item.w)
      setPreview(targetKey, c.col, c.top)
      return
    }
    pendingBoardKey = null

    const r = rect()
    if (!r) return
    const cell = cellFromPointer(ev.clientX, ev.clientY, r, item.w, cols.value, gapValue.value)
    setPreview(props.boardKey, cell.col, cell.top)
    lastPiece = cell
  }

  const onUp = (upEv) => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    if (state) state.draggingId = null
    if (state) state.dropPreview = null
    if (ghostEl) {
      ghostEl.remove()
      ghostEl = null
    }
    document.body.classList.remove('is-dragging-card')
    if (pendingBoardKey && api) {
      api.reparent(props.boardKey, pendingBoardKey, { ...item }, upEv.clientX, upEv.clientY)
    } else if (lastPiece) {
      // 板内一次性落位：只在这里让位，目标卡不会被拖拽过程顶走
      const g = gapValue.value
      applyDrop(props.items, { id: item.id, col: lastPiece.col, top: lastPiece.top, w: item.w, hPx: cardHeightPx(item, g) }, cols.value, g)
      alignBoard()
    }
    pendingBoardKey = null
    lastPiece = null
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

/* ---- 边缘缩放（e/s/se；宽按列、高按像素，最小 35px，冲突自动让位） ---- */
function beginResize(e, item, dir) {
  const startX = e.clientX
  const startY = e.clientY
  const origin = props.items.find((i) => i.id === item.id) || item
  const w0 = origin.w
  const px0 = cardHeightPx(origin, gapValue.value)
  const maxCols = cols.value
  const rect = bodyEl.value?.getBoundingClientRect()
  const g = gapValue.value
  const colWidth = rect ? (rect.width - g.x * (maxCols - 1)) / maxCols : 1
  const maxW = maxCols - (origin.col || 1) + 1

  const onMove = (ev) => {
    scrollNearEdges(ev)
    const cur = props.items.find((i) => i.id === origin.id)
    if (!cur) return
    const dx = ev.clientX - startX
    const dy = ev.clientY - startY
    let changed = false
    if (dir === 'e' || dir === 'se') {
      const w = Math.max(1, Math.min(maxW, w0 + Math.round(dx / (colWidth + g.x))))
      if (w !== cur.w) { cur.w = w; changed = true }
    }
    if (dir === 's' || dir === 'se') {
      const px = Math.max(35, px0 + Math.round(dy / 1.5))
      if (px !== cur.hPx) {
        cur.hPx = px
        cur.h = rowsForHeight(px, g)
        changed = true
      }
    }
    if (!changed) return
    if (item.type === 'container') clampChildren(item.children || [], cur.w)
    applyDrop(props.items, { id: cur.id, col: cur.col, top: Number(cur.top) || 0, w: cur.w, hPx: cardHeightPx(cur, g) }, cols.value, g)
    notify()
  }

  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    alignBoard(origin.id)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

onMounted(() => {
  const parentBoard = boardEl.value?.parentElement?.closest?.('[data-board]')
  api?.register(props.boardKey, {
    getItems: () => props.items,
    getEl: () => bodyEl.value,
    getColumns: () => cols.value,
    parentKey: parentBoard?.getAttribute('data-board') || null,
  })
})

onBeforeUnmount(() => {
  api?.unregister(props.boardKey)
  if (ghostEl) {
    ghostEl.remove()
    ghostEl = null
  }
  document.body.classList.remove('is-dragging-card')
})
</script>

<style scoped>
.grid-board {
  width: 100%;
  height: 100%;
  min-height: 100%;
  min-width: 0;
}

.grid-body {
  position: relative;
}

.drop-preview {
  position: absolute;
  z-index: 1;
  pointer-events: none;
  background: rgba(64, 158, 255, 0.16);
  border: 2px dashed var(--app-primary);
  border-radius: var(--app-radius);
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.25);
}

.grid-item {
  position: absolute;
  background: var(--app-card);
  border: 1px solid var(--app-border-light);
  border-radius: var(--app-radius);
  overflow: hidden;
  min-width: 0;
}

.grid-item--editable {
  user-select: none;
}

.grid-item--container > .item-body {
  background: transparent;
  padding: 12px;
}

.grid-item--selected {
  border-color: var(--app-primary);
  box-shadow: 0 0 0 1px var(--app-primary);
  z-index: 2;
}

.grid-item--dragging {
  opacity: 0.45;
  border-color: var(--app-primary);
  border-style: dashed;
}

/* ---- 头部 ---- */
.item-header {
  --hh: 34px;
  display: flex;
  align-items: center;
  gap: 6px;
  height: var(--hh);
  padding: 0 10px;
  background: var(--app-card);
  border-bottom: 1px solid var(--app-border-light);
  font-size: 13px;
}

.item-header.editable {
  cursor: grab;
}

.item-header.editable:active {
  cursor: grabbing;
}

.item-header.editable:hover {
  background: var(--app-hover);
}

.item-header.item-header--min {
  --hh: 10px;
  padding: 0;
  border-bottom: none;
  position: relative;
}

.item-header.item-header--compact {
  --hh: 22px;
  padding: 0 8px;
  gap: 4px;
  font-size: 12px;
}

.item-header.item-header--hidden {
  visibility: hidden;
  pointer-events: none;
  overflow: hidden;
}

.item-header.item-header--hidden .item-actions {
  display: none;
}

.item-header.item-header--min .item-actions {
  position: absolute;
  top: 2px;
  right: 6px;
  padding: 1px 6px;
  background: var(--app-card);
  border: 1px solid var(--app-border-light);
  border-radius: var(--app-radius);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  opacity: 0;
  pointer-events: none;
}

.item-header.item-header--min.item-header--sel .item-actions {
  opacity: 1;
  pointer-events: auto;
  z-index: 5;
}

.item-title {
  font-weight: 600;
  color: var(--app-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.item-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--app-text-secondary);
}

.act-btn {
  cursor: pointer;
  opacity: 0.7;
}

.act-btn:hover {
  opacity: 1;
}

.act-btn--danger:hover {
  color: var(--app-danger);
}

/* ---- 内容区 ---- */
.item-body {
  height: calc(100% - var(--hh, 34px));
  overflow: auto;
}

.item-body--container {
  overflow: auto;
}

.text-component {
  padding: 12px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--app-text-primary);
}

.grid-empty {
  padding: 40px 0;
  width: 100%;
}

/* ---- 缩放手柄 ---- */
.resize-e {
  position: absolute;
  top: 0;
  right: 0;
  width: 8px;
  height: 100%;
  cursor: ew-resize;
  z-index: 3;
}

.resize-s {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 8px;
  cursor: ns-resize;
  z-index: 3;
}

.resize-se {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  z-index: 4;
}

.resize-e:hover,
.resize-s:hover,
.resize-se:hover {
  background: rgba(64, 158, 255, 0.35);
}
</style>