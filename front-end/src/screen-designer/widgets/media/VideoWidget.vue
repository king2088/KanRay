<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  data: any
  style: any
  props: any
}>()

const src = computed(() => props.props?.src || '')
const autoplay = computed(() => props.props?.autoplay === true)
const loop = computed(() => props.props?.loop === true)
const muted = computed(() => props.props?.muted === true)
const objectFit = computed(() => props.props?.objectFit || 'cover')
</script>

<template>
  <div class="video-wrapper">
    <video
      v-if="src"
      :src="src"
      :autoplay="autoplay"
      :loop="loop"
      :muted="muted"
      :style="{ objectFit: objectFit }"
      playsinline
    ></video>
    <div v-else class="placeholder">
      <el-icon :size="40"><VideoCamera /></el-icon>
      <span>配置视频地址</span>
    </div>
  </div>
</template>

<style scoped>
.video-wrapper {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.video-wrapper video {
  width: 100%;
  height: 100%;
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
</style>
