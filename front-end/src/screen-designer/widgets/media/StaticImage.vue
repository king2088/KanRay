<script setup lang="ts">
const props = defineProps<{
  data: any
  style: any
  props: any
}>()
</script>

<template>
  <div class="static-image">
    <img
      v-if="props.props?.src"
      :src="props.props.src"
      :style="{
        objectFit: props.props?.objectFit || 'cover',
        borderRadius: (props.props?.borderRadius || 0) + 'px'
      }"
    />
    <div v-else class="placeholder" @dblclick.stop>
      <el-icon :size="40"><Picture /></el-icon>
      <span>双击上传图片</span>
    </div>
  </div>
</template>

<style scoped>
.static-image {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.static-image img {
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
  cursor: pointer;
}
</style>
