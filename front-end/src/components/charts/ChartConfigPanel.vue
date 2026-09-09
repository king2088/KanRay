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
          @update="onGroupUpdate(key, $event)"
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
          :model="config.typeSpecific"
          @update="onTypeSpecificUpdate"
        />
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
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

const typeSchema = computed(() => TYPE_CONFIG_SCHEMAS[props.chartType] || {})
const typeSchemaKeys = computed(() => Object.keys(typeSchema.value))

function emitMerged(mutator) {
  const merged = { ...props.config }
  mutator(merged)
  emit('update:config', JSON.parse(JSON.stringify(merged)))
}

function onGroupUpdate(key, newVal) {
  emitMerged((merged) => { merged[key] = newVal })
}

function onTypeSpecificUpdate(newVal) {
  emitMerged((merged) => { merged.typeSpecific = newVal })
}
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
