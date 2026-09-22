<script setup lang="ts">
import './config-common.css'

defineProps<{ component: any }>()
const emit = defineEmits<{ (e: 'updateProps', key: string, value: any): void }>()
</script>

<template>
  <div class="rc-section">
    <div class="rc-section-title">地理坐标图</div>
    <el-form label-width="70px" size="small">
      <el-form-item label="散点大小">
        <el-input-number :model-value="component.props.symbolSize || 12" @update:model-value="emit('updateProps', 'symbolSize', $event)" :min="4" :max="50" controls-position="right" class="rc-w100" />
      </el-form-item>
    </el-form>
  </div>
</template>