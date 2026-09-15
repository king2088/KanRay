<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style="flex-shrink: 0"
  >
    <template v-if="shape === 'bar'">
      <rect x="3" y="13" width="3" height="8" rx="1" fill="currentColor" />
      <rect x="8" y="9" width="3" height="12" rx="1" fill="currentColor" />
      <rect x="13" y="14" width="3" height="7" rx="1" fill="currentColor" />
      <rect x="18" y="6" width="3" height="15" rx="1" fill="currentColor" />
    </template>

    <template v-else-if="shape === 'horizontalBar'">
      <rect x="3" y="5" width="15" height="3" rx="1" fill="currentColor" />
      <rect x="3" y="10.5" width="11" height="3" rx="1" fill="currentColor" />
      <rect x="3" y="16" width="18" height="3" rx="1" fill="currentColor" />
    </template>

    <template v-else-if="shape === 'line'">
      <polyline points="3,18 8,10 14,14 21,5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="3" cy="18" r="1.5" fill="currentColor" />
      <circle cx="8" cy="10" r="1.5" fill="currentColor" />
      <circle cx="14" cy="14" r="1.5" fill="currentColor" />
      <circle cx="21" cy="5" r="1.5" fill="currentColor" />
    </template>

    <template v-else-if="shape === 'pie'">
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="1.8" />
      <path d="M12 12 L12 3 A9 9 0 0 1 20.5 8.2 Z" fill="currentColor" />
    </template>

    <template v-else-if="shape === 'funnel'">
      <path d="M3 3 H21 L17 10 H7 Z" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
      <path d="M7 12 H17 L15 18 H9 Z" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
      <rect x="9" y="20" width="6" height="2" rx="1" fill="currentColor" />
    </template>

    <template v-else-if="shape === 'scatter'">
      <circle cx="6" cy="15" r="2" fill="currentColor" />
      <circle cx="10" cy="9" r="2.5" fill="currentColor" />
      <circle cx="16" cy="13" r="1.5" fill="currentColor" />
      <circle cx="19" cy="7" r="2" fill="currentColor" />
    </template>

    <template v-else-if="shape === 'indicator'">
      <path d="M3 15 A9 9 0 0 1 21 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <line x1="12" y1="15" x2="16" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <circle cx="12" cy="15" r="2" fill="currentColor" />
    </template>

    <template v-else-if="shape === 'map'">
      <path d="M12 2 C8.1 2 5 5.1 5 9 C5 14.2 12 22 12 22 C12 22 19 14.2 19 9 C19 5.1 15.9 2 12 2 Z" fill="currentColor" opacity="0.2" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
      <circle cx="12" cy="9" r="2.5" fill="currentColor" />
    </template>

    <template v-else-if="shape === 'table'">
      <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8" />
      <line x1="3" y1="8" x2="21" y2="8" stroke="currentColor" stroke-width="1.8" />
      <line x1="10" y1="8" x2="10" y2="21" stroke="currentColor" stroke-width="1.8" />
      <line x1="15.5" y1="8" x2="15.5" y2="21" stroke="currentColor" stroke-width="1.8" />
    </template>

    <template v-else-if="shape === 'heatmap'">
      <rect x="3" y="3" width="5" height="5" rx="1" fill="currentColor" opacity="0.2" />
      <rect x="9.5" y="3" width="5" height="5" rx="1" fill="currentColor" opacity="0.5" />
      <rect x="16" y="3" width="5" height="5" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="3" y="9.5" width="5" height="5" rx="1" fill="currentColor" opacity="0.6" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="16" y="9.5" width="5" height="5" rx="1" fill="currentColor" opacity="0.4" />
      <rect x="3" y="16" width="5" height="5" rx="1" fill="currentColor" opacity="0.7" />
      <rect x="9.5" y="16" width="5" height="5" rx="1" fill="currentColor" opacity="0.25" />
      <rect x="16" y="16" width="5" height="5" rx="1" fill="currentColor" opacity="0.55" />
    </template>

    <template v-else-if="shape === 'boxplot'">
      <rect x="8" y="8" width="8" height="9" rx="1" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="1.8" />
      <line x1="12" y1="3" x2="12" y2="8" stroke="currentColor" stroke-width="1.8" />
      <line x1="8" y1="3" x2="16" y2="3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      <line x1="12" y1="17" x2="12" y2="22" stroke="currentColor" stroke-width="1.8" />
      <line x1="8" y1="22" x2="16" y2="22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </template>

    <template v-else-if="shape === 'radar'">
      <polygon points="12,3 21,10 18,21 6,21 3,10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
      <line x1="12" y1="3" x2="12" y2="14" stroke="currentColor" stroke-width="1.5" />
      <line x1="21" y1="10" x2="12" y2="14" stroke="currentColor" stroke-width="1.5" />
      <line x1="18" y1="21" x2="12" y2="14" stroke="currentColor" stroke-width="1.5" />
      <line x1="6" y1="21" x2="12" y2="14" stroke="currentColor" stroke-width="1.5" />
      <line x1="3" y1="10" x2="12" y2="14" stroke="currentColor" stroke-width="1.5" />
    </template>

    <template v-else-if="shape === 'calendar'">
      <rect x="3" y="5" width="18" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="1.8" />
      <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="1.8" />
      <line x1="8" y1="3" x2="8" y2="7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      <line x1="16" y1="3" x2="16" y2="7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      <rect x="6" y="13" width="3" height="2.5" rx="0.5" fill="currentColor" />
      <rect x="10.5" y="13" width="3" height="2.5" rx="0.5" fill="currentColor" opacity="0.4" />
      <rect x="15" y="13" width="3" height="2.5" rx="0.5" fill="currentColor" />
      <rect x="6" y="17.5" width="3" height="2.5" rx="0.5" fill="currentColor" opacity="0.4" />
    </template>

    <template v-else-if="shape === 'candlestick'">
      <line x1="6" y1="3" x2="6" y2="22" stroke="currentColor" stroke-width="1.5" />
      <rect x="4.5" y="8" width="3" height="9" rx="0.5" fill="currentColor" />
      <line x1="14" y1="5" x2="14" y2="20" stroke="currentColor" stroke-width="1.5" />
      <rect x="12.5" y="5" width="3" height="8" rx="0.5" fill="currentColor" />
      <line x1="20" y1="7" x2="20" y2="19" stroke="currentColor" stroke-width="1.5" />
      <rect x="18.5" y="9" width="3" height="7" rx="0.5" fill="currentColor" />
    </template>

    <template v-else-if="shape === 'treemap'">
      <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8" />
      <line x1="12" y1="3" x2="12" y2="13" stroke="currentColor" stroke-width="1.8" />
      <line x1="3" y1="13" x2="21" y2="13" stroke="currentColor" stroke-width="1.8" />
      <rect x="4" y="4" width="7" height="8" rx="1" fill="currentColor" opacity="0.15" />
      <rect x="13" y="4" width="7" height="5" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="13" y="10" width="7" height="2.5" rx="1" fill="currentColor" opacity="0.2" />
    </template>

    <template v-else-if="shape === 'sankey' || shape === 'chord'">
      <rect x="2" y="4" width="4" height="16" rx="1" fill="currentColor" opacity="0.2" stroke="currentColor" stroke-width="1.8" />
      <rect x="18" y="6" width="4" height="12" rx="1" fill="currentColor" opacity="0.2" stroke="currentColor" stroke-width="1.8" />
      <path d="M6 7 C12 7 12 9 18 9" fill="none" stroke="currentColor" stroke-width="1.5" />
      <path d="M6 12 C12 12 12 13 18 13" fill="none" stroke="currentColor" stroke-width="1.5" />
      <path d="M6 15 C12 15 12 17 18 17" fill="none" stroke="currentColor" stroke-width="1.5" />
    </template>

    <template v-else-if="shape === 'barBreakAxis'">
      <rect x="3" y="12" width="3" height="9" rx="1" fill="currentColor" />
      <rect x="8" y="8" width="3" height="13" rx="1" fill="currentColor" />
      <rect x="13" y="14" width="3" height="7" rx="1" fill="currentColor" />
      <rect x="18" y="6" width="3" height="15" rx="1" fill="currentColor" />
      <path d="M2 11 L4 9 L6 11 L8 9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <!-- gauge / polarBar / default -->
    <template v-else>
      <path d="M3 15 A9 9 0 0 1 21 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <line x1="12" y1="15" x2="16" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <circle cx="12" cy="15" r="2" fill="currentColor" />
    </template>
  </svg>
</template>

<script setup>
import { computed } from 'vue'
import { getChartType } from '@/config/chart-types'

const props = defineProps({
  type: { type: String, required: true },
  size: { type: Number, default: 16 },
})

const shape = computed(() => {
  const cat = getChartType(props.type)?.category || 'other'
  if (cat !== 'other') return cat
  return props.type || 'gauge'
})
</script>
