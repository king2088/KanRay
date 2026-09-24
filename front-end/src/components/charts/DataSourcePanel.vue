<template>
  <div class="data-source-panel">
    <div class="panel-title">数据源</div>
    <el-select-v2
      v-model="selectedId"
      placeholder="选择一个数据集"
      filterable
      :options="datasetOptions"
      style="width: 100%"
      @change="onChange"
    >
      <template #default="{ item }">
        <DatasetOption :item="item" />
      </template>
    </el-select-v2>
    <div v-if="!datasets.length" style="margin-top: 8px; color: #909399; font-size: 12px">
      还没有数据集，<el-link type="primary" @click="$router.push('/datasources')">去「数据源」页上传</el-link>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { toDatasetOptions } from '@/utils/dataset-type'
import DatasetOption from '@/components/DatasetOption.vue'

const props = defineProps({
  datasets: { type: Array, default: () => [] },
  datasetId: { type: [Number, String], default: null },
})

const emit = defineEmits(['update:datasetId', 'datasetChange'])

const selectedId = computed({
  get: () => props.datasetId,
  set: (v) => emit('update:datasetId', v),
})

const datasetOptions = computed(() => toDatasetOptions(props.datasets, { withRowCount: true }))

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
