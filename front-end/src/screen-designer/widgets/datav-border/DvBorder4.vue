<template>
  <div ref="containerRef" class="dv-border-box-4">
    <svg
      :class="`dv-border-svg-container ${reverse && 'dv-reverse'}`"
      :width="w"
      :height="h"
    >
      <polygon
        :fill="backgroundColor"
        :points="`
          ${w - 15}, 22 170, 22 150, 7 40, 7 28, 21 32, 24
          16, 42 16, ${h - 32} 41, ${h - 7} ${w - 15}, ${h - 7}
        `"
      />

      <polyline
        class="dv-bb4-line-1"
        :stroke="mergedColor[0]"
        :points="`145, ${h - 5} 40, ${h - 5} 10, ${h - 35}
          10, 40 40, 5 150, 5 170, 20 ${w - 15}, 20`"
      />
      <polyline
        class="dv-bb4-line-2"
        :stroke="mergedColor[1]"
        :points="`245, ${h - 1} 36, ${h - 1} 14, ${h - 23}
          14, ${h - 100}`"
      />

      <polyline class="dv-bb4-line-3" :stroke="mergedColor[0]" :points="`7, ${h - 40} 7, ${h - 75}`" />
      <polyline class="dv-bb4-line-4" :stroke="mergedColor[0]" :points="`28, 24 13, 41 13, 64`" />
      <polyline class="dv-bb4-line-5" :stroke="mergedColor[0]" :points="`5, 45 5, 140`" />
      <polyline class="dv-bb4-line-6" :stroke="mergedColor[1]" :points="`14, 75 14, 180`" />
      <polyline class="dv-bb4-line-7" :stroke="mergedColor[1]" :points="`55, 11 147, 11 167, 26 250, 26`" />
      <polyline class="dv-bb4-line-8" :stroke="mergedColor[1]" :points="`158, 5 173, 16`" />
      <polyline class="dv-bb4-line-9" :stroke="mergedColor[0]" :points="`200, 17 ${w - 10}, 17`" />
      <polyline class="dv-bb4-line-10" :stroke="mergedColor[1]" :points="`385, 17 ${w - 10}, 17`" />
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

const defaultColor = reactive(['red', 'rgba(0,0,255,0.8)'])
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
.dv-border-box-4 {
  position: relative;
  width: 100%;
  height: 100%;
}
.dv-border-box-4 .dv-reverse {
  transform: rotate(180deg);
}
.dv-border-box-4 .dv-border-svg-container {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}
.dv-border-box-4 .dv-border-svg-container polyline {
  fill: none;
}
.dv-border-box-4 .dv-bb4-line-1 {
  stroke-width: 1;
}
.dv-border-box-4 .dv-bb4-line-2 {
  stroke-width: 1;
}
.dv-border-box-4 .dv-bb4-line-3 {
  stroke-width: 3px;
  stroke-linecap: round;
}
.dv-border-box-4 .dv-bb4-line-4 {
  stroke-width: 3px;
  stroke-linecap: round;
}
.dv-border-box-4 .dv-bb4-line-5 {
  stroke-width: 1;
}
.dv-border-box-4 .dv-bb4-line-6 {
  stroke-width: 1;
}
.dv-border-box-4 .dv-bb4-line-7 {
  stroke-width: 1;
}
.dv-border-box-4 .dv-bb4-line-8 {
  stroke-width: 3px;
  stroke-linecap: round;
}
.dv-border-box-4 .dv-bb4-line-9 {
  stroke-width: 3px;
  stroke-linecap: round;
  stroke-dasharray: 100 250;
}
.dv-border-box-4 .dv-bb4-line-10 {
  stroke-width: 1;
  stroke-dasharray: 80 270;
}
.dv-border-box-4 .border-box-content {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
