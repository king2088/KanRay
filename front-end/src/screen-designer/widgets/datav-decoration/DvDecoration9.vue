<template>
  <div ref="containerRef" class="dv-decoration-9">
    <svg class="deco-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient :id="`dvd9-grad-${uid}`" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" :stop-color="mergedColor[0]" stop-opacity="1" />
          <stop offset="100%" :stop-color="mergedColor[1]" stop-opacity="1" />
        </linearGradient>
      </defs>
      <!-- Outer ring -->
      <circle
        cx="50" cy="50" r="45"
        fill="none"
        :stroke="mergedColor[0]"
        stroke-width="10"
        stroke-dasharray="80,100,30,100"
        opacity="0.6"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 50 50"
          to="360 50 50"
          dur="8s"
          repeatCount="indefinite"
        />
      </circle>
      <!-- Middle ring -->
      <circle
        cx="50" cy="50" r="45"
        fill="none"
        :stroke="mergedColor[1]"
        stroke-width="6"
        stroke-dasharray="50,66,100,66"
        opacity="0.5"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="360 50 50"
          to="0 50 50"
          dur="10s"
          repeatCount="indefinite"
        />
      </circle>
      <!-- Inner ring -->
      <circle
        cx="50" cy="50" r="38"
        fill="none"
        :stroke="mergedColor[0]"
        stroke-width="1"
        stroke-dasharray="5,1"
        opacity="0.4"
      />
      <!-- Rotating polygons -->
      <g>
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 50 50"
          to="360 50 50"
          dur="12s"
          repeatCount="indefinite"
        />
        <polygon
          v-for="(p, i) in polygons"
          :key="i"
          :points="p.points"
          :fill="mergedColor[i % 2]"
          :opacity="p.opacity"
        />
      </g>
      <slot></slot>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{ color?: string[] }>(), {
  color: () => ['rgba(3,166,224,0.8)', 'rgba(3,166,224,0.5)']
})

const containerRef = ref<HTMLElement>()
const uid = Math.random().toString(36).slice(2, 8)
let observer: ResizeObserver | null = null

const mergedColor = computed(() => props.color)

const polygons = computed(() => {
  const result: Array<{ points: string; opacity: number }> = []
  const count = 20
  const centerR = 42
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count
    const cx = 50 + centerR * Math.cos(angle)
    const cy = 50 + centerR * Math.sin(angle)
    const size = 2
    const points = [
      `${cx},${cy - size}`,
      `${cx + size},${cy}`,
      `${cx},${cy + size}`,
      `${cx - size},${cy}`,
    ].join(' ')
    result.push({
      points,
      opacity: 0.4 + Math.random() * 0.4,
    })
  }
  return result
})

onMounted(() => {
  if (containerRef.value) {
    observer = new ResizeObserver(() => {})
    observer.observe(containerRef.value)
  }
})

onUnmounted(() => observer?.disconnect())
</script>

<style scoped>
.dv-decoration-9 {
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
