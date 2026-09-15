<template>
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <!-- 数据库/Schema：经典圆柱体 -->
    <template v-if="kind === 'schema' || kind === 'database'">
      <path d="M4 6c0-1.66 3.58-3 8-3s8 1.34 8 3" />
      <path d="M4 6v9c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
      <path d="M4 10.5c0 1.66 3.58 3 8 3s8-1.34 8-3" />
    </template>
    <!-- 表：带表头的网格 -->
    <template v-else-if="kind === 'table'">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 9h16" />
      <path d="M12 4v16" />
    </template>
    <!-- 字段/列：类型感知图标 -->
    <template v-else>
      <!-- 数值：# 号 -->
      <template v-if="isNumeric">
        <path d="M9 4l-2 16" />
        <path d="M15 4l-2 16" />
        <path d="M5 8.5h14" />
        <path d="M5 15.5h14" />
      </template>
      <!-- 时间/日期：时钟 -->
      <template v-else-if="isTime">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l2.5 2.5" />
      </template>
      <!-- 文本/字符串：字母 A -->
      <template v-else>
        <path d="M9 18L12 4l3 14" />
        <path d="M10 14h4" />
      </template>
    </template>
  </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  kind:   { type: String, required: true },
  rawType:{ type: String, default: '' },
})

const t = computed(() => String(props.rawType || '').toLowerCase())
const isNumeric = computed(() => /int|float|double|decimal|numeric|bigint|smallint|tinyint|number|real|serial/.test(t.value))
const isTime    = computed(() => /date|time|timestamp/.test(t.value))
</script>
