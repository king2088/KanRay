<script setup lang="ts">
import './config-common.css'

defineProps<{ component: any }>()
const emit = defineEmits<{ (e: 'updateProps', key: string, value: any): void }>()
</script>

<template>
  <div class="rc-section">
    <div class="rc-section-title">交错正负标签图</div>
    <el-form label-width="70px" size="small">
      <el-form-item label="柱宽度">
        <el-input-number :model-value="component.props.barWidth" @update:model-value="emit('updateProps', 'barWidth', $event)" :min="5" :max="100" placeholder="自动" controls-position="right" class="rc-w100" />
      </el-form-item>
    </el-form>
  </div>
</template>