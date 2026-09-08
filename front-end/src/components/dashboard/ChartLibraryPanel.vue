<template>
  <aside class="chart-library-panel">
    <div class="clp-section">
      <div class="clp-title"><el-icon :size="15"><PieChart /></el-icon> 图表库</div>

      <div v-if="available.length" class="clp-list">
        <div
          v-for="c in available"
          :key="c.id"
          class="chart-palette-item"
          draggable="true"
          @dragstart="onPaletteDrag($event, c)"
          @click="$emit('add-chart', c)"
        >
          <el-icon :size="14"><PieChart /></el-icon>
          <span class="clp-name">{{ c.name }}</span>
        </div>
      </div>
      <div v-else class="clp-empty">
        <el-empty description="没有可用图表" :image-size="46" />
      </div>

      <div v-if="used.length" class="clp-list clp-list--used">
        <div v-for="c in used" :key="c.id" class="chart-palette-item is-used">
          <el-icon :size="14"><PieChart /></el-icon>
          <span class="clp-name">{{ c.name }}</span>
          <el-tag size="small" type="info">已在看板</el-tag>
        </div>
      </div>
    </div>

    <div class="clp-section">
      <div class="clp-title"><el-icon :size="15"><Grid /></el-icon> 组件</div>
      <div class="clp-list">
        <div class="clp-action" @click="$emit('add-text')">
          <el-icon :size="15"><EditPen /></el-icon>
          <span>添加文本</span>
        </div>
        <div class="clp-action" @click="$emit('add-filter')">
          <el-icon :size="15"><Filter /></el-icon>
          <span>添加筛选</span>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { PieChart, Grid, EditPen, Filter } from '@element-plus/icons-vue'

const props = defineProps({
  charts: { type: Array, required: true },
  items: { type: Array, required: true },
})

defineEmits(['add-chart', 'add-text', 'add-filter'])

const used = computed(() => {
  const ids = new Set(props.items.filter((i) => i.type === 'chart').map((i) => i.chartId))
  return props.charts.filter((c) => ids.has(c.id))
})

const available = computed(() => {
  const ids = new Set(props.items.filter((i) => i.type === 'chart').map((i) => i.chartId))
  return props.charts.filter((c) => !ids.has(c.id))
})

function onPaletteDrag(e, chart) {
  e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'chart', chartId: chart.id }))
  e.dataTransfer.effectAllowed = 'copy'
}
</script>

<style scoped>
.chart-library-panel {
  width: 260px;
  flex-shrink: 0;
  background: var(--app-card);
  border: 1px solid var(--app-border-light);
  border-radius: var(--app-radius);
  padding: 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.clp-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.clp-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-primary);
}

.clp-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.clp-list--used {
  margin-top: 2px;
}

.clp-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chart-palette-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--app-primary-light);
  border: 1px solid var(--app-primary);
  color: var(--app-primary);
  border-radius: var(--app-radius);
  padding: 6px 10px;
  font-size: 12px;
  cursor: grab;
  user-select: none;
  max-width: 100%;
  opacity: 0.92;
}

.chart-palette-item:hover {
  border-color: var(--app-primary);
}

.chart-palette-item.is-used {
  background: transparent;
  border-color: var(--app-border-light);
  color: var(--app-text-secondary);
  cursor: default;
  opacity: 0.85;
}

.clp-empty {
  color: var(--app-text-secondary);
  font-size: 12px;
}

.clp-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px dashed var(--app-border);
  border-radius: var(--app-radius);
  padding: 7px 10px;
  font-size: 12px;
  color: var(--app-text-regular);
  cursor: pointer;
  user-select: none;
  transition: border-color 0.15s, color 0.15s;
}

.clp-action:hover {
  border-color: var(--app-primary);
  color: var(--app-primary);
}
</style>