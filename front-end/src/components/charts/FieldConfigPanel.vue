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
        <el-tag  effect="light" :style="typeTagStyle(f.type)" style="margin-left: auto">{{ typeLabel(f.type) }}</el-tag>
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
      <div v-for="(m, mi) in metrics" :key="mi" class="metric-wrap">
        <div class="slot-row">
          <el-select v-model="m.type" style="width: 82px" placeholder="形态" @change="onTypeChange(m)">
            <el-option label="普通" value="base" />
            <el-option label="公式" value="expr" />
          </el-select>
          <template v-if="m.type === 'expr'">
            <el-input v-model="m.label" placeholder="指标名称" style="flex: 0.9" />
            <el-input
              v-model="m.expr"
              :class="{ 'is-invalid': exprError(m) }"
              placeholder="公式，如 $m0 / $m1"
              style="flex: 1.5"
            />
          </template>
          <template v-else>
            <el-select v-model="m.field" placeholder="选择字段" style="flex: 1">
              <el-option v-for="f in fields" :key="f.name" :label="f.label || f.name" :value="f.name" />
            </el-select>
            <el-select v-model="m.agg" style="width: 95px">
              <el-option v-for="a in AGG_OPTIONS" :key="a.value" :label="a.label" :value="a.value" />
            </el-select>
          </template>
          <el-icon class="remove-icon" @click="removeItem(metrics, mi)"><Delete /></el-icon>
        </div>
        <div v-if="m.type === 'expr'" class="ref-row">
          <span class="ref-label">引用前序普通指标：</span>
          <el-tag
            v-for="b in referableFor(mi)"
            :key="b.key"
            size="small"
            effect="plain"
            class="ref-tag"
            @click="insertRef(m, b)"
          >
            {{ '$' + b.key }} {{ b.field || '' }}
          </el-tag>
          <span v-if="!referableFor(mi).length" class="ref-empty">（暂无，请先在上方添加普通指标）</span>
          <span v-if="exprError(m)" class="ref-error">{{ exprError(m) }}</span>
        </div>
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
    if (!props.metrics.some((m) => m.type !== 'expr' && m.field === f.name)) {
      props.metrics.push({ type: 'base', field: f.name, agg: f.type === 'date' ? 'count' : 'sum' })
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
    if (!props.metrics.some((m) => m.type !== 'expr' && m.field === f.name)) {
      props.metrics.push({ type: 'base', field: f.name, agg: f.type === 'number' || f.type === 'integer' ? 'sum' : 'count' })
      update()
    }
  }
}

function addBlank(target) {
  if (target === 'dimensions') props.dims.push({ field: '', granularity: undefined })
  else props.metrics.push({ type: 'base', field: '', agg: 'sum' })
  update()
}

// 公式指标：切换形态时清理字段/聚合，并给默认名称
function onTypeChange(m) {
  if (m.type === 'expr') {
    m.field = undefined
    m.agg = undefined
    if (!m.label) m.label = `公式${props.metrics.findIndex((x) => x === m) + 1}`
  }
  update()
}

// 公式可引用的普通指标（位于其之前）
function referableFor(mi) {
  return props.metrics.slice(0, mi).filter((x) => x.type !== 'expr')
}

// 校验公式引用是否可用（其余语法由后端白名单把关）
function exprError(m) {
  if (m.type !== 'expr') return ''
  const tokens = new Set(String(m.expr || '').match(/\$[A-Za-z_][A-Za-z0-9_]*/g) || [])
  for (const tok of tokens) {
    if (!props.metrics.some((x) => x.type !== 'expr' && x.key === tok.slice(1))) return `引用 ${tok} 不存在`
  }
  return ''
}

function insertRef(m, b) {
  const prefix = m.expr && m.expr.trim() ? `${m.expr.trim()} ` : ''
  m.expr = `${prefix}$${b.key} `
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
  font-size: 14px;
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
  font-size: 14px;
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
  font-size: 14px;
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

.metric-wrap {
  margin-bottom: 8px;
}

.ref-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.4;
}

.ref-label {
  color: var(--app-text-secondary);
  flex-shrink: 0;
}

.ref-tag {
  cursor: pointer;
}

.ref-empty {
  color: var(--app-text-secondary);
}

.ref-error {
  color: var(--app-danger);
  margin-left: 4px;
}

.ref-row :deep(.is-invalid .el-input__inner),
.el-input.is-invalid .el-input__wrapper {
  box-shadow: 0 0 0 1px var(--app-danger) inset;
}

.ref-row :deep(.is-invalid .el-input__inner) {
  color: var(--app-danger);
}
</style>
