<script setup lang="ts">
import './config-common.css'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{ component: any }>()
const emit = defineEmits<{ (e: 'updateProps', key: string, value: any): void }>()
</script>

<template>
  <div class="rc-section">
    <div class="rc-section-title">{{ t('bigscreen.config.doughnutCenter.title') }}</div>
    <el-form label-width="70px" size="default">
      <el-form-item :label="t('bigscreen.config.doughnutCenter.showText')">
        <el-switch :model-value="component.props.centerTextShow === true" @update:model-value="emit('updateProps', 'centerTextShow', $event)" />
      </el-form-item>
      <template v-if="component.props.centerTextShow">
        <el-form-item :label="t('bigscreen.config.doughnutCenter.centerTitle')">
          <el-input :model-value="component.props.centerTitle || t('bigscreen.config.doughnutCenter.total')" @update:model-value="emit('updateProps', 'centerTitle', $event)" :placeholder="t('bigscreen.config.doughnutCenter.total')" />
        </el-form-item>
        <el-form-item :label="t('bigscreen.config.doughnutCenter.titleColor')">
          <el-color-picker :model-value="component.props.centerTitleColor || '#ffffff'" @update:model-value="emit('updateProps', 'centerTitleColor', $event)" />
        </el-form-item>
        <el-form-item :label="t('bigscreen.config.doughnutCenter.titleFontSize')">
          <el-input-number :model-value="component.props.centerTitleSize || 14" @update:model-value="emit('updateProps', 'centerTitleSize', $event)" :min="10" :max="30" controls-position="right" class="rc-w100" />
        </el-form-item>
        <el-form-item :label="t('bigscreen.config.doughnutCenter.value')">
          <el-input :model-value="component.props.centerValue || ''" @update:model-value="emit('updateProps', 'centerValue', $event)" :placeholder="t('bigscreen.config.doughnutCenter.totalHint')" />
        </el-form-item>
        <el-form-item :label="t('bigscreen.config.doughnutCenter.valueColor')">
          <el-color-picker :model-value="component.props.centerValueColor || '#ffffff'" @update:model-value="emit('updateProps', 'centerValueColor', $event)" />
        </el-form-item>
        <el-form-item :label="t('bigscreen.config.doughnutCenter.valueFontSize')">
          <el-input-number :model-value="component.props.centerValueSize || 20" @update:model-value="emit('updateProps', 'centerValueSize', $event)" :min="12" :max="40" controls-position="right" class="rc-w100" />
        </el-form-item>
      </template>
    </el-form>
  </div>
</template>