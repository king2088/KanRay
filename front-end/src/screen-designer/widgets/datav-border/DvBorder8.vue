<template>
  <div ref="containerRef" class="dv-border-box-8">
    <svg class="dv-border-svg-container" :width="w" :height="h">
      <defs>
        <path
          :id="pathId"
          :d="pathD"
          fill="transparent"
        />
        <radialGradient
          :id="gradientId"
          cx="50%"
          cy="50%"
          r="50%"
        >
          <stop offset="0%" stop-color="#fff" stop-opacity="1" />
          <stop offset="100%" stop-color="#fff" stop-opacity="0" />
        </radialGradient>

        <mask :id="maskId">
          <circle cx="0" cy="0" r="150" :fill="`url(#${gradientId})`">
            <animateMotion
              :dur="`${dur}s`"
              :path="pathD"
              rotate="auto"
              repeatCount="indefinite"
            />
          </circle>
        </mask>
      </defs>

      <polygon
        :fill="backgroundColor"
        :points="`5, 5 ${w - 5}, 5 ${w - 5} ${h - 5} 5, ${h - 5}`"
      />

      <use
        :stroke="mergedColor[0]"
        stroke-width="1"
        :xlink:href="`#${pathId}`"
      />

      <use
        :stroke="mergedColor[1]"
        stroke-width="3"
        :xlink:href="`#${pathId}`"
        :mask="`url(#${maskId})`"
      >
        <animate
          attributeName="stroke-dasharray"
          :from="`0, ${length}`"
          :to="`${length}, 0`"
          :dur="`${dur}s`"
          repeatCount="indefinite"
        />
      </use>
    </svg>

    <div class="border-box-content">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  color?: string[]
  dur?: number
  backgroundColor?: string
  reverse?: boolean
}>(), {
  color: () => [],
  dur: 3,
  backgroundColor: 'transparent',
  reverse: false
})

const containerRef = ref<HTMLElement>()
const w = ref(200)
const h = ref(200)

const uid = Math.random().toString(36).slice(2, 10)
const pathId = `border-box-8-path-${uid}`
const gradientId = `border-box-8-gradient-${uid}`
const maskId = `border-box-8-mask-${uid}`

const defaultColor = reactive(['#235fa7', '#4fd2dd'])
const mergedColor = ref<string[]>([])

const length = computed(() => (w.value + h.value - 5) * 2)

const pathD = computed(() => {
  if (props.reverse) {
    return `M 2.5, 2.5 L 2.5, ${h.value - 2.5} L ${w.value - 2.5}, ${h.value - 2.5} L ${w.value - 2.5}, 2.5 L 2.5, 2.5`
  }
  return `M2.5, 2.5 L${w.value - 2.5}, 2.5 L${w.value - 2.5}, ${h.value - 2.5} L2.5, ${h.value - 2.5} L2.5, 2.5`
})

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
.dv-border-box-8 {
  position: relative;
  width: 100%;
  height: 100%;
}
.dv-border-box-8 .dv-border-svg-container {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}
.dv-border-box-8 .border-box-content {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
