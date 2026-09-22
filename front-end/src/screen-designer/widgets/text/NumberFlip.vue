<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps<{
  data: any
  style: any
  props: any
}>()

const currentValue = ref(0)
const targetValue = computed(() => {
  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      return parsed.value ?? 12345
    } catch { return 12345 }
  }
  return 12345
})

const fontSize = computed(() => props.props?.fontSize || 48)
const color = computed(() => props.props?.color || '#409eff')
const prefix = computed(() => props.props?.prefix || '')
const suffix = computed(() => props.props?.suffix || '')
const duration = computed(() => props.props?.duration || 2000)
const separator = computed(() => props.props?.separator !== false)

const formatNumber = (num: number) => {
  if (!separator.value) return Math.round(num).toString()
  return Math.round(num).toLocaleString()
}

onMounted(() => {
  animateValue(0, targetValue.value, duration.value)
})

watch(targetValue, (newVal) => {
  animateValue(currentValue.value, newVal, duration.value)
})

const animateValue = (start: number, end: number, dur: number) => {
  const startTime = performance.now()
  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / dur, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    currentValue.value = start + (end - start) * eased
    if (progress < 1) requestAnimationFrame(animate)
  }
  requestAnimationFrame(animate)
}
</script>

<template>
  <div class="number-flip" :style="{ fontSize: fontSize + 'px', color }">
    <span>{{ prefix }}{{ formatNumber(currentValue) }}{{ suffix }}</span>
  </div>
</template>

<style scoped>
.number-flip { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-family: 'DIN', 'Helvetica Neue', sans-serif; font-weight: bold; }
</style>