<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  data: any
  style: any
  props: any
}>()

const parsed = computed<Record<string, any>>(() => {
  if (props.data?.value) {
    try {
      const obj = JSON.parse(props.data.value)
      if (obj && typeof obj === 'object') return obj
    } catch {}
  }
  return {}
})

const rawValue = computed(() => parsed.value.value ?? props.props?.value ?? 0)

const decimals = computed(() => {
  const d = props.props?.decimals
  return typeof d === 'number' ? d : (parsed.value.decimals ?? 0)
})

const useGrouping = computed(() => {
  const v = props.props?.useGrouping
  return typeof v === 'boolean' ? v : (parsed.value.useGrouping ?? true)
})

const displayValue = computed(() => {
  const num = Number(rawValue.value)
  if (Number.isNaN(num)) return String(rawValue.value)
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals.value,
    maximumFractionDigits: decimals.value,
    useGrouping: useGrouping.value
  })
})

const prefix = computed(() => props.props?.prefix ?? parsed.value.prefix ?? '')
const suffix = computed(() => props.props?.suffix ?? parsed.value.suffix ?? '')
const label = computed(() => parsed.value.label ?? props.props?.label ?? '')

const fontSize = computed(() => props.props?.fontSize || 32)
const color = computed(() => props.props?.color || '#409eff')
const fontWeight = computed(() => props.props?.fontWeight || 'bold')
const fontStyle = computed(() => props.props?.fontStyle || 'normal')
const textAlign = computed(() => props.props?.textAlign || 'center')
const glow = computed(() => props.props?.glow !== false)
const labelShow = computed(() => {
  const v = props.props?.labelShow
  return typeof v === 'boolean' ? v : !!label.value
})
</script>

<template>
  <div class="data-text">
    <div
      class="data-text-value"
      :style="{
        fontSize: fontSize + 'px',
        color,
        fontWeight,
        fontStyle,
        textAlign,
        textShadow: glow ? `0 0 14px ${color}88, 0 0 30px ${color}44` : 'none'
      }"
    ><span class="prefix">{{ prefix }}</span>{{ displayValue }}<span class="suffix">{{ suffix }}</span></div>
    <div v-if="labelShow" class="data-text-label" :style="{ textAlign, fontSize: (props.props?.labelSize ?? Math.max(12, fontSize * 0.4)) + 'px', color: props.props?.labelColor || '#8a94a6' }">{{ label }}</div>
  </div>
</template>

<style scoped>
.data-text {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-family: 'DIN', 'Helvetica Neue', Arial, sans-serif;
  letter-spacing: 1px;
  line-height: 1.2;
}
.data-text-value {
  width: 100%;
  padding: 0 5px;
  box-sizing: border-box;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.prefix, .suffix {
  opacity: 0.8;
  font-size: 0.5em;
  margin: 0 2px;
}
.data-text-label {
  width: 100%;
  padding: 0 5px;
  box-sizing: border-box;
  margin-top: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.85;
}
</style>