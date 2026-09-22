<template>
  <div ref="containerRef" class="dv-decoration-1">
    <svg class="deco-svg" :viewBox="`0 0 200 50`" preserveAspectRatio="none">
      <defs>
        <linearGradient :id="`dvd1-grad-${uid}`" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" :stop-color="mergedColor[0]" stop-opacity="1" />
          <stop offset="100%" :stop-color="mergedColor[1]" stop-opacity="1" />
        </linearGradient>
      </defs>
      <g :transform="`scale(${w / 200}, ${h / 50})`">
        <rect
          v-for="(rect, i) in points"
          :key="i"
          :x="rect.x"
          :y="rect.y"
          :width="rect.w"
          :height="rect.h"
          :fill="rect.fill"
          :opacity="rect.opacity"
        >
          <animate
            v-if="rect.animate"
            attributeName="fill"
            :values="rect.animateValues"
            :dur="rect.dur"
            :begin="rect.begin"
            repeatCount="indefinite"
          />
        </rect>
        <rect
          v-for="(rect, i) in growRects"
          :key="'g' + i"
          :x="rect.x"
          :y="rect.y"
          width="0"
          :height="rect.h"
          :fill="`url(#dvd1-grad-${uid})`"
        >
          <animate
            attributeName="width"
            from="0"
            :to="rect.toW"
            :dur="rect.dur"
            begin="0s"
            repeatCount="indefinite"
          />
        </rect>
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{ color?: string[] }>(), {
  color: () => ['#fff', '#0de7c2']
})

const containerRef = ref<HTMLElement>()
const w = ref(200)
const h = ref(50)
const uid = Math.random().toString(36).slice(2, 8)
let observer: ResizeObserver | null = null

const mergedColor = computed(() => props.color)

const points = computed(() => {
  const result: Array<{
    x: number; y: number; w: number; h: number
    fill: string; opacity: number
    animate?: boolean; animateValues?: string; dur?: string; begin?: string
  }> = []
  const rows = 4
  const cols = 20
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = 10 * c
      const y = 12 * r
      const shouldAnimate = Math.random() > 0.5
      const dur = (0.5 + Math.random() * 1.5).toFixed(1)
      const begin = (Math.random() * 2).toFixed(1)
      result.push({
        x,
        y,
        w: 2.5,
        h: 2.5,
        fill: shouldAnimate ? mergedColor.value[0] : mergedColor.value[1],
        opacity: shouldAnimate ? 0.6 : 0.3,
        animate: shouldAnimate,
        animateValues: shouldAnimate
          ? `${mergedColor.value[0]};${mergedColor.value[0]};transparent;transparent;${mergedColor.value[0]}`
          : undefined,
        dur: shouldAnimate ? `${dur}s` : undefined,
        begin: shouldAnimate ? `${begin}s` : undefined,
      })
    }
  }
  return result
})

const growRects = computed(() => {
  const rects: Array<{
    x: number; y: number; h: number; toW: number; dur: string
  }> = []
  for (let i = 0; i < 2; i++) {
    const x = 10 + Math.random() * 180
    const y = Math.random() * 50
    const toW = 30 + Math.random() * 40
    const dur = (2 + Math.random() * 2).toFixed(1)
    rects.push({ x, y, h: 2.5, toW, dur: `${dur}s` })
  }
  return rects
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
.dv-decoration-1 {
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
