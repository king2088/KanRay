<template>
  <div ref="containerRef" class="dv-decoration-2">
    <svg class="deco-svg" :viewBox="`0 0 ${w} ${h}`" preserveAspectRatio="none">
      <rect
        v-if="!reverse"
        x="0"
        :y="h / 2"
        :width="w"
        height="1"
        :fill="mergedColor[0]"
      >
        <animate
          attributeName="width"
          from="0"
          :to="w"
          :dur="dur + 's'"
          calcMode="spline"
          keySplines="0.7,0,0.3,1"
          keyTimes="0;1"
          repeatCount="indefinite"
        />
      </rect>
      <rect
        v-if="!reverse"
        x="0"
        :y="h / 2"
        width="1"
        height="1"
        :fill="mergedColor[1]"
      >
        <animate
          attributeName="x"
          from="0"
          :to="w"
          :dur="dur + 's'"
          calcMode="spline"
          keySplines="0.7,0,0.3,1"
          keyTimes="0;1"
          repeatCount="indefinite"
        />
      </rect>
      <rect
        v-if="reverse"
        :x="w / 2"
        y="0"
        width="1"
        :height="h"
        :fill="mergedColor[0]"
      >
        <animate
          attributeName="height"
          from="0"
          :to="h"
          :dur="dur + 's'"
          calcMode="spline"
          keySplines="0.7,0,0.3,1"
          keyTimes="0;1"
          repeatCount="indefinite"
        />
      </rect>
      <rect
        v-if="reverse"
        :x="w / 2"
        y="0"
        width="1"
        height="1"
        :fill="mergedColor[1]"
      >
        <animate
          attributeName="y"
          from="0"
          :to="h"
          :dur="dur + 's'"
          calcMode="spline"
          keySplines="0.7,0,0.3,1"
          keyTimes="0;1"
          repeatCount="indefinite"
        />
      </rect>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{ color?: string[]; reverse?: boolean; dur?: number }>(),
  {
    color: () => ['#3faacb', '#fff'],
    reverse: false,
    dur: 6,
  }
)

const containerRef = ref<HTMLElement>()
const w = ref(200)
const h = ref(10)
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
.dv-decoration-2 {
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
