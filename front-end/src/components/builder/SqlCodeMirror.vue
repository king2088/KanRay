<template>
  <div class="sql-codemirror">
    <MonacoEditor
      :model-value="modelValue"
      :catalog="catalog"
      :placeholder="placeholder"
      language="sql"
      height="100%"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>
</template>

<script setup>
import MonacoEditor from '@/components/MonacoEditor.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  catalog: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])
void props
</script>

<style scoped>
.sql-codemirror {
  height: 220px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  overflow: hidden;
}
</style>