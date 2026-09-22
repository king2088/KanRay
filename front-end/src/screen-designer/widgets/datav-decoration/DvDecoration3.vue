<template>
  <div ref="containerRef" class="dv-decoration-3">
    <svg class="deco-svg" :viewBox="`0 0 300 35`" preserveAspectRatio="none">
      <g :transform="`scale(${w / 300}, ${h / 35})`">
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
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{ color?: string[] }>(), {
  color: () => ['#7acaec', 'transparent']
})

const containerRef = ref<HTMLElement>()
const w = ref(300)
const h = ref(35)
let observer: ResizeObserver | null = null

const mergedColor = computed(() => props.color)

const points = computed(() => {
  const result: Array<{
    x: number; y: number; w: number; h: number
    fill: string; opacity: number
    animate?: boolean; animateValues?: string; dur?: string; begin?: string
  }> = []
  const rows = 2
  const cols = 25
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = 12 * c
      const y = 12 * r
      const shouldAnimate = Math.random() > 0.6
      const dur = (0.5 + Math.random() * 1.5).toFixed(1)
      const begin = (Math.random() * 2).toFixed(1)
      result.push({
        x,
        y,
        w: 7,
        h: 7,
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
.dv-decoration-3 {
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
