<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  data: any
  style: any
  props: any
}>()

const color = computed(() => props.props?.color || '#40a9ff')
const intensity = computed(() => props.props?.intensity || 0.4)
const size = computed(() => props.props?.size || 50)
const pulse = computed(() => props.props?.pulse ?? true)
</script>

<template>
  <div class="glow-effect">
    <div
      class="glow-orb"
      :class="{ pulsing: pulse }"
      :style="{
        '--glow-color': color,
        '--glow-intensity': intensity,
        '--glow-size': size + '%',
      }"
    />
    <div class="glow-content">
      <slot></slot>
    </div>
  </div>
</template>

<style scoped>
.glow-effect {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: #1a1a2e;
}
.glow-orb {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: var(--glow-size);
  height: var(--glow-size);
  border-radius: 50%;
  background: radial-gradient(circle, var(--glow-color) 0%, transparent 70%);
  opacity: var(--glow-intensity);
  filter: blur(30px);
  pointer-events: none;
}
.glow-orb.pulsing {
  animation: glowPulse 3s ease-in-out infinite;
}
.glow-content {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
@keyframes glowPulse {
  0%, 100% {
    opacity: var(--glow-intensity);
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: calc(var(--glow-intensity) * 1.5);
    transform: translate(-50%, -50%) scale(1.15);
  }
}
</style>
