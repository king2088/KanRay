<template>
  <div class="json-codemirror">
    <MonacoEditor :model-value="modelValue" language="json" readonly height="100%" />
  </div>
</template>

<script setup>
import MonacoEditor from '@/components/MonacoEditor.vue'

defineProps({
  modelValue: { type: String, default: '' },
})
</script>

<style scoped>
.json-codemirror {
  height: 360px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  overflow: hidden;
}
</style>