<template>
  <div class="etl-node-card" :class="{ 'etl-node-card--selected': selected, 'etl-node-card--error': error }">
    <Handle v-if="node.nodeType !== 'source'" type="target" :position="Position.Left" id="left" />
    <Handle v-if="node.nodeType === 'join'" type="target" :position="Position.Left" id="right" class="handle-handle--right" />
    <div class="etl-node-card__icon" :style="{ background: nodeColor }">{{ NODE_ICON[node.nodeType] }}</div>
    <div class="etl-node-card__body">
      <div class="etl-node-card__title">{{ NODE_TITLE[node.nodeType] }}</div>
      <div class="etl-node-card__desc">{{ desc }}</div>
      <div v-if="error" class="etl-node-card__error">{{ error }}</div>
    </div>
    <Handle v-if="node.nodeType !== 'output'" type="source" :position="Position.Right" id="source" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const props = defineProps({ node: { type: Object, required: true }, error: { type: String, default: null }, selected: { type: Boolean, default: false }, nodeColor: { type: String, default: '#409eff' } })

const NODE_ICON = { source: '源', join: '联', filter: '筛', aggregate: '聚', output: '出', columnSelect: '选', dedup: '去', valueReplace: '替', nullReplace: '空', trim: '格', sqlNode: 'SQL' }
const NODE_TITLE = { source: '数据源', join: '关联', filter: '筛选', aggregate: '聚合', output: '输出', columnSelect: '选择列', dedup: '去重', valueReplace: '值替换', nullReplace: 'Null替换', trim: '去空格', sqlNode: 'SQL' }

const desc = computed(() => {
  const n = props.node
  if (n.nodeType === 'source') return `${n.schema || '-'}.${n.table || '-'}`
  if (n.nodeType === 'join') {
    if (n.rightNodeId) return `${n.joinType || 'inner'} JOIN 节点输出`
    return `${n.joinType || 'inner'} JOIN ${n.to?.schema || '-'}.${n.to?.table || '-'}`
  }
  if (n.nodeType === 'filter') return `${(n.conditions || []).length} 个条件`
  if (n.nodeType === 'aggregate') return `${(n.metrics || []).length} 指标`
  if (n.nodeType === 'columnSelect') return `${(n.columns || []).length} 列`
  if (n.nodeType === 'dedup') return (n.columns || []).length ? `${(n.columns || []).length} 列` : '全列'
  if (n.nodeType === 'valueReplace') return `${(n.mappings || []).length} 处替换`
  if (n.nodeType === 'nullReplace') return `${(n.mappings || []).length} 处替换`
  if (n.nodeType === 'trim') return (n.columns || []).length ? `${(n.columns || []).length} 列` : '全列'
  if (n.nodeType === 'sqlNode') return n.sql ? `${String(n.sql).substring(0, 20)}...` : '自定义 SQL'
  return n.limit != null ? `LIMIT ${n.limit}` : '输出'
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