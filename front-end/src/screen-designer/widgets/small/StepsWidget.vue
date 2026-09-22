<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  data: any
  style: any
  props: any
}>()

const defaultSteps = ['数据采集', '数据处理', '数据分析', '结果展示']
const steps = computed(() => props.props?.steps || defaultSteps)
const activeStep = computed(() => props.props?.activeStep ?? 2)
const completedSteps = computed(() => props.props?.completedSteps ?? [0, 1])
</script>

<template>
  <div class="steps-widget">
    <div class="steps-row">
      <template v-for="(step, idx) in steps" :key="idx">
        <div class="step-item" :class="{ active: idx === activeStep, completed: completedSteps.includes(idx) }">
          <div class="step-circle">
            <span v-if="completedSteps.includes(idx)" class="check-icon">&#10003;</span>
            <span v-else>{{ Number(idx) + 1 }}</span>
          </div>
          <span class="step-label">{{ step }}</span>
        </div>
        <div v-if="Number(idx) < steps.length - 1" class="step-line" :class="{ filled: completedSteps.includes(idx) }"></div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.steps-widget {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  padding: 20px;
  box-sizing: border-box;
}
.steps-row {
  display: flex;
  align-items: flex-start;
  width: 100%;
  max-width: 600px;
}
.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  min-width: 70px;
}
.step-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  border: 2px solid #444;
  color: #666;
  background: transparent;
  transition: all 0.3s;
}
.step-item.completed .step-circle {
  border-color: #52c41a;
  color: #52c41a;
  background: rgba(82, 196, 26, 0.1);
}
.step-item.active .step-circle {
  border-color: #40a9ff;
  color: #fff;
  background: #40a9ff;
  box-shadow: 0 0 12px rgba(64, 169, 255, 0.5);
}
.check-icon {
  font-size: 16px;
}
.step-label {
  font-size: 12px;
  color: #888;
  white-space: nowrap;
}
.step-item.completed .step-label {
  color: #52c41a;
}
.step-item.active .step-label {
  color: #40a9ff;
  font-weight: 600;
}
.step-line {
  flex: 1;
  height: 2px;
  background: #444;
  margin-top: 17px;
  min-width: 20px;
  transition: background 0.3s;
}
.step-line.filled {
  background: #52c41a;
}
</style>
