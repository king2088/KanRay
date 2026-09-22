<!-- 排名列表 (rank-list) - 数据排名滚动列表 -->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  componentType?: string
  data: any
  style: any
  props: any
}>()

const defaultItems = [
  { rank: 1, name: '张三', value: 980 },
  { rank: 2, name: '李四', value: 860 },
  { rank: 3, name: '王五', value: 750 },
  { rank: 4, name: '赵六', value: 640 },
  { rank: 5, name: '孙七', value: 520 },
  { rank: 6, name: '周八', value: 410 },
]

const items = computed(() => props.props?.items || defaultItems)
const maxValue = computed(() => Math.max(...items.value.map((i: any) => i.value)))
const activeIndex = ref(0)
let timer: number | null = null

onMounted(() => {
  timer = window.setInterval(() => {
    activeIndex.value = (activeIndex.value + 1) % items.value.length
  }, 3000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const barGradient = (rank: number) => {
  const gradients: Record<number, string> = {
    1: 'linear-gradient(90deg, #ff4d4f, #ff7875)',
    2: 'linear-gradient(90deg, #ff7a45, #ffa940)',
    3: 'linear-gradient(90deg, #ffa940, #ffc53d)',
    4: 'linear-gradient(90deg, #40a9ff, #69c0ff)',
    5: 'linear-gradient(90deg, #597ef7, #85a5ff)',
    6: 'linear-gradient(90deg, #73d13d, #95de64)',
  }
  return gradients[rank] || 'linear-gradient(90deg, #40a9ff, #69c0ff)'
}
</script>

<template>
  <div class="rank-list">
    <div
      v-for="(item, idx) in items"
      :key="item.rank"
      class="rank-item"
      :class="{ active: idx === activeIndex }"
    >
      <div class="rank-header">
        <span class="rank-badge" :style="{ background: barGradient(item.rank) }">{{ item.rank }}</span>
        <span class="rank-name">{{ item.name }}</span>
        <span class="rank-value">{{ item.value }}</span>
      </div>
      <div class="bar-track">
        <div
          class="bar-fill"
          :style="{
            width: (item.value / maxValue * 100) + '%',
            background: barGradient(item.rank),
          }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.rank-list {
  width: 100%;
  height: 100%;
  background: #1a1a2e;
  padding: 16px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: auto;
}
.rank-item {
  transition: transform 0.3s, box-shadow 0.3s;
  border-radius: 6px;
  padding: 8px 10px;
}
.rank-item.active {
  background: rgba(24, 144, 255, 0.08);
  box-shadow: 0 0 12px rgba(24, 144, 255, 0.15);
  transform: scale(1.01);
}
.rank-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.rank-badge {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
.rank-name {
  flex: 1;
  color: #e0e0e0;
  font-size: 14px;
}
.rank-value {
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}
.bar-track {
  height: 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 1s ease;
}
</style>
