<script setup lang="ts">
import './config-common.css'

defineProps<{ component: any }>()
const emit = defineEmits<{ (e: 'updateProps', key: string, value: any): void }>()
</script>

<template>
  <div class="rc-section">
    <div class="rc-section-title">环形图中心</div>
    <el-form label-width="70px" size="small">
      <el-form-item label="显示文字">
        <el-switch :model-value="component.props.centerTextShow === true" @update:model-value="emit('updateProps', 'centerTextShow', $event)" />
      </el-form-item>
      <template v-if="component.props.centerTextShow">
        <el-form-item label="标题">
          <el-input :model-value="component.props.centerTitle || '总计'" @update:model-value="emit('updateProps', 'centerTitle', $event)" placeholder="总计" />
        </el-form-item>
        <el-form-item label="标题颜色">
          <el-color-picker :model-value="component.props.centerTitleColor || '#ffffff'" @update:model-value="emit('updateProps', 'centerTitleColor', $event)" />
        </el-form-item>
        <el-form-item label="标题字号">
          <el-input-number :model-value="component.props.centerTitleSize || 14" @update:model-value="emit('updateProps', 'centerTitleSize', $event)" :min="10" :max="30" controls-position="right" class="rc-w100" />
        </el-form-item>
        <el-form-item label="数值">
          <el-input :model-value="component.props.centerValue || ''" @update:model-value="emit('updateProps', 'centerValue', $event)" placeholder="默认显示总数" />
        </el-form-item>
        <el-form-item label="数值颜色">
          <el-color-picker :model-value="component.props.centerValueColor || '#ffffff'" @update:model-value="emit('updateProps', 'centerValueColor', $event)" />
        </el-form-item>
        <el-form-item label="数值字号">
          <el-input-number :model-value="component.props.centerValueSize || 20" @update:model-value="emit('updateProps', 'centerValueSize', $event)" :min="12" :max="40" controls-position="right" class="rc-w100" />
        </el-form-item>
      </template>
    </el-form>
  </div>
</template>