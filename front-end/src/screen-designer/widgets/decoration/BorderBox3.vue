<template>
  <div ref="containerRef" style="position:relative;width:100%;height:100%">
    <svg
      style="position:absolute;top:0;left:0;width:100%;height:100%"
      :viewBox="`0 0 ${w} ${h}`"
      preserveAspectRatio="none"
    >
      <polygon :points="polygonPoints" :fill="bgColor" stroke="none" />
      <polyline :points="border1" fill="none" :stroke="color[0]" stroke-width="1" opacity="0.8" />
      <polyline :points="border2" fill="none" :stroke="color[0]" stroke-width="1" opacity="0.5" />
      <polyline :points="border3" fill="none" :stroke="color[0]" stroke-width="1" opacity="0.3" />
      <polyline :points="border4" fill="none" :stroke="color[0]" stroke-width="1" opacity="0.15" />
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
  color: () => ['#2862b7', '#2862b7'],
  backgroundColor: 'rgba(10,30,60,0.6)',
  width: 200,
  height: 200,
})

const containerRef = ref<HTMLDivElement>()
const w = ref(props.width)
const h = ref(props.height)

const bgColor = computed(() => props.backgroundColor)

const polygonPoints = computed(() => {
  const w1 = w.value, h1 = h.value
  return `4,0 ${w1 - 4},0 ${w1},4 ${w1},${h1 - 4} ${w1 - 4},${h1} 4,${h1} 0,${h1 - 4} 0,4`
})

const border1 = computed(() => {
  const w1 = w.value, h1 = h.value
  return `4,0 ${w1 - 4},0 ${w1},4 ${w1},${h1 - 4} ${w1 - 4},${h1} 4,${h1} 0,${h1 - 4} 0,4 4,0`
})

const border2 = computed(() => {
  const w1 = w.value, h1 = h.value
  const px = 8, py = 8
  return `${px},${py} ${w1 - px},${py} ${w1 - py},${py + px} ${w1 - py},${h1 - py - px} ${w1 - px},${h1 - py} ${px},${h1 - py} ${py},${h1 - py - px} ${py},${py + px} ${px},${py}`
})

const border3 = computed(() => {
  const w1 = w.value, h1 = h.value
  const px = 14, py = 14
  return `${px},${py} ${w1 - px},${py} ${w1 - py},${py + px} ${w1 - py},${h1 - py - px} ${w1 - px},${h1 - py} ${px},${h1 - py} ${py},${h1 - py - px} ${py},${py + px} ${px},${py}`
})

const border4 = computed(() => {
  const w1 = w.value, h1 = h.value
  const px = 20, py = 20
  return `${px},${py} ${w1 - px},${py} ${w1 - py},${py + px} ${w1 - py},${h1 - py - px} ${w1 - px},${h1 - py} ${px},${h1 - py} ${py},${h1 - py - px} ${py},${py + px} ${px},${py}`
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
