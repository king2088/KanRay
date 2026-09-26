<script setup lang="ts">
import { computed } from 'vue'
import { useCanvasStore } from '../../stores/canvas'
import { useComponentsStore } from '../../stores/components'

const { t } = useI18n()

const canvasStore = useCanvasStore()
const componentsStore = useComponentsStore()

const componentCount = computed(() => componentsStore.components.length)
</script>

<template>
  <div class="status-bar">
    <div class="left">
      <span>{{ t('bigscreen.statusBar.zoom', { value: canvasStore.actualZoom }) }}</span>
      <span>{{ t('bigscreen.statusBar.canvasSize', { width: canvasStore.config.width, height: canvasStore.config.height }) }}</span>
      <span>{{ t('bigscreen.statusBar.componentCount', { count: componentCount }) }}</span>
    </div>
    <div class="right">
      <span>{{ t('bigscreen.statusBar.selected', { count: componentsStore.selectedIds.length }) }}</span>
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
