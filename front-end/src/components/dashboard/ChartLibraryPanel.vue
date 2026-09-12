<template>
  <aside class="chart-library-panel">
    <div class="clp-header">
      <div class="clp-title"><el-icon :size="15"><PieChart /></el-icon> 图表库</div>
      <el-select v-model="dsFilter" clearable placeholder="按数据源筛选" class="clp-select">
        <el-option v-for="d in datasetOptions" :key="d" :label="d" :value="d" />
      </el-select>
      <el-input v-model="keyword" clearable placeholder="搜索图表名称" :prefix-icon="Search" class="clp-search" />
    </div>

    <el-scrollbar class="clp-scroll">
      <div class="clp-lists">
        <div v-if="available.length" class="clp-list">
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
              <span v-if="c.updatedAt" class="clp-time">{{ formatDate(c.updatedAt) }}</span>
            </div>
          </div>
        </div>
        <div v-else class="clp-empty">
          <el-empty description="没有可用图表" :image-size="46" />
        </div>

        <div v-if="used.length" class="clp-list clp-list--used">
          <div v-for="c in used" :key="c.id" class="chart-palette-item is-used">
            <ChartTypeIcon :name="c.chartType || 'bar'" :size="30" class="clp-type-icon" />
            <div class="clp-body">
              <span class="clp-name">{{ c.name }}</span>
              <span class="clp-meta">{{ c.datasetName || '未绑定数据源' }}</span>
              <span v-if="c.updatedAt" class="clp-time">{{ formatDate(c.updatedAt) }}</span>
            </div>
            <el-tag size="small" type="info">已在看板</el-tag>
          </div>
        </div>
      </div>
    </el-scrollbar>
  </aside>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Search, PieChart } from '@element-plus/icons-vue'
import { flattenItems } from '@/utils/grid-layout'
import ChartTypeIcon from '@/components/charts/ChartTypeIcon.vue'

const props = defineProps({
  charts: { type: Array, required: true },
  items: { type: Array, required: true },
})

defineEmits(['add-chart'])

const dsFilter = ref('')
const keyword = ref('')

const datasetOptions = computed(() => [...new Set((props.charts || []).map((c) => c.datasetName || '未绑定数据源').filter(Boolean))])

function matchesFilter(c) {
  if (dsFilter.value && (c.datasetName || '未绑定数据源') !== dsFilter.value) return false
  if (keyword.value.trim()) {
    const kw = keyword.value.trim().toLowerCase()
    if (!c.name.toLowerCase().includes(kw) && !(c.datasetName || '').toLowerCase().includes(kw)) return false
  }
  return true
}

function formatDate(s) {
  return s ? String(s).replace('T', ' ').slice(0, 16) : '-'
}

function usedChartIds() {
  return new Set(flattenItems(props.items).filter((i) => i.type === 'chart').map((i) => i.chartId))
}

const used = computed(() => {
  const ids = usedChartIds()
  return props.charts.filter((c) => ids.has(c.id) && matchesFilter(c))
})

const available = computed(() => {
  const ids = usedChartIds()
  return props.charts.filter((c) => !ids.has(c.id) && matchesFilter(c))
})

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

.clp-scroll {
  flex: 1;
  min-height: 0;
}

.clp-lists {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 0 8px 4px 0;
}

.clp-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
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