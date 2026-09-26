<template>
  <div class="data-source-panel">
    <div class="panel-title">{{ t('chart.dataSource.title') }}</div>
    <el-select-v2
      v-model="selectedId"
      :placeholder="t('chart.dataSource.selectDataset')"
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
      {{ t('chart.dataSource.emptyPrefix') }}<el-link type="primary" @click="$router.push('/datasources')">{{ t('chart.dataSource.goUpload') }}</el-link>
    </div>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
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
