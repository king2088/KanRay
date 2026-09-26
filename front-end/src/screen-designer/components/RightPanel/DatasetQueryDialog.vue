<template>
  <el-dialog
    :model-value="modelValue"
    :title="t('bigscreen.config.query.title')"
    width="920px"
    top="8vh"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-scrollbar max-height="60vh" class="dq-scroll">
      <div class="dq-cols">
        <!-- Left column: dataset + available fields -->
        <div class="dq-left">
          <el-form label-width="60px" size="default">
            <el-form-item :label="t('dataset.list.title')">
              <el-select-v2 v-model="plot.datasetId" class="dq-w100" filterable :options="datasetOptions" @change="onDatasetChange">
                <template #default="{ item }">
                  <DatasetOption :item="item" />
                </template>
              </el-select-v2>
            </el-form-item>
          </el-form>

          <template v-if="plot.datasetId">
            <!-- Available field palette -->
            <div class="dq-palette">
              <div class="dq-palette-title">{{ t('bigscreen.config.query.availableFields') }}</div>
              <div
                v-for="f in fields"
                :key="f.name"
                class="dq-chip"
                draggable="true"
                @dragstart="onFieldDragStart($event, f)"
                @click="quickAdd(f)"
              >
                <el-icon :size="14"><DataLine /></el-icon>
                <span class="dq-chip-name">{{ f.label || f.name }}</span>
                <el-tag size="small" effect="light" :style="typeTagStyle(f.type)" class="dq-chip-type">{{ fieldTypeLabel(f.type) }}</el-tag>
              </div>
            </div>
          </template>
        </div>

        <!-- Right column: dimensions / metrics / display options -->
        <div class="dq-right">
          <template v-if="plot.datasetId">
            <!-- Dimension zone -->
            <div class="dq-drop" @dragover.prevent @drop="onDrop($event, 'dimensions')">
              <div class="dq-drop-title">{{ t('bigscreen.config.query.dimensionZone') }}<el-icon class="dq-add" @click="addBlank('dimensions')"><Plus /></el-icon>
              </div>
              <div v-if="!dimensions.length" class="dq-hint">{{ t('bigscreen.config.query.dropAsDimension') }}</div>
              <div v-for="(d, di) in dimensions" :key="di" class="dq-row">
                <el-select v-model="d.field" :placeholder="t('dataset.detail.fieldPlaceholder')" style="flex: 1">
                  <el-option v-for="f in fields" :key="f.name" :label="f.label || f.name" :value="f.name" />
                </el-select>
                <el-select
                  v-if="isDateField(d.field)"
                  v-model="d.granularity"
                  style="width: 80px"
                  :placeholder="t('bigscreen.config.query.granularity')"
                >
                  <el-option :label="t('bigscreen.config.query.day')" value="day" />
                  <el-option :label="t('bigscreen.config.query.month')" value="month" />
                  <el-option :label="t('bigscreen.config.query.year')" value="year" />
                </el-select>
                <el-icon class="dq-remove" @click="removeItem(dimensions, di)"><Delete /></el-icon>
              </div>
            </div>

            <!-- Metric zone -->
            <div class="dq-drop" @dragover.prevent @drop="onDrop($event, 'metrics')">
              <div class="dq-drop-title">{{ t('bigscreen.config.query.metricZone') }}<el-icon class="dq-add" @click="addBlank('metrics')"><Plus /></el-icon>
              </div>
              <div v-if="!metrics.length" class="dq-hint">{{ t('bigscreen.config.query.dropAsMetric') }}</div>
              <div v-for="(m, mi) in metrics" :key="mi" class="dq-row">
                <el-select v-model="m.field" :placeholder="t('dataset.detail.fieldPlaceholder')" style="flex: 1">
                  <el-option v-for="f in numericFields" :key="f.name" :label="f.label || f.name" :value="f.name" />
                </el-select>
                <el-select v-model="m.agg" style="width: 100px">
                  <el-option v-for="a in AGG_OPTIONS" :key="a.value" :label="t(a.labelKey)" :value="a.value" />
                </el-select>
                <el-icon class="dq-remove" @click="removeItem(metrics, mi)"><Delete /></el-icon>
              </div>
            </div>

            <!-- Display options -->
            <el-form label-width="70px" size="default">
              <el-form-item :label="t('bigscreen.config.query.rowLimit')">
                <el-input-number v-model="groupLimit" :min="1" :max="500" style="width: 120px" />
              </el-form-item>
              <el-form-item :label="t('bigscreen.config.common.sort')">
                <el-select v-model="sortOption" style="width: 45%">
                  <el-option :label="t('bigscreen.config.common.sortNone')" value="" />
                  <el-option :label="t('bigscreen.config.query.sortByMetric')" value="metric" />
                  <el-option :label="t('bigscreen.config.query.sortByDimension')" value="dim" />
                </el-select>
                <el-select v-model="sortOrder" style="width: 45%; margin-left: 8px">
                  <el-option :label="t('bigscreen.config.common.asc')" value="asc" />
                  <el-option :label="t('bigscreen.config.common.desc')" value="desc" />
                </el-select>
              </el-form-item>
            </el-form>
          </template>
          <div v-else class="dq-hint dq-empty">{{ t('bigscreen.config.query.selectDatasetFirst') }}</div>
        </div>
      </div>
    </el-scrollbar>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">{{ t('bigscreen.config.action.cancel') }}</el-button>
      <el-button type="primary" @click="confirm">{{ t('bigscreen.config.action.ok') }}</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts">
const fieldCache = new Map<number, { name: string; label: string; type: string }[]>()
</script>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Delete, DataLine } from '@element-plus/icons-vue'
import { datasetApi } from '@/api'
import { AGG_OPTIONS } from '@/utils/chart-utils'
import { t } from '@/i18n'
import { toDatasetOptions } from '@/utils/dataset-type'
import { fieldTypeLabel } from '@/utils/field-type-label'
import DatasetOption from '@/components/DatasetOption.vue'

const props = defineProps<{
  modelValue: boolean
  datasetId: number | null
  query?: any
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'confirm', payload: { datasetId: number | null; query: any }): void
}>()

const NUMERIC_TYPES = ['integer', 'number']

const datasetList = ref<{ id: number; name: string }[]>([])
const datasetOptions = computed(() => toDatasetOptions(datasetList.value))
const fields = ref<{ name: string; label: string; type: string }[]>([])

const plot = ref({
  datasetId: props.datasetId as number | null,
})
const dimensions = ref<any[]>([])
const metrics = ref<any[]>([])
const groupLimit = ref(20)
const sortOption = ref('')   // ''=none, 'metric'=byMetric, 'dim'=byDimension
const sortOrder = ref('desc')

const numericFields = computed(() => fields.value.filter((f) => NUMERIC_TYPES.includes(f.type)))

// Field type labels come from utils/field-type-label; the param is no longer named t to avoid shadowing the translator
const typeTagStyle = (type: string) =>
  NUMERIC_TYPES.includes(type)
    ? { background: '#E9F7EF', borderColor: '#B8E9CD', color: '#1F8A4C' }
    : {}

function isDateField(fieldName: string) {
  const f = fields.value.find((x) => x.name === fieldName)
  return f && f.type === 'date'
}

function onFieldDragStart(e: DragEvent, field: any) {
  e.dataTransfer?.setData('text/plain', JSON.stringify({ name: field.name, type: field.type }))
}

function onDrop(e: DragEvent, target: 'dimensions' | 'metrics') {
  const raw = e.dataTransfer?.getData('text/plain')
  if (!raw) return
  const f = JSON.parse(raw)
  quickAdd(f, target)
}

function addField(f: any, target: 'dimensions' | 'metrics') {
  if (target === 'dimensions') {
    if (!dimensions.value.some((d) => d.field === f.name)) {
      dimensions.value.push({ field: f.name, granularity: f.type === 'date' ? 'day' : undefined })
    }
  } else {
    if (!NUMERIC_TYPES.includes(f.type)) return
    if (!metrics.value.some((m) => m.field === f.name)) {
      metrics.value.push({ field: f.name, agg: 'sum' })
    }
  }
}

function quickAdd(f: any, target?: 'dimensions' | 'metrics') {
  const t = target || (NUMERIC_TYPES.includes(f.type) ? 'metrics' : 'dimensions')
  addField(f, t)
}

function addBlank(target: 'dimensions' | 'metrics') {
  if (target === 'dimensions') dimensions.value.push({ field: '', granularity: undefined })
  else metrics.value.push({ field: '', agg: 'sum' })
}

function removeItem(arr: any[], i: number) {
  arr.splice(i, 1)
}

function sortOptionToQuery(): any {
  if (sortOption.value === 'metric') return 0
  if (sortOption.value === 'dim') return 'dim'
  return undefined
}

async function loadDatasets() {
  if (datasetList.value.length) return
  try {
    datasetList.value = (await datasetApi.list()) || []
  } catch {
    datasetList.value = []
  }
}

async function loadFields(id: number) {
  if (fieldCache.has(id)) {
    fields.value = fieldCache.get(id)!
    return
  }
  try {
    const ds = await datasetApi.get(id)
    fields.value = ds?.fields || []
    fieldCache.set(id, fields.value)
  } catch {
    fields.value = []
  }
}

async function onDatasetChange(id: number | null) {
  dimensions.value = []
  metrics.value = []
  if (!id) return
  await loadFields(id)
}

function initFromConfig() {
  const q = props.query || {}
  dimensions.value = (q.dimensions || []).map((d: any) => ({ field: d.field, granularity: d.granularity }))
  metrics.value = (q.metrics || []).map((m: any) => ({ field: m.field, agg: m.agg }))
  groupLimit.value = q.groupLimit ?? 20
  if (q.sortBy === 0) sortOption.value = 'metric'
  else if (q.sortBy === 'dim') sortOption.value = 'dim'
  else sortOption.value = ''
  sortOrder.value = q.sortOrder || 'desc'
}

async function open() {
  fields.value = []
  dimensions.value = []
  metrics.value = []
  plot.value.datasetId = props.datasetId ?? null
  await loadDatasets()
  if (plot.value.datasetId) await loadFields(plot.value.datasetId)
  initFromConfig()
}

function confirm() {
  if (!plot.value.datasetId) return ElMessage.warning(t('bigscreen.config.query.selectDataset'))
  const dims = dimensions.value.filter((d) => d.field)
  const ms = metrics.value.filter((m) => m.field)
  if (ms.length === 0) return ElMessage.warning(t('bigscreen.config.query.needMetric'))
  emit('confirm', {
    datasetId: plot.value.datasetId,
    query: {
      dimensions: dims,
      metrics: ms,
      groupLimit: groupLimit.value,
      sortBy: sortOptionToQuery(),
      sortOrder: sortOrder.value,
    },
  })
  emit('update:modelValue', false)
}

watch(() => props.modelValue, (v) => { if (v) open() })
</script>

<style scoped>
.dq-scroll { margin-right: -8px; }
.dq-w100 { width: 100%; }
.dq-cols {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}
.dq-left {
  width: 300px;
  flex-shrink: 0;
  border-right: 1px solid var(--app-border);
  padding-right: 14px;
}
.dq-palette {
  background: var(--app-hover);
  border-radius: var(--app-radius);
  padding: 10px;
  margin-bottom: 12px;
  max-height: calc(60vh - 56px);
  overflow-y: auto;
}
.dq-right {
  flex: 1;
  min-width: 0;
  padding-bottom: 4px;
  max-height: 60vh;
  overflow-y: auto;
}
.dq-palette-title {
  font-size: 12px;
  color: var(--app-text-secondary);
  margin-bottom: 8px;
}
.dq-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--scr-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  padding: 6px 10px;
  margin-bottom: 6px;
  cursor: grab;
  font-size: 14px;
  user-select: none;
  color: var(--app-text-primary);
}
.dq-chip:hover { border-color: var(--app-primary); color: var(--app-primary); }
.dq-chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
.dq-chip-type { flex-shrink: 0; }
.dq-drop {
  border: 1px dashed var(--app-border);
  border-radius: var(--app-radius);
  padding: 10px;
  margin-bottom: 12px;
  min-height: 70px;
}
.dq-drop-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text-primary);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.dq-add { color: var(--app-primary); cursor: pointer; }
.dq-hint { font-size: 12px; color: var(--app-text-secondary); text-align: center; padding: 8px 0; }
.dq-empty { padding: 24px 0; }
.dq-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.dq-remove { color: var(--app-danger); cursor: pointer; flex-shrink: 0; }
</style>
