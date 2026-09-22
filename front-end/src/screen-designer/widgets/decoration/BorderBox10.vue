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
        :stroke="color[1]"
        stroke-width="1"
        opacity="0.5"
      />

      <line
        x1="0" y1="0" :x2="20" :y2="20"
        :stroke="color[0]"
        stroke-width="2"
      >
        <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
      </line>
      <line
        :x1="w" y1="0" :x2="w - 20" :y2="20"
        :stroke="color[0]"
        stroke-width="2"
      >
        <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" begin="0.5s" repeatCount="indefinite" />
      </line>
      <line
        x1="0" :y1="h" :x2="20" :y2="h - 20"
        :stroke="color[0]"
        stroke-width="2"
      >
        <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" begin="1s" repeatCount="indefinite" />
      </line>
      <line
        :x1="w" :y1="h" :x2="w - 20" :y2="h - 20"
        :stroke="color[0]"
        stroke-width="2"
      >
        <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" begin="1.5s" repeatCount="indefinite" />
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
  color: () => ['#46b6fea', '#46b6fea'],
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
  return `8,8 ${w1 - 8},8 ${w1 - 8},${h1 - 8} 8,${h1 - 8} 8,8`
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
