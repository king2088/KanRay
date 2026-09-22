<script setup lang="ts">
import './config-common.css'

defineProps<{ component: any }>()
const emit = defineEmits<{ (e: 'updateProps', key: string, value: any): void }>()
</script>

<template>
  <div class="rc-section">
    <div class="rc-section-title">正负条形图</div>
    <el-form label-width="70px" size="small">
      <el-form-item label="柱宽度">
        <el-input-number :model-value="component.props.barWidth" @update:model-value="emit('updateProps', 'barWidth', $event)" :min="5" :max="100" placeholder="自动" controls-position="right" class="rc-w100" />
      </el-form-item>
      <el-form-item label="收入颜色">
        <el-color-picker :model-value="component.props.positiveColor || '#67c23a'" @update:model-value="emit('updateProps', 'positiveColor', $event)" />
      </el-form-item>
      <el-form-item label="支出颜色">
        <el-color-picker :model-value="component.props.negativeColor || '#f56c6c'" @update:model-value="emit('updateProps', 'negativeColor', $event)" />
      </el-form-item>
    </el-form>
  </div>
</template>