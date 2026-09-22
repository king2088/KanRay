<template>
  <div ref="containerRef" style="position:relative;width:100%;height:100%">
    <svg
      style="position:absolute;top:0;left:0;width:100%;height:100%"
      :viewBox="`0 0 ${w} ${h}`"
      preserveAspectRatio="none"
    >
      <polyline
        :points="mainBorder"
        fill="none"
        :stroke="color[0]"
        stroke-width="2"
        stroke-dasharray="12,6"
      >
        <animate
          attributeName="stroke-dashoffset"
          values="0;36"
          dur="2s"
          repeatCount="indefinite"
        />
      </polyline>

      <polyline :points="cornerLT" fill="none" :stroke="color[0]" stroke-width="3" />
      <polyline :points="cornerRT" fill="none" :stroke="color[0]" stroke-width="3" />
      <polyline :points="cornerLB" fill="none" :stroke="color[0]" stroke-width="3" />
      <polyline :points="cornerRB" fill="none" :stroke="color[0]" stroke-width="3" />
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
  color: () => ['#2a5bff', '#2a5bff'],
  backgroundColor: 'transparent',
  width: 200,
  height: 200,
})

const containerRef = ref<HTMLDivElement>()
const w = ref(props.width)
const h = ref(props.height)

const mainBorder = computed(() => {
  const w1 = w.value, h1 = h.value
  return `0,0 ${w1},0 ${w1},${h1} 0,${h1} 0,0`
})

const cornerLT = computed(() => `0,20 0,0 20,0`)
const cornerRT = computed(() => `${w.value - 20},0 ${w.value},0 ${w.value},20`)
const cornerLB = computed(() => `0,${h.value - 20} 0,${h.value} 20,${h.value}`)
const cornerRB = computed(() => `${w.value - 20},${h.value} ${w.value},${h.value} ${w.value},${h.value - 20}`)

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
