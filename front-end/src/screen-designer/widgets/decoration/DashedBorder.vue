<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  data: any
  style: any
  props: any
}>()

const borderColor = computed(() => props.props?.borderColor || '#40a9ff')
const dashWidth = computed(() => props.props?.dashWidth || 8)
const dashGap = computed(() => props.props?.dashGap || 6)
const duration = computed(() => props.props?.duration || 12)
</script>

<template>
  <div class="dashed-border-wrapper">
    <div
      class="dashed-border"
      :style="{
        '--border-color': borderColor,
        '--dash-w': dashWidth + 'px',
        '--dash-g': dashGap + 'px',
        '--dur': duration + 's',
      }"
    >
      <div class="dashed-border-inner">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashed-border-wrapper {
  width: 100%;
  height: 100%;
  padding: 2px;
  box-sizing: border-box;
}
.dashed-border {
  width: 100%;
  height: 100%;
  border: 2px dashed var(--border-color);
  border-radius: 4px;
  animation: dashMove var(--dur) linear infinite;
}
.dashed-border-inner {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
@keyframes dashMove {
  0% { border-color: var(--border-color); opacity: 1; }
  50% { opacity: 0.5; }
  100% { border-color: var(--border-color); opacity: 1; }
}
</style>
