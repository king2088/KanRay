<template>
  <div class="grid-board" :data-board="boardKey" :class="{ 'grid-board--editable': editable }">
    <div
      ref="bodyEl"
      class="grid-body"
      :style="bodyStyle"
      @dragover.prevent
      @drop="onBoardHtmlDrop"
    >
      <template v-if="items.length">
        <div
          v-for="(item, idx) in items"
          :key="item.id"
          class="grid-item"
          :class="{
            'grid-item--editable': editable,
            'grid-item--container': item.type === 'container',
            'grid-item--selected': state.selectedId === item.id,
            'grid-item--dragging': state.draggingId === item.id,
          }"
          :style="itemStyle(item)"
          @mousedown="editable && select(item.id)"
        >
          <!-- 组件头部 -->
          <div
            class="item-header"
            :class="{ editable }"
            @mousedown.stop="editable && beginDrag($event, item)"
          >
            <el-tooltip v-if="editable" content="按住头部拖动调整位置" placement="top" :show-after="600">
              <span class="item-grip">
                <el-icon :size="16"><Rank /></el-icon>
              </span>
            </el-tooltip>
            <span class="item-title">{{ itemTitle(item) }}</span>
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
                      占 {{ w }} 列
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
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
import { ArrowUp, ArrowDown, Operation, Delete, Rank } from '@element-plus/icons-vue'
import ChartTile from './ChartTile.vue'
import FilterComponent from './FilterComponent.vue'
import { applyDrop, cellFromPointer, clampChildren, findFreeCell, GAP, GRID_COLS, ROW_H } from '@/utils/grid-layout'

defineOptions({ name: 'GridBoard' })

const props = defineProps({
  items: { type: Array, required: true },
  charts: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
  boardKey: { type: String, required: true },
  columns: { type: Number, default: GRID_COLS },
})

const state = inject('boardState', null)
const api = inject('gridBoardApi', null)
const chartMap = inject('chartMap', ref({}))
const chartLoaded = inject('chartLoaded', ref({}))
const filterValues = inject('filterValues', ref({}))
const externalFilters = inject('externalFilters', null)

const bodyEl = ref(null)

const bodyStyle = computed(() => ({
  gridTemplateColumns: `repeat(${Math.max(1, props.columns)}, 1fr)`,
}))

const widthOptions = computed(() => [4, 6, 8, 10, 12].filter((w) => w <= Math.max(1, props.columns)))

function itemTitle(item) {
  if (item.type === 'chart') return chartMap.value?.[item.chartId]?.name || '图表'
  if (item.type === 'text') return '文本'
  if (item.type === 'filter') return item.label || `筛选：${item.field}`
  return '容器'
}

function itemStyle(item) {
  return {
    gridColumn: `${item.col || 1} / span ${Math.min(item.w || 6, Math.max(1, props.columns))}`,
    gridRow: `${item.row || 1} / span ${Math.max(1, item.h || 1)}`,
  }
}

function select(id) {
  if (state) state.selectedId = id
}

function notify() {
  api?.notify?.()
}

/* ---- 上移/下移（空间语义：行号 ±1，自动让位） ---- */
function nudge(item, dir) {
  const piece = { id: item.id, col: item.col, row: item.row + dir, w: item.w, h: item.h }
  if (piece.row < 1) return
  applyDrop(props.items, piece, props.columns)
  notify()
}

/* ---- 宽度调整 ---- */
function setWidth(item, w) {
  const maxW = Math.max(1, props.columns)
  const nw = Math.min(w, maxW)
  const col = Math.min(item.col, Math.max(1, maxW - nw + 1))
  item.col = col
  item.w = nw
  if (item.type === 'container') clampChildren(item.children || [], nw)
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
      const cell = findFreeCell(props.items, 6, 2, props.columns)
      const item = { id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, type: 'chart', chartId: chart.id, w: 6, h: 2, col: cell.col, row: cell.row }
      props.items.push(item)
      select(item.id)
      notify()
    }
  } catch (err) {
    /* ignore */
  }
}

/* ---- 头部拖动（显式网格：跟手落点 + 自动让位；悬停其它棋盘时移交） ---- */
let ghostEl = null
let ghostMoved = false
let pendingBoardKey = null
let lastPiece = null

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

  const onMove = (ev) => {
    if (!started) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return
      started = true
      ghostEl = buildGhost(item)
      document.body.classList.add('is-dragging-card')
    }
    if (!ghostEl) return
    ghostEl.style.transform = `translate3d(${ev.clientX - 14}px, ${ev.clientY - 8}px, 0)`

    const hoverEl = document.elementFromPoint(ev.clientX, ev.clientY)
    const hoverKey = hoverEl?.closest?.('[data-board]')?.getAttribute('data-board') || null
    if (hoverKey && hoverKey !== props.boardKey) {
      pendingBoardKey = hoverKey
      return
    }
    pendingBoardKey = null

    const r = rect()
    if (!r) return
    const cell = cellFromPointer(ev.clientX, ev.clientY, r, item.w, props.columns)
    if (lastPiece && cell.col === lastPiece.col && cell.row === lastPiece.row) return
    lastPiece = cell
    applyDrop(props.items, { id: item.id, col: cell.col, row: cell.row, w: item.w, h: item.h }, props.columns)
    notify()
  }

  const onUp = (upEv) => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    if (state) state.draggingId = null
    if (ghostEl) {
      ghostEl.remove()
      ghostEl = null
    }
    document.body.classList.remove('is-dragging-card')
    if (pendingBoardKey && api) {
      api.reparent(props.boardKey, pendingBoardKey, { ...item }, upEv.clientX, upEv.clientY)
    }
    pendingBoardKey = null
    lastPiece = null
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

/* ---- 边缘缩放（e/s/se，按列/行取整） ---- */
function beginResize(e, item, dir) {
  const startX = e.clientX
  const startY = e.clientY
  const w0 = item.w
  const h0 = item.h
  const maxCols = Math.max(1, props.columns)
  const rect = bodyEl.value?.getBoundingClientRect()
  const colWidth = rect ? (rect.width - GAP * (maxCols - 1)) / maxCols : 1
  const maxW = maxCols - (item.col || 1) + 1
  const minH = 1

  const onMove = (ev) => {
    const dx = ev.clientX - startX
    const dy = ev.clientY - startY
    if (dir === 'e' || dir === 'se') {
      const w = Math.max(1, Math.min(maxW, w0 + Math.round(dx / (colWidth + GAP))))
      if (w !== item.w) item.w = w
    }
    if (dir === 's' || dir === 'se') {
      const h = Math.max(minH, h0 + Math.round(dy / (ROW_H + GAP)))
      if (h !== item.h) item.h = h
    }
    if (item.type === 'container') clampChildren(item.children || [], item.w)
    notify()
  }

  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

onMounted(() => {
  api?.register(props.boardKey, {
    getItems: () => props.items,
    getEl: () => bodyEl.value,
    getColumns: () => Math.max(1, props.columns),
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
  min-height: 0;
}

.grid-board--editable {
  background: none;
}

.grid-body {
  height: 100%;
  display: grid;
  grid-template-rows: repeat(60, 150px);
  grid-auto-rows: 150px;
  gap: 12px;
  align-content: start;
}

.grid-item {
  position: relative;
  background: var(--app-card);
  border: 1px solid var(--app-border-light);
  border-radius: var(--app-radius);
  overflow: hidden;
  min-height: 0;
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
}

.grid-item--dragging {
  opacity: 0.45;
  border-color: var(--app-primary);
  border-style: dashed;
}

.item-header {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
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

.item-header .item-actions {
  z-index: 2;
}

.item-grip {
  color: var(--app-text-secondary);
  display: inline-flex;
  align-items: center;
  user-select: none;
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

.item-body {
  height: calc(100% - 34px);
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
  grid-column: span 12;
  padding-top: 24px;
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