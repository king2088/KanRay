<template>
  <div ref="containerRef" style="position:relative;width:100%;height:100%">
    <svg
      style="position:absolute;top:0;left:0;width:100%;height:100%"
      :viewBox="`0 0 ${w} ${h}`"
      preserveAspectRatio="none"
    >
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
        opacity="0.4"
      />

      <!-- Top-left corner -->
      <polygon :points="cornerLT" :fill="color[0]" opacity="0.7">
        <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2s" repeatCount="indefinite" />
      </polygon>
      <line x1="0" y1="0" :x2="28" :y2="0" :stroke="color[0]" stroke-width="2" />
      <line x1="0" y1="0" x2="0" :y2="28" :stroke="color[0]" stroke-width="2" />

      <!-- Top-right corner -->
      <polygon :points="cornerRT" :fill="color[0]" opacity="0.7">
        <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2s" begin="0.5s" repeatCount="indefinite" />
      </polygon>
      <line :x1="w" y1="0" :x2="w - 28" y2="0" :stroke="color[0]" stroke-width="2" />
      <line :x1="w" y1="0" :x2="w" :y2="28" :stroke="color[0]" stroke-width="2" />

      <!-- Bottom-left corner -->
      <polygon :points="cornerLB" :fill="color[0]" opacity="0.7">
        <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2s" begin="1s" repeatCount="indefinite" />
      </polygon>
      <line x1="0" :y1="h" :x2="28" :y2="h" :stroke="color[0]" stroke-width="2" />
      <line x1="0" :y1="h" x2="0" :y2="h - 28" :stroke="color[0]" stroke-width="2" />

      <!-- Bottom-right corner -->
      <polygon :points="cornerRB" :fill="color[0]" opacity="0.7">
        <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2s" begin="1.5s" repeatCount="indefinite" />
      </polygon>
      <line :x1="w" :y1="h" :x2="w - 28" :y2="h" :stroke="color[0]" stroke-width="2" />
      <line :x1="w" :y1="h" :x2="w" :y2="h - 28" :stroke="color[0]" stroke-width="2" />

      <!-- Animated center lines -->
      <line :x1="w / 2" y1="0" :x2="w / 2" :y2="h" :stroke="color[0]" stroke-width="0.5" opacity="0.2">
        <animate attributeName="opacity" values="0;0.3;0" dur="4s" repeatCount="indefinite" />
      </line>
      <line x1="0" :y1="h / 2" :x2="w" :y2="h / 2" :stroke="color[0]" stroke-width="0.5" opacity="0.2">
        <animate attributeName="opacity" values="0;0.3;0" dur="4s" begin="2s" repeatCount="indefinite" />
      </line>
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
  color: () => ['#3b8eea', '#3b8eea'],
  backgroundColor: 'transparent',
  width: 200,
  height: 200,
})

const containerRef = ref<HTMLDivElement>()
const w = ref(props.width)
const h = ref(props.height)

const outerBorder = computed(() => {
  const w1 = w.value, h1 = h.value
  return `0,0 ${w1},0 ${w1},${h1} 0,${h1}`
})

const innerBorder = computed(() => {
  const w1 = w.value, h1 = h.value
  return `10,10 ${w1 - 10},10 ${w1 - 10},${h1 - 10} 10,${h1 - 10}`
})

const cornerLT = computed(() => `0,0 20,0 0,20`)
const cornerRT = computed(() => `${w.value},0 ${w.value - 20},0 ${w.value},20`)
const cornerLB = computed(() => `0,${h.value} 20,${h.value} 0,${h.value - 20}`)
const cornerRB = computed(() => `${w.value},${h.value} ${w.value - 20},${h.value} ${w.value},${h.value - 20}`)

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
