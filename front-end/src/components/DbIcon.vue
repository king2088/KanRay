<template>
  <svg v-if="icon && icon.svg" class="db-type-icon" :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true">
    <g v-html="icon.svg" />
  </svg>
  <svg v-else-if="icon" class="db-type-icon" :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true">
    <path :d="icon.path" :fill="icon.color" />
  </svg>
  <span v-else class="db-type-fallback" :style="{ width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.55) + 'px' }" aria-hidden="true">
    {{ letter }}
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { getDbIcon, getDbLetter } from '@/utils/dbIcons'

const props = defineProps({
  type: { type: String, required: true },
  size: { type: Number, default: 16 },
})

const icon = computed(() => getDbIcon(props.type))
const letter = computed(() => getDbLetter(props.type))
</script>

<style scoped>
.db-type-icon {
  flex-shrink: 0;
  vertical-align: -0.18em;
}

.db-type-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: var(--app-primary-light, #e8f1fd);
  color: var(--app-primary, #3b82f6);
  font-weight: 600;
  line-height: 1;
  flex-shrink: 0;
}
</style>