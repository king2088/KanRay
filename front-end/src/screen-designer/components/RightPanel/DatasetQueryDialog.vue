<template>
  <el-dialog
    :model-value="modelValue"
    title="配置维度/指标"
    width="640px"
    top="8vh"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-scrollbar max-height="60vh" class="dq-scroll">
      <!-- ① 数据集选择 -->
      <el-form label-width="70px" size="small" style="margin-bottom: 4px">
        <el-form-item label="数据集">
          <el-select v-model="plot.datasetId" class="dq-w100" @change="onDatasetChange">
            <el-option v-for="d in datasetList" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
      </el-form>

      <template v-if="plot.datasetId">
        <!-- ② 可用字段托盘 -->
        <div class="dq-palette">
          <div class="dq-palette-title">可用字段（拖拽或点击添加）</div>
          <div
            v-for="f in fields"
            :key="f.name"
            class="dq-chip"
            draggable="true"
            @dragstart="onFieldDragStart($event, f)"
            @click="quickAdd(f)"
          >
            <el-icon :size="14"><DataLine /></el-icon>
            <span>{{ f.label || f.name }}</span>
            <el-tag size="small" effect="light" :style="typeTagStyle(f.type)" style="margin-left: auto">{{ typeLabel(f.type) }}</el-tag>
          </div>
        </div>

        <!-- ③ 维度区 -->
        <div class="dq-drop" @dragover.prevent @drop="onDrop($event, 'dimensions')">
          <div class="dq-drop-title">
            维度（分类 / X 轴）
            <el-icon class="dq-add" @click="addBlank('dimensions')"><Plus /></el-icon>
          </div>
          <div v-if="!dimensions.length" class="dq-hint">拖入字段作为维度</div>
          <div v-for="(d, di) in dimensions" :key="di" class="dq-row">
            <el-select v-model="d.field" placeholder="选择字段" style="flex: 1">
              <el-option v-for="f in fields" :key="f.name" :label="f.label || f.name" :value="f.name" />
            </el-select>
            <el-select
              v-if="isDateField(d.field)"
              v-model="d.granularity"
              style="width: 80px"
              placeholder="粒度"
            >
              <el-option label="日" value="day" />
              <el-option label="月" value="month" />
              <el-option label="年" value="year" />
            </el-select>
            <el-icon class="dq-remove" @click="removeItem(dimensions, di)"><Delete /></el-icon>
          </div>
        </div>

        <!-- ④ 指标区 -->
        <div class="dq-drop" @dragover.prevent @drop="onDrop($event, 'metrics')">
          <div class="dq-drop-title">
            指标（数值 / Y 轴）
            <el-icon class="dq-add" @click="addBlank('metrics')"><Plus /></el-icon>
          </div>
          <div v-if="!metrics.length" class="dq-hint">拖入字段作为指标</div>
          <div v-for="(m, mi) in metrics" :key="mi" class="dq-row">
            <el-select v-model="m.field" placeholder="选择字段" style="flex: 1">
              <el-option v-for="f in numericFields" :key="f.name" :label="f.label || f.name" :value="f.name" />
            </el-select>
            <el-select v-model="m.agg" style="width: 100px">
              <el-option v-for="a in AGG_OPTIONS" :key="a.value" :label="a.label" :value="a.value" />
            </el-select>
            <el-icon class="dq-remove" @click="removeItem(metrics, mi)"><Delete /></el-icon>
          </div>
        </div>

        <!-- ⑤ 显示选项 -->
        <el-form label-width="70px" size="small">
          <el-form-item label="显示条数">
            <el-input-number v-model="groupLimit" :min="1" :max="500" style="width: 120px" />
          </el-form-item>
          <el-form-item label="排序">
            <el-select v-model="sortOption" style="width: 45%">
              <el-option label="不排序" value="" />
              <el-option label="按指标" value="metric" />
              <el-option label="按维度" value="dim" />
            </el-select>
            <el-select v-model="sortOrder" style="width: 45%; margin-left: 8px">
              <el-option label="升序" value="asc" />
              <el-option label="降序" value="desc" />
            </el-select>
          </el-form-item>
        </el-form>
      </template>
      <div v-else class="dq-hint dq-empty">请先在上方选择数据集</div>
    </el-scrollbar>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="confirm">确定</el-button>
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
const fields = ref<{ name: string; label: string; type: string }[]>([])

const plot = ref({
  datasetId: props.datasetId as number | null,
})
const dimensions = ref<any[]>([])
const metrics = ref<any[]>([])
const groupLimit = ref(20)
const sortOption = ref('')   // ''=不排序, 'metric'=按指标, 'dim'=按维度
const sortOrder = ref('desc')

const numericFields = computed(() => fields.value.filter((f) => NUMERIC_TYPES.includes(f.type)))

const typeLabel = (t: string) =>
  ({ string: '文本', integer: '整数', number: '小数', date: '日期', boolean: '布尔' } as any)[t] || t
const typeTagStyle = (t: string) =>
  NUMERIC_TYPES.includes(t)
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
  if (!plot.value.datasetId) return ElMessage.warning('请选择数据集')
  const dims = dimensions.value.filter((d) => d.field)
  const ms = metrics.value.filter((m) => m.field)
  if (ms.length === 0) return ElMessage.warning('请至少添加一个指标')
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
.dq-palette {
  background: var(--app-hover);
  border-radius: var(--app-radius);
  padding: 10px;
  margin-bottom: 12px;
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
  background: var(--app-card);
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
