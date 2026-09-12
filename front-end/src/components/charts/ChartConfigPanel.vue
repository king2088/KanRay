<template>
  <div class="chart-config-panel">
    <el-collapse v-model="openPanels" class="config-collapse">
      <!-- 主题配置 -->
      <el-collapse-item name="theme" title="主题">
        <ThemeConfigPanel
          :theme="config.theme"
          :palette-index="config.colorPalette"
          :custom-palette="config.customPalette"
          @update:theme="(v) => emitMerged((m) => { m.theme = v })"
          @update:palette="(v) => emitMerged((m) => { m.colorPalette = v })"
          @update:customPalette="(v) => emitMerged((m) => { m.customPalette = v })"
        />
      </el-collapse-item>

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

      <!-- 折线系列样式（按系列单独配置，line/area 等类型） -->
      <el-collapse-item
        v-if="showSeriesStyles && seriesNames.length"
        title="线条样式 · 按系列"
        name="seriesStyles"
      >
        <div v-for="nm in seriesNames" :key="nm" class="series-style-block">
          <div class="series-style-name">{{ nm }}</div>
          <SchemaForm
            :schema="seriesStyleSchema"
            :model="seriesStyleModel(nm)"
            @update="(v) => onSeriesStyleUpdate(nm, v)"
          />
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { COMMON_CONFIG_SCHEMA, TYPE_CONFIG_SCHEMAS, SERIES_STYLE_TYPES, SERIES_STYLE_SCHEMA, getDefaultsFromSchema } from '@/config/chart-configs'
import { getChartType } from '@/config/chart-types'
import SchemaForm from './SchemaForm.vue'
import ThemeConfigPanel from './ThemeConfigPanel.vue'

const props = defineProps({
  chartType: { type: String, required: true },
  config: { type: Object, default: () => ({}) },
  seriesNames: { type: Array, default: () => [] },
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

const showSeriesStyles = computed(() => SERIES_STYLE_TYPES.has(props.chartType))
const seriesStyleSchema = SERIES_STYLE_SCHEMA

function seriesStyleModel(nm) {
  const existing = props.config?.typeSpecific?.seriesStyles?.[nm] || {}
  return { ...getDefaultsFromSchema(SERIES_STYLE_SCHEMA), ...existing }
}

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

function onSeriesStyleUpdate(nm, newVal) {
  emitMerged((merged) => {
    merged.typeSpecific = merged.typeSpecific || {}
    merged.typeSpecific.seriesStyles = merged.typeSpecific.seriesStyles || {}
    merged.typeSpecific.seriesStyles[nm] = newVal
  })
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
.config-collapse :deep(.el-collapse-item.is-active > .el-collapse-item__header) {
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--app-card);
  box-sizing: border-box;
  width: calc(100% + 20px);
  margin: 0 -10px;
  padding-left: 10px;
  padding-right: 10px;
}
.config-collapse :deep(.el-collapse-item__content) {
  padding-top: 4px;
}
.series-style-block {
  padding: 8px;
  margin-bottom: 8px;
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: 6px;
  background: var(--el-fill-color-light, #fafafa);
}
.series-style-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text, #333);
  margin-bottom: 4px;
}
</style>
