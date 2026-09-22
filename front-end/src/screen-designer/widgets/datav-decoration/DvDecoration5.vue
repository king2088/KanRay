<template>
  <div ref="containerRef" class="dv-decoration-5">
    <svg class="deco-svg" :viewBox="`0 0 ${w} ${h}`" preserveAspectRatio="none">
      <polyline
        :points="line1Points"
        fill="none"
        :stroke="mergedColor[0]"
        stroke-width="3"
      >
        <animate
          attributeName="stroke-dasharray"
          :values="line1From"
          dur="1.2s"
          calcMode="spline"
          keySplines="0.4,0,0.2,1;0.4,0,0.2,1"
          keyTimes="0;0.5;1"
          repeatCount="indefinite"
        />
      </polyline>
      <polyline
        :points="line2Points"
        fill="none"
        :stroke="mergedColor[1]"
        stroke-width="2"
      >
        <animate
          attributeName="stroke-dasharray"
          :values="line2From"
          dur="1.2s"
          calcMode="spline"
          keySplines="0.4,0,0.2,1;0.4,0,0.2,1"
          keyTimes="0;0.5;1"
          repeatCount="indefinite"
        />
      </polyline>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{ color?: string[] }>(), {
  color: () => ['#3f96a5', '#3f96a5']
})

const containerRef = ref<HTMLElement>()
const w = ref(200)
const h = ref(50)
let observer: ResizeObserver | null = null

const mergedColor = computed(() => props.color)

const line1Points = computed(() => {
  const wp = w.value
  const hp = h.value
  return [
    `0,${hp * 0.2}`,
    `${wp * 0.18},${hp * 0.2}`,
    `${wp * 0.2},${hp * 0.4}`,
    `${wp * 0.25},${hp * 0.4}`,
    `${wp * 0.27},${hp * 0.6}`,
    `${wp * 0.72},${hp * 0.6}`,
    `${wp * 0.75},${hp * 0.4}`,
    `${wp * 0.8},${hp * 0.4}`,
    `${wp * 0.82},${hp * 0.2}`,
    `${wp},${hp * 0.2}`,
  ].join(' ')
})

const line1From = computed(() => {
  const len = w.value
  return `0,${len / 2},0,${len / 2};0,0,${len},0;0,${len / 2},0,${len / 2}`
})

const line2Points = computed(() => {
  return `${w.value * 0.3},${h.value * 0.8} ${w.value * 0.7},${h.value * 0.8}`
})

const line2From = computed(() => {
  const len = w.value * 0.4
  return `0,${len / 2},0,${len / 2};0,0,${len},0;0,${len / 2},0,${len / 2}`
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
.dv-decoration-5 {
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
