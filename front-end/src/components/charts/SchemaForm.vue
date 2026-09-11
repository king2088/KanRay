<template>
  <div class="schema-form" :class="{ 'is-inline': isInline }">
    <template v-for="unit in layout" :key="unit.type === 'row' ? `row:${unit.keys.join(',')}` : unit.key">
      <!-- One-line group: consecutive row-flagged fields laid out horizontally -->
      <div v-if="unit.type === 'row'" class="row-group">
        <div
          v-for="f in unit.fields"
          :key="f.key"
          class="row-field"
          :class="{ 'is-fixed': f.field.selectWidth }"
        >
          <span v-if="f.field.separator" class="row-sep" />
          <span class="row-field-label">{{ f.field.label }}</span>
          <Control
            :field="f.field"
            :value="getModelValue(f.key)"
            :compact="true"
            fluid
            @change="(v) => setModelValue(f.key, v)"
          />
        </div>
      </div>

      <template v-else>
        <!-- Inline toolbar group (text style) -->
        <div v-if="unit.field.type === 'group' && unit.field.inline && unit.field.children" class="inline-group">
          <span class="inline-group-label">{{ unit.field.label }}</span>
          <span class="inline-sub">
            <SchemaForm
              :schema="unit.field.children"
              :model="getNestedModel(unit.key)"
              @update="onNestedUpdate(unit.key, $event)"
              inline
            />
          </span>
        </div>

        <!-- Flattened single-control group: rendered as a plain field-row -->
        <div v-else-if="unit.field.type === 'group' && unit.field.flat && unit.field.children" class="field-row">
          <div class="field-label">{{ unit.field.label }}</div>
          <div class="field-control flat-control">
            <SchemaForm
              :schema="unit.field.children"
              :model="getNestedModel(unit.key)"
              @update="onNestedUpdate(unit.key, $event)"
              inline
            />
          </div>
        </div>

        <!-- Nested group: render as a sub-block -->
        <div v-else-if="!unit.field.type || unit.field.type === 'group'" class="field-row group-child">
          <div class="field-label sub">{{ unit.field.label }}</div>
          <div class="field-control">
            <SchemaForm
              v-if="unit.field.children"
              :schema="unit.field.children"
              :model="getNestedModel(unit.key)"
              @update="onNestedUpdate(unit.key, $event)"
            />
            <span v-else class="hint">配置缺失</span>
          </div>
        </div>

        <!-- Inline (toolbar) mode: bare compact control, no label -->
        <span v-else-if="isInline" class="ctrl">
          <Control
            :field="unit.field"
            :value="getModelValue(unit.key)"
            :compact="true"
            @change="(v) => setModelValue(unit.key, v)"
          />
        </span>

        <!-- Normal row: label left, control right -->
        <div v-else class="field-row">
          <div class="field-label">{{ unit.field.label }}</div>
          <div class="field-control">
            <Control
              :field="unit.field"
              :value="getModelValue(unit.key)"
              @change="(v) => setModelValue(unit.key, v)"
            />
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import Control from './SchemaControl.vue'

const props = defineProps({
  schema: { type: Object, required: true },
  model: { type: Object, default: () => ({}) },
  inline: { type: Boolean, default: false },
})

const emit = defineEmits(['update'])

const isInline = computed(() => props.inline)
const localModel = ref({})

// 将连续的 row 标记字段合并为一行渲染，其余字段保持原有单个渲染
const layout = computed(() => {
  const units = []
  let row = []
  const flush = () => {
    if (row.length) {
      units.push({ type: 'row', keys: row.map((f) => f.key), fields: row })
      row = []
    }
  }
  for (const [key, field] of Object.entries(props.schema)) {
    if (field && field.row) {
      row.push({ key, field })
    } else {
      flush()
      units.push({ type: 'single', key, field })
    }
  }
  flush()
  return units
})

function getDefaultValue(field) {
  if (!field.type || field.type === 'group') return {}
  if (field.type === 'switch') return field.default ?? false
  if (field.type === 'number') return field.default ?? field.min ?? 0
  if (field.type === 'slider') return field.default ?? field.min ?? 0
  if (field.type === 'select' || field.type === 'buttonGroup') {
    return field.multiple ? (field.default ?? []) : (field.default ?? (field.options?.[0]?.value ?? ''))
  }
  if (field.type === 'toggle') return field.default ?? field.inactiveValue ?? ''
  if (field.type === 'color') return field.default ?? '#409EFF'
  if (field.type === 'input') return field.default ?? ''
  if (field.type === 'textarea') return field.default ?? ''
  return field.default ?? null
}

function buildModel(source) {
  const result = { ...(source || {}) }
  for (const key of Object.keys(props.schema)) {
    const field = props.schema[key]
    if (field && field.type === 'positionGrid' && field.keys) continue
    if (!(key in result)) {
      result[key] = getDefaultValue(field)
    }
    if (field.type === 'group' && field.children && (!result[key] || typeof result[key] !== 'object')) {
      result[key] = {}
    }
  }
  return result
}

function initLocalModel() {
  localModel.value = buildModel(props.model)
}

initLocalModel()

function sameContent(a, b) {
  try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false }
}

watch(() => props.model, (newVal) => {
  if (newVal && !sameContent(localModel.value, newVal)) {
    localModel.value = buildModel(newVal)
  }
}, { deep: true, immediate: false })

function emitUpdate() {
  emit('update', { ...localModel.value })
}

function getModelValue(key) {
  const f = props.schema[key]
  if (f && f.type === 'positionGrid' && f.keys) {
    const out = {}
    for (const k of f.keys) out[k] = localModel.value[k]
    return out
  }
  return localModel.value[key]
}

function setModelValue(key, val) {
  const f = props.schema[key]
  if (f && f.type === 'positionGrid' && f.keys && val && typeof val === 'object') {
    let changed = false
    for (const k of f.keys) {
      if (localModel.value[k] !== val[k]) {
        localModel.value[k] = val[k]
        changed = true
      }
    }
    if (changed) emitUpdate()
    return
  }
  if (localModel.value[key] !== val) {
    localModel.value[key] = val
    emitUpdate()
  }
}

function getNestedModel(key) {
  if (!localModel.value[key] || typeof localModel.value[key] !== 'object') {
    localModel.value[key] = {}
  }
  return localModel.value[key]
}

function onNestedUpdate(key, newVal) {
  localModel.value[key] = newVal
  emitUpdate()
}
</script>

<style scoped>
.schema-form {
  width: 100%;
}
.schema-form.is-inline {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  width: 100%;
}
.field-row {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-height: 34px;
  padding: 2px 0;
  gap: 8px;
}
.field-row.group-child {
  align-items: flex-start;
}
.field-label {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--app-text-secondary, #6b7280);
  min-width: 72px;
}
.field-label.sub {
  padding-top: 6px;
  color: var(--app-text, #333);
  font-weight: 500;
}
.field-control {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: flex-start;
  align-items: center;
}
.hint {
  font-size: 12px;
  color: #c0c4cc;
}
.inline-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 2px 0;
}
.inline-group-label {
  font-size: 12px;
  color: var(--app-text-secondary, #888);
  min-width: 72px;
  flex-shrink: 0;
}
.inline-sub {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
  gap: 2px;
}
.ctrl {
  display: inline-flex;
  align-items: center;
}
.row-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 2px 0 2px 80px;
}
.flat-control :deep(.ctrl) {
  display: flex;
  width: 100%;
}
.flat-control :deep(.ctrl .el-select) {
  width: 100%;
}
.row-group .row-field {
  flex: 0 1 auto;
  display: flex;
  align-items: center;
  gap: 4px;
}
.row-field :deep(.el-color-picker),
.ctrl :deep(.el-color-picker) {
  flex: 0 0 32px;
  width: 32px;
}
.row-field-label {
  flex-shrink: 0;
  font-size: 12px;
  white-space: nowrap;
  color: var(--app-text-secondary, #6b7280);
}
.row-group .row-sep {
  width: 1px;
  height: 16px;
  flex-shrink: 0;
  background: var(--el-border-color-lighter, #ebeef5);
  margin: 0 2px;
}
.row-group .row-field.is-fixed {
  flex: 0 0 auto;
}
.row-field :deep(.el-input-number) {
  width: 86px;
  flex: 0 1 86px;
  min-width: 0;
}
:deep(.field-control .el-input-number),
:deep(.field-control .el-slider) {
  width: 130px;
}
:deep(.field-control > .el-switch) {
  margin-right: 4px;
}
:deep(.field-control > .el-select),
:deep(.field-control > .el-input) {
  width: 100%;
}
</style>
