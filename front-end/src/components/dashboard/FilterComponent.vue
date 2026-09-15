<template>
  <div class="filter-component">
    <div class="filter-name">{{ label }}：</div>
    <div class="filter-body">
      <el-select
        v-if="values.length"
        :model-value="modelValue"
        placeholder="请选择"
        clearable
        filterable
        
        style="width: 100%"
        @update:model-value="onChange"
      >
        <el-option v-for="v in values" :key="v" :label="String(v ?? '(空)')" :value="v" />
      </el-select>
      <span v-else class="filter-empty">暂无可选值</span>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { datasetApi } from '@/api'

const props = defineProps({
  modelValue: { type: [String, Number, null], default: null },
  field: { type: String, required: true },
  datasetId: { type: Number, required: true },
  label: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const values = ref([])

function onChange(v) {
  emit('update:modelValue', v)
}

onMounted(async () => {
  try {
    const res = await datasetApi.query(props.datasetId, {
      dimensions: [{ field: props.field }],
      metrics: [{ field: '*', agg: 'count' }],
      groupLimit: 500,
    })
    values.value = res.rows.map((r) => r[`dim:${props.field}`]?.value)
  } catch (e) {
    values.value = []
  }
})
</script>

<style scoped>
.filter-component {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 100%;
  padding: 8px 12px;
}

.filter-name {
  font-size: 14px;
  color: #606266;
  white-space: nowrap;
  font-weight: 600;
}

.filter-body {
  flex: 1;
  min-width: 0;
}

.filter-empty {
  font-size: 12px;
  color: #c0c4cc;
}
</style>