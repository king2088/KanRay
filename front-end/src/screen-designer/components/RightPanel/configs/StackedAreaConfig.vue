<script setup lang="ts">
import './config-common.css'

defineProps<{ component: any }>()
const emit = defineEmits<{ (e: 'updateProps', key: string, value: any): void }>()
</script>

<template>
  <div class="rc-section">
    <div class="rc-section-title">堆叠面积图</div>
    <el-form label-width="70px" size="small">
      <el-form-item label="平滑">
        <el-switch :model-value="component.props.smooth === true" @update:model-value="emit('updateProps', 'smooth', $event)" />
      </el-form-item>
      <el-form-item label="区域填充">
        <el-switch :model-value="component.props.areaStyle !== false" @update:model-value="emit('updateProps', 'areaStyle', $event)" />
      </el-form-item>
    </el-form>
  </div>
</template>