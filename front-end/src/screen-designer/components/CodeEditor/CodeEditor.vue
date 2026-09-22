<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  modelValue: string
  language?: string
  height?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const containerRef = ref<HTMLDivElement>()
const editor = shallowRef<any>(null)
let preventLoop = false

onMounted(async () => {
  if (!containerRef.value) return
  const monaco = await import('monaco-editor')

  editor.value = monaco.editor.create(containerRef.value, {
    value: props.modelValue || '',
    language: props.language || 'javascript',
    theme: 'vs-dark',
    minimap: { enabled: false },
    fontSize: 13,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    wordWrap: 'on',
    ...({ locale: 'zh-cn' } as any)
  } as any)

  if (typeof (monaco.editor as any).setLocale === 'function') {
    (monaco.editor as any).setLocale('zh-cn')
  }

  editor.value.onDidChangeModelContent(() => {
    if (preventLoop) return
    emit('update:modelValue', editor.value.getValue())
  })
})

watch(() => props.modelValue, (val) => {
  if (!editor.value) return
  if (editor.value.getValue() === val) return
  preventLoop = true
  editor.value.setValue(val)
  setTimeout(() => { preventLoop = false }, 0)
})

onUnmounted(() => {
  if (editor.value) {
    editor.value.dispose()
    editor.value = null
  }
})
</script>

<template>
  <div ref="containerRef" :style="{ width: '100%', height: height || '200px' }"></div>
</template>
