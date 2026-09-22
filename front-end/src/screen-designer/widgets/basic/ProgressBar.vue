<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  data: any
  style: any
  props: any
}>()

const value = computed(() => {
  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      return parsed.value ?? 75
    } catch { return 75 }
  }
  return 75
})

const barColor = computed(() => props.props?.barColor || '#409eff')
const bgColor = computed(() => props.props?.bgColor || '#333')
const height = computed(() => props.props?.barHeight || 20)
const borderRadius = computed(() => props.props?.borderRadius || 10)
const showText = computed(() => props.props?.showText !== false)
const textColor = computed(() => props.props?.textColor || '#fff')
const fontSize = computed(() => props.props?.fontSize || 14)
</script>

<template>
  <div class="progress-bar-container">
    <div class="progress-bar-bg" :style="{ background: bgColor, height: height + 'px', borderRadius: borderRadius + 'px' }">
      <div class="progress-bar-fill" :style="{ width: value + '%', background: barColor, borderRadius: borderRadius + 'px' }"></div>
    </div>
    <div v-if="showText" class="progress-text" :style="{ color: textColor, fontSize: fontSize + 'px' }">{{ value }}%</div>
  </div>
</template>

<style scoped>
.progress-bar-container { width: 100%; height: 100%; display: flex; align-items: center; gap: 10px; padding: 0 10px; }
.progress-bar-bg { flex: 1; overflow: hidden; position: relative; }
.progress-bar-fill { height: 100%; transition: width 0.5s ease; }
.progress-text { white-space: nowrap; font-weight: 500; }
</style>