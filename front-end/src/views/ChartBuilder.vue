<template>
  <div class="chart-builder">
    <!-- 左侧：数据源 + 字段-->
    <div class="builder-left">
      <el-scrollbar class="builder-left-scroll">
        <div class="builder-left-view">
          <DataSourcePanel
            :datasets="datasets"
            :datasetId="datasetId"
            @update:datasetId="datasetId = $event"
            @datasetChange="onDatasetChange"
          />
          <el-divider style="margin: 8px 0" />
          <FieldConfigPanel
            :fields="fields"
            :dims="dims"
            :metrics="metrics"
            :chart-type="chartType"
          />
          <!-- 显示选项（排序等） -->
          <div class="left-extra">
            <div class="panel-title">显示选项</div>
            <el-form label-width="70px">
              <el-form-item label="显示数量">
                <el-input-number v-model="showOptions.groupLimit" :min="1" :max="500" style="width: 120px" />
              </el-form-item>
              <el-form-item label="排序方式">
                <el-select v-model="sortConfig.field" style="width: 45%">
                  <el-option label="不排序" value="" />
                  <el-option label="按指标" value="metric" />
                  <el-option label="按维度" value="dim" />
                </el-select>
                <el-select v-model="sortConfig.order" style="width: 45%; margin-left: 8px">
                  <el-option label="升序" value="asc" />
                  <el-option label="降序" value="desc" />
                </el-select>
              </el-form-item>
            </el-form>
          </div>
        </div>
      </el-scrollbar>
      </div>

    <!-- 右侧主区：工具栏 + 预览 + 配置 -->
    <div class="builder-main">
      <div class="builder-workspace">
        <div class="builder-preview-col">
      <!-- 工具栏 -->
      <div class="builder-toolbar">
        <div class="tb-left">
          <el-button circle @click="back"><el-icon><ArrowLeft /></el-icon></el-button>
          <el-input v-model="chartName" placeholder="图表名称" style="width: 220px" maxlength="100" />
          <el-tag v-if="datasetId" type="info">{{ datasetName }}</el-tag>
        </div>
        <div class="tb-right">
          <el-button :loading="saving" type="primary" @click="save">
            <el-icon style="margin-right: 4px"><Check /></el-icon>保存图表
          </el-button>
        </div>
      </div>

        <!-- 中间：图表预览 -->
        <div class="builder-preview">
        <div class="preview-toolbar">
          <span>
            <el-icon style="margin-right: 6px; vertical-align: middle"><TrendCharts />
            </el-icon>{{ currentChartLabel }} - 实时预览
          </span>
          <el-button :loading="previewLoading" @click="loadPreview">刷新</el-button>
        </div>
        <div class="preview-area">
          <template v-if="chartType === 'table'">
            <el-empty v-if="!previewData" description="暂无数据" />
            <el-table v-else :data="previewRows" size="small" border max-height="100%">
              <el-table-column v-for="d in dims" :key="d.field" :label="dimLabel(d)">
                <template #default="{ row }">{{ row[`dim:${d.field}`]?.value }}</template>
              </el-table-column>
              <el-table-column v-for="m in metrics" :key="m.field + m.agg" :label="metricLabel(m)">
                <template #default="{ row }">{{ row[`metric:${m.field}`]?.value }}</template>
              </el-table-column>
            </el-table>
          </template>
          <template v-else-if="isProgressType">
            <!-- 进度组件 -->
            <div class="progress-container">
              <template v-if="chartType === 'progressBar'">
                <div class="prog-stat-value">{{ fmtNumber(progressValue) }}%</div>
                <el-progress
                  :percentage="progressValue"
                  :stroke-width="displayConfig.progressBarMax ? 16 : 20"
                  :show-text="false"
                  :color="displayConfig.progressColor || undefined"
                  style="width: 70%"
                />
              </template>
              <template v-else-if="chartType === 'circularProgress'">
                <el-progress
                  type="dashboard"
                  :percentage="progressValue"
                  :stroke-width="displayConfig.lineWidth || 10"
                  :color="displayConfig.progressColor || undefined"
                  width="180"
                />
              </template>
              <template v-else-if="chartType === 'multiRingProgress'">
                <div class="multi-ring">
                  <el-progress
                    v-for="(m, mi) in metrics"
                    :key="mi"
                    type="circle"
                    :percentage="calcMultiRing(m)?.pct || 0"
                    :stroke-width="displayConfig.lineWidth || 8"
                    :color="displayConfig.progressColor || undefined"
                    width="100"
                  >
                    <template #default>
                      <div style="text-align: center">
                        <div style="font-size: 12px">{{ metricLabel(m) }}</div>
                        <div style="font-size: 14px; font-weight: 600">{{ fmtNumber(calcMultiRing(m)?.val) }}</div>
                      </div>
                    </template>
                  </el-progress>
                </div>
              </template>
              <template v-else-if="chartType === 'fluidProgress'">
                <div class="fluid-progress">
                  <div class="fluid-value">{{ progressValue }}%</div>
                  <div class="fluid-wave" :style="{ background: `linear-gradient(180deg, ${displayConfig.progressColor || '#409EFF'} 0%, ${displayConfig.progressColor || '#409EFF'} 100%)`, transform: `translateY(${100 - progressValue}%)` }"></div>
                </div>
              </template>
            </div>
          </template>
          <template v-else-if="chartType === 'stat'">
            <el-empty v-if="!statData" description="暂无指标" />
            <div v-else class="stat-card">
              <div class="stat-label" style="font-size:14px;color:var(--app-text-secondary)">{{ statData.label }}</div>
              <div class="stat-value">{{ fmtNumber(statData.value) }}</div>
            </div>
          </template>
          <template v-else-if="chartType === 'statTrend'">
            <div v-if="!statData" class="stat-card"><el-empty description="暂无指标" /></div>
            <div v-else class="stat-card stat-trend-card">
              <div class="stat-label" style="font-size:14px;color:var(--app-text-secondary)">{{ statData.label }}</div>
              <div class="stat-value">{{ fmtNumber(statData.value) }}</div>
            </div>
          </template>
          <template v-else>
            <el-empty v-if="!previewData" description="配置维度与指标后展示预览" />
            <EChartRenderer
              v-else
              :chart-type="chartType"
              :data="previewData"
              :options="finalOptions"
            />
          </template>
        </div>
      </div>
      </div>

      <!-- 右侧：图表类型 + 配置 -->
      <div class="builder-right">
        <div class="right-section right-types">
          <div class="right-section-title"><span class="rsec-icon" v-html="sectionIcon()"></span>图表类型</div>
          <ChartTypePanel :chart-type="chartType" @update:chartType="chartType = $event" />
        </div>
        <el-divider style="margin: 8px 0" />
        <div class="right-section right-config">
          <el-scrollbar class="right-config-scroll">
            <div class="right-config-view">
              <ChartConfigPanel :chart-type="chartType" :config="displayConfig" :series-names="chartSeriesNames" @update:config="displayConfig = $event" />
            </div>
          </el-scrollbar>
        </div>
      </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Check, Delete, DataLine, TrendCharts, Plus } from '@element-plus/icons-vue'
import { datasetApi, chartApi } from '@/api'
import { CHART_TYPES, getChartType } from '@/config/chart-types'
import { getPalette, DEFAULT_PALETTE_INDEX } from '@/config/color-palettes'
import { getDefaultConfig } from '@/config/chart-configs'
import EChartRenderer from '@/components/charts/EChartRenderer.vue'
import DataSourcePanel from '@/components/charts/DataSourcePanel.vue'
import FieldConfigPanel from '@/components/charts/FieldConfigPanel.vue'
import ChartTypePanel from '@/components/charts/ChartTypePanel.vue'
import ChartConfigPanel from '@/components/charts/ChartConfigPanel.vue'

// Use AGG_OPTIONS from chart-utils for aggregation options (chart-configs doesn't export it)
const AGGS = [
  { value: 'sum', label: '求和' },
  { value: 'avg', label: '平均值' },
  { value: 'count', label: '计数' },
  { value: 'count_distinct', label: '去重计数' },
  { value: 'max', label: '最大值' },
  { value: 'min', label: '最小值' },
]

const route = useRoute()
const router = useRouter()

const datasets = ref([])
const fields = ref([])
const datasetId = ref(null)
const datasetName = ref('')
const chartName = ref('')
const chartType = ref('bar')
const dims = ref([])
const metrics = ref([])
const showOptions = reactive({ groupLimit: 20 })
const sortConfig = reactive({ field: '', order: 'desc' })
const displayConfig = ref({})
const previewData = ref(null)
const previewRows = ref([])
const statData = ref(null)
const progressValue = computed(() => {
  if (!isProgressType.value) return 0
  const val = previewData.value?.rows?.[0]?.[`metric:${metrics.value[0]?.field}`]?.value || 0
  const max = progressMax()
  return max > 0 ? Math.min(100, Math.round((val / max) * 100)) : 0
})
const previewLoading = ref(false)
const saving = ref(false)
let editingId = null

const currentChartLabel = computed(() => getChartType(chartType.value)?.label || chartType.value)

const finalOptions = computed(() => ({
  ...displayConfig.value,
  _palette: getPalette(displayConfig.value.colorPalette, displayConfig.value.customPalette),
}))

// 用 schema 默认值兜底，确保缺失字段也有默认值，避免配置面板显示空白
function mergeWithDefaults(saved = {}, type = chartType.value) {
  const defaults = getDefaultConfig(type)
  const merged = { ...defaults, ...saved }
  const savedType = saved.typeSpecific
  if (savedType && typeof savedType === 'object') {
    merged.typeSpecific = { ...(defaults.typeSpecific || {}), ...savedType }
  } else {
    merged.typeSpecific = defaults.typeSpecific
  }
  return merged
}

const isProgressType = computed(() => ['progressBar', 'circularProgress', 'multiRingProgress', 'fluidProgress'].includes(chartType.value))

const typeLabel = (t) => ({ string: '文本', integer: '整数', number: '小数', date: '日期', boolean: '布尔' }[t] || t)

const sectionIcon = () => '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><rect x="3" y="11" width="3.4" height="8" rx="1.2"/><rect x="9.2" y="5.5" width="3.4" height="13.5" rx="1.2"/><rect x="15.4" y="8.5" width="3.4" height="10.5" rx="1.2"/><rect x="1.6" y="20.4" width="20.8" height="1.6" rx="0.8"/></svg>'

function isDateField(fieldName) {
  const f = fields.value.find((x) => x.name === fieldName)
  return f && f.type === 'date'
}

function dimLabel(d) {
  const f = fields.value.find((x) => x.name === d.field)
  return f ? f.label || f.name : d.field
}

function metricLabel(m) {
  const f = fields.value.find((x) => x.name === m.field)
  const agg = AGGS.find((x) => x.value === m.agg)?.label || m.agg
  return `${f ? f.label || f.name : m.field} (${agg})`
}

function fmtNumber(n) {
  if (n === null || n === undefined) return '-'
  if (typeof n !== 'number') return String(n)
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

function progressMax() {
  return displayConfig.value.typeSpecific?.max ?? displayConfig.value.max ?? 100
}

const chartSeriesNames = computed(() => {
  const d = previewData.value
  if (!d || !d.rows?.length || !d.dimensions?.length) return []
  const gDim = d.dimensions[1]
  if (gDim) {
    return [...new Set(d.rows.map((r) => String(r[`dim:${gDim.field}`]?.value ?? r[gDim.field] ?? '无')))]
  }
  const m = metrics.value?.[0]
  if (!m) return []
  if (m.field === '*' && m.agg === 'count') return ['数据行数']
  const f = fields.value.find((x) => x.name === m.field)
  return [`${f ? f.label || f.name : m.field}(${m.agg})`]
})

function calcMultiRing(m) {
  const val = previewData.value?.rows?.[0]?.[`metric:${m.field}`]?.value
  const max = progressMax()
  return { val, pct: max > 0 ? Math.min(100, Math.round((val || 0) / max * 100)) : 0 }
}

async function loadDatasets() {
  datasets.value = await datasetApi.list()
  const fromQuery = route.query.dataset
  if (fromQuery && datasets.value.some((d) => d.id === Number(fromQuery))) {
    datasetId.value = Number(fromQuery)
    onDatasetChange(datasetId.value)
  }
}

async function onDatasetChange(id) {
  datasetId.value = id
  if (!id) return
  const ds = await datasetApi.get(id)
  datasetName.value = ds.name
  fields.value = (ds.fields || []).map((f) => ({ name: f.name, label: f.label, type: f.type }))
  dims.value = []
  metrics.value = []
}

function onFieldDragStart(e, field) {
  e.dataTransfer.setData('text/plain', JSON.stringify({ name: field.name, label: field.label, type: field.type }))
}

function onDrop(e, target) {
  const raw = e.dataTransfer.getData('text/plain')
  if (!raw) return
  const f = JSON.parse(raw)
  if (target === 'dimensions') {
    if (!dims.value.some((d) => d.field === f.name)) dims.value.push({ field: f.name, granularity: f.type === 'date' ? 'day' : undefined })
  } else {
    if (!metrics.value.some((m) => m.field === f.name)) metrics.value.push({ field: f.name, agg: f.type === 'date' ? 'count' : 'sum' })
  }
}

function addBlank(target) {
  if (target === 'dimensions') dims.value.push({ field: '', granularity: undefined })
  else metrics.value.push({ field: '', agg: 'sum' })
}

function removeItem(arr, i) {
  arr.splice(i, 1)
}

function buildQuery() {
  return {
    dimensions: dims.value
      .filter((d) => d.field)
      .map((d) => ({ field: d.field, granularity: d.granularity || undefined })),
    metrics: metrics.value
      .filter((m) => m.field)
      .map((m) => ({ field: m.field, agg: m.agg })),
    groupLimit: showOptions.groupLimit || undefined,
    sortBy: sortConfig.field === 'metric' ? 0 : sortConfig.field === 'dim' ? 'dim' : undefined,
    sortOrder: sortConfig.order,
  }
}

async function loadPreview() {
  if (!datasetId.value) return
  if (metrics.value.filter((m) => m.field).length === 0) {
    previewData.value = null
    return
  }
  previewLoading.value = true
  try {
    const res = await datasetApi.query(datasetId.value, buildQuery())
    previewData.value = res
    previewRows.value = res.rows
    if (chartType.value === 'stat' || chartType.value === 'statTrend') {
      statData.value = { value: res.rows[0]?.[`metric:${metrics.value[0].field}`]?.value, label: metricLabel(metrics.value[0]) }
    }
  } finally {
    previewLoading.value = false
  }
}

async function save() {
  if (!chartName.value.trim()) return ElMessage.warning('请填写图表名称')
  if (!datasetId.value) return ElMessage.warning('请选择数据集')
  if (metrics.value.length === 0) return ElMessage.warning('请至少添加一个指标')
  saving.value = true
  try {
    const payload = {
      name: chartName.value.trim(),
      chartType: chartType.value,
      datasetId: datasetId.value,
      config: {
        dimensions: dims.value.filter((d) => d.field).map((d) => ({ field: d.field, granularity: d.granularity || undefined })),
        metrics: metrics.value.filter((m) => m.field).map((m) => ({ field: m.field, agg: m.agg })),
        groupLimit: showOptions.groupLimit || undefined,
        sortBy: sortConfig.field === 'metric' ? 0 : sortConfig.field === 'dim' ? 'dim' : undefined,
        sortOrder: sortConfig.order,
        options: { ...displayConfig.value },
      },
    }
    if (editingId) {
      await chartApi.update(editingId, payload)
      ElMessage.success('图表已更新')
    } else {
      const created = await chartApi.create(payload)
      ElMessage.success('图表已保存')
      editingId = created.id
    }
  } finally {
    saving.value = false
  }
}

function back() {
  if (editingId) router.push('/charts')
  else router.push(route.query.dataset ? '/datasets' : '/charts')
}

async function loadEditing() {
  const id = Number(route.params.id)
  if (!id) return
  const chart = await chartApi.get(id)
  editingId = id
  chartName.value = chart.name
  chartType.value = chart.chartType
  datasetId.value = chart.datasetId
  const ds = await datasetApi.get(chart.datasetId)
  datasetName.value = ds.name
  fields.value = (ds.fields || []).map((f) => ({ name: f.name, label: f.label, type: f.type }))
  const cfg = chart.config || {}
  dims.value = (cfg.dimensions || []).map((d) => ({ field: d.field, granularity: d.granularity }))
  metrics.value = (cfg.metrics || []).map((m) => ({ field: m.field, agg: m.agg }))
  if (cfg.options) {
    displayConfig.value = mergeWithDefaults({ ...cfg.options }, chartType.value)
  }
  if (cfg.sortBy === 0) sortConfig.field = 'metric'
  else if (cfg.sortBy === 'dim') sortConfig.field = 'dim'
  sortConfig.order = cfg.sortOrder || 'desc'
}

const debounce = (fn, ms) => {
  let t = null
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), 500)
  }
}
// 数据变更防抖（维度/指标/图表类型/显示数量/排序）
const debouncedPreview = debounce(loadPreview, 500)
// 配置变更防抖（仅触发图表重渲染，不重载数据）
const debouncedConfigChange = debounce(() => {
  // 触发 finalOptions 更新，EChartRenderer 会自动重渲染
}, 200)

// 仅数据相关变更触发 loadPreview
watch([dims, metrics, chartType, showOptions, sortConfig], debouncedPreview, { deep: true })
// 切换图表类型时重置类型专属配置（保持公共配置不变）
watch(chartType, (newType, oldType) => {
  if (!oldType || newType === oldType) return
  const defaults = getDefaultConfig(newType)
  const saved = displayConfig.value
  displayConfig.value = {
    ...saved,
    ...(defaults.typeSpecific ? { typeSpecific: defaults.typeSpecific } : {}),
    colorPalette: saved.colorPalette ?? defaults.colorPalette,
  }
})
// 配置变更仅更新 finalOptions（通过 computed 自动响应），不需要额外 watch

onMounted(async () => {
  await loadDatasets()
  await loadEditing()
  if (!editingId) displayConfig.value = getDefaultConfig(chartType.value)
  if (datasetId.value && metrics.value.length) {
    const ds = await datasetApi.get(datasetId.value)
    datasetName.value = ds.name
    loadPreview()
  }
})
</script>

<style scoped>
.chart-builder {
  height: 100%;
  display: flex;
}

.builder-toolbar {
  height: var(--app-header-height);
  background: var(--app-card);
  border-bottom: 1px solid var(--app-border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
}

.tb-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tb-left :deep(.el-input__wrapper) {
  box-shadow: none;
  border-bottom: 1px solid transparent;
  border-radius: 0;
}

.tb-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.builder-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.builder-workspace {
  flex: 1;
  display: flex;
  min-height: 0;
}

.builder-preview-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.builder-left {
  width: 300px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: var(--app-card);
  border-right: 1px solid var(--app-border-light);
  flex-shrink: 0;
}

.builder-left-scroll {
  flex: 1;
  min-height: 0;
}

.builder-left-view {
  padding: 4px 16px 16px;
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-primary);
  margin-bottom: 8px;
  margin-top: 8px;
}

.left-extra {
  margin-top: 8px;
}

.builder-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--app-card);
  margin: 16px;
  border: 1px solid var(--app-border-light);
  border-radius: var(--app-radius);
  overflow: hidden;
  min-width: 200px;
}

.preview-toolbar {
  height: 44px;
  border-bottom: 1px solid var(--app-border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  font-weight: 600;
  font-size: 14px;
}

.preview-area {
  flex: 1;
  padding: 16px;
  position: relative;
  min-height: 0;
  overflow: auto;
}

.preview-area > :deep(.ec-chart) {
  position: absolute;
  inset: 16px;
  width: auto;
  height: auto;
}

.stat-card {
  text-align: center;
  padding: 60px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.stat-trend-card {
  padding: 30px 0;
}

.stat-value {
  font-size: 44px;
  font-weight: 600;
  color: var(--app-primary);
}

.stat-label {
  font-size: 13px;
  color: var(--app-text-regular);
}

.progress-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  height: 100%;
  padding: 20px 0;
}

.prog-stat-value {
  font-size: 36px;
  font-weight: 600;
  color: var(--app-primary);
}

.multi-ring {
  display: flex;
  gap: 30px;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
}

.fluid-progress {
  position: relative;
  width: 180px;
  height: 180px;
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
  font-size: 28px;
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
  transition: transform 0.5s ease;
}

.builder-right {
  width: 350px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: var(--app-card);
  border-left: 1px solid var(--app-border-light);
  padding: 4px 16px 0;
  flex-shrink: 0;
}

.right-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-primary);
  margin-bottom: 8px;
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.rsec-icon {
  display: inline-flex;
  color: var(--app-text-secondary);
  opacity: 0.55;
}

.rsec-icon :deep(svg) {
  width: 15px;
  height: 15px;
  fill: currentColor;
}

.right-section {
  margin-bottom: 4px;
}

.right-types {
  flex: 0 1 40%;
  min-height: 260px;
  display: flex;
  flex-direction: column;
}

.right-config {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.right-config-scroll {
  flex: 1;
  min-height: 0;
}

.right-config-scroll :deep(.el-scrollbar__bar) {
  z-index: 6;
}

.right-config-view {
  padding: 0 10px 16px;
}


</style>
