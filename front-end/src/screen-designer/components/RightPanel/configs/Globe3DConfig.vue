<script setup lang="ts">
import './config-common.css'

defineProps<{ component: any }>()
const emit = defineEmits<{ (e: 'updateProps', key: string, value: any): void }>()
</script>

<template>
  <div class="rc-section">
    <div class="rc-section-title">3D地球</div>
    <el-form label-width="70px" size="default">
      <el-form-item label="旋转速度">
        <el-slider :model-value="component.props.rotationSpeed ?? 2" @update:model-value="emit('updateProps', 'rotationSpeed', $event)" :min="0" :max="10" :step="0.5" show-stops />
      </el-form-item>
    </el-form>
  </div>
</template>