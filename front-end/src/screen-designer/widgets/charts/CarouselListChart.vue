<!-- 轮播列表 (carousel-list) - 数据轮播列表 -->
<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  componentType?: string
  data: any
  style: any
  props: any
}>()

const defaultItems = [
  { rank: 1, name: '华东区域', value: 9865 },
  { rank: 2, name: '华南区域', value: 8732 },
  { rank: 3, name: '华北区域', value: 7654 },
  { rank: 4, name: '西南区域', value: 6543 },
  { rank: 5, name: '华中区域', value: 5432 },
  { rank: 6, name: '东北区域', value: 4321 },
  { rank: 7, name: '西北区域', value: 3210 },
  { rank: 8, name: '海外区域', value: 2109 },
]

const items = computed(() => props.props?.items || defaultItems)
const paused = ref(false)

const rankColor = (rank: number) => {
  const colors = ['#ff4d4f', '#ff7a45', '#ffa940', '#ffc53d', '#73d13d', '#40a9ff', '#597ef7', '#9254de']
  return colors[(rank - 1) % colors.length]
}
</script>

<template>
  <div class="carousel-list">
    <div
      class="scroll-container"
      :class="{ paused }"
      @mouseenter="paused = true"
      @mouseleave="paused = false"
    >
      <div class="scroll-content">
        <div
          v-for="(item, idx) in [...items, ...items]"
          :key="idx"
          class="scroll-item"
        >
          <span class="rank" :style="{ background: rankColor(item.rank) }">{{ item.rank }}</span>
          <span class="name">{{ item.name }}</span>
          <span class="value">{{ item.value.toLocaleString() }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.carousel-list {
  width: 100%;
  height: 100%;
  background: #1a1a2e;
  overflow: hidden;
  padding: 12px;
  box-sizing: border-box;
}
.scroll-container {
  height: 100%;
  overflow: hidden;
  position: relative;
}
.scroll-content {
  animation: scrollUp 16s linear infinite;
}
.scroll-container.paused .scroll-content {
  animation-play-state: paused;
}
.scroll-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  gap: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  transition: background 0.2s;
}
.scroll-item:hover {
  background: rgba(24, 144, 255, 0.1);
}
.rank {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
.name {
  flex: 1;
  color: #e0e0e0;
  font-size: 14px;
}
.value {
  color: #40a9ff;
  font-size: 14px;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}
@keyframes scrollUp {
  0% { transform: translateY(0); }
  100% { transform: translateY(-50%); }
}
</style>
