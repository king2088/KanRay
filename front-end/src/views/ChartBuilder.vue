<template>
  <div class="chart-builder">
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

    <div class="builder-body">
      <!-- 左侧配置 -->
      <div class="builder-config">
        <!-- 第一步：选择数据 -->
        <el-collapse v-model="activePanels" class="config-collapse">
          <el-collapse-item title="数据源" name="dataset">
            <el-select v-model="datasetId" placeholder="选择一个数据集" style="width: 100%" @change="onDatasetChange">
              <el-option v-for="d in datasets" :key="d.id" :label="`${d.name} (${d.row_count} 行)`" :value="d.id" />
            </el-select>
            <div v-if="!datasets.length" style="margin-top: 8px; color: #909399; font-size: 12px">
              还没有数据集，<el-link type="primary" @click="$router.push('/datasets/new')">去上传数据</el-link>
            </div>
          </el-collapse-item>

          <el-collapse-item title="图表类型" name="chartType">
            <div class="chart-type-grid">
              <div
                v-for="t in CHART_TYPES"
                :key="t.value"
                class="chart-type-item"
                :class="{ active: chartType === t.value }"
                @click="chartType = t.value"
              >
                <el-icon :size="22"><component :is="t.icon" /></el-icon>
                <span>{{ t.label }}</span>
              </div>
            </div>
          </el-collapse-item>

          <!-- 字段配置 -->
          <el-collapse-item :title="`字段配置`" name="fields">
            <div class="field-palette">
              <div class="palette-title">可用字段（拖拽或点击添加）</div>
              <div
                v-for="f in fields"
                :key="f.name"
                class="field-chip"
                draggable="true"
                @dragstart="onFieldDragStart($event, f)"
              >
                <el-icon :size="14" style="margin-right: 6px"><DataLine /></el-icon>
                <span>{{ f.label || f.name }}</span>
                <el-tag size="small" type="info" style="margin-left: auto">{{ typeLabel(f.type) }}</el-tag>
              </div>
            </div>

            <!-- 维度 -->
            <div
              class="drop-zone"
              @dragover.prevent
              @drop="onDrop($event, 'dimensions')"
            >
              <div class="drop-zone-title">
                维度（分类 / X 轴）
                <el-icon class="add-icon" @click="addBlank('dimensions')"><Plus /></el-icon>
              </div>
              <div v-if="!dims.length" class="drop-hint">拖入字段作为维度</div>
              <div v-for="(d, di) in dims" :key="di" class="slot-row">
                <el-select v-model="d.field" placeholder="选择字段" size="small" style="flex: 1">
                  <el-option v-for="f in fields" :key="f.name" :label="f.label || f.name" :value="f.name" />
                </el-select>
                <el-select v-if="isDateField(d.field)" v-model="d.granularity" size="small" style="width: 90px" placeholder="粒度">
                  <el-option label="日" value="day" />
                  <el-option label="月" value="month" />
                  <el-option label="年" value="year" />
                </el-select>
                <el-icon class="remove-icon" @click="removeItem(dims, di)"><Delete /></el-icon>
              </div>
            </div>

            <!-- 指标 -->
            <div
              class="drop-zone"
              @dragover.prevent
              @drop="onDrop($event, 'metrics')"
            >
              <div class="drop-zone-title">
                指标（数值 / Y 轴）
                <el-icon class="add-icon" @click="addBlank('metrics')"><Plus /></el-icon>
              </div>
              <div v-if="!metrics.length" class="drop-hint">拖入字段作为指标</div>
              <div v-for="(m, mi) in metrics" :key="mi" class="slot-row">
                <el-select v-model="m.field" placeholder="选择字段" size="small" style="flex: 1.4">
                  <el-option v-for="f in fields" :key="f.name" :label="f.label || f.name" :value="f.name" />
                </el-select>
                <el-select v-model="m.agg" size="small" style="width: 110px">
                  <el-option v-for="a in AGG_OPTIONS" :key="a.value" :label="a.label" :value="a.value" />
                </el-select>
                <el-icon class="remove-icon" @click="removeItem(metrics, mi)"><Delete /></el-icon>
              </div>
            </div>

            <!-- 高级选项 -->
            <el-collapse>
              <el-collapse-item title="显示选项" name="display">
                <el-form label-width="90px" size="small">
                  <el-form-item label="图表标题">
                    <el-input v-model="showOptions.title" placeholder="留空则不显示" />
                  </el-form-item>
                  <el-form-item label="显示数量">
                    <el-input-number v-model="showOptions.groupLimit" :min="1" :max="500" />
                  </el-form-item>
                  <el-form-item label="排序">
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
              </el-collapse-item>
            </el-collapse>
          </el-collapse-item>
        </el-collapse>
      </div>

      <!-- 右侧预览 -->
      <div class="builder-preview">
        <div class="preview-toolbar">
          <span>实时预览</span>
          <el-button size="small" :loading="previewLoading" @click="loadPreview">刷新</el-button>
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
          <template v-else-if="chartType === 'stat'">
            <el-empty v-if="!statData" description="暂无指标" />
            <div v-else class="stat-card">
              <div class="stat-value">{{ fmtNumber(statData.value) }}</div>
              <div class="stat-label">{{ statData.label }}</div>
            </div>
          </template>
          <template v-else>
            <el-empty v-if="!previewData" description="配置维度与指标后展示预览" />
            <EChartRenderer
              v-else
              :chart-type="chartType"
              :data="previewData"
              :options="showOptions"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Check, Plus, Delete, DataLine } from '@element-plus/icons-vue'
import { datasetApi, chartApi } from '@/api'
import { CHART_TYPES, AGG_OPTIONS } from '@/utils/chart-utils'
import EChartRenderer from '@/components/charts/EChartRenderer.vue'

const route = useRoute()
const router = useRouter()

const datasets = ref([])
const fields = ref([])
const datasetId = ref(null)
const datasetName = ref('')
const chartName = ref('')
const chartType = ref('bar')
const activePanels = ref(['dataset', 'chartType', 'fields'])
const dims = ref([])
const metrics = ref([])
const showOptions = reactive({ title: '', groupLimit: 20 })
const sortConfig = reactive({ field: '', order: 'desc' })
const previewData = ref(null)
const previewRows = ref([])
const statData = ref(null)
const previewLoading = ref(false)
const saving = ref(false)
let editingId = null

const typeLabel = (t) => ({ string: '文本', integer: '整数', number: '小数', date: '日期', boolean: '布尔' }[t] || t)

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
  const agg = AGG_OPTIONS.find((x) => x.value === m.agg)?.label || m.agg
  return `${f ? f.label || f.name : m.field} (${agg})`
}

function fmtNumber(n) {
  if (n === null || n === undefined) return '-'
  if (typeof n !== 'number') return String(n)
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
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
  // 清空字段配置
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
    if (chartType.value === 'stat') {
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
        options: { ...showOptions },
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

// 编辑模式加载
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
    showOptions.title = cfg.options.title || ''
    showOptions.groupLimit = cfg.options.groupLimit || 20
  }
  if (cfg.sortBy === 0) sortConfig.field = 'metric'
  else if (cfg.sortBy === 'dim') sortConfig.field = 'dim'
  sortConfig.order = cfg.sortOrder || 'desc'
}

// 配置变化自动预览（防抖）
const debounce = (fn, ms) => {
  let t = null
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), 350)
  }
}
const debouncedPreview = debounce(loadPreview, 350)

watch([dims, metrics, chartType, showOptions, sortConfig], debouncedPreview, { deep: true })

onMounted(async () => {
  await loadDatasets()
  await loadEditing()
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
  flex-direction: column;
}

.builder-toolbar {
  height: 56px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
}

.tb-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.builder-body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.builder-config {
  width: 380px;
  overflow-y: auto;
  background: #fff;
  border-right: 1px solid #e4e7ed;
  padding: 8px 16px 16px;
  flex-shrink: 0;
}

.builder-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
  margin: 16px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
}

.preview-toolbar {
  height: 44px;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  font-weight: 600;
}

.preview-area {
  flex: 1;
  padding: 16px;
  position: relative;
  min-height: 0;
}

.preview-area > :deep(.ec-chart) {
  position: absolute;
  inset: 16px;
}

.chart-type-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.chart-type-item {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 10px 6px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #606266;
}

.chart-type-item:hover {
  border-color: #409eff;
  color: #409eff;
}

.chart-type-item.active {
  border-color: #409eff;
  background: #ecf5ff;
  color: #409eff;
}

.field-palette {
  background: #f5f7fa;
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 12px;
}

.palette-title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}

.field-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 5px 8px;
  margin-bottom: 6px;
  cursor: grab;
  font-size: 13px;
  user-select: none;
}

.field-chip:hover {
  border-color: #409eff;
}

.drop-zone {
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 12px;
  min-height: 70px;
}

.drop-zone-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.add-icon {
  color: #409eff;
  cursor: pointer;
}

.drop-hint {
  font-size: 12px;
  color: #c0c4cc;
  text-align: center;
  padding: 8px 0;
}

.slot-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.remove-icon {
  color: #f56c6c;
  cursor: pointer;
  flex-shrink: 0;
}

.stat-card {
  text-align: center;
  padding: 60px 0;
}

.stat-value {
  font-size: 48px;
  font-weight: 700;
  color: #409eff;
}

.stat-label {
  margin-top: 8px;
  color: #606266;
}
</style>