<template>
  <div
    ref="containerRef"
    class="dv-border-box-7"
    :style="`box-shadow: inset 0 0 40px ${mergedColor[0]}; border: 1px solid ${mergedColor[0]}; background-color: ${backgroundColor}`"
  >
    <svg class="dv-border-svg-container" :width="w" :height="h">
      <polyline class="dv-bb7-line-width-2" :stroke="mergedColor[0]" :points="`0, 25 0, 0 25, 0`" />
      <polyline class="dv-bb7-line-width-2" :stroke="mergedColor[0]" :points="`${w - 25}, 0 ${w}, 0 ${w}, 25`" />
      <polyline class="dv-bb7-line-width-2" :stroke="mergedColor[0]" :points="`${w - 25}, ${h} ${w}, ${h} ${w}, ${h - 25}`" />
      <polyline class="dv-bb7-line-width-2" :stroke="mergedColor[0]" :points="`0, ${h - 25} 0, ${h} 25, ${h}`" />

      <polyline class="dv-bb7-line-width-5" :stroke="mergedColor[1]" :points="`0, 10 0, 0 10, 0`" />
      <polyline class="dv-bb7-line-width-5" :stroke="mergedColor[1]" :points="`${w - 10}, 0 ${w}, 0 ${w}, 10`" />
      <polyline class="dv-bb7-line-width-5" :stroke="mergedColor[1]" :points="`${w - 10}, ${h} ${w}, ${h} ${w}, ${h - 10}`" />
      <polyline class="dv-bb7-line-width-5" :stroke="mergedColor[1]" :points="`0, ${h - 10} 0, ${h} 10, ${h}`" />
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

const defaultColor = reactive(['rgba(128,128,128,0.3)', 'rgba(128,128,128,0.5)'])
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
.dv-border-box-7 {
  position: relative;
  width: 100%;
  height: 100%;
}
.dv-border-box-7 .dv-border-svg-container {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}
.dv-border-box-7 .dv-bb7-line-width-2 {
  fill: none;
  stroke-width: 2;
}
.dv-border-box-7 .dv-bb7-line-width-5 {
  fill: none;
  stroke-width: 5;
}
.dv-border-box-7 .border-box-content {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
