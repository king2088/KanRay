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
        opacity="0.5"
      />

      <line
        :x1="0" :y1="scanY"
        :x2="w" :y2="scanY"
        :stroke="color[0]"
        stroke-width="1"
        opacity="0.7"
      >
        <animate
          attributeName="y1"
          :values="`${0};${h};${0}`"
          dur="4s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="y2"
          :values="`${0};${h};${0}`"
          dur="4s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0;0.7;0.7;0"
          dur="4s"
          repeatCount="indefinite"
        />
      </line>

      <polyline :points="cornerLT" fill="none" :stroke="color[0]" stroke-width="2" />
      <polyline :points="cornerRT" fill="none" :stroke="color[0]" stroke-width="2" />
      <polyline :points="cornerLB" fill="none" :stroke="color[0]" stroke-width="2" />
      <polyline :points="cornerRB" fill="none" :stroke="color[0]" stroke-width="2" />
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
  color: () => ['#3a69a5', '#3a69a5'],
  backgroundColor: 'transparent',
  width: 200,
  height: 200,
})

const containerRef = ref<HTMLDivElement>()
const w = ref(props.width)
const h = ref(props.height)

const scanY = ref(0)

const outerBorder = computed(() => {
  const w1 = w.value, h1 = h.value
  return `0,0 ${w1},0 ${w1},${h1} 0,${h1}`
})

const innerBorder = computed(() => {
  const w1 = w.value, h1 = h.value
  return `10,10 ${w1 - 10},10 ${w1 - 10},${h1 - 10} 10,${h1 - 10}`
})

const cornerLT = computed(() => `0,24 0,0 24,0`)
const cornerRT = computed(() => `${w.value - 24},0 ${w.value},0 ${w.value},24`)
const cornerLB = computed(() => `0,${h.value - 24} 0,${h.value} 24,${h.value}`)
const cornerRB = computed(() => `${w.value - 24},${h.value} ${w.value},${h.value} ${w.value},${h.value - 24}`)

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
