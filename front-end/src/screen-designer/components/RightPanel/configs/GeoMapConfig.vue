<script setup lang="ts">
import './config-common.css'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{ component: any }>()
const emit = defineEmits<{ (e: 'updateProps', key: string, value: any): void }>()
</script>

<template>
  <div class="rc-section">
    <div class="rc-section-title">{{ t('bigscreen.config.geoMap.title') }}</div>
    <el-form label-width="70px" size="default">
      <el-form-item :label="t('bigscreen.config.shape.scatterSize')">
        <el-input-number :model-value="component.props.symbolSize || 12" @update:model-value="emit('updateProps', 'symbolSize', $event)" :min="4" :max="50" controls-position="right" class="rc-w100" />
      </el-form-item>
    </el-form>
  </div>
</template>