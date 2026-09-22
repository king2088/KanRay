<template>
  <div ref="containerRef" class="dv-decoration-6">
    <svg class="deco-svg" viewBox="0 0 300 35" preserveAspectRatio="none">
      <rect
        v-for="(bar, i) in bars"
        :key="i"
        :x="bar.x"
        :y="bar.y"
        :width="bar.rectWidth"
        :height="bar.height"
        :fill="bar.fill"
        :opacity="0.8"
      >
        <animate
          attributeName="y"
          :values="`${bar.y};${bar.targetY};${bar.y}`"
          :dur="bar.dur + 's'"
          repeatCount="indefinite"
        />
        <animate
          attributeName="height"
          :values="`${bar.height};${bar.targetHeight};${bar.height}`"
          :dur="bar.dur + 's'"
          repeatCount="indefinite"
        />
      </rect>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ color?: string[] }>(), {
  color: () => ['#7acaec', '#7acaec']
})

const mergedColor = computed(() => props.color)

const bars = computed(() => {
  const result: Array<{
    x: number; y: number; rectWidth: number; height: number
    fill: string; dur: number; targetY: number; targetHeight: number
  }> = []
  const rectWidth = 7
  const count = 40
  for (let i = 0; i < count; i++) {
    const height = 3 + Math.random() * 10
    const y = 35 - height - Math.random() * 5
    const targetHeight = 5 + Math.random() * 12
    const targetY = 35 - targetHeight - Math.random() * 3
    const dur = 1.5 + Math.random()
    const colorIdx = Math.random() > 0.5 ? 0 : 1
    result.push({
      x: i * 7.5,
      y,
      rectWidth,
      height,
      fill: mergedColor.value[colorIdx],
      dur,
      targetY,
      targetHeight,
    })
  }
  return result
})
</script>

<style scoped>
.dv-decoration-6 {
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
