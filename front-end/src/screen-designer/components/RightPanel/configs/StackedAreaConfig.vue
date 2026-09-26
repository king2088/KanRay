<script setup lang="ts">
import './config-common.css'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{ component: any }>()
const emit = defineEmits<{ (e: 'updateProps', key: string, value: any): void }>()
</script>

<template>
  <div class="rc-section">
    <div class="rc-section-title">{{ t('bigscreen.config.stackedArea.title') }}</div>
    <el-form label-width="70px" size="default">
      <el-form-item :label="t('bigscreen.config.common.smooth')">
        <el-switch :model-value="component.props.smooth === true" @update:model-value="emit('updateProps', 'smooth', $event)" />
      </el-form-item>
      <el-form-item :label="t('bigscreen.config.stackedArea.areaFill')">
        <el-switch :model-value="component.props.areaStyle !== false" @update:model-value="emit('updateProps', 'areaStyle', $event)" />
      </el-form-item>
    </el-form>
  </div>
</template>