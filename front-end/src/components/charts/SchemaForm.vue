<template>
  <el-form label-width="90px" size="small" :inline="false" class="schema-form">
    <template v-for="(field, key) in schema" :key="key">
      <!-- Inline text-style toolbar group (no labels, one wrapping row) -->
      <div
        v-if="field.type === 'group' && field.inline && field.children"
        class="inline-group"
      >
        <span class="inline-group-label">{{ field.label }}</span>
        <SchemaForm
          class="inline-sub"
          :schema="field.children"
          :model="getNestedModel(key)"
          @update="onNestedUpdate(key)"
          inline
        />
      </div>

      <el-form-item
        v-else-if="!field.type || field.type === 'group'"
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

      <!-- Scalar fields rendered as compact inline controls when parent is inline -->
      <el-form-item
        v-else-if="!isInline"
        :label="field.label"
      >
        <Control
          :field="field"
          :value="getModelValue(key)"
          @change="(v) => setModelValue(key, v)"
        />
      </el-form-item>

      <!-- Inline mode: render compact control without label -->
      <span v-else class="ctrl">
        <Control
          :field="field"
          :value="getModelValue(key)"
          :compact="true"
          @change="(v) => setModelValue(key, v)"
        />
      </span>
    </template>
  </el-form>
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
  if (field.type === 'select' || field.type === 'buttonGroup') return field.default ?? (field.options?.[0]?.value ?? '')
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

function onNestedUpdate(key) {
  return (newVal) => {
    localModel.value[key] = newVal
    emitUpdate()
  }
}
</script>

<style scoped>
.schema-form {
  width: 100%;
}
:deep(.schema-form .el-form-item) {
  margin-bottom: 8px;
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
  width: 74px;
  flex-shrink: 0;
}
:deep(.inline-sub) {
  flex: 1;
  min-width: 0;
}
:deep(.inline-sub .el-form-item) {
  margin-bottom: 0;
}
.ctrl {
  display: inline-flex;
  align-items: center;
}
</style>
