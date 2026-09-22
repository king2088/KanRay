<script setup lang="ts">
import './config-common.css'

defineProps<{ component: any }>()
const emit = defineEmits<{ (e: 'updateProps', key: string, value: any): void }>()
</script>

<template>
  <div class="rc-section">
    <div class="rc-section-title">中心显示配置</div>
    <el-form label-width="70px" size="small">
      <el-form-item label="圆心直径">
        <el-input-number :model-value="component.props.centerSize ?? 40" @update:model-value="emit('updateProps', 'centerSize', $event)" :min="10" :max="80" controls-position="right" class="rc-w100" />
      </el-form-item>
      <el-form-item label="名称">
        <div class="rc-row-gap-sm">
          <el-color-picker :model-value="component.props.centerNameColor || '#aaaaaa'" @update:model-value="emit('updateProps', 'centerNameColor', $event)" />
          <el-input-number :model-value="component.props.centerNameSize ?? 12" @update:model-value="emit('updateProps', 'centerNameSize', $event)" :min="8" :max="24" controls-position="right" class="rc-flex-1" />
        </div>
      </el-form-item>
      <el-form-item label="数值">
        <div class="rc-row-gap-sm">
          <el-color-picker :model-value="component.props.centerValueColor || '#ffffff'" @update:model-value="emit('updateProps', 'centerValueColor', $event)" />
          <el-input-number :model-value="component.props.centerValueSize ?? 22" @update:model-value="emit('updateProps', 'centerValueSize', $event)" :min="12" :max="48" controls-position="right" class="rc-flex-1" />
        </div>
      </el-form-item>
      <el-form-item label="环宽度">
        <el-input-number :model-value="component.props.ringWidth ?? 12" @update:model-value="emit('updateProps', 'ringWidth', $event)" :min="4" :max="30" controls-position="right" class="rc-w100" />
      </el-form-item>
    </el-form>
  </div>
</template>