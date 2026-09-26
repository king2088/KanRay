<script setup lang="ts">
import { inject } from 'vue'
import './config-common.css'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{ component: any }>()
const openCodeDialog = inject<(id: string) => void>('openCodeDialog', () => {})
</script>

<template>
  <div class="rc-section">
    <div class="rc-section-title">{{ t('bigscreen.config.customChart.title') }}</div>
    <el-alert type="info" :closable="false" class="rc-mb-sm">{{ t('bigscreen.config.customChart.editTip') }}</el-alert>
    <div class="rc-tags">
      <el-tag v-if="component.props?.html" type="success" size="small">HTML</el-tag>
      <el-tag v-if="component.props?.css" type="warning" size="small">CSS</el-tag>
      <el-tag v-if="component.props?.js" type="primary" size="small">JS</el-tag>
      <el-tag v-if="!component.props?.html && !component.props?.css && !component.props?.js" type="info" size="small">{{ t('bigscreen.config.customChart.notWritten') }}</el-tag>
    </div>
    <el-button type="primary" @click="openCodeDialog(component.id)">{{ t('bigscreen.config.action.openEditor') }}</el-button>
  </div>
</template>

<style scoped>
.rc-mb-sm {
  margin-bottom: 10px;
}

.rc-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
</style>