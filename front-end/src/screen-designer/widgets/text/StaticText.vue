<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  data: any
  style: any
  props: any
}>()

const text = computed(() => {
  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      return parsed.text ?? props.data.value
    } catch { return props.data.value }
  }
  if (props.props?.content) return props.props.content
  return '静态文本'
})

const fontSize = computed(() => props.props?.fontSize || 24)
const color = computed(() => props.props?.color || '#ffffff')
const fontWeight = computed(() => props.props?.fontWeight || 'normal')
const fontStyle = computed(() => props.props?.fontStyle || 'normal')
const textDecoration = computed(() => props.props?.textDecoration || 'none')
const textAlign = computed(() => props.props?.textAlign || 'center')
const lineHeight = computed(() => props.props?.lineHeight || 1.5)
const letterSpacing = computed(() => props.props?.letterSpacing || 0)
</script>

<template>
  <div class="static-text" :style="{ fontSize: fontSize + 'px', color, fontWeight, fontStyle, textDecoration, textAlign, lineHeight, letterSpacing: letterSpacing + 'px' }">{{ text }}</div>
</template>

<style scoped>
.static-text { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 5px; word-break: break-all; }
</style>