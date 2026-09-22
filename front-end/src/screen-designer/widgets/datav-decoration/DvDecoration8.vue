<template>
  <div ref="containerRef" class="dv-decoration-8">
    <svg class="deco-svg" :viewBox="`0 0 ${w} ${h}`" preserveAspectRatio="none">
      <polyline
        :points="line1Points"
        fill="none"
        :stroke="mergedColor[0]"
        stroke-width="2"
      />
      <polyline
        :points="line2Points"
        fill="none"
        :stroke="mergedColor[0]"
        stroke-width="2"
      />
      <polyline
        :points="line3Points"
        fill="none"
        :stroke="mergedColor[1]"
        stroke-width="3"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{ color?: string[]; reverse?: boolean }>(), {
  color: () => ['#3f96a5', '#3f96a5'],
  reverse: false,
})

const containerRef = ref<HTMLElement>()
const w = ref(200)
const h = ref(30)
let observer: ResizeObserver | null = null

const mergedColor = computed(() => props.color)

function xPos(pos: number): number {
  return props.reverse ? w.value - pos : pos
}

const line1Points = computed(() => {
  return `${xPos(0)},0 ${xPos(30)},${h.value / 2}`
})

const line2Points = computed(() => {
  return `${xPos(20)},0 ${xPos(50)},${h.value / 2} ${xPos(w.value)},${h.value / 2}`
})

const line3Points = computed(() => {
  return `${xPos(0)},${h.value - 3} ${xPos(200)},${h.value - 3}`
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
.dv-decoration-8 {
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
