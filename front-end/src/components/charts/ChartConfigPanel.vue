<template>
  <div class="chart-config-panel">
    <el-collapse v-model="openPanels" class="config-collapse">
      <!-- 主题配置 -->
      <el-collapse-item name="theme">
        <template #title>
          <span class="cfg-title"><span class="cfg-icon" v-html="groupIcon('主题')"></span>主题</span>
        </template>
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
      >
        <template #title>
          <span class="cfg-title"><span class="cfg-icon" v-html="groupIcon(schema.label)"></span>{{ schema.label }}</span>
        </template>
        <SchemaForm
          :schema="schema.children"
          :model="config[key]"
          @update="onGroupUpdate(key, $event)"
        />
      </el-collapse-item>

      <!-- 类型专属配置 -->
      <el-collapse-item
        v-if="typeSchemaKeys.length"
        name="typeSpecific"
      >
        <template #title>
          <span class="cfg-title"><span class="cfg-icon" v-html="groupIcon('专属配置')"></span>{{ `${getChartType(chartType)?.label || ''} 专属配置` }}</span>
        </template>
        <SchemaForm
          :schema="typeSchema"
          :model="config.typeSpecific"
          @update="onTypeSpecificUpdate"
        />
      </el-collapse-item>

      <!-- 折线系列样式（按系列单独配置，line/area 等类型） -->
      <el-collapse-item
        v-if="showSeriesStyles && seriesNames.length"
        name="seriesStyles"
      >
        <template #title>
          <span class="cfg-title"><span class="cfg-icon" v-html="groupIcon('线条样式')"></span>线条样式 · 按系列</span>
        </template>
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

const svgIcon = (inner) => `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">${inner}</svg>`

const GROUP_ICONS = {
  主题: '<circle cx="12" cy="12" r="8.5"/>',
  标题: '<rect x="3" y="4.5" width="18" height="3.4" rx="1.2"/><rect x="10" y="7.9" width="4" height="11.6" rx="1.2"/>',
  图例: '<rect x="3" y="6" width="6" height="6" rx="1.4"/><rect x="3" y="14.2" width="18" height="4.2" rx="1.4"/>',
  提示框: '<rect x="2.75" y="2.6" width="18.5" height="11.8" rx="2.25"/><path d="M5.5 15.2h10.4l-5.2 5.6z"/>',
  数据标签: '<path d="M3 3h6.6a2 2 0 0 1 1.4.6l8.4 8.4a2 2 0 0 1 0 2.8l-5.8 5.8a2 2 0 0 1-2.8 0L2.6 12A2 2 0 0 1 2 10.6V4a1 1 0 0 1 1-1z"/><circle cx="7.3" cy="6.6" r="1.5"/>',
  标记线: '<rect x="3" y="10.2" width="11.5" height="3.6" rx="1.8"/><circle cx="18" cy="12" r="3.1"/>',
  绘图区域: '<rect x="3" y="3" width="18" height="18" rx="2.2"/><circle cx="12" cy="12" r="2.2"/>',
  缩略轴: '<rect x="3" y="8.4" width="18" height="7.2" rx="3.6"/><rect x="4.6" y="5.8" width="4" height="12.4" rx="1.6"/><rect x="15.4" y="5.8" width="4" height="12.4" rx="1.6"/>',
  X轴: '<g><rect x="3.5" y="9.3" width="17" height="5.4" rx="1.8" transform="rotate(45 12 12)"/><rect x="3.5" y="9.3" width="17" height="5.4" rx="1.8" transform="rotate(-45 12 12)"/></g>',
  Y轴: '<g><rect x="9.4" y="2.6" width="5.2" height="11.5" rx="1.9"/><rect x="8.9" y="9.6" width="5.2" height="9.2" rx="1.9" transform="rotate(-46 11.5 14.2)"/><rect x="15.4" y="9.6" width="5.2" height="9.2" rx="1.9" transform="rotate(46 18 14.2)"/></g>',
  专属配置: '<g><rect x="3.5" y="4" width="3.2" height="16" rx="1.6"/><rect x="10.4" y="4" width="3.2" height="16" rx="1.6"/><rect x="17.3" y="4" width="3.2" height="16" rx="1.6"/><rect x="2.8" y="3" width="4.6" height="3.2" rx="1.6"/><rect x="9.7" y="8.3" width="4.6" height="3.2" rx="1.6"/><rect x="16.6" y="6" width="4.6" height="3.2" rx="1.6"/></g>',
  线条样式: '<path d="M3 16.8l5.2-5.4 3.5 3.6 6.3-7 1.7 1.6-8 8.9-3.5-3.6-4.6 4.8z"/><circle cx="20" cy="8" r="1.6"/>',
  __default: '<path d="M12 2l10 10-10 10L2 12z"/>',
}

function groupIcon(label) {
  return (GROUP_ICONS[label] || GROUP_ICONS.__default) && svgIcon(GROUP_ICONS[label] || GROUP_ICONS.__default)
}
</script>

<style scoped>
.chart-config-panel {
  padding: 0 0 12px;
}
.config-collapse :deep(.el-collapse-item__header) {
  font-size: 14px;
  font-weight: 500;
  padding: 10px 0;
  background-color: var(--app-card-solid);
}
.config-collapse :deep(.el-collapse-item.is-active > .el-collapse-item__header) {
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--app-card-solid);
  box-sizing: border-box;
  width: calc(100% + 12px);
  margin: 0 -10px;
  padding-left: 10px;
  padding-right: 10px;
}
.config-collapse :deep(.el-collapse-item__wrap) {
  background-color: var(--app-card-solid);
}
.config-collapse :deep(.el-collapse-item__content) {
  padding-top: 4px;
}

.cfg-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.cfg-icon {
  display: inline-flex;
  color: var(--app-text-secondary);
  opacity: 0.55;
}

.cfg-icon :deep(svg) {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  fill: currentColor;
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
