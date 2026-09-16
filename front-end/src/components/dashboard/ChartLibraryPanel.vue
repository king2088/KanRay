<template>
  <aside class="chart-library-panel">
    <div class="clp-header">
      <div class="clp-title"><el-icon :size="15"><PieChart /></el-icon> 图表库</div>
      <el-select v-model="dsFilter" clearable placeholder="按数据源筛选" class="clp-select" @change="onFilterChange">
        <el-option v-for="d in datasetOptions" :key="d.id" :label="d.name" :value="d.id" />
      </el-select>
      <el-input v-model="keyword" clearable placeholder="搜索图表名称" :prefix-icon="Search" class="clp-search" @input="onKeywordInput" @clear="onKeywordClear" />
      <div class="clp-count">共 {{ total }} 个图表</div>
    </div>

    <el-scrollbar class="clp-scroll">
      <div v-loading="loading" class="clp-lists" element-loading-text="加载中…">
        <template v-if="available.length">
          <div class="clp-list">
            <div
              v-for="c in available"
              :key="c.id"
              class="chart-palette-item"
              draggable="true"
              @dragstart="onPaletteDrag($event, c)"
              @click="$emit('add-chart', c)"
            >
              <ChartTypeIcon :name="c.chartType || 'bar'" :size="30" class="clp-type-icon" />
              <div class="clp-body">
                <span class="clp-name">{{ c.name }}</span>
                <span class="clp-meta">{{ c.datasetName || '未绑定数据源' }}</span>
                <span v-if="c.updatedAt" class="clp-time">{{ formatDateTime(c.updatedAt, appStore.timezone) }}</span>
              </div>
            </div>
          </div>
          <div v-if="hasMore" class="clp-more">
            <el-button  text :loading="loadingMore" @click="loadMore">加载更多</el-button>
          </div>
        </template>
        <el-empty v-else-if="!loading" description="没有可用图表" :image-size="46" />

        <div v-if="usedList.length" class="clp-list clp-list--used">
          <div v-for="c in usedList" :key="c.id" class="chart-palette-item is-used">
            <ChartTypeIcon :name="c.chartType || 'bar'" :size="30" class="clp-type-icon" />
            <div class="clp-body">
              <span class="clp-name">{{ c.name }}</span>
              <span class="clp-meta">{{ c.datasetName || '未绑定数据源' }}</span>
              <span v-if="c.updatedAt" class="clp-time">{{ formatDateTime(c.updatedAt, appStore.timezone) }}</span>
            </div>
            <el-tag  type="info">已在看板</el-tag>
          </div>
        </div>
      </div>
    </el-scrollbar>
  </aside>
</template>

<script setup>
import { ref, computed, onBeforeUnmount, watch } from 'vue'
import { Search, PieChart } from '@element-plus/icons-vue'
import { chartApi } from '@/api'
import { flattenItems } from '@/utils/grid-layout'
import { useAppStore } from '@/stores/app'
import { formatDateTime } from '@/utils/datetime'
import ChartTypeIcon from '@/components/charts/ChartTypeIcon.vue'

const PAGE_SIZE = 20
const appStore = useAppStore()

const props = defineProps({
  datasets: { type: Array, default: () => [] },
  items: { type: Array, required: true },
})

defineEmits(['add-chart'])

const dsFilter = ref('')
const keyword = ref('')
const list = ref([])
const usedList = ref([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const loadingMore = ref(false)
let seq = 0
let kwTimer = null

const datasetOptions = computed(() => (props.datasets || []).map((d) => ({ id: d.id, name: d.name })))

function usedChartIds() {
  return new Set(flattenItems(props.items).filter((i) => i.type === 'chart').map((i) => i.chartId))
}

async function fetchAvailable(reset, extra = {}) {
  const mySeq = ++seq
  const ids = usedChartIds()
  const params = {
    keyword: keyword.value.trim() || undefined,
    datasetId: dsFilter.value || undefined,
    excludeIds: ids.size ? [...ids].join(',') : undefined,
    page: reset ? 1 : page.value,
    pageSize: PAGE_SIZE,
  }
  loading.value = !!reset
  try {
    const res = await chartApi.list({ ...params, ...extra })
    if (mySeq !== seq) return
    const data = Array.isArray(res) ? { list: res, total: res.length } : res
    if (reset) {
      list.value = data.list || []
      page.value = 1
    } else {
      list.value = list.value.concat(data.list || [])
    }
    total.value = data.total ?? list.value.length
  } catch (e) {
    if (mySeq !== seq) return
    if (reset) list.value = []
    total.value = list.value.length
  } finally {
    if (mySeq === seq) loading.value = false
    loadingMore.value = false
  }
}

async function fetchUsed() {
  const ids = usedChartIds()
  if (!ids.size) {
    usedList.value = []
    return
  }
  try {
    const res = await chartApi.list({ ids: [...ids].join(',') })
    usedList.value = Array.isArray(res) ? res : res.list || []
  } catch (e) {
    usedList.value = []
  }
}

function onFilterChange() {
  fetchAvailable(true)
}

function onKeywordInput() {
  if (kwTimer) clearTimeout(kwTimer)
  kwTimer = setTimeout(() => fetchAvailable(true), 350)
}

function onKeywordClear() {
  fetchAvailable(true)
}

async function loadMore() {
  if (loadingMore.value || loading.value) return
  loadingMore.value = true
  page.value += 1
  await fetchAvailable(false)
}

const hasMore = computed(() => list.value.length < total.value)

watch(
  () => flattenItems(props.items).filter((i) => i.type === 'chart').map((i) => i.chartId).join(','),
  () => {
    fetchUsed()
    fetchAvailable(true)
  },
)

fetchAvailable(true)
fetchUsed()

onBeforeUnmount(() => {
  if (kwTimer) clearTimeout(kwTimer)
  seq += 1
})

const available = computed(() => list.value)

function onPaletteDrag(e, chart) {
  e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'chart', chartId: chart.id }))
  e.dataTransfer.effectAllowed = 'copy'
}
</script>

<style scoped>
.chart-library-panel {
  width: 260px;
  flex-shrink: 0;
  background: var(--app-card);
  border: 1px solid var(--app-border-light);
  border-radius: var(--app-radius);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
  min-height: 0;
}

.clp-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.clp-select,
.clp-search {
  width: 100%;
}

.clp-count {
  font-size: 11px;
  color: var(--app-text-secondary);
}

.clp-scroll {
  flex: 1;
  min-height: 0;
}

.clp-lists {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 0 8px 4px 0;
  min-height: 100%;
}

.clp-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text-primary);
}

.clp-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.clp-list--used {
  border-top: 1px solid var(--app-border-light);
  padding-top: 14px;
}

.clp-more {
  display: flex;
  justify-content: center;
}

.clp-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chart-palette-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: var(--app-primary-light);
  border: 1px solid var(--app-primary);
  color: var(--app-primary);
  border-radius: var(--app-radius);
  padding: 6px 10px;
  font-size: 12px;
  cursor: grab;
  user-select: none;
  max-width: 100%;
  opacity: 0.92;
}

.chart-palette-item:hover {
  border-color: var(--app-primary);
}

.chart-palette-item.is-used {
  background: transparent;
  border-color: var(--app-border-light);
  color: var(--app-text-secondary);
  cursor: default;
  opacity: 0.85;
}

.clp-type-icon {
  flex-shrink: 0;
}

.clp-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.chart-palette-item .clp-name {
  font-weight: 600;
  font-size: 12.5px;
  line-height: 1.35;
}

.clp-meta {
  font-size: 11px;
  color: var(--app-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.clp-time {
  font-size: 10.5px;
  color: var(--app-text-secondary);
  opacity: 0.8;
  line-height: 1.3;
}

.clp-empty {
  color: var(--app-text-secondary);
  font-size: 12px;
}
</style>