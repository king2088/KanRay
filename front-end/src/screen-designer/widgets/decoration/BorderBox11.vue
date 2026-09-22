<template>
  <div ref="containerRef" style="position:relative;width:100%;height:100%">
    <svg
      style="position:absolute;top:0;left:0;width:100%;height:100%"
      :viewBox="`0 0 ${w} ${h}`"
      preserveAspectRatio="none"
    >
      <polyline
        :points="borderPoints"
        fill="none"
        :stroke="color[0]"
        stroke-width="1"
      />

      <template v-for="tick in topTicks" :key="`t-${tick}`">
        <line :x1="tick" y1="0" :x2="tick" :y2="6" :stroke="color[0]" stroke-width="1" opacity="0.6" />
      </template>
      <template v-for="tick in bottomTicks" :key="`b-${tick}`">
        <line :x1="tick" :y1="h" :x2="tick" :y2="h - 6" :stroke="color[0]" stroke-width="1" opacity="0.6" />
      </template>
      <template v-for="tick in leftTicks" :key="`l-${tick}`">
        <line x1="0" :y1="tick" x2="6" :y2="tick" :stroke="color[0]" stroke-width="1" opacity="0.6" />
      </template>
      <template v-for="tick in rightTicks" :key="`r-${tick}`">
        <line :x1="w" :y1="tick" :x2="w - 6" :y2="tick" :stroke="color[0]" stroke-width="1" opacity="0.6" />
      </template>
    </svg>
    <div style="position:relative;width:100%;height:100%;padding:12px;box-sizing:border-box">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  color?: string[]
  backgroundColor?: string
  width?: number
  height?: number
}>(), {
  color: () => ['#4281b0', '#4281b0'],
  backgroundColor: 'transparent',
  width: 200,
  height: 200,
})

const containerRef = ref<HTMLDivElement>()
const w = ref(props.width)
const h = ref(props.height)

const borderPoints = computed(() => {
  const w1 = w.value, h1 = h.value
  return `0,0 ${w1},0 ${w1},${h1} 0,${h1} 0,0`
})

const topTicks = computed(() => {
  const w1 = w.value
  const ticks: number[] = []
  for (let i = 30; i < w1; i += 30) {
    ticks.push(i)
  }
  return ticks
})

const bottomTicks = computed(() => {
  return topTicks.value
})

const leftTicks = computed(() => {
  const h1 = h.value
  const ticks: number[] = []
  for (let i = 30; i < h1; i += 30) {
    ticks.push(i)
  }
  return ticks
})

const rightTicks = computed(() => {
  return leftTicks.value
})

let observer: ResizeObserver | null = null

onMounted(() => {
  if (containerRef.value) {
    w.value = containerRef.value.clientWidth
    h.value = containerRef.value.clientHeight
    observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        w.value = entry.contentRect.width
        h.value = entry.contentRect.height
      }
    })
    observer.observe(containerRef.value)
  }
})

onUnmounted(() => {
  observer?.disconnect()
})
</script>
