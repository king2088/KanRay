<template>
  <div class="chart-tile">
    <!-- 表格类型 -->
    <template v-if="chartType === 'table'">
      <el-table v-if="rows.length" :data="rows" size="small" border max-height="100%">
        <el-table-column
          v-for="col in tableCols"
          :key="col.key"
          :label="col.label"
          min-width="100"
          show-overflow-tooltip
        >
          <template #header>{{ col.label }}</template>
          <template #default="{ row }">{{ row[col.key] }}</template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无数据" :image-size="60" />
    </template>

    <!-- 数值卡 -->
    <template v-else-if="chartType === 'stat'">
      <div v-if="statValue !== null" class="stat-tile">
        <div class="stat-value">{{ fmtNumber(statValue) }}</div>
        <div class="stat-label">{{ statLabel }}</div>
      </div>
      <el-empty v-else description="暂无数据" :image-size="60" />
    </template>

    <!-- 图表 -->
    <EChartRenderer v-else-if="data" :chart-type="chartType" :data="data" :options="chartOptions" />
    <div v-else class="tile-loading" v-loading="!loaded">
      <el-empty v-if="loaded" description="暂无数据" :image-size="60" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { chartApi, datasetApi } from '@/api'
import EChartRenderer from '@/components/charts/EChartRenderer.vue'

const props = defineProps({
  chart: { type: Object, required: true },
  externalFilters: { type: Array, default: () => [] },
  heightScale: { type: Number, default: 2 },
})

const data = ref(null)
const loaded = ref(false)
const rows = ref([])
const tableCols = ref([])
const statValue = ref(null)
const statLabel = ref('')
const rawChart = ref(null)
const datasetFields = ref([])

const chartType = computed(() => rawChart.value?.chartType || props.chart.chartType)
const chartOptions = computed(() => rawChart.value?.config?.options || props.chart.config?.options || {})

const chartId = computed(() => props.chart.id)

function fmtNumber(n) {
  if (n === null || n === undefined) return '-'
  if (typeof n !== 'number') return String(n)
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

/** 合并可用的外部筛选：仅保留与图表数据集同源的字段 */
function usableFilters() {
  const fields = new Set(datasetFields.value.map((f) => f.name))
  return props.externalFilters.filter((f) => f.value !== null && f.value !== undefined && f.value !== '' && fields.has(f.field))
}

async function load() {
  try {
    rawChart.value = await chartApi.get(chartId.value)
    // 加载数据集字段，用于筛选白名单
    const ds = await datasetApi.get(rawChart.value.datasetId)
    datasetFields.value = ds.fields || []
    loaded.value = true
    await run()
  } catch (e) {
    loaded.value = true
  }
}

async function run() {
  const res = await chartApi.data(chartId.value, usableFilters())
  data.value = res.data
  rows.value = res.data.rows || []
  const cfg = rawChart.value.config || {}
  const metrics = cfg.metrics || []
  // 表格列
  tableCols.value = []
  cfg.dimensions.forEach((d) => tableCols.value.push({ key: `dim:${d.field}`, label: d.field }))
  metrics.forEach((m) => tableCols.value.push({ key: `metric:${m.field}`, label: m.field }))
  // 数值卡
  if (metrics.length) {
    const first = res.data.rows[0]
    statValue.value = first ? first[`metric:${metrics[0].field}`]?.value ?? null : null
    statLabel.value = metrics[0].field
  }
}

watch(() => props.externalFilters, run, { deep: true })

onMounted(load)
</script>

<style scoped>
.chart-tile {
  height: 100%;
  width: 100%;
  position: relative;
  padding: 8px;
  overflow: hidden;
}

.chart-tile > :deep(.ec-chart) {
  height: 100%;
}

.tile-loading {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-tile {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.stat-value {
  font-size: 42px;
  font-weight: 700;
  color: #409eff;
  line-height: 1.2;
}

.stat-label {
  margin-top: 6px;
  color: #606266;
  font-size: 13px;
}
</style>