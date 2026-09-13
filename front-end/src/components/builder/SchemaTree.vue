<template>
  <el-tree :data="treeData" node-key="id" default-expand-all :props="{ label: 'n', children: 'children' }">
    <template #default="{ data }">
      <span class="schema-tree__node">
        <el-icon :size="14" class="schema-tree__icon"><component :is="iconMap[data.kind]" /></el-icon>
        <span class="schema-tree__label">{{ data.n }}</span>
        <el-tag v-if="data.kind === 'field' && roleMeta(data.raw)?.metric" size="small" effect="plain" type="primary">指标</el-tag>
        <el-tag v-else-if="data.kind === 'field' && roleMeta(data.raw)?.dimension" size="small" effect="plain" type="success">维度</el-tag>
        <el-tag v-else-if="data.kind === 'field' && roleMeta(data.raw)?.time" size="small" effect="plain" type="warning">时间</el-tag>
        <span class="schema-tree__actions">
          <el-button v-if="data.kind === 'table'" link size="small" type="primary" draggable @dragstart="onDragStart($event, data.id)" @click.stop="emit('mount-table', data.id)">上架</el-button>
          <el-button v-if="data.kind === 'table'" link size="small" @click.stop="emit('open-table', data.id)">打开</el-button>
          <el-button v-if="data.kind === 'field'" link size="small" @click.stop="emit('pick-field', data.raw, $event)">插入</el-button>
        </span>
      </span>
    </template>
  </el-tree>
</template>

<script setup>
import { computed } from 'vue'
import { Folder, Grid, Rank } from '@element-plus/icons-vue'
import { toTree } from '@/utils/catalog'

const props = defineProps({ catalog: { type: Array, default: () => [] } })
const emit = defineEmits(['mount-table', 'open-table', 'pick-field'])

const iconMap = { schema: Folder, table: Grid, field: Rank }
const treeData = computed(() => toTree(props.catalog))

function roleMeta(raw) {
  const role = raw?.role || ''
  return { metric: role === 'metric', dimension: role === 'dimension', time: role === 'time' }
}

function onDragStart(e, tableId) {
  e.dataTransfer.setData('text/plain', tableId)
  e.dataTransfer.effectAllowed = 'copy'
}
</script>

<style scoped>
.schema-tree__node { display: flex; align-items: center; gap: 6px; font-size: 12px; min-width: 0; }
.schema-tree__icon { color: var(--app-text-secondary); flex: 0 0 auto; }
.schema-tree__label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.schema-tree__actions { display: none; gap: 2px; flex: 0 0 auto; }
.el-tree-node__content:hover .schema-tree__actions,
.el-tree-node__content:focus-within .schema-tree__actions { display: flex; }
:deep(.el-tree-node__content) { height: 30px; }
:deep(.el-tree-node__content:hover) { background: var(--app-hover); border-radius: 4px; }
</style>