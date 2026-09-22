<template>
  <div ref="containerRef" class="dv-border-box-13">
    <svg class="dv-border-svg-container" :width="w" :height="h">
      <path
        :fill="backgroundColor"
        :stroke="mergedColor[0]"
        :d="`
          M 5 20 L 5 10 L 12 3 L 60 3 L 68 10
          L ${w - 20} 10 L ${w - 5} 25
          L ${w - 5} ${h - 5} L 20 ${h - 5}
          L 5 ${h - 20} L 5 20
        `"
      />

      <path
        fill="transparent"
        stroke-width="3"
        stroke-linecap="round"
        stroke-dasharray="10, 5"
        :stroke="mergedColor[0]"
        :d="`M 16 9 L 61 9`"
      />

      <path
        fill="transparent"
        :stroke="mergedColor[1]"
        :d="`M 5 20 L 5 10 L 12 3 L 60 3 L 68 10`"
      />

      <path
        fill="transparent"
        :stroke="mergedColor[1]"
        :d="`M ${w - 5} ${h - 30} L ${w - 5} ${h - 5} L ${w - 30} ${h - 5}`"
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

const defaultColor = reactive(['#6586ec', '#2cf7fe'])
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
.dv-border-box-13 {
  position: relative;
  width: 100%;
  height: 100%;
}
.dv-border-box-13 .dv-border-svg-container {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}
.dv-border-box-13 .border-box-content {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
