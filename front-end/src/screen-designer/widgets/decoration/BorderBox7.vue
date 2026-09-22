<template>
  <div ref="containerRef" style="position:relative;width:100%;height:100%">
    <svg
      style="position:absolute;top:0;left:0;width:100%;height:100%"
      :viewBox="`0 0 ${w} ${h}`"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="cornerGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" :stop-color="color[0]" stop-opacity="1" />
          <stop offset="100%" :stop-color="color[0]" stop-opacity="0.2" />
        </linearGradient>
      </defs>

      <polyline
        :points="outerBorder"
        fill="none"
        :stroke="color[0]"
        stroke-width="2"
      />
      <polyline
        :points="innerBorder"
        fill="none"
        :stroke="color[0]"
        stroke-width="1"
        opacity="0.3"
      />

      <rect x="0" y="0" width="30" height="3" fill="url(#cornerGrad)" />
      <rect x="0" y="0" width="3" height="30" fill="url(#cornerGrad)" />

      <rect :x="w - 30" y="0" width="30" height="3" fill="url(#cornerGrad)" />
      <rect :x="w - 3" y="0" width="3" height="30" fill="url(#cornerGrad)" />

      <rect x="0" :y="h - 3" width="30" height="3" fill="url(#cornerGrad)" />
      <rect x="0" :y="h - 30" width="3" height="30" fill="url(#cornerGrad)" />

      <rect :x="w - 30" :y="h - 3" width="30" height="3" fill="url(#cornerGrad)" />
      <rect :x="w - 3" :y="h - 30" width="3" height="30" fill="url(#cornerGrad)" />
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
  color: () => ['#49ccf7', '#49ccf7'],
  backgroundColor: 'transparent',
  width: 200,
  height: 200,
})

const containerRef = ref<HTMLDivElement>()
const w = ref(props.width)
const h = ref(props.height)

const outerBorder = computed(() => {
  const w1 = w.value, h1 = h.value
  return `0,0 ${w1},0 ${w1},${h1} 0,${h1} 0,0`
})

const innerBorder = computed(() => {
  const w1 = w.value, h1 = h.value
  return `12,12 ${w1 - 12},12 ${w1 - 12},${h1 - 12} 12,${h1 - 12} 12,12`
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
