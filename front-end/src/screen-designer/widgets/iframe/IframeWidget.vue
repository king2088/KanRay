<script setup lang="ts">
const props = defineProps<{
  data: any
  style: any
  props: any
}>()

const DEFAULT_SANDBOX = 'allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-downloads allow-presentation allow-storage-access-by-user-activation allow-top-navigation-by-user-activation'
</script>

<template>
  <div class="iframe-wrapper">
    <iframe
      v-if="props.props?.src"
      :src="props.props.src"
      :sandbox="props.props?.sandbox || DEFAULT_SANDBOX"
      allowfullscreen
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      :style="{
        border: 'none',
        width: '100%',
        height: '100%',
        background: props.props?.transparent ? 'transparent' : '#fff'
      }"
    ></iframe>
    <div v-else class="placeholder">
      <el-icon :size="40"><Monitor /></el-icon>
      <span>iframe</span>
    </div>
  </div>
</template>

<style scoped>
.iframe-wrapper {
  width: 100%;
  height: 100%;
  overflow: hidden;
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
