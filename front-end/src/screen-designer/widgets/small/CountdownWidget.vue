<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  data: any
  style: any
  props: any
}>()

const getDefaultTarget = () => {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d
}

const target = computed(() => {
  if (props.props?.target) return new Date(props.props.target)
  return getDefaultTarget()
})

const now = ref(new Date())
let timer: number | null = null

onMounted(() => {
  timer = window.setInterval(() => { now.value = new Date() }, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const pad = (n: number) => n.toString().padStart(2, '0')

const diff = computed(() => {
  const ms = Math.max(0, target.value.getTime() - now.value.getTime())
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((ms % (1000 * 60)) / 1000)
  return { days, hours, minutes, seconds }
})
</script>

<template>
  <div class="countdown-widget">
    <div class="countdown-row">
      <div class="countdown-block">
        <span class="countdown-number">{{ pad(diff.days) }}</span>
        <span class="countdown-label">天</span>
      </div>
      <span class="countdown-sep">:</span>
      <div class="countdown-block">
        <span class="countdown-number">{{ pad(diff.hours) }}</span>
        <span class="countdown-label">时</span>
      </div>
      <span class="countdown-sep">:</span>
      <div class="countdown-block">
        <span class="countdown-number">{{ pad(diff.minutes) }}</span>
        <span class="countdown-label">分</span>
      </div>
      <span class="countdown-sep">:</span>
      <div class="countdown-block">
        <span class="countdown-number">{{ pad(diff.seconds) }}</span>
        <span class="countdown-label">秒</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.countdown-widget {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}
.countdown-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.countdown-block {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.countdown-number {
  font-size: 42px;
  font-weight: 700;
  font-family: 'Courier New', monospace;
  color: #40a9ff;
  text-shadow: 0 0 20px rgba(64, 169, 255, 0.6), 0 0 40px rgba(64, 169, 255, 0.3);
  line-height: 1;
}
.countdown-label {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
}
.countdown-sep {
  font-size: 36px;
  font-weight: 700;
  color: #40a9ff;
  text-shadow: 0 0 10px rgba(64, 169, 255, 0.4);
  margin: 0 2px;
  align-self: flex-start;
  padding-top: 4px;
}
</style>
