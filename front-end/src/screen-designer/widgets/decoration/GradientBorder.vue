<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  data: any
  style: any
  props: any
}>()

const colors = computed(() => props.props?.colors || ['#40a9ff', '#ff4d4f', '#52c41a', '#40a9ff'])
const duration = computed(() => props.props?.duration || 4)
</script>

<template>
  <div class="gradient-border-wrapper">
    <div
      class="gradient-border"
      :style="{
        '--c1': colors[0],
        '--c2': colors[1],
        '--c3': colors[2],
        '--c4': colors[3] || colors[0],
        '--dur': duration + 's',
      }"
    >
      <div class="gradient-border-inner">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gradient-border-wrapper {
  width: 100%;
  height: 100%;
  padding: 2px;
  background: linear-gradient(
    var(--angle, 0deg),
    var(--c1),
    var(--c2),
    var(--c3),
    var(--c4)
  );
  animation: borderRotate var(--dur) linear infinite;
  box-sizing: border-box;
}
.gradient-border-inner {
  width: 100%;
  height: 100%;
  background: #1a1a2e;
  display: flex;
  align-items: center;
  justify-content: center;
}
@keyframes borderRotate {
  0% { --angle: 0deg; }
  100% { --angle: 360deg; }
}
@property --angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}
</style>
