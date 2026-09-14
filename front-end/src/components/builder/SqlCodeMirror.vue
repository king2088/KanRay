<template>
  <div ref="container" class="sql-codemirror" />
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { basicSetup } from 'codemirror'
import { sql, MySQL } from '@codemirror/lang-sql'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { defaultKeymap } from '@codemirror/commands'

const props = defineProps({
  modelValue: { type: String, default: '' },
  catalog: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const container = ref(null)
const sqlComp = new Compartment()
let view

function buildSqlConfig(catalog) {
  const tables = (catalog || []).flatMap((s) =>
    (s.tables || []).map((t) => ({
      schema: s.schema,
      name: t.table,
      columns: (t.columns || []).map((c) => ({ name: c.name, type: c.type })),
    }))
  )
  const schemas = [...new Set((catalog || []).map((s) => s.schema))]
  return sql({ dialect: MySQL, schema: schemas, tables, upperCaseKeywords: true })
}

const cmTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '12px', backgroundColor: 'transparent' },
  '.cm-scroller': { fontFamily: "'SFMono-Regular', Consolas, monospace", lineHeight: '1.6' },
  '.cm-content': { color: 'var(--app-text-primary)', padding: '4px 0' },
  '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--app-text-secondary)', borderRight: '1px solid var(--app-border)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: '#b4d5fe !important' },
  '.cm-cursor': { borderLeftColor: 'var(--app-text-primary)' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--app-hover) 30%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'color-mix(in srgb, var(--app-hover) 30%, transparent)' },
  '.cm-tooltip': { backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text-primary)' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--el-color-primary-light-8)', color: 'var(--app-text-primary)' },
  '.cm-tooltip-autocomplete > ul > li': { display: 'flex', alignItems: 'center', gap: '8px' },
})

const sqlHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--el-color-primary)' },
  { tag: tags.operator, color: 'var(--app-text-regular)' },
  { tag: tags.string, color: 'var(--el-color-success)' },
  { tag: tags.number, color: 'var(--el-color-warning)' },
  { tag: tags.comment, color: 'var(--app-text-secondary)', fontStyle: 'italic' },
  { tag: tags.typeName, color: 'var(--el-color-primary-light-3)' },
  { tag: tags.variableName, color: 'var(--app-text-primary)' },
])

onMounted(() => {
  const state = EditorState.create({
    doc: props.modelValue,
    extensions: [
      basicSetup,
      syntaxHighlighting(sqlHighlight),
      sqlComp.of(buildSqlConfig(props.catalog)),
      cmTheme,
      EditorView.lineWrapping,
      keymap.of([...defaultKeymap]),
      props.placeholder ? placeholder(props.placeholder) : [],
      EditorView.updateListener.of((update) => {
        if (update.docChanged) emit('update:modelValue', update.state.doc.toString())
      }),
    ],
  })
  view = new EditorView({ state, parent: container.value })
})

watch(() => props.catalog, (v) => {
  if (view) view.dispatch({ effects: sqlComp.reconfigure(buildSqlConfig(v)) })
}, { deep: true })

watch(() => props.modelValue, (v) => {
  if (!view || view.state.composing) return
  if (v !== view.state.doc.toString()) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } })
  }
})

onBeforeUnmount(() => { view?.destroy() })
</script>

<style scoped>
.sql-codemirror { height: 220px; border: 1px solid var(--el-border-color); border-radius: 6px; overflow: hidden; }
</style>