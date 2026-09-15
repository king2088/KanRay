<template>
  <svg v-if="icon" class="db-type-icon" :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true">
    <path :d="icon.path" :fill="icon.color" />
  </svg>
  <el-icon v-else :size="size" class="db-type-icon"><Coin /></el-icon>
</template>

<script setup>
import { computed } from 'vue'
import { getDbIcon } from '@/utils/dbIcons'

const props = defineProps({
  type: { type: String, required: true },
  size: { type: Number, default: 16 },
})

const icon = computed(() => getDbIcon(props.type))
</script>

<style scoped>
.db-type-icon {
  flex-shrink: 0;
  vertical-align: -0.18em;
}
</style>