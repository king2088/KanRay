<template>
  <div class="json-editor-wrap" :style="{ height }">
    <MonacoEditor :model-value="modelValue" language="json" :readonly="readonly" height="100%" />
  </div>
</template>

<script setup>
import MonacoEditor from '@/components/MonacoEditor.vue'

defineProps({
  modelValue: { type: String, default: '' },
  readonly: { type: Boolean, default: false },
  height: { type: String, default: '360px' },
})
</script>

<style scoped>
.json-editor-wrap {
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  overflow: hidden;
}
</style>