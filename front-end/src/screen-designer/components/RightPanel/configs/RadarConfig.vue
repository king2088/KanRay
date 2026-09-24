<script setup lang="ts">
import './config-common.css'

defineProps<{ component: any }>()
const emit = defineEmits<{ (e: 'updateProps', key: string, value: any): void }>()
</script>

<template>
  <div class="rc-section">
    <div class="rc-section-title">雷达图</div>
    <el-form label-width="70px" size="default">
      <el-form-item label="形状">
        <el-select :model-value="component.props.shape || 'polygon'" @update:model-value="emit('updateProps', 'shape', $event)" class="rc-w100">
          <el-option label="多边形" value="polygon" />
          <el-option label="圆形" value="circle" />
        </el-select>
      </el-form-item>
      <el-form-item label="填充">
        <div class="rc-row">
          <el-switch :model-value="component.props.areaStyle === true" @update:model-value="emit('updateProps', 'areaStyle', $event)" />
          <el-input-number v-if="component.props.areaStyle === true" :model-value="component.props.areaOpacity ?? 0.3" @update:model-value="emit('updateProps', 'areaOpacity', $event)" :min="0" :max="1" :step="0.1" controls-position="right" class="rc-flex-1" />
        </div>
      </el-form-item>
      <el-form-item label="分割线">
        <div class="rc-row">
          <el-switch :model-value="component.props.splitLineShow !== false" @update:model-value="emit('updateProps', 'splitLineShow', $event)" />
          <template v-if="component.props.splitLineShow !== false">
            <el-input-number :model-value="component.props.splitLineWidth ?? 1" @update:model-value="emit('updateProps', 'splitLineWidth', $event)" :min="0.5" :max="10" :step="0.5" controls-position="right" class="rc-flex-1" />
            <el-color-picker :model-value="component.props.splitLineColor || 'rgba(128,148,171,0.45)'" @update:model-value="emit('updateProps', 'splitLineColor', $event)" />
          </template>
        </div>
      </el-form-item>
      <el-form-item label="区块色">
        <div class="rc-row">
          <el-color-picker :model-value="component.props.splitAreaColors?.[0] || '#1a1a2e'" @update:model-value="emit('updateProps', 'splitAreaColors', [$event, component.props.splitAreaColors?.[1] || '#1e2a3a'])" />
          <el-color-picker :model-value="component.props.splitAreaColors?.[1] || '#1e2a3a'" @update:model-value="emit('updateProps', 'splitAreaColors', [component.props.splitAreaColors?.[0] || '#1a1a2e', $event])" />
          <span class="rc-label-muted">交替区块色</span>
        </div>
      </el-form-item>
      <el-form-item label="指标字体">
        <div class="rc-row">
          <el-input-number :model-value="component.props.axisNameSize ?? 12" @update:model-value="emit('updateProps', 'axisNameSize', $event)" :min="10" :max="30" controls-position="right" class="rc-flex-1" />
          <el-color-picker :model-value="component.props.axisNameColor || '#999' " @update:model-value="emit('updateProps', 'axisNameColor', $event)" />
        </div>
      </el-form-item>
      <el-form-item label="半径层数">
        <el-input-number :model-value="component.props.splitNumber ?? 5" @update:model-value="emit('updateProps', 'splitNumber', $event)" :min="1" :max="12" controls-position="right" class="rc-w100" />
      </el-form-item>
      <el-form-item label="数据线条">
        <div class="rc-row">
          <el-input-number :model-value="component.props.seriesLineWidth ?? 2" @update:model-value="emit('updateProps', 'seriesLineWidth', $event)" :min="1" :max="10" controls-position="right" class="rc-flex-1" />
          <el-color-picker :model-value="component.props.seriesItemColor || component.props.seriesLineColor || ''" @update:model-value="emit('updateProps', 'seriesItemColor', $event)" />
        </div>
      </el-form-item>
      <el-form-item label="数据点">
        <div class="rc-row">
          <el-switch :model-value="component.props.symbolShow !== false" @update:model-value="emit('updateProps', 'symbolShow', $event)" />
          <el-input-number :model-value="component.props.symbolSize ?? 4" @update:model-value="emit('updateProps', 'symbolSize', $event)" :min="2" :max="20" controls-position="right" class="rc-flex-1" />
        </div>
      </el-form-item>
    </el-form>
  </div>
</template>