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
        stroke-width="2"
      />

      <polygon :points="hexLT" :fill="color[0]" opacity="0.6">
        <animate attributeName="opacity" values="0.3;0.8;0.3" dur="3s" repeatCount="indefinite" />
      </polygon>
      <polygon :points="hexRT" :fill="color[0]" opacity="0.6">
        <animate attributeName="opacity" values="0.3;0.8;0.3" dur="3s" begin="0.75s" repeatCount="indefinite" />
      </polygon>
      <polygon :points="hexLB" :fill="color[0]" opacity="0.6">
        <animate attributeName="opacity" values="0.3;0.8;0.3" dur="3s" begin="1.5s" repeatCount="indefinite" />
      </polygon>
      <polygon :points="hexRB" :fill="color[0]" opacity="0.6">
        <animate attributeName="opacity" values="0.3;0.8;0.3" dur="3s" begin="2.25s" repeatCount="indefinite" />
      </polygon>
    </svg>
    <div style="position:relative;width:100%;height:100%;padding:16px;box-sizing:border-box">
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
  color: () => ['#2c4983', '#2c4983'],
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

const hexLT = computed(() => `0,0 12,0 18,6 12,12 0,12 0,0`)
const hexRT = computed(() => {
  return `${w.value - 12},0 ${w.value},0 ${w.value},12 ${w.value - 12},12 ${w.value - 18},6 ${w.value - 12},0`
})
const hexLB = computed(() => {
  return `0,${h.value - 12} 12,${h.value - 12} 18,${h.value - 6} 12,${h.value} 0,${h.value} 0,${h.value - 12}`
})
const hexRB = computed(() => {
  return `${w.value - 12},${h.value - 12} ${w.value},${h.value - 12} ${w.value},${h.value} ${w.value - 12},${h.value} ${w.value - 18},${h.value - 6} ${w.value - 12},${h.value - 12}`
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
