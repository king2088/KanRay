<template>
  <div class="chart-type-panel">
    <!-- 分类筛选下拉 -->
    <div class="category-select">
      <el-select
        v-model="activeCategory"
        placeholder="全部分类"
        style="width: 100%"
        clearable
        @change="onCategoryChange"
      >
        <el-option label="全部分类" :value="''" />
        <el-option
          v-for="cat in CHART_CATEGORIES"
          :key="cat.key"
          :label="cat.label"
          :value="cat.key"
        />
      </el-select>
    </div>

    <!-- 图表类型网格 -->
    <el-scrollbar class="chart-type-scroll">
      <div class="chart-type-grid">
        <div
          v-for="t in filteredTypes"
          :key="t.value"
          class="chart-type-item"
          :class="{ active: chartType === t.value }"
          @click="$emit('update:chartType', t.value)"
          :title="t.label"
        >
          <ChartTypeIcon :name="t.value" :size="50" />
          <span>{{ t.label }}</span>
        </div>
      </div>
    </el-scrollbar>

    <div v-if="filteredTypes.length === 0" class="empty-hint">
      该分类暂无图表类型
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { CHART_TYPES, CHART_CATEGORIES } from '@/config/chart-types'
import ChartTypeIcon from '@/components/charts/ChartTypeIcon.vue'

defineProps({
  chartType: { type: String, required: true },
})

defineEmits(['update:chartType'])

const activeCategory = ref('')

const filteredTypes = computed(() => {
  if (activeCategory.value === '') return CHART_TYPES
  return CHART_TYPES.filter((t) => t.category === activeCategory.value)
})

function onCategoryChange(val) {
  // val is already set by v-model
}
</script>

<style scoped>
.chart-type-panel {
  padding-bottom: 12px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.category-select {
  margin-bottom: 10px;
}

.chart-type-scroll {
  flex: 1;
  min-height: 0;
}

.chart-type-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding-right: 10px;
}

.chart-type-item {
  border: 1px solid var(--app-border-light);
  border-radius: var(--app-radius);
  padding: 4px;
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

.empty-hint {
  text-align: center;
  color: var(--app-text-secondary);
  font-size: 12px;
  padding: 20px 0;
}
</style>