<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  data: any
  style: any
  props: any
}>()

const currentIndex = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

const images = computed(() => props.props?.images || [])
const interval = computed(() => props.props?.interval || 3000)

function startLoop() {
  stopLoop()
  if (images.value.length > 1) {
    timer = setInterval(() => {
      currentIndex.value = (currentIndex.value + 1) % images.value.length
    }, interval.value)
  }
}

function stopLoop() {
  if (timer) { clearInterval(timer); timer = null }
}

onMounted(startLoop)
onUnmounted(stopLoop)

// Restart when images or interval change
const watchKey = computed(() => `${images.value.length}-${interval.value}`)
let lastKey = watchKey.value
const checkWatch = () => {
  if (watchKey.value !== lastKey) { lastKey = watchKey.value; startLoop() }
}
setInterval(checkWatch, 1000)
</script>

<template>
  <div class="carousel-image">
    <template v-if="images.length">
      <transition-group name="fade">
        <img
          v-for="(img, idx) in images"
          v-show="idx === currentIndex"
          :key="idx"
          :src="img"
          :style="{ objectFit: props.props?.objectFit || 'cover' }"
        />
      </transition-group>
    </template>
    <div v-else class="placeholder">
      <el-icon :size="40"><Picture /></el-icon>
      <span>双击添加轮播图片</span>
    </div>
  </div>
</template>

<style scoped>
.carousel-image {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.carousel-image img {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
  gap: 5px;
  font-size: 12px;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.6s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
