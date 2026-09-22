<template>
  <div ref="containerRef" class="dv-border-box-3">
    <svg class="dv-border-svg-container" :width="w" :height="h">
      <polygon
        :fill="backgroundColor"
        :points="`
          23, 23 ${w - 24}, 23 ${w - 24}, ${h - 24} 23, ${h - 24}
        `"
      />

      <polyline
        class="dv-bb3-line1"
        :stroke="mergedColor[0]"
        :points="`4, 4 ${w - 22}, 4 ${w - 22}, ${h - 22} 4, ${h - 22} 4, 4`"
      />
      <polyline
        class="dv-bb3-line2"
        :stroke="mergedColor[1]"
        :points="`10, 10 ${w - 16}, 10 ${w - 16}, ${h - 16} 10, ${h - 16} 10, 10`"
      />
      <polyline
        class="dv-bb3-line2"
        :stroke="mergedColor[1]"
        :points="`16, 16 ${w - 10}, 16 ${w - 10}, ${h - 10} 16, ${h - 10} 16, 16`"
      />
      <polyline
        class="dv-bb3-line2"
        :stroke="mergedColor[1]"
        :points="`22, 22 ${w - 4}, 22 ${w - 4}, ${h - 4} 22, ${h - 4} 22, 22`"
      />
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

const defaultColor = reactive(['#2862b7', '#2862b7'])
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
.dv-border-box-3 {
  position: relative;
  width: 100%;
  height: 100%;
}
.dv-border-box-3 .dv-border-svg-container {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}
.dv-border-box-3 .dv-border-svg-container polyline {
  fill: none;
}
.dv-border-box-3 .dv-bb3-line1 {
  stroke-width: 3;
}
.dv-border-box-3 .dv-bb3-line2 {
  stroke-width: 1;
}
.dv-border-box-3 .border-box-content {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
