<template>
  <div ref="containerRef" class="dv-decoration-10">
    <svg class="deco-svg" :viewBox="`0 0 ${w} ${h}`" preserveAspectRatio="none">
      <circle
        v-for="(c, i) in circles"
        :key="'c' + i"
        :cx="c.cx"
        :cy="c.cy"
        r="3"
        :fill="c.filled ? mergedColor[0] : mergedColor[1]"
      />
      <polyline
        v-for="(line, i) in lines"
        :key="'l' + i"
        :points="line.points"
        fill="none"
        :stroke="mergedColor[0]"
        stroke-width="2"
      >
        <animate
          attributeName="stroke-dasharray"
          :values="line.dashValues"
          :dur="line.dur + 's'"
          begin="0s"
          repeatCount="indefinite"
        />
      </polyline>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{ color?: string[] }>(), {
  color: () => ['#00c2ff', 'rgba(0,194,255,0.3)']
})

const containerRef = ref<HTMLElement>()
const w = ref(200)
const h = ref(20)
let observer: ResizeObserver | null = null

const mergedColor = computed(() => props.color)

const circles = computed(() => [
  { cx: 0, cy: h.value / 2, filled: false },
  { cx: w.value * 0.2, cy: h.value / 2, filled: false },
  { cx: w.value * 0.8, cy: h.value / 2, filled: false },
  { cx: w.value, cy: h.value / 2, filled: false },
])

const lines = computed(() => {
  const cy = h.value / 2
  const seg1 = w.value * 0.2
  const seg2 = w.value * 0.6
  const seg3 = w.value * 0.2
  return [
    {
      points: `0,${cy} ${w.value * 0.2},${cy}`,
      dashValues: `0,${seg1},0,${seg1};${seg1},0,${seg1},0;0,${seg1},0,${seg1}`,
      dur: 2,
    },
    {
      points: `${w.value * 0.2},${cy} ${w.value * 0.8},${cy}`,
      dashValues: `0,${seg2},0,${seg2};${seg2},0,${seg2},0;0,${seg2},0,${seg2}`,
      dur: 4,
    },
    {
      points: `${w.value * 0.8},${cy} ${w.value},${cy}`,
      dashValues: `0,${seg3},0,${seg3};${seg3},0,${seg3},0;0,${seg3},0,${seg3}`,
      dur: 2,
    },
  ]
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
.dv-decoration-10 {
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
