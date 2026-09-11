<template>
  <div class="schema-form" :class="{ 'is-inline': isInline }">
    <template v-for="(field, key) in schema" :key="key">
      <!-- Inline toolbar group (text style) -->
      <div v-if="field.type === 'group' && field.inline && field.children" class="inline-group">
        <span class="inline-group-label">{{ field.label }}</span>
        <span class="inline-sub">
          <SchemaForm
            :schema="field.children"
            :model="getNestedModel(key)"
            @update="onNestedUpdate(key, $event)"
            inline
          />
        </span>
      </div>

      <!-- Nested group: render as a sub-block -->
      <div v-else-if="!field.type || field.type === 'group'" class="field-row group-child">
        <div class="field-label sub">{{ field.label }}</div>
        <div class="field-control">
          <SchemaForm
            v-if="field.children"
            :schema="field.children"
            :model="getNestedModel(key)"
            @update="onNestedUpdate(key, $event)"
          />
          <span v-else class="hint">配置缺失</span>
        </div>
      </div>

      <!-- Inline (toolbar) mode: bare compact control, no label -->
      <span v-else-if="isInline" class="ctrl">
        <Control
          :field="field"
          :value="getModelValue(key)"
          :compact="true"
          @change="(v) => setModelValue(key, v)"
        />
      </span>

      <!-- Normal row: label left, control right -->
      <div v-else class="field-row">
        <div class="field-label">{{ field.label }}</div>
        <div class="field-control">
          <Control
            :field="field"
            :value="getModelValue(key)"
            @change="(v) => setModelValue(key, v)"
          />
        </div>
      </div>
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
  return localModel.value[key]
}

function setModelValue(key, val) {
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
.field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  justify-content: flex-end;
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
  gap: 6px;
  padding: 4px 0;
}
.inline-group-label {
  font-size: 12px;
  color: var(--app-text-secondary, #888);
  min-width: 62px;
  flex-shrink: 0;
}
.inline-sub {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
  gap: 6px;
}
.ctrl {
  display: inline-flex;
  align-items: center;
}
:deep(.field-control .el-input-number),
:deep(.field-control .el-slider) {
  width: 130px;
}
:deep(.field-control > .el-switch) {
  margin-right: 4px;
}
:deep(.field-control > .el-select),
:deep(.field-control > .el-input),
:deep(.field-control > .el-color-picker) {
  width: 100%;
}
</style>
