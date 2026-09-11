<template>
  <svg
    class="ct-icon"
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <g v-html="content" />
  </svg>
</template>

<script setup>
import { computed } from 'vue'
import { CHART_ICON_PATHS } from '@/config/chart-icons'

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 50 },
})

const content = computed(() => CHART_ICON_PATHS[props.name] || CHART_ICON_PATHS.bar)
</script>

<style scoped>
.ct-icon {
  display: block;
  flex-shrink: 0;
}
</style>