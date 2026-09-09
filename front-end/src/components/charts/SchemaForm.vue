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
          predefine
          style="width: 100%"
        />

        <el-alert v-else title="Unsupported field type" type="warning" :show-icon="false" style="font-size: 12px" />
      </el-form-item>
    </template>
  </el-form>
</template>

<script setup>
import { computed, watch } from 'vue'

const props = defineProps({
  schema: { type: Object, required: true },
  model: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update'])

// Ensure model has all keys from schema with defaults
const modelWithDefaults = computed(() => {
  const result = { ...props.model }
  for (const key of Object.keys(props.schema)) {
    const field = props.schema[key]
    if (!(key in result)) {
      result[key] = getDefaultValue(field)
    }
  }
  return result
})

function getDefaultValue(field) {
  if (!field.type || field.type === 'group') return {}
  if (field.type === 'switch') return field.default ?? false
  if (field.type === 'number') return field.default ?? field.min ?? 0
  if (field.type === 'slider') return field.default ?? field.min ?? 0
  if (field.type === 'select') return field.default ?? (field.options?.[0]?.value ?? '')
  if (field.type === 'color') return field.default ?? '#409EFF'
  if (field.type === 'input') return field.default ?? ''
  if (field.type === 'textarea') return field.default ?? ''
  return field.default ?? null
}

function getModelValue(key) {
  return modelWithDefaults.value[key]
}

function setModelValue(key, val) {
  modelWithDefaults.value[key] = val
  emit('update', modelWithDefaults.value)
}

function getNestedModel(key) {
  return {
    get: () => modelWithDefaults.value[key] || {},
    set: (val) => {
      modelWithDefaults.value[key] = val
      emit('update', modelWithDefaults.value)
    },
  }
}

function onNestedUpdate(key) {
  return (newVal) => {
    modelWithDefaults.value[key] = newVal
    emit('update', modelWithDefaults.value)
  }
}

watch(() => props.model, (newVal) => {
  // External model changes will be merged in modelWithDefaults computed
}, { deep: true, immediate: false })
</script>

<style scoped>
.config-form-item {
  margin-bottom: 8px;
}
</style>