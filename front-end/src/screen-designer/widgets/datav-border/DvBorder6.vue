<template>
  <div ref="containerRef" class="dv-border-box-6">
    <svg class="dv-border-svg-container" :width="w" :height="h">
      <polygon
        :fill="backgroundColor"
        :points="`
          9, 7 ${w - 9}, 7 ${w - 9}, ${h - 7} 9, ${h - 7}
        `"
      />

      <circle :fill="mergedColor[1]" cx="5" cy="5" r="2" />
      <circle :fill="mergedColor[1]" :cx="w - 5" cy="5" r="2" />
      <circle :fill="mergedColor[1]" :cx="w - 5" :cy="h - 5" r="2" />
      <circle :fill="mergedColor[1]" cx="5" :cy="h - 5" r="2" />
      <polyline :stroke="mergedColor[0]" :points="`10, 4 ${w - 10}, 4`" />
      <polyline :stroke="mergedColor[0]" :points="`10, ${h - 4} ${w - 10}, ${h - 4}`" />
      <polyline :stroke="mergedColor[0]" :points="`5, 70 5, ${h - 70}`" />
      <polyline :stroke="mergedColor[0]" :points="`${w - 5}, 70 ${w - 5}, ${h - 70}`" />
      <polyline :stroke="mergedColor[0]" :points="`3, 10, 3, 50`" />
      <polyline :stroke="mergedColor[0]" :points="`7, 30 7, 80`" />
      <polyline :stroke="mergedColor[0]" :points="`${w - 3}, 10 ${w - 3}, 50`" />
      <polyline :stroke="mergedColor[0]" :points="`${w - 7}, 30 ${w - 7}, 80`" />
      <polyline :stroke="mergedColor[0]" :points="`3, ${h - 10} 3, ${h - 50}`" />
      <polyline :stroke="mergedColor[0]" :points="`7, ${h - 30} 7, ${h - 80}`" />
      <polyline :stroke="mergedColor[0]" :points="`${w - 3}, ${h - 10} ${w - 3}, ${h - 50}`" />
      <polyline :stroke="mergedColor[0]" :points="`${w - 7}, ${h - 30} ${w - 7}, ${h - 80}`" />
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
}>(), {
  color: () => [],
  backgroundColor: 'transparent'
})

const containerRef = ref<HTMLElement>()
const w = ref(200)
const h = ref(200)

const defaultColor = reactive(['rgba(255, 255, 255, 0.35)', 'gray'])
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
.dv-border-box-6 {
  position: relative;
  width: 100%;
  height: 100%;
}
.dv-border-box-6 .dv-border-svg-container {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}
.dv-border-box-6 .dv-border-svg-container polyline {
  fill: none;
  stroke-width: 1;
}
.dv-border-box-6 .border-box-content {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
