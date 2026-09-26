<script setup lang="ts">
import './config-common.css'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{ component: any }>()
const emit = defineEmits<{ (e: 'updateProps', key: string, value: any): void }>()
</script>

<template>
  <div class="rc-section">
    <div class="rc-section-title">{{ t('bigscreen.config.positiveNegativeBar.title') }}</div>
    <el-form label-width="70px" size="default">
      <el-form-item :label="t('bigscreen.config.common.barWidth')">
        <el-input-number :model-value="component.props.barWidth" @update:model-value="emit('updateProps', 'barWidth', $event)" :min="5" :max="100" :placeholder="t('bigscreen.config.common.auto')" controls-position="right" class="rc-w100" />
      </el-form-item>
      <el-form-item :label="t('bigscreen.config.positiveNegativeBar.incomeColor')">
        <el-color-picker :model-value="component.props.positiveColor || '#67c23a'" @update:model-value="emit('updateProps', 'positiveColor', $event)" />
      </el-form-item>
      <el-form-item :label="t('bigscreen.config.positiveNegativeBar.expenseColor')">
        <el-color-picker :model-value="component.props.negativeColor || '#f56c6c'" @update:model-value="emit('updateProps', 'negativeColor', $event)" />
      </el-form-item>
    </el-form>
  </div>
</template>