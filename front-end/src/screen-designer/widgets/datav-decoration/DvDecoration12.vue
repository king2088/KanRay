<template>
  <div ref="containerRef" class="dv-decoration-12">
    <svg class="deco-svg" :viewBox="`0 0 ${w} ${h}`" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient :id="`dvd12-halo-${uid}`">
          <stop offset="0%" :stop-color="mergedColor[1]" stop-opacity="0.3" />
          <stop offset="100%" :stop-color="mergedColor[1]" stop-opacity="0" />
        </radialGradient>
      </defs>
      <!-- Halo pulse -->
      <circle
        :cx="w / 2"
        :cy="h / 2"
        r="1"
        :fill="`url(#dvd12-halo-${uid})`"
      >
        <animate
          attributeName="r"
          :from="1"
          :to="w / 2"
          dur="3s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.6;0"
          dur="3s"
          repeatCount="indefinite"
        />
      </circle>
      <!-- Outer ring -->
      <circle
        :cx="w / 2"
        :cy="h / 2"
        :r="Math.min(w, h) / 2 - 2"
        fill="none"
        :stroke="mergedColor[0]"
        stroke-width="2"
        stroke-dasharray="4,4"
        opacity="0.6"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          :from="`0 ${w / 2} ${h / 2}`"
          :to="`360 ${w / 2} ${h / 2}`"
          dur="10s"
          repeatCount="indefinite"
        />
      </circle>
      <!-- Middle ring -->
      <circle
        :cx="w / 2"
        :cy="h / 2"
        :r="Math.min(w, h) / 2 * 0.7"
        fill="none"
        :stroke="mergedColor[0]"
        stroke-width="1.5"
        stroke-dasharray="2,6"
        opacity="0.5"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          :from="`360 ${w / 2} ${h / 2}`"
          :to="`0 ${w / 2} ${h / 2}`"
          dur="8s"
          repeatCount="indefinite"
        />
      </circle>
      <!-- Inner ring -->
      <circle
        :cx="w / 2"
        :cy="h / 2"
        :r="Math.min(w, h) / 2 * 0.4"
        fill="none"
        :stroke="mergedColor[1]"
        stroke-width="1"
        stroke-dasharray="1,3"
        opacity="0.4"
      />
      <!-- Center dot -->
      <circle
        :cx="w / 2"
        :cy="h / 2"
        r="3"
        :fill="mergedColor[0]"
      >
        <animate
          attributeName="r"
          values="2;4;2"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
      <!-- Scan line -->
      <g opacity="0.6">
        <animateTransform
          attributeName="transform"
          type="rotate"
          :from="`0 ${w / 2} ${h / 2}`"
          :to="`360 ${w / 2} ${h / 2}`"
          dur="4s"
          repeatCount="indefinite"
        />
        <line
          :x1="w / 2"
          :y1="h / 2"
          :x2="w / 2"
          :y2="2"
          :stroke="mergedColor[1]"
          stroke-width="1"
          opacity="0.8"
        />
        <path
          :d="`M ${w / 2},${h / 2} L ${w / 2 - 10},${h / 2 - 10} A ${Math.min(w, h) / 2 * 0.35} ${Math.min(w, h) / 2 * 0.35} 0 0 1 ${w / 2 + 10},${h / 2 - 10} Z`"
          :fill="mergedColor[0]"
          opacity="0.15"
        />
      </g>
      <!-- Split lines -->
      <line
        v-for="(line, i) in splitLines"
        :key="'sl' + i"
        :x1="line.x1"
        :y1="line.y1"
        :x2="line.x2"
        :y2="line.y2"
        :stroke="mergedColor[i % 2]"
        stroke-width="0.5"
        opacity="0.3"
      />
      <slot></slot>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{ color?: string[] }>(), {
  color: () => ['#2783ce', '#2cf7fe']
})

const containerRef = ref<HTMLElement>()
const w = ref(200)
const h = ref(200)
const uid = Math.random().toString(36).slice(2, 8)
let observer: ResizeObserver | null = null

const mergedColor = computed(() => props.color)

const splitLines = computed(() => {
  const cx = w.value / 2
  const cy = h.value / 2
  const r = Math.min(w.value, h.value) / 2
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI * i) / 3
    lines.push({
      x1: cx + r * Math.cos(angle),
      y1: cy + r * Math.sin(angle),
      x2: cx + (r - 15) * Math.cos(angle),
      y2: cy + (r - 15) * Math.sin(angle),
    })
  }
  return lines
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
.dv-decoration-12 {
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
