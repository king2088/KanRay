<script setup lang="ts">
const props = defineProps<{
  data: any
  style: any
  props: any
}>()

const borderType = props.props?.type || 'basic'
</script>

<template>
  <div class="border-decoration" :class="`border-${borderType}`">
    <slot></slot>
  </div>
</template>

<style scoped>
.border-decoration {
  width: 100%;
  height: 100%;
  position: relative;
}

.border-basic {
  border: 2px solid #1890ff;
  border-radius: 4px;
}

.border-round {
  border: 2px solid #1890ff;
  border-radius: 12px;
}

.border-tech {
  border: 1px solid rgba(24, 144, 255, 0.6);
  background: linear-gradient(135deg, rgba(24, 144, 255, 0.1), transparent);
}

.border-tech::before,
.border-tech::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  border: 2px solid #1890ff;
}

.border-tech::before {
  top: -2px;
  left: -2px;
  border-right: none;
  border-bottom: none;
}

.border-tech::after {
  bottom: -2px;
  right: -2px;
  border-left: none;
  border-top: none;
}

.border-glow {
  border: 1px solid #1890ff;
  box-shadow: 0 0 10px rgba(24, 144, 255, 0.5), inset 0 0 10px rgba(24, 144, 255, 0.1);
  border-radius: 4px;
  animation: glow-pulse 2s ease-in-out infinite;
}

@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 10px rgba(24, 144, 255, 0.5), inset 0 0 10px rgba(24, 144, 255, 0.1); }
  50% { box-shadow: 0 0 20px rgba(24, 144, 255, 0.8), inset 0 0 20px rgba(24, 144, 255, 0.2); }
}
</style>