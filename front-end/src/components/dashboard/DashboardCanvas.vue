<template>
  <div class="dash-canvas">
    <GridBoard
      v-if="rootReady"
      :items="rootItems"
      :charts="charts"
      :editable="editable"
      :board-key="'root'"
      :columns="12"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, provide, reactive, ref, watch } from 'vue'
import { chartApi } from '@/api'
import GridBoard from './GridBoard.vue'
import { applyDrop, cellFromPointer, clampChildren, findFreeCell, flattenItems } from '@/utils/grid-layout'

const props = defineProps({
  items: { type: Array, required: true },
  charts: { type: Array, required: true },
  editable: { type: Boolean, default: false },
})

const emit = defineEmits(['update:items'])

const rootItems = ref([])
const rootReady = ref(false)

// props.items 由编辑器/视图层经 normalizeLayout 得到；这里仅同步引用（控件原地改树）
watch(
  () => props.items,
  (v) => {
    rootItems.value = Array.isArray(v) ? v : []
    rootReady.value = true
  },
  { immediate: true },
)

/* ---- 棋盘状态注入（选择/拖动高亮、选中数据） ---- */
const boardState = reactive({ selectedId: null, draggingId: null })
provide('boardState', boardState)

/* ---- 图表数据（懒加载） ---- */
const chartMap = ref({})
const chartLoaded = ref({})
provide('chartMap', chartMap)
provide('chartLoaded', chartLoaded)

function loadChartData() {
  const flat = flattenItems(rootItems.value)
  const usedIds = new Set(flat.filter((i) => i.type === 'chart').map((i) => i.chartId))
  usedIds.forEach(async (cid) => {
    if (chartMap.value[cid]) {
      chartLoaded.value[cid] = true
      return
    }
    try {
      chartMap.value[cid] = await chartApi.get(cid)
      chartLoaded.value[cid] = true
    } catch (e) {
      /* ignore */
    }
  })
}

watch(
  () =>
    flattenItems(rootItems.value)
      .filter((i) => i.type === 'chart')
      .map((i) => i.chartId)
      .join(','),
  loadChartData,
  { immediate: true },
)

watch(
  () => props.charts.length,
  () => {
    props.charts.forEach((c) => {
      chartMap.value[c.id] = chartMap.value[c.id] || c
      chartLoaded.value[c.id] = true
    })
    loadChartData()
  },
)

/* ---- 筛选聚合（递归，任一卡片的筛选生效） ---- */
const filterValues = ref({})
provide('filterValues', filterValues)

const externalFilters = computed(() => {
  const arr = []
  flattenItems(rootItems.value).forEach((item) => {
    if (item.type !== 'filter') return
    const value = filterValues.value[item.field]
    if (value === null || value === undefined || value === '') return
    arr.push({ field: item.field, op: 'eq', value })
  })
  return arr
})
provide('externalFilters', externalFilters)

/* ---- 修改通知 → 编辑器 v-model 同步 ---- */
function notify() {
  emit('update:items', rootItems.value)
}

/* ---- 棋盘注册表 + 跨层拖拽移交 ---- */
const registry = new Map()

function isAncestorBoard(anc, src) {
  let cur = src
  for (;;) {
    const entry = registry.get(cur)
    if (!entry) return false
    cur = entry.parentKey
    if (!cur) return false
    if (cur === anc) return true
  }
}

function rectContains(r, x, y) {
  return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
}

/** 几何判定鼠标下的目标棋盘：取包含指针的最小面积候选，排除源的祖先（待在源内/拖到外层） */
function pickTarget(clientX, clientY, sourceKey) {
  const srcEntry = registry.get(sourceKey)
  const srcRect = srcEntry?.getEl()?.getBoundingClientRect()
  const insideSource = rectContains(srcRect, clientX, clientY)

  let best = null
  let bestArea = Infinity
  registry.forEach((entry, key) => {
    if (key === sourceKey) return
    const el = entry.getEl()
    if (!el) return
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height || !rectContains(r, clientX, clientY)) return
    const area = r.width * r.height
    if (area < bestArea) {
      bestArea = area
      best = key
    }
  })

  if (best) {
    if (insideSource && isAncestorBoard(best, sourceKey)) return null
    return best
  }
  if (!insideSource) {
    const hit = document.elementFromPoint(clientX, clientY)?.closest?.('[data-board]')?.getAttribute('data-board')
    if (hit && hit !== sourceKey && isAncestorBoard(hit, sourceKey)) return hit
  }
  return null
}

provide('gridBoardApi', {
  register(key, entry) {
    registry.set(key, entry)
  },
  unregister(key) {
    registry.delete(key)
  },
  notify,
  pickTarget,
  removeItem(id) {
    const { arr, idx } = findItemRef(id)
    if (idx === -1) return
    arr.splice(idx, 1)
    if (boardState.selectedId === id) boardState.selectedId = null
    notify()
  },
  reparent(fromKey, toKey, item, clientX, clientY) {
    const src = registry.get(fromKey)
    const dst = registry.get(toKey)
    if (!src || !dst) return
    const srcItems = src.getItems()
    const idx = srcItems.findIndex((i) => i.id === item.id)
    if (idx === -1) return
    const [it] = srcItems.splice(idx, 1)
    const rect = dst.getEl()?.getBoundingClientRect()
    if (!rect) {
      srcItems.push(it)
      return
    }
    const cell = cellFromPointer(clientX, clientY, rect, it.w, dst.getColumns())
    dst.getItems().push({ ...it, col: cell.col, row: cell.row })
    applyDrop(dst.getItems(), { id: it.id, col: cell.col, row: cell.row, w: it.w, h: it.h }, dst.getColumns())
    boardState.selectedId = it.id
    notify()
  },
})

/** 全树查找 id → 所在的父数组 */
function findItemRef(id, arr = rootItems.value) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].id === id) return { arr, idx: i }
    const child = arr[i].children
    if (Array.isArray(child) && child.length) {
      const r = findItemRef(id, child)
      if (r.idx !== -1) return r
    }
  }
  return { arr, idx: -1 }
}

/* ---- 供编辑器调用的添加方法（命中选中容器则落入其 children） ---- */
function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function targetContainer() {
  const sel = boardState.selectedId
  if (!sel) return null
  const { arr, idx } = findItemRef(sel)
  if (idx !== -1 && arr[idx].type === 'container') return arr[idx]
  return null
}

function addChart(chart) {
  const container = targetContainer()
  if (container) {
    const cell = findFreeCell(container.children || [], 6, 2, Math.max(1, container.w))
    container.children = container.children || []
    container.children.push({ id: newId('c'), type: 'chart', chartId: chart.id, w: 6, h: 2, col: cell.col, row: cell.row })
  } else {
    const cell = findFreeCell(rootItems.value, 6, 2)
    rootItems.value.push({ id: newId('c'), type: 'chart', chartId: chart.id, w: 6, h: 2, col: cell.col, row: cell.row })
  }
  notify()
}

function addText(content) {
  const container = targetContainer()
  const cols = container ? Math.max(1, container.w) : 12
  const item = { id: newId('t'), type: 'text', content: content || '', w: Math.min(12, cols), h: 1 }
  if (container) {
    container.children = container.children || []
    const cell = findFreeCell(container.children, item.w, 1, cols)
    container.children.push({ ...item, col: cell.col, row: cell.row })
  } else {
    const cell = findFreeCell(rootItems.value, item.w, 1)
    rootItems.value.push({ ...item, col: cell.col, row: cell.row })
  }
  notify()
}

function addFilter(opts) {
  const container = targetContainer()
  const cols = container ? Math.max(1, container.w) : 12
  const item = { id: newId('f'), type: 'filter', ...opts, w: Math.min(12, cols), h: 1 }
  if (container) {
    container.children = container.children || []
    const cell = findFreeCell(container.children, item.w, 1, cols)
    container.children.push({ ...item, col: cell.col, row: cell.row })
  } else {
    const cell = findFreeCell(rootItems.value, item.w, 1)
    rootItems.value.push({ ...item, col: cell.col, row: cell.row })
  }
  notify()
}

function addContainer() {
  const item = { id: newId('con'), type: 'container', w: 6, h: 3, children: [] }
  const cell = findFreeCell(rootItems.value, 6, 3)
  rootItems.value.push({ ...item, col: cell.col, row: cell.row })
  boardState.selectedId = item.id
  notify()
}

defineExpose({ addChart, addText, addFilter, addContainer })

onBeforeUnmount(() => {
  registry.clear()
})
</script>

<style scoped>
.dash-canvas {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}
</style>