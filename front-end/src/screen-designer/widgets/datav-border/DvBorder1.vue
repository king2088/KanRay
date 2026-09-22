<template>
  <div ref="containerRef" class="dv-border-box-1">
    <svg class="dv-border-svg-container" :width="w" :height="h">
      <polygon
        :fill="backgroundColor"
        :points="`
          10, 27 10, ${h - 27} 13, ${h - 24} 13, ${h - 21} 24, ${h - 11}
          38, ${h - 11} 41, ${h - 8} 73, ${h - 8} 75, ${h - 10} 81, ${h - 10}
          85, ${h - 6} ${w - 85}, ${h - 6} ${w - 81}, ${h - 10} ${w - 75}, ${h - 10}
          ${w - 73}, ${h - 8} ${w - 41}, ${h - 8} ${w - 38}, ${h - 11}
          ${w - 24}, ${h - 11} ${w - 13}, ${h - 21} ${w - 13}, ${h - 24}
          ${w - 10}, ${h - 27} ${w - 10}, 27 ${w - 13}, 25 ${w - 13}, 21
          ${w - 24}, 11 ${w - 38}, 11 ${w - 41}, 8 ${w - 73}, 8 ${w - 75}, 10
          ${w - 81}, 10 ${w - 85}, 6 85, 6 81, 10 75, 10 73, 8 41, 8 38, 11 24, 11 13, 21 13, 24
        `"
      />
    </svg>

    <svg
      v-for="item in borders"
      :key="item"
      width="150"
      height="150"
      :class="`${item} border`"
    >
      <polygon
        :fill="mergedColor[0]"
        points="6,66 6,18 12,12 18,12 24,6 27,6 30,9 36,9 39,6 84,6 81,9 75,9 73.2,7 40.8,7 37.8,10.2 24,10.2 12,21 12,24 9,27 9,51 7.8,54 7.8,63"
      >
        <animate
          attributeName="fill"
          :values="`${mergedColor[0]};${mergedColor[1]};${mergedColor[0]}`"
          dur="0.5s"
          begin="0s"
          repeatCount="indefinite"
        />
      </polygon>
      <polygon
        :fill="mergedColor[1]"
        points="27.599999999999998,4.8 38.4,4.8 35.4,7.8 30.599999999999998,7.8"
      >
        <animate
          attributeName="fill"
          :values="`${mergedColor[1]};${mergedColor[0]};${mergedColor[1]}`"
          dur="0.5s"
          begin="0s"
          repeatCount="indefinite"
        />
      </polygon>
      <polygon
        :fill="mergedColor[0]"
        points="9,54 9,63 7.199999999999999,66 7.199999999999999,75 7.8,78 7.8,110 8.4,110 8.4,66 9.6,66 9.6,54"
      >
        <animate
          attributeName="fill"
          :values="`${mergedColor[0]};${mergedColor[1]};transparent`"
          dur="1s"
          begin="0s"
          repeatCount="indefinite"
        />
      </polygon>
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

const defaultColor = reactive(['#4fd2dd', '#235fa7'])
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
.dv-border-box-1 {
  position: relative;
  width: 100%;
  height: 100%;
}
.dv-border-box-1 .dv-border-svg-container {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}
.dv-border-box-1 .border {
  position: absolute;
  display: block;
}
.dv-border-box-1 .left-top {
  top: 0;
  left: 0;
}
.dv-border-box-1 .right-top {
  right: 0;
  top: 0;
  transform: rotateY(180deg);
}
.dv-border-box-1 .left-bottom {
  left: 0;
  bottom: 0;
  transform: rotateX(180deg);
}
.dv-border-box-1 .right-bottom {
  right: 0;
  bottom: 0;
  transform: rotateX(180deg) rotateY(180deg);
}
.dv-border-box-1 .border-box-content {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
