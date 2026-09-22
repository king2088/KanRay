<template>
  <div ref="containerRef" class="dv-border-box-12">
    <svg class="dv-border-svg-container" :width="w" :height="h">
      <defs>
        <filter :id="filterId" height="150%" width="150%" x="-25%" y="-25%">
          <feMorphology operator="dilate" radius="1" in="SourceAlpha" result="thicken" />
          <feGaussianBlur in="thicken" stdDeviation="2" result="blurred" />
          <feFlood :flood-color="fade(mergedColor[1] || defaultColor[1], 70)" result="glowColor">
            <animate
              attributeName="flood-color"
              :values="`
                ${fade(mergedColor[1] || defaultColor[1], 70)};
                ${fade(mergedColor[1] || defaultColor[1], 30)};
                ${fade(mergedColor[1] || defaultColor[1], 70)};
              `"
              dur="3s"
              begin="0s"
              repeatCount="indefinite"
            />
          </feFlood>
          <feComposite in="glowColor" in2="blurred" operator="in" result="softGlowColored" />
          <feMerge>
            <feMergeNode in="softGlowColored" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path
        v-if="w && h"
        :fill="backgroundColor"
        stroke-width="2"
        :stroke="mergedColor[0]"
        :d="`
          M15 5 L ${w - 15} 5 Q ${w - 5} 5, ${w - 5} 15
          L ${w - 5} ${h - 15} Q ${w - 5} ${h - 5}, ${w - 15} ${h - 5}
          L 15, ${h - 5} Q 5 ${h - 5} 5 ${h - 15} L 5 15
          Q 5 5 15 5
        `"
      />

      <path
        stroke-width="2"
        fill="transparent"
        stroke-linecap="round"
        :filter="`url(#${filterId})`"
        :stroke="mergedColor[1]"
        :d="`M 20 5 L 15 5 Q 5 5 5 15 L 5 20`"
      />

      <path
        stroke-width="2"
        fill="transparent"
        stroke-linecap="round"
        :filter="`url(#${filterId})`"
        :stroke="mergedColor[1]"
        :d="`M ${w - 20} 5 L ${w - 15} 5 Q ${w - 5} 5 ${w - 5} 15 L ${w - 5} 20`"
      />

      <path
        stroke-width="2"
        fill="transparent"
        stroke-linecap="round"
        :filter="`url(#${filterId})`"
        :stroke="mergedColor[1]"
        :d="`
          M ${w - 20} ${h - 5} L ${w - 15} ${h - 5}
          Q ${w - 5} ${h - 5} ${w - 5} ${h - 15}
          L ${w - 5} ${h - 20}
        `"
      />

      <path
        stroke-width="2"
        fill="transparent"
        stroke-linecap="round"
        :filter="`url(#${filterId})`"
        :stroke="mergedColor[1]"
        :d="`
          M 20 ${h - 5} L 15 ${h - 5}
          Q 5 ${h - 5} 5 ${h - 15}
          L 5 ${h - 20}
        `"
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

const uid = Math.random().toString(36).slice(2, 10)
const filterId = `borderr-box-12-filterId-${uid}`

const defaultColor = reactive(['#2e6099', '#7ce7fd'])
const mergedColor = ref<string[]>([])

const mergeColor = () => {
  mergedColor.value = [...defaultColor].map((c, i) => (props.color && props.color[i]) || c)
}

const fade = (color: string, opacity: number) => {
  const hex = color.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`
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
.dv-border-box-12 {
  position: relative;
  width: 100%;
  height: 100%;
}
.dv-border-box-12 .dv-border-svg-container {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}
.dv-border-box-12 .border-box-content {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
