<template>
  <div class="data-source-panel">
    <div class="panel-title">数据源</div>
    <el-select
      v-model="selectedId"
      placeholder="选择一个数据集"
      style="width: 100%"
      @change="onChange"
    >
      <el-option
        v-for="d in datasets"
        :key="d.id"
        :label="`${d.name} (${d.row_count} 行)`"
        :value="d.id"
      />
    </el-select>
    <div v-if="!datasets.length" style="margin-top: 8px; color: #909399; font-size: 12px">
      还没有数据集，<el-link type="primary" @click="$router.push('/datasets/new')">去上传数据</el-link>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  datasets: { type: Array, default: () => [] },
  datasetId: { type: [Number, String], default: null },
})

const emit = defineEmits(['update:datasetId', 'datasetChange'])

const selectedId = computed({
  get: () => props.datasetId,
  set: (v) => emit('update:datasetId', v),
})

function onChange(id) {
  emit('datasetChange', id)
}
</script>

<style scoped>
.data-source-panel {
  padding: 12px 0 8px;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text-primary);
  margin-bottom: 8px;
}
</style>
