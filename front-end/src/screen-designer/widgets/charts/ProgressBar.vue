<!-- 进度条 (progress) - 基础进度条组件 -->
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  componentType?: string
  data: any
  style: any
  props: any
}>()

const value = computed(() => props.props?.value || 70)
const maxValue = computed(() => props.props?.maxValue || 100)
const percentage = computed(() => Math.min((value.value / maxValue.value) * 100, 100))
</script>

<template>
  <div class="progress-bar">
    <div class="progress-label" v-if="props.props?.showLabel !== false">
      {{ props.props?.label || '进度' }} {{ percentage.toFixed(0) }}%
    </div>
    <div class="progress-track" :style="{ height: (props.props?.trackHeight || 20) + 'px' }">
      <div class="progress-fill" :style="{
        width: percentage + '%',
        background: props.props?.color || 'linear-gradient(90deg, #1890ff, #52c41a)',
        borderRadius: (props.props?.borderRadius || 10) + 'px'
      }">
        <div class="progress-glow" v-if="props.props?.glow"></div>
      </div>
    </div>
    <div class="progress-value" v-if="props.props?.showValue !== false">
      {{ value }} / {{ maxValue }}
    </div>
  </div>
</template>

<style scoped>
.progress-bar {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 5px;
  box-sizing: border-box;
}

.progress-label {
  font-size: 12px;
  color: #aaa;
  margin-bottom: 5px;
}

.progress-track {
  width: 100%;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.5s ease;
  position: relative;
}

.progress-glow {
  position: absolute;
  top: 0;
  right: 0;
  width: 20px;
  height: 100%;
  background: rgba(255, 255, 255, 0.4);
  filter: blur(4px);
}

.progress-value {
  font-size: 11px;
  color: #666;
  margin-top: 3px;
  text-align: right;
}
</style>