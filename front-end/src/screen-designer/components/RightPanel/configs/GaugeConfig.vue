<script setup lang="ts">
import './config-common.css'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{ component: any }>()
const emit = defineEmits<{ (e: 'updateProps', key: string, value: any): void }>()
</script>

<template>
  <div class="rc-section">
    <div class="rc-section-title">{{ t('bigscreen.config.gauge.title') }}</div>
    <el-form label-width="70px" size="default">
      <el-form-item :label="t('bigscreen.config.common.name')">
        <el-input :model-value="component.props.gaugeName || ''" @update:model-value="emit('updateProps', 'gaugeName', $event)" :placeholder="t('bigscreen.config.gauge.name')" />
      </el-form-item>
      <el-form-item v-if="component.type === 'gauge'" :label="t('bigscreen.config.gauge.startAngle')">
        <el-input-number :model-value="component.props.startAngle ?? 225" @update:model-value="emit('updateProps', 'startAngle', $event)" :min="0" :max="360" controls-position="right" class="rc-w100" />
      </el-form-item>
      <el-form-item v-if="component.type === 'gauge'" :label="t('bigscreen.config.gauge.endAngle')">
        <el-input-number :model-value="component.props.endAngle ?? -45" @update:model-value="emit('updateProps', 'endAngle', $event)" :min="-360" :max="360" controls-position="right" class="rc-w100" />
      </el-form-item>
      <el-form-item v-if="component.type === 'gauge'" :label="t('bigscreen.config.gauge.min')">
        <el-input-number :model-value="component.props.min ?? 0" @update:model-value="emit('updateProps', 'min', $event)" controls-position="right" class="rc-w100" />
      </el-form-item>
      <el-form-item v-if="component.type === 'gauge'" :label="t('bigscreen.config.gauge.max')">
        <el-input-number :model-value="component.props.max ?? 100" @update:model-value="emit('updateProps', 'max', $event)" controls-position="right" class="rc-w100" />
      </el-form-item>
      <el-form-item :label="t('bigscreen.config.gauge.radiusSize')">
        <el-slider :model-value="component.props.gaugeRadius ?? 85" @update:model-value="emit('updateProps', 'gaugeRadius', $event)" :min="30" :max="100" :step="5" show-input input-size="default" />
      </el-form-item>
      <el-form-item :label="t('bigscreen.config.gauge.arcWidth')">
        <el-slider :model-value="component.props.gaugeLineWidth ?? 10" @update:model-value="emit('updateProps', 'gaugeLineWidth', $event)" :min="2" :max="40" :step="1" show-input input-size="default" />
      </el-form-item>
      <el-form-item :label="t('bigscreen.config.gauge.valueFontSize')">
        <el-slider :model-value="component.props.detailFontSize ?? 11" @update:model-value="emit('updateProps', 'detailFontSize', $event)" :min="8" :max="36" :step="1" show-input input-size="default" />
      </el-form-item>
      <el-form-item :label="t('bigscreen.config.gauge.titleFontSize')">
        <el-slider :model-value="component.props.titleFontSize ?? 12" @update:model-value="emit('updateProps', 'titleFontSize', $event)" :min="8" :max="24" :step="1" show-input input-size="default" />
      </el-form-item>
      <el-form-item :label="t('bigscreen.config.gauge.tickFontSize')">
        <el-slider :model-value="component.props.axisLabelFontSize ?? 8" @update:model-value="emit('updateProps', 'axisLabelFontSize', $event)" :min="6" :max="16" :step="1" show-input input-size="default" />
      </el-form-item>
      <el-form-item :label="t('bigscreen.config.gauge.pointerWidth')">
        <el-slider :model-value="component.props.pointerWidth ?? 3" @update:model-value="emit('updateProps', 'pointerWidth', $event)" :min="1" :max="12" :step="1" show-input input-size="default" />
      </el-form-item>
      <el-form-item :label="t('bigscreen.config.gauge.pointerLength')">
        <el-slider :model-value="component.props.pointerLength ?? 60" @update:model-value="emit('updateProps', 'pointerLength', $event)" :min="20" :max="90" :step="5" show-input input-size="default" />
      </el-form-item>
      <el-form-item v-if="component.type === 'gauge'" :label="t('bigscreen.config.gauge.format')">
        <el-input :model-value="component.props.detailFormat || '{value}%'" @update:model-value="emit('updateProps', 'detailFormat', $event)" :placeholder="t('bigscreen.config.format.valueExample')" />
      </el-form-item>
    </el-form>
  </div>
</template>