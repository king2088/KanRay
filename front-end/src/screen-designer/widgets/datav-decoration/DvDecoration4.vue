<template>
  <div ref="containerRef" class="dv-decoration-4">
    <svg class="deco-svg" :viewBox="`0 0 ${w} ${h}`" preserveAspectRatio="none">
      <defs>
        <linearGradient :id="`dvd4-grad-${uid}`" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" :stop-color="mergedColor[0]" stop-opacity="1" />
          <stop offset="100%" :stop-color="mergedColor[1]" stop-opacity="1" />
        </linearGradient>
      </defs>
      <template v-if="!reverse">
        <polyline
          :points="`${w / 2},0 ${w / 2},${h}`"
          fill="none"
          :stroke="mergedColor[0]"
          stroke-width="5"
          opacity="0.3"
        />
        <polyline
          :points="`${w / 2},0 ${w / 2},${h}`"
          fill="none"
          :stroke="`url(#dvd4-grad-${uid})`"
          stroke-width="2"
          stroke-dasharray="20,80"
          stroke-dashoffset="-30"
          opacity="0.8"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="-100"
            to="0"
            :dur="dur + 's'"
            repeatCount="indefinite"
          />
        </polyline>
      </template>
      <template v-else>
        <polyline
          :points="`0,${h / 2} ${w},${h / 2}`"
          fill="none"
          :stroke="mergedColor[0]"
          stroke-width="5"
          opacity="0.3"
        />
        <polyline
          :points="`0,${h / 2} ${w},${h / 2}`"
          fill="none"
          :stroke="`url(#dvd4-grad-${uid})`"
          stroke-width="2"
          stroke-dasharray="20,80"
          stroke-dashoffset="-30"
          opacity="0.8"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="-100"
            to="0"
            :dur="dur + 's'"
            repeatCount="indefinite"
          />
        </polyline>
      </template>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{ color?: string[]; reverse?: boolean; dur?: number }>(),
  {
    color: () => ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.3)'],
    reverse: false,
    dur: 3,
  }
)

const containerRef = ref<HTMLElement>()
const w = ref(10)
const h = ref(200)
const uid = Math.random().toString(36).slice(2, 8)
let observer: ResizeObserver | null = null

const mergedColor = computed(() => props.color)

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
.dv-decoration-4 {
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
