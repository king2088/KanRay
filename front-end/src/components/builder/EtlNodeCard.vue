<template>
  <div class="etl-node-card" :class="{ 'etl-node-card--selected': selected, 'etl-node-card--error': error }">
    <Handle v-if="node.nodeType !== 'source'" type="target" :position="Position.Left" id="left" />
    <Handle v-if="node.nodeType === 'join'" type="target" :position="Position.Left" id="right" class="handle-handle--right" />
    <div class="etl-node-card__icon" :style="{ background: nodeColor }">{{ etlNodeShort(node.nodeType) }}</div>
    <div class="etl-node-card__body">
      <div class="etl-node-card__title">{{ etlNodeLabel(node.nodeType) }}</div>
      <div class="etl-node-card__desc">{{ desc }}</div>
      <div v-if="error" class="etl-node-card__error">{{ error }}</div>
    </div>
    <Handle v-if="node.nodeType !== 'output'" type="source" :position="Position.Right" id="source" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { etlNodeShort, etlNodeLabel } from '@/utils/etl-nodes'
import { t } from '@/i18n'

const props = defineProps({ node: { type: Object, required: true }, error: { type: String, default: null }, selected: { type: Boolean, default: false }, nodeColor: { type: String, default: '#409eff' } })

const desc = computed(() => {
  const n = props.node
  if (n.nodeType === 'source') return `${n.schema || '-'}.${n.table || '-'}`
  if (n.nodeType === 'join') {
    if (n.rightNodeId) return t('dataset.etl.joinNodeOutput', { type: n.joinType || 'inner' })
    return `${n.joinType || 'inner'} JOIN ${n.to?.schema || '-'}.${n.to?.table || '-'}`
  }
  if (n.nodeType === 'filter') return t('dataset.etl.count.conditions', { count: (n.conditions || []).length })
  if (n.nodeType === 'aggregate') return t('dataset.etl.count.metrics', { count: (n.metrics || []).length })
  if (n.nodeType === 'columnSelect') return t('dataset.etl.count.columns', { count: (n.columns || []).length })
  if (n.nodeType === 'dedup') return (n.columns || []).length ? t('dataset.etl.count.columns', { count: (n.columns || []).length }) : t('dataset.etl.allColumns')
  if (n.nodeType === 'valueReplace') return t('dataset.etl.count.replacements', { count: (n.mappings || []).length })
  if (n.nodeType === 'nullReplace') return t('dataset.etl.count.replacements', { count: (n.mappings || []).length })
  if (n.nodeType === 'trim') return (n.columns || []).length ? t('dataset.etl.count.columns', { count: (n.columns || []).length }) : t('dataset.etl.allColumns')
  if (n.nodeType === 'sqlNode') return n.sql ? `${String(n.sql).substring(0, 20)}...` : t('dataset.etl.customSql')
  return n.limit != null ? `LIMIT ${n.limit}` : etlNodeLabel('output')
})
</script>

<style scoped>
.etl-node-card { display: flex; gap: 8px; align-items: center; background: var(--app-card); border: 1px solid var(--app-border); border-radius: 8px; padding: 8px 10px; width: 180px; cursor: grab; transition: box-shadow .15s, border-color .15s; }
.etl-node-card--selected, .etl-node-card:hover { border-color: var(--app-primary); box-shadow: 0 2px 8px rgba(0, 0, 0, .08); }
.etl-node-card--error { border-color: var(--el-color-danger); }
.etl-node-card__icon { width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 14px; font-weight: 600; }
.etl-node-card__body { min-width: 0; }
.etl-node-card__title { font-size: 13px; font-weight: 600; color: var(--app-text-primary); }
.etl-node-card__desc { font-size: 12px; color: var(--app-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.etl-node-card__error { font-size: 12px; color: var(--el-color-danger); margin-top: 2px; }
</style>