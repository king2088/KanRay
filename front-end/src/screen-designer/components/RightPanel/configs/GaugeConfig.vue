<script setup lang="ts">
import './config-common.css'

defineProps<{ component: any }>()
const emit = defineEmits<{ (e: 'updateProps', key: string, value: any): void }>()
</script>

<template>
  <div class="rc-section">
    <div class="rc-section-title">仪表盘配置</div>
    <el-form label-width="70px" size="default">
      <el-form-item label="名称">
        <el-input :model-value="component.props.gaugeName || ''" @update:model-value="emit('updateProps', 'gaugeName', $event)" placeholder="仪表盘名称" />
      </el-form-item>
      <el-form-item v-if="component.type === 'gauge'" label="起始角">
        <el-input-number :model-value="component.props.startAngle ?? 225" @update:model-value="emit('updateProps', 'startAngle', $event)" :min="0" :max="360" controls-position="right" class="rc-w100" />
      </el-form-item>
      <el-form-item v-if="component.type === 'gauge'" label="结束角">
        <el-input-number :model-value="component.props.endAngle ?? -45" @update:model-value="emit('updateProps', 'endAngle', $event)" :min="-360" :max="360" controls-position="right" class="rc-w100" />
      </el-form-item>
      <el-form-item v-if="component.type === 'gauge'" label="最小值">
        <el-input-number :model-value="component.props.min ?? 0" @update:model-value="emit('updateProps', 'min', $event)" controls-position="right" class="rc-w100" />
      </el-form-item>
      <el-form-item v-if="component.type === 'gauge'" label="最大值">
        <el-input-number :model-value="component.props.max ?? 100" @update:model-value="emit('updateProps', 'max', $event)" controls-position="right" class="rc-w100" />
      </el-form-item>
      <el-form-item label="半径大小">
        <el-slider :model-value="component.props.gaugeRadius ?? 85" @update:model-value="emit('updateProps', 'gaugeRadius', $event)" :min="30" :max="100" :step="5" show-input input-size="default" />
      </el-form-item>
      <el-form-item label="弧线宽度">
        <el-slider :model-value="component.props.gaugeLineWidth ?? 10" @update:model-value="emit('updateProps', 'gaugeLineWidth', $event)" :min="2" :max="40" :step="1" show-input input-size="default" />
      </el-form-item>
      <el-form-item label="数值字号">
        <el-slider :model-value="component.props.detailFontSize ?? 11" @update:model-value="emit('updateProps', 'detailFontSize', $event)" :min="8" :max="36" :step="1" show-input input-size="default" />
      </el-form-item>
      <el-form-item label="标题字号">
        <el-slider :model-value="component.props.titleFontSize ?? 12" @update:model-value="emit('updateProps', 'titleFontSize', $event)" :min="8" :max="24" :step="1" show-input input-size="default" />
      </el-form-item>
      <el-form-item label="刻度字号">
        <el-slider :model-value="component.props.axisLabelFontSize ?? 8" @update:model-value="emit('updateProps', 'axisLabelFontSize', $event)" :min="6" :max="16" :step="1" show-input input-size="default" />
      </el-form-item>
      <el-form-item label="指针宽度">
        <el-slider :model-value="component.props.pointerWidth ?? 3" @update:model-value="emit('updateProps', 'pointerWidth', $event)" :min="1" :max="12" :step="1" show-input input-size="default" />
      </el-form-item>
      <el-form-item label="指针长度">
        <el-slider :model-value="component.props.pointerLength ?? 60" @update:model-value="emit('updateProps', 'pointerLength', $event)" :min="20" :max="90" :step="5" show-input input-size="default" />
      </el-form-item>
      <el-form-item v-if="component.type === 'gauge'" label="格式化">
        <el-input :model-value="component.props.detailFormat || '{value}%'" @update:model-value="emit('updateProps', 'detailFormat', $event)" placeholder="如: {value}%" />
      </el-form-item>
    </el-form>
  </div>
</template>