<script setup lang="ts">
import './config-common.css'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{ component: any }>()
const emit = defineEmits<{ (e: 'updateProps', key: string, value: any): void }>()
</script>

<template>
  <div class="rc-section">
    <div class="rc-section-title">{{ t('bigscreen.config.mixedPositiveNegative.title') }}</div>
    <el-form label-width="70px" size="default">
      <el-form-item :label="t('bigscreen.config.common.barWidth')">
        <el-input-number :model-value="component.props.barWidth" @update:model-value="emit('updateProps', 'barWidth', $event)" :min="5" :max="100" :placeholder="t('bigscreen.config.common.auto')" controls-position="right" class="rc-w100" />
      </el-form-item>
    </el-form>
  </div>
</template>