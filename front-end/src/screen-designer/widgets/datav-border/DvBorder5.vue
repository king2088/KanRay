<template>
  <div ref="containerRef" class="dv-border-box-5">
    <svg
      :class="`dv-border-svg-container ${reverse && 'dv-reverse'}`"
      :width="w"
      :height="h"
    >
      <polygon
        :fill="backgroundColor"
        :points="`
          10, 22 ${w - 22}, 22 ${w - 22}, ${h - 86} ${w - 84}, ${h - 24} 10, ${h - 24}
        `"
      />

      <polyline
        class="dv-bb5-line-1"
        :stroke="mergedColor[0]"
        :points="`8, 5 ${w - 5}, 5 ${w - 5}, ${h - 100}
          ${w - 100}, ${h - 5} 8, ${h - 5} 8, 5`"
      />
      <polyline
        class="dv-bb5-line-2"
        :stroke="mergedColor[1]"
        :points="`3, 5 ${w - 20}, 5 ${w - 20}, ${h - 60}
          ${w - 74}, ${h - 5} 3, ${h - 5} 3, 5`"
      />
      <polyline class="dv-bb5-line-3" :stroke="mergedColor[1]" :points="`50, 13 ${w - 35}, 13`" />
      <polyline class="dv-bb5-line-4" :stroke="mergedColor[1]" :points="`15, 20 ${w - 35}, 20`" />
      <polyline class="dv-bb5-line-5" :stroke="mergedColor[1]" :points="`15, ${h - 20} ${w - 110}, ${h - 20}`" />
      <polyline class="dv-bb5-line-6" :stroke="mergedColor[1]" :points="`15, ${h - 13} ${w - 110}, ${h - 13}`" />
    </svg>

    <div class="border-box-content">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  color?: string[]
  backgroundColor?: string
  reverse?: boolean
}>(), {
  color: () => [],
  backgroundColor: 'transparent',
  reverse: false
})

const containerRef = ref<HTMLElement>()
const w = ref(200)
const h = ref(200)

const defaultColor = reactive(['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0.20)'])
const mergedColor = ref<string[]>([])

const mergeColor = () => {
  mergedColor.value = [...defaultColor].map((c, i) => (props.color && props.color[i]) || c)
}

watch(() => props.color, () => mergeColor(), { deep: true })

let observer: ResizeObserver | null = null
onMounted(() => {
  mergeColor()
  if (containerRef.value) {
    w.value = containerRef.value.clientWidth
    h.value = containerRef.value.clientHeight
    observer = new ResizeObserver(entries => {
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
.dv-border-box-5 {
  position: relative;
  width: 100%;
  height: 100%;
}
.dv-border-box-5 .dv-reverse {
  transform: rotate(180deg);
}
.dv-border-box-5 .dv-border-svg-container {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}
.dv-border-box-5 .dv-border-svg-container > polyline {
  fill: none;
}
.dv-border-box-5 .dv-bb5-line-1,
.dv-border-box-5 .dv-bb5-line-2 {
  stroke-width: 1;
}
.dv-border-box-5 .dv-bb5-line-3,
.dv-border-box-5 .dv-bb5-line-6 {
  stroke-width: 5;
}
.dv-border-box-5 .dv-bb5-line-4,
.dv-border-box-5 .dv-bb5-line-5 {
  stroke-width: 2;
}
.dv-border-box-5 .border-box-content {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
