<template>
  <div ref="containerRef" class="dv-border-box-2">
    <svg class="dv-border-svg-container" :width="w" :height="h">
      <polygon
        :fill="backgroundColor"
        :points="`
          7, 7 ${w - 7}, 7 ${w - 7}, ${h - 7} 7, ${h - 7}
        `"
      />

      <polyline
        :stroke="mergedColor[0]"
        :points="`2, 2 ${w - 2}, 2 ${w - 2}, ${h - 2} 2, ${h - 2} 2, 2`"
      />
      <polyline
        :stroke="mergedColor[1]"
        :points="`6, 6 ${w - 6}, 6 ${w - 6}, ${h - 6} 6, ${h - 6} 6, 6`"
      />
      <circle :fill="mergedColor[0]" cx="11" cy="11" r="1" />
      <circle :fill="mergedColor[0]" :cx="w - 11" cy="11" r="1" />
      <circle :fill="mergedColor[0]" :cx="w - 11" :cy="h - 11" r="1" />
      <circle :fill="mergedColor[0]" cx="11" :cy="h - 11" r="1" />
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

const defaultColor = reactive(['#fff', 'rgba(255, 255, 255, 0.6)'])
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
.dv-border-box-2 {
  position: relative;
  width: 100%;
  height: 100%;
}
.dv-border-box-2 .dv-border-svg-container {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}
.dv-border-box-2 .dv-border-svg-container polyline {
  fill: none;
  stroke-width: 1;
}
.dv-border-box-2 .border-box-content {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
