<template>
  <div class="chart-tile">
    <!-- 表格类型 -->
    <template v-if="chartType === 'table'">
      <el-table v-if="rows.length" :data="rows" border>
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

    <!-- 进度类型 -->
    <template v-else-if="isProgressType">
      <div class="progress-tile">
        <template v-if="chartType === 'progressBar'">
          <div class="prog-stat-value">{{ fmtNumber(progressValue) }}%</div>
          <el-progress
            :percentage="progressValue"
            :stroke-width="displayConfig?.progressBarMax ? 16 : 20"
            :show-text="false"
            style="width: 70%"
          />
        </template>
        <template v-else-if="chartType === 'circularProgress'">
          <el-progress
            type="dashboard"
            :percentage="progressValue"
            :stroke-width="displayConfig?.lineWidth || 10"
            width="140"
          />
        </template>
        <template v-else-if="chartType === 'multiRingProgress'">
          <div class="multi-ring">
            <el-progress
              v-for="(m, mi) in metrics"
              :key="mi"
              type="circle"
              :percentage="calcMultiRing(m)?.pct || 0"
              :stroke-width="displayConfig?.lineWidth || 8"
              width="80"
            >
              <template #default>
                <div style="text-align: center">
                  <div style="font-size: 10px">{{ metricLabel(m) }}</div>
                  <div style="font-size: 12px; font-weight: 600">{{ fmtNumber(calcMultiRing(m)?.val) }}</div>
                </div>
              </template>
            </el-progress>
          </div>
        </template>
        <template v-else-if="chartType === 'fluidProgress'">
          <div class="fluid-progress">
            <div class="fluid-value">{{ progressValue }}%</div>
            <div class="fluid-wave"></div>
          </div>
        </template>
      </div>
    </template>

    <!-- 指标趋势图 -->
    <template v-else-if="chartType === 'statTrend'">
      <div v-if="statValue !== null" class="stat-tile stat-trend-tile">
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
import { getChartType } from '@/config/chart-types'
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

const cfg = computed(() => rawChart.value?.config || {})
const metrics = computed(() => cfg.value.metrics || [])
const dims = computed(() => cfg.value.dimensions || [])

const isProgressType = computed(() => ['progressBar', 'circularProgress', 'multiRingProgress', 'fluidProgress'].includes(chartType.value))
const displayConfig = computed(() => chartOptions.value)
const progressValue = computed(() => {
  const val = data.value?.rows?.[0]?.[`metric:${metrics.value[0]?.field}`]?.value || 0
  const max = displayConfig.value?.max || 100
  return max > 0 ? Math.min(100, Math.round((val / max) * 100)) : 0
})

function fmtNumber(n) {
  if (n === null || n === undefined) return '-'
  if (typeof n !== 'number') return String(n)
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

function metricLabel(m) {
  const f = m?.field
  const agg = m?.agg
  return `${f} (${agg || 'sum'})`
}

function calcMultiRing(m) {
  const val = data.value?.rows?.[0]?.[`metric:${m.field}`]?.value || 0
  const max = displayConfig.value?.max || 100
  return { val, pct: max > 0 ? Math.min(100, Math.round((val / max) * 100)) : 0 }
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
  // 表格列
  tableCols.value = []
  dims.value.forEach((d) => tableCols.value.push({ key: `dim:${d.field}`, label: d.field }))
  metrics.value.forEach((m) => tableCols.value.push({ key: `metric:${m.field}`, label: m.field }))
  // 数值卡 / 进度
  if (metrics.value.length) {
    const first = res.data.rows[0]
    statValue.value = first ? first[`metric:${metrics.value[0].field}`]?.value ?? null : null
    statLabel.value = metricLabel(metrics.value[0])
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

.stat-trend-tile {
  padding: 16px 0;
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
  font-size: 14px;
}

/* 进度类型样式 */
.progress-tile {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px 0;
}

.prog-stat-value {
  font-size: 28px;
  font-weight: 600;
  color: var(--app-primary);
}

.multi-ring {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
}

.fluid-progress {
  position: relative;
  width: 140px;
  height: 140px;
  border-radius: 50%;
  border: 3px solid var(--app-border-light);
  overflow: hidden;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.fluid-value {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 22px;
  font-weight: 600;
  z-index: 2;
  color: var(--app-text-primary);
}

.fluid-wave {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100%;
  opacity: 0.85;
  background: linear-gradient(180deg, var(--app-primary) 0%, var(--app-primary) 100%);
  transition: transform 0.5s ease;
}
</style>