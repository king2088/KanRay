<script setup lang="ts">
import './config-common.css'

defineProps<{ component: any }>()
const emit = defineEmits<{ (e: 'updateProps', key: string, value: any): void }>()
</script>

<template>
  <div class="rc-section">
    <div class="rc-section-title">极坐标柱状图</div>
    <el-form label-width="70px" size="default">
      <el-form-item label="形状">
        <el-select :model-value="component.props.shape || 'circle'" @update:model-value="emit('updateProps', 'shape', $event)" class="rc-w100">
          <el-option label="圆形" value="circle" />
          <el-option label="多边形" value="polygon" />
        </el-select>
      </el-form-item>
      <el-form-item label="起始角度">
        <el-input-number :model-value="component.props.startAngle ?? 75" @update:model-value="emit('updateProps', 'startAngle', $event)" :min="0" :max="360" controls-position="right" class="rc-w100" />
      </el-form-item>
      <el-form-item label="柱条宽度">
        <el-input-number :model-value="component.props.barWidth" @update:model-value="emit('updateProps', 'barWidth', $event)" :min="2" :max="100" placeholder="自动" controls-position="right" class="rc-w100" />
      </el-form-item>
      <el-form-item label="柱端圆角">
        <el-input-number :model-value="component.props.barBorderRadius ?? (component.props.shape === 'circle' ? 6 : 0)" @update:model-value="emit('updateProps', 'barBorderRadius', $event)" :min="0" :max="50" controls-position="right" class="rc-w100" />
      </el-form-item>
      <el-form-item label="外径百分比">
        <el-input-number :model-value="component.props.radiusMax ?? 80" @update:model-value="emit('updateProps', 'radiusMax', $event)" :min="20" :max="100" controls-position="right" class="rc-w100" />
      </el-form-item>
      <el-form-item label="角度标签">
        <div class="rc-row">
          <el-switch :model-value="component.props.angleLabelShow !== false" @update:model-value="emit('updateProps', 'angleLabelShow', $event)" />
          <el-input-number :model-value="component.props.angleLabelSize ?? 11" @update:model-value="emit('updateProps', 'angleLabelSize', $event)" :min="10" :max="30" controls-position="right" class="rc-flex-1" />
          <el-color-picker :model-value="component.props.angleLabelColor || '#999'" @update:model-value="emit('updateProps', 'angleLabelColor', $event)" />
        </div>
      </el-form-item>
      <el-form-item label="数值标签">
        <div class="rc-row">
          <el-switch :model-value="component.props.radiusLabelShow !== false" @update:model-value="emit('updateProps', 'radiusLabelShow', $event)" />
          <el-input-number :model-value="component.props.radiusLabelSize ?? 11" @update:model-value="emit('updateProps', 'radiusLabelSize', $event)" :min="10" :max="30" controls-position="right" class="rc-flex-1" />
          <el-color-picker :model-value="component.props.radiusLabelColor || '#999'" @update:model-value="emit('updateProps', 'radiusLabelColor', $event)" />
        </div>
      </el-form-item>
      <el-form-item label="分隔线">
        <div class="rc-row">
          <el-switch :model-value="component.props.radiusSplitShow !== false" @update:model-value="emit('updateProps', 'radiusSplitShow', $event)" />
          <el-color-picker :model-value="component.props.radiusSplitColor || 'rgba(128,148,171,0.35)'" @update:model-value="emit('updateProps', 'radiusSplitColor', $event)" />
        </div>
      </el-form-item>
      <el-form-item label="数据标签">
        <div class="rc-row">
          <el-switch :model-value="component.props.labelShow !== false" @update:model-value="emit('updateProps', 'labelShow', $event)" />
          <el-input-number :model-value="component.props.labelFontSize ?? 11" @update:model-value="emit('updateProps', 'labelFontSize', $event)" :min="10" :max="30" controls-position="right" class="rc-flex-1" />
          <el-color-picker :model-value="component.props.labelColor || '#fff'" @update:model-value="emit('updateProps', 'labelColor', $event)" />
        </div>
      </el-form-item>
    </el-form>
  </div>
</template>