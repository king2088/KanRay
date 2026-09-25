<template>
  <div class="monaco-editor-wrap" :style="{ height: height, width: '100%' }">
    <div ref="containerRef" class="monaco-editor-host"></div>
    <div
      v-if="showPlaceholder"
      ref="placeholderRef"
      class="monaco-editor-placeholder"
      pointer-events="none"
    >{{ placeholder }}</div>
  </div>
</template>

<script setup>
import { ref, shallowRef, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { loadMonaco } from '@/utils/monacoCore'
import { buildCatalogIndex, registerSqlCatalog, unregisterSqlCatalog, setSqlCatalog } from '@/utils/monacoSqlCompletion'

const props = defineProps({
  modelValue: { type: String, default: '' },
  language: { type: String, default: 'text' },
  readonly: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  height: { type: String, default: '100%' },
  catalog: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue'])

const containerRef = ref(null)
const placeholderRef = ref(null)
const editor = shallowRef(null)
let themeObserver = null
let appliedTheme = isDark() ? 'vs-dark' : 'vs'
let preventLoop = false
let disposed = false
let isMounted = false

function isDark() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
}

// 每个实例拥有独立的 catalog token，注册到共享的 util 模块（见 monacoSqlCompletion.js）
const catalogToken = Symbol('sql-catalog')
let catalogIndex = buildCatalogIndex(props.catalog)

watch(() => props.catalog, (v) => {
  catalogIndex = buildCatalogIndex(v)
  if (isMounted) setSqlCatalog(catalogToken, catalogIndex)
}, { deep: true })

const showPlaceholder = computed(() =>
  !!props.placeholder && props.modelValue === ''
)

function layoutPlaceholder() {
  if (!placeholderRef.value || !editor.value) return
  const info = editor.value.getLayoutInfo()
  placeholderRef.value.style.left = `${info.contentLeft + 4}px`
  placeholderRef.value.style.top = `${info.contentTop + 4}px`
  placeholderRef.value.style.fontSize = `${info.fontInfo?.fontSize || 13}px`
}

watch(showPlaceholder, (v) => { if (v) layoutPlaceholder() })

onMounted(async () => {
  if (!containerRef.value) return
  disposed = false
  isMounted = true
  const monaco = await loadMonaco(['sql', 'json'])
  if (disposed || !containerRef.value) return

  if (typeof monaco.editor.setLocale === 'function') {
    monaco.editor.setLocale('zh-cn')
  }
  registerSqlCatalog(monaco, catalogToken, catalogIndex)

  editor.value = monaco.editor.create(containerRef.value, {
    value: props.modelValue || '',
    language: props.language,
    theme: appliedTheme,
    readOnly: props.readonly,
    minimap: { enabled: false },
    fontSize: 13,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    wordWrap: 'on',
    ...({ locale: 'zh-cn' })
  })

  editor.value.onDidChangeModelContent(() => {
    if (preventLoop) return
    emit('update:modelValue', editor.value.getValue())
  })

  editor.value.onDidLayoutChange(() => layoutPlaceholder())
  editor.value.onDidChangeModel(() => layoutPlaceholder())

  if (showPlaceholder.value) layoutPlaceholder()

  themeObserver = new MutationObserver(() => {
    if (!editor.value) return
    const theme = isDark() ? 'vs-dark' : 'vs'
    if (appliedTheme !== theme) {
      appliedTheme = theme
      monaco.editor.setTheme(theme)
    }
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

watch(() => props.modelValue, (val) => {
  if (!editor.value) return
  if (editor.value.getValue() === val) return
  preventLoop = true
  editor.value.setValue(val || '')
  setTimeout(() => { preventLoop = false }, 0)
})

onBeforeUnmount(() => {
  disposed = true
  isMounted = false
  unregisterSqlCatalog(catalogToken)
  themeObserver?.disconnect()
  if (editor.value) {
    editor.value.dispose()
    editor.value = null
  }
})
</script>

<style scoped>
.monaco-editor-wrap {
  position: relative;
  overflow: hidden;
  min-height: 0;
}
.monaco-editor-host {
  position: absolute;
  inset: 0;
}
.monaco-editor-placeholder {
  position: absolute;
  pointer-events: none;
  color: var(--app-text-secondary);
  font-family: 'SFMono-Regular', Consolas, monospace;
  line-height: 1.6;
  white-space: pre;
  opacity: 0.75;
  user-select: none;
}
.monaco-editor-wrap :deep(.monaco-editor),
.monaco-editor-wrap :deep(.monaco-editor .monaco-editor-background),
.monaco-editor-wrap :deep(.monaco-editor .margin) {
  background-color: transparent !important;
}
</style>