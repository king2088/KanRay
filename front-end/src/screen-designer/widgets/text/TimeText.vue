<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  data: any
  style: any
  props: any
}>()

const now = ref(new Date())
let timer: number | null = null

onMounted(() => {
  timer = window.setInterval(() => { now.value = new Date() }, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const format = computed(() => props.props?.format || 'YYYY-MM-DD HH:mm:ss')
const fontSize = computed(() => props.props?.fontSize || 24)
const color = computed(() => props.props?.color || '#409eff')
const fontWeight = computed(() => props.props?.fontWeight || 'normal')
const textAlign = computed(() => props.props?.textAlign || 'center')

const formattedTime = computed(() => {
  const d = now.value
  const pad = (n: number) => n.toString().padStart(2, '0')
  const year = d.getFullYear()
  const month = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const hours = pad(d.getHours())
  const minutes = pad(d.getMinutes())
  const seconds = pad(d.getSeconds())
  return format.value
    .replace('YYYY', year.toString())
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
})
</script>

<template>
  <div class="time-text" :style="{ fontSize: fontSize + 'px', color, fontWeight, textAlign }">{{ formattedTime }}</div>
</template>

<style scoped>
.time-text { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-family: 'Courier New', monospace; }
</style>