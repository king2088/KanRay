<template>
  <div ref="container" class="json-codemirror" />
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { EditorView, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { basicSetup } from 'codemirror'
import { json } from '@codemirror/lang-json'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { defaultKeymap } from '@codemirror/commands'

const props = defineProps({
  modelValue: { type: String, default: '' },
})

const container = ref(null)
let view

const cmTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px', backgroundColor: 'transparent' },
  '.cm-scroller': { fontFamily: "'SFMono-Regular', Consolas, monospace", lineHeight: '1.6' },
  '.cm-content': { color: 'var(--app-text-primary)', padding: '4px 0' },
  '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--app-text-secondary)', borderRight: '1px solid var(--app-border)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: '#b4d5fe !important' },
  '.cm-cursor': { borderLeftColor: 'var(--app-text-primary)' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--app-hover) 30%, transparent)' },
})

const jsonHighlight = HighlightStyle.define([
  { tag: tags.propertyName, color: 'var(--app-text-primary)' },
  { tag: tags.string, color: 'var(--el-color-success)' },
  { tag: tags.number, color: 'var(--el-color-warning)' },
  { tag: tags.bool, color: 'var(--el-color-danger)' },
  { tag: tags.null, color: 'var(--app-text-secondary)' },
])

onMounted(() => {
  view = new EditorView({
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        basicSetup,
        json(),
        syntaxHighlighting(jsonHighlight),
        cmTheme,
        EditorView.lineWrapping,
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        keymap.of([...defaultKeymap]),
      ],
    }),
    parent: container.value,
  })
})

watch(
  () => props.modelValue,
  (v) => {
    if (!view || view.state.composing) return
    if (v !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } })
    }
  }
)

onBeforeUnmount(() => { view?.destroy() })
</script>

<style scoped>
.json-codemirror {
  height: 360px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  overflow: hidden;
}
</style>