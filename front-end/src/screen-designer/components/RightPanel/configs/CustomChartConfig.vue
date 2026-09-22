<script setup lang="ts">
import { inject } from 'vue'
import './config-common.css'

defineProps<{ component: any }>()
const openCodeDialog = inject<(id: string) => void>('openCodeDialog', () => {})
</script>

<template>
  <div class="rc-section">
    <div class="rc-section-title">自定义代码</div>
    <el-alert type="info" :closable="false" class="rc-mb-sm">
      支持 HTML + CSS + JavaScript，双击组件或点击下方按钮编辑
    </el-alert>
    <div class="rc-tags">
      <el-tag v-if="component.props?.html" type="success" size="small">HTML</el-tag>
      <el-tag v-if="component.props?.css" type="warning" size="small">CSS</el-tag>
      <el-tag v-if="component.props?.js" type="primary" size="small">JS</el-tag>
      <el-tag v-if="!component.props?.html && !component.props?.css && !component.props?.js" type="info" size="small">未编写</el-tag>
    </div>
    <el-button type="primary" @click="openCodeDialog(component.id)">
      打开代码编辑器
    </el-button>
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