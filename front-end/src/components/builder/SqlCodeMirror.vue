<template>
  <div class="sql-editor-wrap">
    <MonacoEditor
      :model-value="modelValue"
      :catalog="catalog"
      :placeholder="placeholder"
      :readonly="readonly"
      language="sql"
      height="100%"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>
</template>

<script setup>
import MonacoEditor from '@/components/MonacoEditor.vue'

defineProps({
  modelValue: { type: String, default: '' },
  catalog: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  readonly: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])
</script>

<style scoped>
.sql-editor-wrap {
  height: 220px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  overflow: hidden;
}
</style>