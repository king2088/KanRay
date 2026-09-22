<template>
  <div ref="containerRef" class="dv-decoration-11">
    <svg class="deco-svg" :viewBox="`0 0 ${w} ${h}`" preserveAspectRatio="none">
      <defs>
        <linearGradient :id="`dvd11-grad-${uid}`" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" :stop-color="mergedColor[0]" stop-opacity="0.2" />
          <stop offset="100%" :stop-color="mergedColor[1]" stop-opacity="0.2" />
        </linearGradient>
      </defs>
      <!-- Corner polygons -->
      <polygon :points="topLeftPoints" :fill="mergedColor[0]" opacity="0.6" />
      <polygon :points="bottomLeftPoints" :fill="mergedColor[0]" opacity="0.6" />
      <polygon :points="topRightPoints" :fill="mergedColor[0]" opacity="0.6" />
      <polygon :points="bottomRightPoints" :fill="mergedColor[0]" opacity="0.6" />
      <!-- Main hexagon -->
      <polygon
        :points="hexPoints"
        :fill="`url(#dvd11-grad-${uid})`"
        :stroke="mergedColor[0]"
        stroke-width="1"
      />
      <!-- Vertical polylines -->
      <polyline
        :points="`${h * 0.12},0 ${h * 0.12},${h}`"
        fill="none"
        :stroke="mergedColor[0]"
        stroke-width="1"
        opacity="0.5"
      />
      <polyline
        :points="`${w - h * 0.12},0 ${w - h * 0.12},${h}`"
        fill="none"
        :stroke="mergedColor[1]"
        stroke-width="1"
        opacity="0.5"
      />
      <slot></slot>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{ color?: string[] }>(), {
  color: () => ['#1a98fc', '#2cf7fe']
})

const containerRef = ref<HTMLElement>()
const w = ref(200)
const h = ref(100)
const uid = Math.random().toString(36).slice(2, 8)
let observer: ResizeObserver | null = null

const mergedColor = computed(() => props.color)

const topLeftPoints = computed(() => {
  const s = Math.min(w.value * 0.1, h.value * 0.2)
  return `0,0 ${s},0 0,${s}`
})

const bottomLeftPoints = computed(() => {
  const s = Math.min(w.value * 0.1, h.value * 0.2)
  return `0,${h.value} ${s},${h.value} 0,${h.value - s}`
})

const topRightPoints = computed(() => {
  const s = Math.min(w.value * 0.1, h.value * 0.2)
  return `${w.value},0 ${w.value - s},0 ${w.value},${s}`
})

const bottomRightPoints = computed(() => {
  const s = Math.min(w.value * 0.1, h.value * 0.2)
  return `${w.value},${h.value} ${w.value - s},${h.value} ${w.value},${h.value - s}`
})

const hexPoints = computed(() => {
  const cx = w.value / 2
  const cy = h.value / 2
  const rx = w.value * 0.35
  const ry = h.value * 0.4
  const points: string[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6
    points.push(`${cx + rx * Math.cos(angle)},${cy + ry * Math.sin(angle)}`)
  }
  return points.join(' ')
})

onMounted(() => {
  if (containerRef.value) {
    w.value = containerRef.value.clientWidth
    h.value = containerRef.value.clientHeight
    observer = new ResizeObserver((entries) => {
      for (const e of entries) {
        w.value = e.contentRect.width
        h.value = e.contentRect.height
      }
    })
    observer.observe(containerRef.value)
  }
})

onUnmounted(() => observer?.disconnect())
</script>

<style scoped>
.dv-decoration-11 {
  position: relative;
  width: 100%;
  height: 100%;
}
.deco-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>
