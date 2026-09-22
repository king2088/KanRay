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

const pad = (n: number) => n.toString().padStart(2, '0')

const timeStr = computed(() => {
  return `${pad(now.value.getHours())}:${pad(now.value.getMinutes())}:${pad(now.value.getSeconds())}`
})

const dateStr = computed(() => {
  const d = now.value
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `${d.getFullYear()}年${pad(d.getMonth() + 1)}月${pad(d.getDate())}日 星期${weekdays[d.getDay()]}`
})

const secondDeg = computed(() => now.value.getSeconds() * 6)
const minuteDeg = computed(() => now.value.getMinutes() * 6 + now.value.getSeconds() * 0.1)
const hourDeg = computed(() => (now.value.getHours() % 12) * 30 + now.value.getMinutes() * 0.5)
</script>

<template>
  <div class="clock-widget">
    <div class="clock-face">
      <svg viewBox="0 0 200 200" width="160" height="160">
        <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2" />
        <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(64,169,255,0.2)" stroke-width="1" />

        <g v-for="i in 12" :key="i">
          <line
            :x1="100 + 75 * Math.cos(((i * 30 - 90) * Math.PI) / 180)"
            :y1="100 + 75 * Math.sin(((i * 30 - 90) * Math.PI) / 180)"
            :x2="100 + 82 * Math.cos(((i * 30 - 90) * Math.PI) / 180)"
            :y2="100 + 82 * Math.sin(((i * 30 - 90) * Math.PI) / 180)"
            stroke="rgba(255,255,255,0.4)"
            stroke-width="2"
            stroke-linecap="round"
          />
        </g>

        <line
          x1="100" y1="100"
          :x2="100 + 45 * Math.cos(((hourDeg - 90) * Math.PI) / 180)"
          :y2="100 + 45 * Math.sin(((hourDeg - 90) * Math.PI) / 180)"
          stroke="#e0e0e0"
          stroke-width="4"
          stroke-linecap="round"
        />
        <line
          x1="100" y1="100"
          :x2="100 + 60 * Math.cos(((minuteDeg - 90) * Math.PI) / 180)"
          :y2="100 + 60 * Math.sin(((minuteDeg - 90) * Math.PI) / 180)"
          stroke="#40a9ff"
          stroke-width="2.5"
          stroke-linecap="round"
        />
        <line
          x1="100" y1="100"
          :x2="100 + 68 * Math.cos(((secondDeg - 90) * Math.PI) / 180)"
          :y2="100 + 68 * Math.sin(((secondDeg - 90) * Math.PI) / 180)"
          stroke="#ff4d4f"
          stroke-width="1.2"
          stroke-linecap="round"
        />

        <circle cx="100" cy="100" r="4" fill="#40a9ff" />
      </svg>
    </div>
    <div class="clock-text">
      <div class="time-display">{{ timeStr }}</div>
      <div class="date-display">{{ dateStr }}</div>
    </div>
  </div>
</template>

<style scoped>
.clock-widget {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: transparent;
  gap: 12px;
}
.clock-face svg {
  filter: drop-shadow(0 0 12px rgba(64, 169, 255, 0.4));
}
.clock-text {
  text-align: center;
}
.time-display {
  font-size: 28px;
  font-weight: 700;
  font-family: 'Courier New', monospace;
  color: #40a9ff;
  text-shadow: 0 0 16px rgba(64, 169, 255, 0.5);
  letter-spacing: 2px;
}
.date-display {
  font-size: 13px;
  color: #888;
  margin-top: 4px;
}
</style>
