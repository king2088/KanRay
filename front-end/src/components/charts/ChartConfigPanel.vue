<template>
  <div class="chart-config-panel">
    <el-collapse v-model="openPanels" class="config-collapse">
      <!-- 公共配置：动态渲染 COMMON_CONFIG_SCHEMA -->
      <el-collapse-item
        v-for="(schema, key) in commonSchemaGroups"
        :key="key"
        :name="key"
        :title="schema.label"
      >
        <SchemaForm
          :schema="schema.children"
          :model="localConfig[key]"
          @update="onConfigUpdate(key)"
        />
      </el-collapse-item>

      <!-- 类型专属配置 -->
      <el-collapse-item
        v-if="typeSchemaKeys.length"
        :title="`${getChartType(chartType)?.label || ''} 专属配置`"
        name="typeSpecific"
      >
        <SchemaForm
          :schema="typeSchema"
          :model="localTypeSpecific"
          @update="onTypeSpecificUpdate"
        />
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { COMMON_CONFIG_SCHEMA, TYPE_CONFIG_SCHEMAS } from '@/config/chart-configs'
import { getChartType } from '@/config/chart-types'
import SchemaForm from './SchemaForm.vue'

const props = defineProps({
  chartType: { type: String, required: true },
  config: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:config'])

const openPanels = ref(['title'])

const commonSchemaGroups = computed(() => {
  const groups = {}
  for (const [key, schema] of Object.entries(COMMON_CONFIG_SCHEMA)) {
    if (schema.type === 'group' && schema.children) {
      groups[key] = schema
    }
  }
  return groups
})

// Local reactive copy to avoid mutating props directly
const localConfig = ref({})
const localTypeSpecific = ref({})

// Sync from props to local
function syncFromProps() {
  localConfig.value = { ...props.config }
  // Remove colorPalette from localConfig since it's handled separately
  if (localConfig.value.colorPalette) {
    delete localConfig.value.colorPalette
  }
  localTypeSpecific.value = { ...(props.config.typeSpecific || {}) }
}

// Initial sync
syncFromProps()

// Sync back to props when local changes
let emitTimer = null
function emitUpdate() {
  if (emitTimer) clearTimeout(emitTimer)
  emitTimer = setTimeout(() => {
    const merged = { ...localConfig.value }
    if (Object.keys(localTypeSpecific.value).length > 0) {
      merged.typeSpecific = { ...localTypeSpecific.value }
    }
    emit('update:config', JSON.parse(JSON.stringify(merged)))
  }, 100)
}

// Watch for prop changes
watch(() => props.config, (newVal) => {
  if (newVal) {
    syncFromProps()
  }
}, { deep: true, immediate: false })

const typeSchema = computed(() => TYPE_CONFIG_SCHEMAS[props.chartType] || {})
const typeSchemaKeys = computed(() => Object.keys(typeSchema.value))

function onConfigUpdate(key) {
  return (newVal) => {
    localConfig.value[key] = newVal
    emitUpdate()
  }
}

function onTypeSpecificUpdate(newVal) {
  localTypeSpecific.value = newVal
  emitUpdate()
}

watch(() => props.chartType, () => {
  openPanels.value = ['title']
  nextTick(() => {
    localTypeSpecific.value = {}
  })
}, { immediate: false })
</script>

<style scoped>
.chart-config-panel {
  padding: 0 0 12px;
}
.config-collapse :deep(.el-collapse-item__header) {
  font-size: 13px;
  font-weight: 500;
  padding: 10px 0;
}
.config-collapse :deep(.el-collapse-item__content) {
  padding-top: 4px;
}
</style>