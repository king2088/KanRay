<template>
  <div ref="containerRef" style="position:relative;width:100%;height:100%">
    <svg
      style="position:absolute;top:0;left:0;width:100%;height:100%"
      :viewBox="`0 0 ${w} ${h}`"
      preserveAspectRatio="none"
    >
      <polygon
        :points="polygonPoints"
        :fill="bgColor"
        stroke="none"
      />

      <polygon :points="cornerLT" :fill="color[0]" opacity="0.6">
        <animate
          attributeName="fill"
          :values="`${color[0]};${color[1]};${color[0]}`"
          dur="3s"
          repeatCount="indefinite"
        />
      </polygon>
      <polygon :points="cornerRT" :fill="color[1]" opacity="0.6">
        <animate
          attributeName="fill"
          :values="`${color[1]};${color[0]};${color[1]}`"
          dur="3s"
          repeatCount="indefinite"
        />
      </polygon>
      <polygon :points="cornerLB" :fill="color[0]" opacity="0.6">
        <animate
          attributeName="fill"
          :values="`${color[0]};${color[1]};${color[0]}`"
          dur="3s"
          begin="0.5s"
          repeatCount="indefinite"
        />
      </polygon>
      <polygon :points="cornerRB" :fill="color[1]" opacity="0.6">
        <animate
          attributeName="fill"
          :values="`${color[1]};${color[0]};${color[1]}`"
          dur="3s"
          begin="0.5s"
          repeatCount="indefinite"
        />
      </polygon>
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
  color: () => ['#4fd2dd', '#235fa7'],
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

const cornerLT = computed(() => {
  return `0,0 40,0 0,40`
})
const cornerRT = computed(() => {
  return `${w.value},0 ${w.value - 40},0 ${w.value},40`
})
const cornerLB = computed(() => {
  return `0,${h.value} 40,${h.value} 0,${h.value - 40}`
})
const cornerRB = computed(() => {
  return `${w.value},${h.value} ${w.value - 40},${h.value} ${w.value},${h.value - 40}`
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
