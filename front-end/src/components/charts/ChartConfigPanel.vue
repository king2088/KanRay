<template>
  <div class="chart-config-panel">
    <el-collapse v-model="openPanels">
      <!-- 公共配置 -->
      <el-collapse-item title="标题" name="title">
        <el-form label-width="80px" size="small">
          <el-form-item label="显示">
            <el-switch v-model="titleCfg.show" />
          </el-form-item>
          <el-form-item label="标题文本" v-if="titleCfg.show">
            <el-input v-model="titleCfg.text" placeholder="图表标题" />
          </el-form-item>
          <el-form-item label="副标题" v-if="titleCfg.show">
            <el-input v-model="titleCfg.subtext" placeholder="副标题（可选）" />
          </el-form-item>
          <el-form-item label="位置" v-if="titleCfg.show">
            <el-select v-model="titleCfg.position" style="width: 100%">
              <el-option label="左" value="left" />
              <el-option label="居中" value="center" />
              <el-option label="右" value="right" />
            </el-select>
          </el-form-item>
          <el-form-item label="标题字号" v-if="titleCfg.show">
            <el-input-number v-model="titleCfg.fontSize" :min="10" :max="40" />
          </el-form-item>
        </el-form>
      </el-collapse-item>

      <el-collapse-item title="图例" name="legend">
        <el-form label-width="80px" size="small">
          <el-form-item label="显示">
            <el-switch v-model="legendCfg.show" />
          </el-form-item>
          <el-form-item label="位置" v-if="legendCfg.show">
            <el-select v-model="legendCfg.position" style="width: 100%">
              <el-option label="上" value="top" />
              <el-option label="下" value="bottom" />
              <el-option label="左" value="left" />
              <el-option label="右" value="right" />
            </el-select>
          </el-form-item>
        </el-form>
      </el-collapse-item>

      <el-collapse-item title="提示" name="tooltip">
        <el-form label-width="80px" size="small">
          <el-form-item label="显示">
            <el-switch v-model="tooltipCfg.show" />
          </el-form-item>
          <el-form-item label="触发方式" v-if="tooltipCfg.show">
            <el-select v-model="tooltipCfg.trigger" style="width: 100%">
              <el-option label="坐标轴" value="axis" />
              <el-option label="数据项" value="item" />
              <el-option label="不触发" value="none" />
            </el-select>
          </el-form-item>
        </el-form>
      </el-collapse-item>

      <el-collapse-item title="标签" name="label">
        <el-form label-width="80px" size="small">
          <el-form-item label="显示">
            <el-switch v-model="labelCfg.show" />
          </el-form-item>
          <el-form-item label="位置" v-if="labelCfg.show">
            <el-select v-model="labelCfg.position" style="width: 100%">
              <el-option label="上" value="top" />
              <el-option label="下" value="bottom" />
              <el-option label="左" value="left" />
              <el-option label="右" value="right" />
              <el-option label="内" value="inside" />
              <el-option label="内上" value="insideTop" />
            </el-select>
          </el-form-item>
          <el-form-item label="格式" v-if="labelCfg.show">
            <el-select v-model="labelCfg.formatter" style="width: 100%">
              <el-option label="默认" value="" />
              <el-option label="数值" value="{c}" />
              <el-option label="百分比" value="{d}%" />
            </el-select>
          </el-form-item>
        </el-form>
      </el-collapse-item>

      <el-collapse-item title="辅助线" name="markLine">
        <el-form label-width="80px" size="small">
          <el-form-item label="显示">
            <el-switch v-model="markLineCfg.show" />
          </el-form-item>
          <el-form-item label="类型" v-if="markLineCfg.show">
            <el-select v-model="markLineCfg.type" style="width: 100%">
              <el-option label="平均值" value="average" />
              <el-option label="最大值" value="max" />
              <el-option label="最小值" value="min" />
              <el-option label="自定义" value="custom" />
            </el-select>
          </el-form-item>
          <el-form-item label="自定义值" v-if="markLineCfg.show && markLineCfg.type === 'custom'">
            <el-input-number v-model="markLineCfg.customValue" />
          </el-form-item>
        </el-form>
      </el-collapse-item>

      <el-collapse-item title="颜色主题" name="color">
        <el-select v-model="colorIndex" style="width: 100%">
          <el-option v-for="(p, i) in COLOR_PALETTES" :key="i" :label="p.name" :value="i" />
        </el-select>
        <div class="palette-preview" v-if="COLOR_PALETTES[colorIndex]">
          <span
            v-for="(c, ci) in COLOR_PALETTES[colorIndex].colors.slice(0, 6)"
            :key="ci"
            class="palette-dot"
            :style="{ backgroundColor: c }"
          />
        </div>
      </el-collapse-item>

      <!-- 类型专属配置 -->
      <el-collapse-item
        v-if="typeSchemaKeys.length"
        :title="`${getChartType(chartType)?.label || ''} 专属配置`"
        name="typeSpecific"
      >
        <div v-for="key in typeSchemaKeys" :key="key">
          <component
            :is="'div'"
            class="type-config-row"
          >
            <label class="type-config-label">{{ typeSchema[key].label }}</label>
            <el-switch
              v-if="typeSchema[key].type === 'switch'"
              v-model="typeSpecific[key]"
            />
            <el-input-number
              v-else-if="typeSchema[key].type === 'number'"
              v-model="typeSpecific[key]"
              :min="typeSchema[key].min"
              :max="typeSchema[key].max"
              :placeholder="typeSchema[key].placeholder"
              controls-position="right"
              style="width: 120px"
            />
            <el-slider
              v-else-if="typeSchema[key].type === 'slider'"
              v-model="typeSpecific[key]"
              :min="typeSchema[key].min ?? 0"
              :max="typeSchema[key].max ?? 100"
              :step="typeSchema[key].step ?? 1"
              style="width: 120px"
            />
            <el-select
              v-else-if="typeSchema[key].type === 'select'"
              v-model="typeSpecific[key]"
              style="width: 120px"
            >
              <el-option
                v-for="opt in typeSchema[key].options || []"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
            <el-color-picker
              v-else-if="typeSchema[key].type === 'color'"
              v-model="typeSpecific[key]"
            />
          </component>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { COMMON_CONFIG_SCHEMA, TYPE_CONFIG_SCHEMAS } from '@/config/chart-configs'
import { COLOR_PALETTES, DEFAULT_PALETTE_INDEX } from '@/config/color-palettes'
import { getChartType } from '@/config/chart-types'

const props = defineProps({
  chartType: { type: String, required: true },
  config: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:config'])

const openPanels = ref(['title'])

// Build config object with all fields, deep clone default schema
const config = computed(() => props.config)
const update = () => emit('update:config', JSON.parse(JSON.stringify(config.value)))

// Computed sub-configs (sync via setters that emit)
const titleCfg = computed({
  get: () => ({ show: true, text: '', subtext: '', position: 'center', fontSize: 16, subFontSize: 12, ...(config.value.title || {}) }),
  set: (v) => { config.value.title = v; update() },
})

const legendCfg = computed({
  get: () => ({ show: true, position: 'bottom', ...(config.value.legend || {}) }),
  set: (v) => { config.value.legend = v; update() },
})

const tooltipCfg = computed({
  get: () => ({ show: true, trigger: 'axis', ...(config.value.tooltip || {}) }),
  set: (v) => { config.value.tooltip = v; update() },
})

const labelCfg = computed({
  get: () => ({ show: false, position: 'top', formatter: '', ...(config.value.label || {}) }),
  set: (v) => { config.value.label = v; update() },
})

const markLineCfg = computed({
  get: () => ({ show: false, type: 'average', customValue: 0, ...(config.value.markLine || {}) }),
  set: (v) => { config.value.markLine = v; update() },
})

const colorIndex = computed({
  get: () => (config.value.colorPalette !== undefined ? config.value.colorPalette : DEFAULT_PALETTE_INDEX),
  set: (v) => { config.value.colorPalette = v; update() },
})

// Type-specific schema
const typeSchema = computed(() => TYPE_CONFIG_SCHEMAS[props.chartType] || {})
const typeSchemaKeys = computed(() => Object.keys(typeSchema.value))

// Mutate typeSpecific in-place and emit
const typeSpecific = computed({
  get: () => (config.value.typeSpecific = config.value.typeSpecific || {}),
  set: () => update(),
})

// Watch deep changes to config to emit
watch(() => [props.chartType], () => {
  openPanels.value = ['title']
}, { immediate: false })

// Emit updates when type-specific values change
watch(typeSpecific, update, { deep: true })
</script>

<style scoped>
.chart-config-panel {
  padding: 0 0 12px;
}

.palette-preview {
  display: flex;
  gap: 4px;
  margin-top: 8px;
}

.palette-dot {
  width: 24px;
  height: 12px;
  border-radius: 3px;
}

.type-config-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding: 0 4px;
}

.type-config-label {
  font-size: 12px;
  color: var(--app-text-regular);
  flex-shrink: 0;
  margin-right: 8px;
}
</style>
