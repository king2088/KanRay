<template>
  <div class="dash-canvas">
    <!-- 编辑模式：底部工具条 -->
    <div v-if="editable" class="canvas-toolbar">
      <div class="tool-group">
        <span class="tool-label">添加图表：</span>
        <div
          v-for="c in availableCharts"
          :key="c.id"
          class="chart-palette-item"
          draggable="true"
          @dragstart="onPaletteDrag($event, c)"
          @click="addChart(c)"
        >
          <el-icon :size="14"><PieChart /></el-icon>
          <span>{{ c.name }}</span>
        </div>
        <span v-if="!availableCharts.length" class="tool-hint">请先在「图表中心」创建图表</span>
      </div>
      <div class="tool-group">
        <span class="tool-label">单元格宽/高：</span>
        <el-tag size="small" type="info">{{ GRID_COLS }} 列网格</el-tag>
      </div>
    </div>

    <!-- 网格主体 -->
    <div
      class="grid-body"
      @dragover.prevent
      @drop="onCanvasDrop"
    >
      <template v-if="items.length">
        <div
          v-for="(item, idx) in items"
          :key="item.id"
          class="grid-item"
          :class="{
            'grid-item--editable': editable,
            'grid-item--selected': selectedId === item.id,
            'grid-item--dragging': draggingId === item.id,
          }"
          :style="itemStyle(item)"
          @click="editable && (selectedId = item.id)"
          ref="gridItems"
        >
          <!-- 组件头部 -->
          <div class="item-header" :class="{ editable }">
            <span
              v-if="editable"
              class="drag-handle"
              @mousedown="startReorder($event, idx)"
            >
              <el-icon size="14"><Rank /></el-icon>
            </span>
            <span class="item-title">{{ itemTitle(item) }}</span>
            <span v-if="editable" class="item-actions">
              <!-- 宽度调整 -->
              <el-dropdown trigger="click" size="small" @command="(cmd) => setWidth(item, cmd)">
                <el-icon class="act-btn" size="15"><Operation /></el-icon>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-for="w in [4, 6, 8, 10, 12]" :key="w" :command="w" :disabled="item.w === w">
                      占 {{ w }} 列
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-icon class="act-btn act-btn--danger" size="15" @click.stop="removeItem(item.id)"><Delete /></el-icon>
            </span>
          </div>

          <!-- 组件内容 -->
          <div class="item-body">
            <template v-if="item.type === 'chart'">
              <ChartTile
                v-if="chartLoaded[item.chartId]"
                :chart="chartMap[item.chartId]"
                :external-filters="filtersArray"
                :height-scale="item.h"
              />
              <el-empty v-else-if="!chartMap[item.chartId]" description="图表已删除" :image-size="60" />
            </template>
            <template v-else-if="item.type === 'text'">
              <div class="text-component" v-html="renderText(item.content)" />
            </template>
            <template v-else-if="item.type === 'filter'">
              <FilterComponent
                v-model="filterValues[item.field]"
                :field="item.field"
                :dataset-id="item.datasetId"
                :label="item.label"
              />
            </template>
          </div>
        </div>
      </template>
      <el-empty v-else class="grid-empty" description="从上方拖拽图表到此处" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Rank, Operation, Delete, PieChart } from '@element-plus/icons-vue'
import { chartApi, datasetApi } from '@/api'
import ChartTile from './ChartTile.vue'
import FilterComponent from './FilterComponent.vue'

const props = defineProps({
  items: { type: Array, required: true },
  charts: { type: Array, required: true },
  editable: { type: Boolean, default: false },
})

const emit = defineEmits(['update:items', 'add-item', 'remove-item'])

const GRID_COLS = 12
const gridItems = ref([])
const selectedId = ref(null)
const draggingId = ref(null)
const chartMap = ref({})
const chartLoaded = ref({})

// 可用图表 = 全部图表中尚未放到看板上的
const availableCharts = computed(() => {
  const used = new Set(props.items.filter((i) => i.type === 'chart').map((i) => i.chartId))
  return props.charts.filter((c) => !used.has(c.id))
})

const filterValues = ref({})

// 由筛选组件 + 其当前值组装 externalFilters
const filtersArray = computed(() => {
  const arr = []
  props.items.forEach((item) => {
    if (item.type !== 'filter') return
    const value = filterValues.value[item.id]
    if (value === null || value === undefined || value === '') return
    arr.push({ field: item.field, op: 'eq', value })
  })
  return arr
})

function itemTitle(item) {
  if (item.type === 'chart') return chartMap.value[item.chartId]?.name || '图表'
  if (item.type === 'text') return '文本'
  if (item.type === 'filter') return item.label || `筛选：${item.field}`
  return '组件'
}

function itemStyle(item) {
  return {
    gridColumn: `span ${Math.min(item.w || 6, GRID_COLS)}`,
    gridRow: `span ${item.h || 1}`,
  }
}

/** 采用 CSS grid flow 布局，无需计算 x/y，数组顺序即布局顺序 */
function computeLayout() {
  // no-op in flow layout; 保留用于未来自由定位
}

function renderText(content) {
  return content || ''
}

function onPaletteDrag(e, chart) {
  e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'chart', chartId: chart.id }))
  e.dataTransfer.effectAllowed = 'copy'
}

function addChart(chart) {
  const id = `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  emit('add-item', { id, type: 'chart', chartId: chart.id, w: 6, h: 2 })
}

function onCanvasDrop(e) {
  const raw = e.dataTransfer.getData('text/plain')
  if (!raw) return
  try {
    const data = JSON.parse(raw)
    if (data.type === 'chart') {
      const chart = props.charts.find((c) => c.id === data.chartId)
      if (chart) addChart(chart)
    }
  } catch (err) {
    /* ignore */
  }
}

function setWidth(item, w) {
  item.w = w
}

function removeItem(id) {
  emit('remove-item', id)
  if (selectedId.value === id) selectedId.value = null
}

/** 添加文本组件 */
function addText(content) {
  const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  emit('add-item', { id, type: 'text', content: content || '', w: 12, h: 1 })
}

/** 添加筛选组件 */
function addFilter(opts) {
  const id = `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  emit('add-item', { id, type: 'filter', ...opts, w: 12, h: 1 })
}

defineExpose({ addText, addFilter })

/* ---- 拖动排序（基于 flow 数组顺序） ---- */
function startReorder(e, startIdx) {
  if (!props.editable) return
  e.preventDefault()
  const startX = e.clientX
  const startY = e.clientY
  const item = props.items[startIdx]
  draggingId.value = item.id
  let moved = false

  const currentIndex = () => props.items.findIndex((it) => it.id === item.id)

  const onMove = (ev) => {
    const dx = Math.abs(ev.clientX - startX)
    const dy = Math.abs(ev.clientY - startY)
    if (dx < 5 && dy < 5) return
    moved = true
    const el = document.elementFromPoint(ev.clientX, ev.clientY)
    const targetEl = el ? el.closest('.grid-item') : null
    if (!targetEl) return
    const targetIdx = gridItems.value.findIndex((n) => n === targetEl || n?.$el === targetEl)
    if (targetIdx === -1) return
    const curIdx = currentIndex()
    if (curIdx === targetIdx) return
    const arr = [...props.items]
    const [dragged] = arr.splice(curIdx, 1)
    arr.splice(targetIdx, 0, dragged)
    emit('update:items', arr)
  }

  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    draggingId.value = null
    if (moved) ElMessage.success('已调整位置')
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

/* ---- 加载图表定义 ---- */
function loadCharts() {
  chartMap.value = {}
  chartLoaded.value = {}
  props.charts.forEach((c) => {
    chartMap.value[c.id] = c
    chartLoaded.value[c.id] = false
  })
  // 懒加载图表数据：仅加载看板中出现的
  const usedIds = new Set(props.items.filter((i) => i.type === 'chart').map((i) => i.chartId))
  usedIds.forEach(async (cid) => {
    if (!chartMap.value[cid]) {
      try {
        chartMap.value[cid] = await chartApi.get(cid)
      } catch (e) {
        return
      }
    }
    chartLoaded.value[cid] = true
  })
}

// 看板中出现的图表随 items 变化即时点亮
watch(
  () => props.items.filter((i) => i.type === 'chart').map((i) => i.chartId).join(','),
  () => {
    props.items.forEach((item) => {
      if (item.type !== 'chart') return
      if (chartMap.value[item.chartId]) chartLoaded.value[item.chartId] = true
    })
  },
)

// 监听外部筛选：透传给 ChartTile
// chartTile 内部调用 chartApi.data 时合并 externalFilters
watch(() => props.externalFilters, () => {}, { deep: true })

onMounted(loadCharts)
watch(() => props.charts.length, loadCharts)
</script>

<style scoped>
.dash-canvas {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.canvas-toolbar {
  background: #fff;
  border: 1px solid var(--app-border-light);
  border-radius: var(--app-radius);
  padding: 10px 14px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tool-label {
  font-size: 13px;
  color: var(--app-text-regular);
  font-weight: 600;
}

.tool-hint {
  font-size: 12px;
  color: var(--app-text-secondary);
}

.chart-palette-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--app-primary-light);
  border: 1px solid #d9ecff;
  color: var(--app-primary);
  border-radius: var(--app-radius);
  padding: 4px 10px;
  font-size: 12px;
  cursor: grab;
  user-select: none;
}

.chart-palette-item:hover {
  border-color: var(--app-primary);
}

.grid-body {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-auto-rows: minmax(140px, auto);
  grid-auto-flow: row;
  gap: 12px;
  align-content: start;
}

.grid-item {
  background: #fff;
  border: 1px solid var(--app-border-light);
  border-radius: var(--app-radius);
  overflow: hidden;
  min-height: 0;
  min-width: 0;
}

.grid-item--editable {
  cursor: move;
}

.grid-item--selected {
  border-color: var(--app-primary);
  box-shadow: 0 0 0 1px var(--app-primary);
}

.grid-item--dragging {
  opacity: 0.8;
  border-color: var(--app-primary);
}

.item-header {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 10px;
  background: #fff;
  border-bottom: 1px solid var(--app-border-light);
  font-size: 13px;
}

.item-header.editable:hover {
  background: var(--app-hover);
}

.drag-handle {
  color: var(--app-text-secondary);
  cursor: grab;
  display: inline-flex;
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

.text-component {
  padding: 12px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--app-text-primary);
}

.grid-empty {
  grid-column: span 12;
}
</style>