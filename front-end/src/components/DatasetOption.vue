<template>
  <span class="ds-opt">
    <span class="ds-opt-name">{{ item.name }}</span>
    <span v-if="item.type" class="ds-opt-type"> - {{ item.type }}</span>
  </span>
</template>

<script setup>
defineProps({
  item: { type: Object, required: true },
})
</script>

<style scoped>
.ds-opt {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ds-opt-type {
  color: var(--el-text-color-secondary);
}
</style>