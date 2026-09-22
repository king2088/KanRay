<template>
  <div ref="containerRef" class="dv-border-box-9">
    <svg class="dv-border-svg-container" :width="w" :height="h">
      <defs>
        <linearGradient :id="gradientId" x1="0%" y1="0%" x2="100%" y2="100%">
          <animate attributeName="x1" values="0%;100%;0%" dur="10s" begin="0s" repeatCount="indefinite" />
          <animate attributeName="x2" values="100%;0%;100%" dur="10s" begin="0s" repeatCount="indefinite" />
          <stop offset="0%" :stop-color="mergedColor[0]">
            <animate
              attributeName="stop-color"
              :values="`${mergedColor[0]};${mergedColor[1]};${mergedColor[0]}`"
              dur="10s"
              begin="0s"
              repeatCount="indefinite"
            />
          </stop>
          <stop offset="100%" :stop-color="mergedColor[1]">
            <animate
              attributeName="stop-color"
              :values="`${mergedColor[1]};${mergedColor[0]};${mergedColor[1]}`"
              dur="10s"
              begin="0s"
              repeatCount="indefinite"
            />
          </stop>
        </linearGradient>

        <mask :id="maskId">
          <polyline
            stroke="#fff"
            stroke-width="3"
            fill="transparent"
            :points="`8, ${h * 0.4} 8, 3, ${w * 0.4 + 7}, 3`"
          />
          <polyline
            fill="#fff"
            :points="`
              8, ${h * 0.15} 8, 3, ${w * 0.1 + 7}, 3
              ${w * 0.1}, 8 14, 8 14, ${h * 0.15 - 7}
            `"
          />

          <polyline
            stroke="#fff"
            stroke-width="3"
            fill="transparent"
            :points="`${w * 0.5}, 3 ${w - 3}, 3, ${w - 3}, ${h * 0.25}`"
          />
          <polyline
            fill="#fff"
            :points="`
              ${w * 0.52}, 3 ${w * 0.58}, 3
              ${w * 0.58 - 7}, 9 ${w * 0.52 + 7}, 9
            `"
          />
          <polyline
            fill="#fff"
            :points="`
              ${w * 0.9}, 3 ${w - 3}, 3 ${w - 3}, ${h * 0.1}
              ${w - 9}, ${h * 0.1 - 7} ${w - 9}, 9 ${w * 0.9 + 7}, 9
            `"
          />

          <polyline
            stroke="#fff"
            stroke-width="3"
            fill="transparent"
            :points="`8, ${h * 0.5} 8, ${h - 3} ${w * 0.3 + 7}, ${h - 3}`"
          />
          <polyline
            fill="#fff"
            :points="`
              8, ${h * 0.55} 8, ${h * 0.7}
              2, ${h * 0.7 - 7} 2, ${h * 0.55 + 7}
            `"
          />

          <polyline
            stroke="#fff"
            stroke-width="3"
            fill="transparent"
            :points="`${w * 0.35}, ${h - 3} ${w - 3}, ${h - 3} ${w - 3}, ${h * 0.35}`"
          />
          <polyline
            fill="#fff"
            :points="`
              ${w * 0.92}, ${h - 3} ${w - 3}, ${h - 3} ${w - 3}, ${h * 0.8}
              ${w - 9}, ${h * 0.8 + 7} ${w - 9}, ${h - 9} ${w * 0.92 + 7}, ${h - 9}
            `"
          />
        </mask>
      </defs>

      <polygon
        :fill="backgroundColor"
        :points="`
          15, 9 ${w * 0.1 + 1}, 9 ${w * 0.1 + 4}, 6 ${w * 0.52 + 2}, 6
          ${w * 0.52 + 6}, 10 ${w * 0.58 - 7}, 10 ${w * 0.58 - 2}, 6
          ${w * 0.9 + 2}, 6 ${w * 0.9 + 6}, 10 ${w - 10}, 10 ${w - 10}, ${h * 0.1 - 6}
          ${w - 6}, ${h * 0.1 - 1} ${w - 6}, ${h * 0.8 + 1} ${w - 10}, ${h * 0.8 + 6}
          ${w - 10}, ${h - 10} ${w * 0.92 + 7}, ${h - 10}  ${w * 0.92 + 2}, ${h - 6}
          11, ${h - 6} 11, ${h * 0.15 - 2} 15, ${h * 0.15 - 7}
        `"
      />

      <rect x="0" y="0" :width="w" :height="h" :fill="`url(#${gradientId})`" :mask="`url(#${maskId})`" />
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

const uid = Math.random().toString(36).slice(2, 10)
const gradientId = `border-box-9-gradient-${uid}`
const maskId = `border-box-9-mask-${uid}`

const defaultColor = reactive(['#11eefd', '#0078d2'])
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
.dv-border-box-9 {
  position: relative;
  width: 100%;
  height: 100%;
}
.dv-border-box-9 .dv-border-svg-container {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}
.dv-border-box-9 .border-box-content {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
