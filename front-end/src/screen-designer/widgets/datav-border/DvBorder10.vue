<template>
  <div
    ref="containerRef"
    class="dv-border-box-10"
    :style="`box-shadow: inset 0 0 25px 3px ${mergedColor[0]}`"
  >
    <svg class="dv-border-svg-container" :width="w" :height="h">
      <polygon
        :fill="backgroundColor"
        :points="`
          4, 0 ${w - 4}, 0 ${w}, 4 ${w}, ${h - 4} ${w - 4}, ${h}
          4, ${h} 0, ${h - 4} 0, 4
        `"
      />
    </svg>

    <svg
      v-for="item in borders"
      :key="item"
      width="150"
      height="150"
      :class="`${item} dv-border-svg-container`"
    >
      <polygon
        :fill="mergedColor[1]"
        points="40, 0 5, 0 0, 5 0, 16 3, 19 3, 7 7, 3 35, 3"
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

const borders = ['left-top', 'right-top', 'left-bottom', 'right-bottom']

const defaultColor = reactive(['#1d48c4', '#d3e1f8'])
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
.dv-border-box-10 {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 6px;
}
.dv-border-box-10 .dv-border-svg-container {
  position: absolute;
  display: block;
}
.dv-border-box-10 .right-top {
  right: 0;
  transform: rotateY(180deg);
}
.dv-border-box-10 .left-bottom {
  bottom: 0;
  transform: rotateX(180deg);
}
.dv-border-box-10 .right-bottom {
  right: 0;
  bottom: 0;
  transform: rotateX(180deg) rotateY(180deg);
}
.dv-border-box-10 .border-box-content {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
