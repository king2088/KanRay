<template>
  <div ref="containerRef" class="dv-border-box-11">
    <svg class="dv-border-svg-container" :width="w" :height="h">
      <defs>
        <filter :id="filterId" height="150%" width="150%" x="-25%" y="-25%">
          <feMorphology operator="dilate" radius="2" in="SourceAlpha" result="thicken" />
          <feGaussianBlur in="thicken" stdDeviation="3" result="blurred" />
          <feFlood :flood-color="mergedColor[1]" result="glowColor" />
          <feComposite in="glowColor" in2="blurred" operator="in" result="softGlowColored" />
          <feMerge>
            <feMergeNode in="softGlowColored" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <polygon
        :fill="backgroundColor"
        :points="`
          20, 32 ${w * 0.5 - titleWidth / 2}, 32 ${w * 0.5 - titleWidth / 2 + 20}, 53
          ${w * 0.5 + titleWidth / 2 - 20}, 53 ${w * 0.5 + titleWidth / 2}, 32
          ${w - 20}, 32 ${w - 8}, 48 ${w - 8}, ${h - 25} ${w - 20}, ${h - 8}
          20, ${h - 8} 8, ${h - 25} 8, 50
        `"
      />

      <polyline
        :stroke="mergedColor[0]"
        :filter="`url(#${filterId})`"
        :points="`
          ${(w - titleWidth) / 2}, 30
          20, 30 7, 50 7, ${50 + (h - 167) / 2}
          13, ${55 + (h - 167) / 2} 13, ${135 + (h - 167) / 2}
          7, ${140 + (h - 167) / 2} 7, ${h - 27}
          20, ${h - 7} ${w - 20}, ${h - 7} ${w - 7}, ${h - 27}
          ${w - 7}, ${140 + (h - 167) / 2} ${w - 13}, ${135 + (h - 167) / 2}
          ${w - 13}, ${55 + (h - 167) / 2} ${w - 7}, ${50 + (h - 167) / 2}
          ${w - 7}, 50 ${w - 20}, 30 ${(w + titleWidth) / 2}, 30
          ${(w + titleWidth) / 2 - 20}, 7 ${(w - titleWidth) / 2 + 20}, 7
          ${(w - titleWidth) / 2}, 30 ${(w - titleWidth) / 2 + 20}, 52
          ${(w + titleWidth) / 2 - 20}, 52 ${(w + titleWidth) / 2}, 30
        `"
      />

      <polygon
        :stroke="mergedColor[0]"
        fill="transparent"
        :points="`
          ${(w + titleWidth) / 2 - 5}, 30 ${(w + titleWidth) / 2 - 21}, 11
          ${(w + titleWidth) / 2 - 27}, 11 ${(w + titleWidth) / 2 - 8}, 34
        `"
      />

      <polygon
        :stroke="mergedColor[0]"
        fill="transparent"
        :points="`
          ${(w - titleWidth) / 2 + 5}, 30 ${(w - titleWidth) / 2 + 22}, 49
          ${(w - titleWidth) / 2 + 28}, 49 ${(w - titleWidth) / 2 + 8}, 26
        `"
      />

      <polygon
        :stroke="mergedColor[0]"
        :fill="fade(mergedColor[1] || defaultColor[1], 30)"
        :filter="`url(#${filterId})`"
        :points="`
          ${(w + titleWidth) / 2 - 11}, 37 ${(w + titleWidth) / 2 - 32}, 11
          ${(w - titleWidth) / 2 + 23}, 11 ${(w - titleWidth) / 2 + 11}, 23
          ${(w - titleWidth) / 2 + 33}, 49 ${(w + titleWidth) / 2 - 22}, 49
        `"
      />

      <polygon
        :filter="`url(#${filterId})`"
        :fill="mergedColor[0]"
        opacity="1"
        :points="`
          ${(w - titleWidth) / 2 - 10}, 37 ${(w - titleWidth) / 2 - 31}, 37
          ${(w - titleWidth) / 2 - 25}, 46 ${(w - titleWidth) / 2 - 4}, 46
        `"
      >
        <animate attributeName="opacity" values="1;0.7;1" dur="2s" begin="0s" repeatCount="indefinite" />
      </polygon>

      <polygon
        :filter="`url(#${filterId})`"
        :fill="mergedColor[0]"
        opacity="0.7"
        :points="`
          ${(w - titleWidth) / 2 - 40}, 37 ${(w - titleWidth) / 2 - 61}, 37
          ${(w - titleWidth) / 2 - 55}, 46 ${(w - titleWidth) / 2 - 34}, 46
        `"
      >
        <animate attributeName="opacity" values="0.7;0.4;0.7" dur="2s" begin="0s" repeatCount="indefinite" />
      </polygon>

      <polygon
        :filter="`url(#${filterId})`"
        :fill="mergedColor[0]"
        opacity="0.5"
        :points="`
          ${(w - titleWidth) / 2 - 70}, 37 ${(w - titleWidth) / 2 - 91}, 37
          ${(w - titleWidth) / 2 - 85}, 46 ${(w - titleWidth) / 2 - 64}, 46
        `"
      >
        <animate attributeName="opacity" values="0.5;0.2;0.5" dur="2s" begin="0s" repeatCount="indefinite" />
      </polygon>

      <polygon
        :filter="`url(#${filterId})`"
        :fill="mergedColor[0]"
        opacity="1"
        :points="`
          ${(w + titleWidth) / 2 + 30}, 37 ${(w + titleWidth) / 2 + 9}, 37
          ${(w + titleWidth) / 2 + 3}, 46 ${(w + titleWidth) / 2 + 24}, 46
        `"
      >
        <animate attributeName="opacity" values="1;0.7;1" dur="2s" begin="0s" repeatCount="indefinite" />
      </polygon>

      <polygon
        :filter="`url(#${filterId})`"
        :fill="mergedColor[0]"
        opacity="0.7"
        :points="`
          ${(w + titleWidth) / 2 + 60}, 37 ${(w + titleWidth) / 2 + 39}, 37
          ${(w + titleWidth) / 2 + 33}, 46 ${(w + titleWidth) / 2 + 54}, 46
        `"
      >
        <animate attributeName="opacity" values="0.7;0.4;0.7" dur="2s" begin="0s" repeatCount="indefinite" />
      </polygon>

      <polygon
        :filter="`url(#${filterId})`"
        :fill="mergedColor[0]"
        opacity="0.5"
        :points="`
          ${(w + titleWidth) / 2 + 90}, 37 ${(w + titleWidth) / 2 + 69}, 37
          ${(w + titleWidth) / 2 + 63}, 46 ${(w + titleWidth) / 2 + 84}, 46
        `"
      >
        <animate attributeName="opacity" values="0.5;0.2;0.5" dur="2s" begin="0s" repeatCount="indefinite" />
      </polygon>

      <text
        class="dv-border-box-11-title"
        :x="w / 2"
        y="32"
        fill="#fff"
        font-size="18"
        text-anchor="middle"
        dominant-baseline="middle"
      >
        {{ title }}
      </text>

      <polygon
        :fill="mergedColor[0]"
        :filter="`url(#${filterId})`"
        :points="`
          7, ${53 + (h - 167) / 2} 11, ${57 + (h - 167) / 2}
          11, ${133 + (h - 167) / 2} 7, ${137 + (h - 167) / 2}
        `"
      />

      <polygon
        :fill="mergedColor[0]"
        :filter="`url(#${filterId})`"
        :points="`
          ${w - 7}, ${53 + (h - 167) / 2} ${w - 11}, ${57 + (h - 167) / 2}
          ${w - 11}, ${133 + (h - 167) / 2} ${w - 7}, ${137 + (h - 167) / 2}
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
  title?: string
  titleWidth?: number
  backgroundColor?: string
}>(), {
  color: () => [],
  title: '',
  titleWidth: 250,
  backgroundColor: 'transparent'
})

const containerRef = ref<HTMLElement>()
const w = ref(200)
const h = ref(200)

const uid = Math.random().toString(36).slice(2, 10)
const filterId = `border-box-11-filterId-${uid}`

const defaultColor = reactive(['#8aaafb', '#1f33a2'])
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
.dv-border-box-11 {
  position: relative;
  width: 100%;
  height: 100%;
}
.dv-border-box-11 .dv-border-svg-container {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}
.dv-border-box-11 .dv-border-box-11-title {
  font-size: 18px;
}
.dv-border-box-11 .border-box-content {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
