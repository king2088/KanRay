<script setup lang="ts">
import { computed } from 'vue'
import { useCanvasStore } from '../../stores/canvas'
import { useComponentsStore } from '../../stores/components'

const canvasStore = useCanvasStore()
const componentsStore = useComponentsStore()

const componentCount = computed(() => componentsStore.components.length)
</script>

<template>
  <div class="status-bar">
    <div class="left">
      <span>缩放: {{ canvasStore.actualZoom }}%</span>
      <span>画布: {{ canvasStore.config.width }} × {{ canvasStore.config.height }}</span>
      <span>组件数: {{ componentCount }}</span>
    </div>
    <div class="right">
      <span>已选择: {{ componentsStore.selectedIds.length }} 个组件</span>
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  height: 30px;
  background: white;
  border-top: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  font-size: 12px;
  color: #606266;
}

.left, .right {
  display: flex;
  gap: 20px;
  align-items: center;
}
</style>
