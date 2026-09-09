<template>
  <el-form label-width="100px" size="small" :inline="false">
    <template v-for="(field, key) in schema" :key="key">
      <el-form-item
        v-if="!field.type || field.type === 'group'"
        :label="field.label"
      >
        <SchemaForm
          v-if="field.children"
          :schema="field.children"
          :model="getNestedModel(key)"
          @update="onNestedUpdate(key)"
        />
        <el-alert v-else title="Group needs children schema" type="warning" :show-icon="false" style="font-size: 12px" />
      </el-form-item>

      <el-form-item v-else :label="field.label">
        <el-switch
          v-if="field.type === 'switch'"
          :model-value="getModelValue(key)"
          @update:model-value="val => setModelValue(key, val)"
          :disabled="field.disabled"
        />

        <el-input
          v-else-if="field.type === 'input'"
          :model-value="getModelValue(key)"
          @update:model-value="val => setModelValue(key, val)"
          :placeholder="field.placeholder"
          :disabled="field.disabled"
          style="width: 100%"
        />

        <el-input
          v-else-if="field.type === 'textarea'"
          :model-value="getModelValue(key)"
          @update:model-value="val => setModelValue(key, val)"
          :placeholder="field.placeholder"
          :disabled="field.disabled"
          :rows="4"
          style="width: 100%"
        />

        <el-input-number
          v-else-if="field.type === 'number'"
          :model-value="getModelValue(key)"
          @update:model-value="val => setModelValue(key, val)"
          :min="field.min"
          :max="field.max"
          :step="field.step || 1"
          :placeholder="field.placeholder"
          :disabled="field.disabled"
          :controls-position="field.controlsPosition || 'right'"
          style="width: 140px"
        />

        <el-slider
          v-else-if="field.type === 'slider'"
          :model-value="getModelValue(key)"
          @update:model-value="val => setModelValue(key, val)"
          :min="field.min ?? 0"
          :max="field.max ?? 100"
          :step="field.step ?? 1"
          :disabled="field.disabled"
          style="width: 140px"
        />

        <el-select
          v-else-if="field.type === 'select'"
          :model-value="getModelValue(key)"
          @update:model-value="val => setModelValue(key, val)"
          :placeholder="field.placeholder || '请选择'"
          :disabled="field.disabled"
          style="width: 100%"
          clearable
        >
          <el-option
            v-for="opt in field.options || []"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>

        <el-color-picker
          v-else-if="field.type === 'color'"
          :model-value="getModelValue(key)"
          @update:model-value="val => setModelValue(key, val)"
          :disabled="field.disabled"
          :predefine="[]"
          style="width: 100%"
        />

        <el-button
          v-else-if="field.type === 'toggle'"
          :type="getModelValue(key) === field.activeValue ? 'primary' : 'default'"
          size="small"
          @click="toggleValue(key, field)"
          :title="field.label"
          style="min-width: 36px"
        >
          <span :style="getToggleStyle(key, field)">{{ field.icon || field.label }}</span>
        </el-button>

        <el-button-group v-else-if="field.type === 'buttonGroup'">
          <el-button
            v-for="opt in field.options || []"
            :key="opt.value"
            :type="getModelValue(key) === opt.value ? 'primary' : 'default'"
            size="small"
            @click="setModelValue(key, opt.value)"
            :title="opt.label"
            style="min-width: 32px"
          >
            <span :style="opt.value === 'underline' ? { textDecoration: 'underline' } : opt.value === 'line-through' ? { textDecoration: 'line-through' } : {}" v-html="opt.icon || opt.label"></span>
          </el-button>
        </el-button-group>

        <el-alert v-else title="Unsupported field type" type="warning" :show-icon="false" style="font-size: 12px" />
      </el-form-item>
    </template>
  </el-form>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps({
  schema: { type: Object, required: true },
  model: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update'])

// Local reactive copy of model with defaults applied
const localModel = ref({})

function getDefaultValue(field) {
  if (!field.type || field.type === 'group') return {}
  if (field.type === 'switch') return field.default ?? false
  if (field.type === 'number') return field.default ?? field.min ?? 0
  if (field.type === 'slider') return field.default ?? field.min ?? 0
  if (field.type === 'select' || field.type === 'buttonGroup') return field.default ?? (field.options?.[0]?.value ?? '')
  if (field.type === 'toggle') return field.default ?? field.inactiveValue ?? ''
  if (field.type === 'color') return field.default ?? '#409EFF'
  if (field.type === 'input') return field.default ?? ''
  if (field.type === 'textarea') return field.default ?? ''
  return field.default ?? null
}

function initLocalModel() {
  const result = { ...(props.model || {}) }
  for (const key of Object.keys(props.schema)) {
    const field = props.schema[key]
    if (!(key in result)) {
      result[key] = getDefaultValue(field)
    }
    if (field.type === 'group' && field.children && (!result[key] || typeof result[key] !== 'object')) {
      result[key] = {}
    }
  }
  localModel.value = result
}

// Initialize
initLocalModel()

// Watch parent model changes
watch(() => props.model, (newVal) => {
  const result = { ...(newVal || {}) }
  for (const key of Object.keys(props.schema)) {
    const field = props.schema[key]
    if (!(key in result)) {
      result[key] = getDefaultValue(field)
    }
    if (field.type === 'group' && field.children && (!result[key] || typeof result[key] !== 'object')) {
      result[key] = {}
    }
  }
  localModel.value = result
}, { deep: true, immediate: false })

// Emit updates with debounce to avoid excessive updates
let emitTimer = null
function emitUpdate() {
  if (emitTimer) clearTimeout(emitTimer)
  emitTimer = setTimeout(() => {
    emit('update', { ...localModel.value })
  }, 50)
}

function getModelValue(key) {
  return localModel.value[key]
}

function setModelValue(key, val) {
  // Only emit if value actually changed
  if (localModel.value[key] !== val) {
    localModel.value[key] = val
    emitUpdate()
  }
}

function toggleValue(key, field) {
  const current = localModel.value[key]
  const next = current === field.activeValue ? field.inactiveValue : field.activeValue
  setModelValue(key, next)
}

function getToggleStyle(key, field) {
  const val = localModel.value[key]
  if (field.icon === 'B') return val === field.activeValue ? { fontWeight: 'bold' } : {}
  if (field.icon === 'I') return val === field.activeValue ? { fontStyle: 'italic' } : {}
  return {}
}

function getNestedModel(key) {
  if (!localModel.value[key] || typeof localModel.value[key] !== 'object') {
    localModel.value[key] = {}
  }
  return localModel.value[key]
}

function onNestedUpdate(key) {
  return (newVal) => {
    localModel.value[key] = newVal
    emitUpdate()
  }
}
</script>

<style scoped>
.config-form-item {
  margin-bottom: 8px;
}
</style>