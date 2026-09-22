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
        opacity="0.3"
      />

      <rect
        x="0" y="0" width="20" height="3"
        :fill="color[0]"
        opacity="0.9"
      >
        <animate
          attributeName="x"
          :values="`0;${w - 20};0`"
          dur="6s"
          repeatCount="indefinite"
        />
      </rect>
      <rect
        x="0" y="0" width="3" height="20"
        :fill="color[0]"
        opacity="0.9"
      >
        <animate
          attributeName="y"
          :values="`0;${h - 20};0`"
          dur="6s"
          repeatCount="indefinite"
        />
      </rect>
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
  color: () => ['#5ea5f0', '#5ea5f0'],
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
  return `10,10 ${w1 - 10},10 ${w1 - 10},${h1 - 10} 10,${h1 - 10} 10,10`
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
