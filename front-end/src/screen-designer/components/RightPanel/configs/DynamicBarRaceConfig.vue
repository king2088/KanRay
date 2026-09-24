<script setup lang="ts">
import './config-common.css'

defineProps<{ component: any }>()
const emit = defineEmits<{ (e: 'updateProps', key: string, value: any): void }>()
</script>

<template>
  <div class="rc-section">
    <div class="rc-section-title">动态排序条形图</div>
    <el-form label-width="70px" size="default">
      <el-form-item label="柱宽度">
        <el-input-number :model-value="component.props.barWidth || 16" @update:model-value="emit('updateProps', 'barWidth', $event)" :min="5" :max="50" controls-position="right" class="rc-w100" />
      </el-form-item>
      <el-form-item label="刷新间隔">
        <el-input-number :model-value="component.props.animationDuration || 1000" @update:model-value="emit('updateProps', 'animationDuration', $event)" :min="500" :max="5000" :step="100" controls-position="right" class="rc-w100" />
        <div class="rc-form-tip">单位: ms</div>
      </el-form-item>
    </el-form>
  </div>
</template>