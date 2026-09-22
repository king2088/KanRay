<template>
  <div class="dv-decoration-7">
    <svg class="deco-left" width="21" height="20" viewBox="0 0 21 20">
      <polyline
        points="10,0 19,10 10,20"
        fill="none"
        :stroke="mergedColor[0]"
        stroke-width="4"
      />
      <polyline
        points="2,0 11,10 2,20"
        fill="none"
        :stroke="mergedColor[1]"
        stroke-width="2"
      />
    </svg>
    <div class="deco-content">
      <slot></slot>
    </div>
    <svg class="deco-right" width="21" height="20" viewBox="0 0 21 20">
      <polyline
        points="11,0 2,10 11,20"
        fill="none"
        :stroke="mergedColor[0]"
        stroke-width="4"
      />
      <polyline
        points="19,0 10,10 19,20"
        fill="none"
        :stroke="mergedColor[1]"
        stroke-width="2"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ color?: string[] }>(), {
  color: () => ['#1dc1f5', '#1dc1f5']
})

const mergedColor = computed(() => props.color)
</script>

<style scoped>
.dv-decoration-7 {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}
.deco-left,
.deco-right {
  flex-shrink: 0;
}
.deco-content {
  flex: 1;
  height: 100%;
}
</style>
