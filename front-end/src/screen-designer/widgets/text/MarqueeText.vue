<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  data: any
  style: any
  props: any
}>()

const text = ref(props.props?.content || '这是一段跑马灯文本，从右向左滚动显示')
const speed = ref(props.props?.speed || 50)
const containerRef = ref<HTMLDivElement>()
const textRef = ref<HTMLDivElement>()
let animationFrame: number | null = null

onMounted(() => {
  if (!containerRef.value || !textRef.value) return

  let position = containerRef.value.offsetWidth

  const animate = () => {
    position -= speed.value / 60
    if (position < -textRef.value!.offsetWidth) {
      position = containerRef.value!.offsetWidth
    }
    textRef.value!.style.transform = `translateX(${position}px)`
    animationFrame = requestAnimationFrame(animate)
  }

  animationFrame = requestAnimationFrame(animate)
})

onUnmounted(() => {
  if (animationFrame) cancelAnimationFrame(animationFrame)
})
</script>

<template>
  <div class="marquee-text" ref="containerRef">
    <div ref="textRef" class="marquee-content" :style="{
      fontSize: (props.props?.fontSize || 24) + 'px',
      color: props.props?.color || '#1890ff',
      fontWeight: props.props?.fontWeight || 'normal',
      whiteSpace: 'nowrap'
    }">
      {{ text }}
    </div>
  </div>
</template>

<style scoped>
.marquee-text {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  position: relative;
}

.marquee-content {
  position: absolute;
  white-space: nowrap;
  will-change: transform;
}
</style>