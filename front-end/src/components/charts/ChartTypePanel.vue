<template>
  <div class="chart-type-panel">
    <!-- 分类筛选 tabs -->
    <div class="category-tabs">
      <div
        class="cat-tab"
        :class="{ active: activeCategory === null }"
        @click="activeCategory = null"
      >全部</div>
      <div
        v-for="cat in CHART_CATEGORIES"
        :key="cat.key"
        class="cat-tab"
        :class="{ active: activeCategory === cat.key }"
        @click="activeCategory = cat.key"
      >{{ cat.label }}</div>
    </div>

    <!-- 空状态 -->
    <el-empty v-if="filteredTypes.length === 0" description="该分类暂无图表类型" :image-size="60" />

    <!-- 图表类型网格 -->
    <div class="chart-type-grid">
      <div
        v-for="t in filteredTypes"
        :key="t.value"
        class="chart-type-item"
        :class="{ active: chartType === t.value }"
        @click="$emit('update:chartType', t.value)"
      >
        <el-icon :size="20"><component :is="t.icon" /></el-icon>
        <span>{{ t.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { CHART_TYPES, CHART_CATEGORIES } from '@/config/chart-types'

defineProps({
  chartType: { type: String, required: true },
})

defineEmits(['update:chartType'])

const activeCategory = ref(null)

const filteredTypes = computed(() => {
  if (activeCategory.value === null) return CHART_TYPES
  return CHART_TYPES.filter((t) => t.category === activeCategory.value)
})
</script>

<style scoped>
.chart-type-panel {
  padding-bottom: 12px;
}

.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 10px;
}

.cat-tab {
  padding: 3px 10px;
  font-size: 12px;
  border-radius: 12px;
  cursor: pointer;
  background: var(--app-hover);
  color: var(--app-text-regular);
  transition: all 0.15s;
  white-space: nowrap;
}

.cat-tab:hover {
  color: var(--app-primary);
}

.cat-tab.active {
  background: var(--app-primary);
  color: #fff;
}

.chart-type-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.chart-type-item {
  border: 1px solid var(--app-border-light);
  border-radius: var(--app-radius);
  padding: 8px 4px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--app-text-regular);
}

.chart-type-item:hover {
  border-color: var(--app-primary);
  color: var(--app-primary);
}

.chart-type-item.active {
  border-color: var(--app-primary);
  background: var(--app-primary-light);
  color: var(--app-primary);
}
</style>
