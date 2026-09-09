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
          :model="config[key]"
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
          :model="typeSpecific"
          @update="onTypeSpecificUpdate"
        />
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { COMMON_CONFIG_SCHEMA, TYPE_CONFIG_SCHEMAS } from '@/config/chart-configs'
import { COLOR_PALETTES, DEFAULT_PALETTE_INDEX } from '@/config/color-palettes'
import { getChartType } from '@/config/chart-types'
import SchemaForm from './SchemaForm.vue'

const props = defineProps({
  chartType: { type: String, required: true },
  config: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:config'])

const openPanels = ref(['title'])

const commonSchemaGroups = computed(() => {
  // Only include groups with children (type === 'group' && children exists)
  const groups = {}
  for (const [key, schema] of Object.entries(COMMON_CONFIG_SCHEMA)) {
    if (schema.type === 'group' && schema.children) {
      groups[key] = schema
    }
  }
  return groups
})

const config = computed(() => props.config)
const update = () => emit('update:config', JSON.parse(JSON.stringify(config.value)))

function onConfigUpdate(key) {
  return (newVal) => {
    config.value[key] = newVal
    update()
  }
}

const typeSchema = computed(() => TYPE_CONFIG_SCHEMAS[props.chartType] || {})
const typeSchemaKeys = computed(() => Object.keys(typeSchema.value))

const typeSpecific = computed({
  get: () => (config.value.typeSpecific = config.value.typeSpecific || {}),
  set: () => update(),
})

function onTypeSpecificUpdate(newVal) {
  config.value.typeSpecific = newVal
  update()
}

watch(() => props.chartType, () => {
  openPanels.value = ['title']
}, { immediate: false })

watch(typeSpecific, update, { deep: true })

// Color palette quick selector - add as a separate panel
const colorPaletteSchema = computed(() => ({
  colorPalette: COMMON_CONFIG_SCHEMA.colorPalette,
}))
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