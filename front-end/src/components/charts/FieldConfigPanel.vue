<template>
  <div class="field-config-panel">
    <div class="panel-title">字段配置</div>
    <div class="field-palette">
      <div class="palette-title">可用字段（拖拽或点击添加）</div>
      <div
        v-for="f in fields"
        :key="f.name"
        class="field-chip"
        draggable="true"
        @dragstart="onFieldDragStart($event, f)"
        @click="quickAdd(f)"
      >
        <el-icon :size="14" style="margin-right: 6px"><DataLine /></el-icon>
        <span>{{ f.label || f.name }}</span>
        <el-tag size="small" effect="light" :style="typeTagStyle(f.type)" style="margin-left: auto">{{ typeLabel(f.type) }}</el-tag>
      </div>
    </div>

    <!-- 维度 -->
    <div class="drop-zone" @dragover.prevent @drop="onDrop($event, 'dimensions')">
      <div class="drop-zone-title">
        维度（分类 / X 轴）
        <el-icon class="add-icon" @click="addBlank('dimensions')"><Plus /></el-icon>
      </div>
      <div v-if="!dims.length" class="drop-hint">拖入字段作为维度</div>
      <div v-for="(d, di) in dims" :key="di" class="slot-row">
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
        <el-icon class="remove-icon" @click="removeItem(dims, di)"><Delete /></el-icon>
      </div>
    </div>

    <!-- 指标 -->
    <div class="drop-zone" @dragover.prevent @drop="onDrop($event, 'metrics')">
      <div class="drop-zone-title">
        指标（数值 / Y 轴）
        <el-icon class="add-icon" @click="addBlank('metrics')"><Plus /></el-icon>
      </div>
      <div v-if="!metrics.length" class="drop-hint">拖入字段作为指标</div>
      <div v-for="(m, mi) in metrics" :key="mi" class="slot-row">
        <el-select v-model="m.field" placeholder="选择字段" style="flex: 1">
          <el-option v-for="f in fields" :key="f.name" :label="f.label || f.name" :value="f.name" />
        </el-select>
        <el-select v-model="m.agg" style="width: 95px">
          <el-option v-for="a in AGG_OPTIONS" :key="a.value" :label="a.label" :value="a.value" />
        </el-select>
        <el-icon class="remove-icon" @click="removeItem(metrics, mi)"><Delete /></el-icon>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Plus, Delete, DataLine } from '@element-plus/icons-vue'
import { AGG_OPTIONS } from '@/utils/chart-utils'

const props = defineProps({
  fields: { type: Array, default: () => [] },
  dims: { type: Array, default: () => [] },
  metrics: { type: Array, default: () => [] },
  chartType: { type: String, default: 'bar' },
})

const update = () => {
  // dims/metrics are reactive objects passed by reference, mutation happens in-place
}

const typeLabel = (t) => ({ string: '文本', integer: '整数', number: '小数', date: '日期', boolean: '布尔' }[t] || t)

const NUMERIC_TYPES = ['integer', 'number']

const typeTagStyle = (t) =>
  NUMERIC_TYPES.includes(t)
    ? { background: '#E9F7EF', borderColor: '#B8E9CD', color: '#1F8A4C' }
    : {}

function isDateField(fieldName) {
  const f = props.fields.find((x) => x.name === fieldName)
  return f && f.type === 'date'
}

function onFieldDragStart(e, field) {
  e.dataTransfer.setData('text/plain', JSON.stringify({ name: field.name, label: field.label, type: field.type }))
}

function onDrop(e, target) {
  const raw = e.dataTransfer.getData('text/plain')
  if (!raw) return
  const f = JSON.parse(raw)
  if (target === 'dimensions') {
    if (!props.dims.some((d) => d.field === f.name)) {
      props.dims.push({ field: f.name, granularity: f.type === 'date' ? 'day' : undefined })
      update()
    }
  } else {
    if (!props.metrics.some((m) => m.field === f.name)) {
      props.metrics.push({ field: f.name, agg: f.type === 'date' ? 'count' : 'sum' })
      update()
    }
  }
}

function quickAdd(f) {
  // Click adds to a sensible slot based on type
  if (f.type === 'date' || (props.metrics.length === 0 && f.type !== 'number' && f.type !== 'integer')) {
    if (!props.dims.some((d) => d.field === f.name)) {
      props.dims.push({ field: f.name, granularity: f.type === 'date' ? 'day' : undefined })
      update()
    }
  } else {
    if (!props.metrics.some((m) => m.field === f.name)) {
      props.metrics.push({ field: f.name, agg: props.dims.length === 0 && (f.type === 'number' || f.type === 'integer') ? 'sum' : 'sum' })
      update()
    }
  }
}

function addBlank(target) {
  if (target === 'dimensions') props.dims.push({ field: '', granularity: undefined })
  else props.metrics.push({ field: '', agg: 'sum' })
  update()
}

function removeItem(arr, i) {
  arr.splice(i, 1)
  update()
}
</script>

<style scoped>
.field-config-panel {
  padding: 4px 0;
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-primary);
  margin-bottom: 8px;
}

.field-palette {
  background: var(--app-hover);
  border-radius: var(--app-radius);
  padding: 10px;
  margin-bottom: 12px;
}

.palette-title {
  font-size: 12px;
  color: var(--app-text-secondary);
  margin-bottom: 8px;
}

.field-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--app-card);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  padding: 6px 10px;
  margin-bottom: 6px;
  cursor: grab;
  font-size: 13px;
  user-select: none;
  color: var(--app-text-primary);
}

.field-chip:hover {
  border-color: var(--app-primary);
  color: var(--app-primary);
}

.drop-zone {
  border: 1px dashed var(--app-border);
  border-radius: var(--app-radius);
  padding: 10px;
  margin-bottom: 12px;
  min-height: 70px;
}

.drop-zone-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-primary);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.add-icon {
  color: var(--app-primary);
  cursor: pointer;
}

.drop-hint {
  font-size: 12px;
  color: var(--app-text-secondary);
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
  color: var(--app-danger);
  cursor: pointer;
  flex-shrink: 0;
}
</style>
