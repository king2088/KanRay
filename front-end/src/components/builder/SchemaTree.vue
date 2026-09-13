<template>
  <div class="schema-tree">
    <el-input v-model="query" size="small" placeholder="搜索表 / 字段" clearable @input="onSearch" />
    <div class="schema-tree__body" ref="bodyEl">
      <el-tree-v2
        ref="treeRef"
        :data="treeData"
        :props="{ children: 'children', label: 'n', value: 'id' }"
        :height="treeHeight"
        :default-expanded-keys="defaultExpanded"
        :filter-method="filterMethod"
        :item-size="30"
      >
        <template #default="{ data }">
          <span
            class="schema-tree__node"
            :class="{ 'schema-tree__node--draggable': data.kind === 'table' }"
            :draggable="data.kind === 'table'"
            @dragstart="onDragStart($event, data.id)"
          >
            <el-icon :size="14" class="schema-tree__icon"><component :is="iconMap[data.kind]" /></el-icon>
            <span class="schema-tree__label">{{ data.n }}</span>
            <el-tag v-if="data.kind === 'field' && roleMeta(data.raw)?.metric" size="small" effect="plain" type="primary">指标</el-tag>
            <el-tag v-else-if="data.kind === 'field' && roleMeta(data.raw)?.dimension" size="small" effect="plain" type="success">维度</el-tag>
            <el-tag v-else-if="data.kind === 'field' && roleMeta(data.raw)?.time" size="small" effect="plain" type="warning">时间</el-tag>
            <span class="schema-tree__actions">
              <el-button v-if="data.kind === 'table'" link size="small" type="primary" @click.stop="emit('mount-table', data.id)">上架</el-button>
              <el-button v-if="data.kind === 'table' && showFields" link size="small" @click.stop="emit('open-table', data.id)">打开</el-button>
              <el-button v-if="data.kind === 'field'" link size="small" @click.stop="emit('pick-field', data.raw, $event)">插入</el-button>
            </span>
          </span>
        </template>
      </el-tree-v2>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Folder, Grid, Rank } from '@element-plus/icons-vue'
import { toTree } from '@/utils/catalog'

const props = defineProps({
  catalog: { type: Array, default: () => [] },
  showFields: { type: Boolean, default: true },
})
const emit = defineEmits(['mount-table', 'open-table', 'pick-field'])

const iconMap = { schema: Folder, table: Grid, field: Rank }
const query = ref('')
const treeRef = ref(null)
const bodyEl = ref(null)
const treeHeight = ref(300)

const fullTree = computed(() => toTree(props.catalog))
const treeData = computed(() =>
  props.showFields
    ? fullTree.value
    : fullTree.value.map((s) => ({
        ...s,
        children: (s.children || []).map((t) => ({ ...t, children: [] })),
      }))
)
const defaultExpanded = computed(() => treeData.value.map((s) => s.id))

function filterMethod(value, data) {
  if (!value) return true
  return String(data.n || '').toLowerCase().includes(String(value).toLowerCase())
}

function onSearch(value) {
  const q = String(value || '').trim()
  treeRef.value?.filter(q)
  if (!q) treeRef.value?.setExpandedKeys(defaultExpanded.value)
}

let ro = null
onMounted(() => {
  if (bodyEl.value) treeHeight.value = Math.max(bodyEl.value.clientHeight, 60)
  ro = new ResizeObserver(() => {
    if (bodyEl.value) treeHeight.value = Math.max(bodyEl.value.clientHeight, 60)
  })
  if (bodyEl.value) ro.observe(bodyEl.value)
})
onBeforeUnmount(() => ro?.disconnect())

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
.schema-tree { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.schema-tree__body { flex: 1; min-height: 0; }
.schema-tree__node { display: flex; align-items: center; gap: 6px; font-size: 12px; min-width: 0; }
.schema-tree__node--draggable { cursor: grab; }
.schema-tree__icon { color: var(--app-text-secondary); flex: 0 0 auto; }
.schema-tree__label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.schema-tree__actions { display: none; gap: 2px; flex: 0 0 auto; }
.el-tree-node__content:hover .schema-tree__actions,
.el-tree-node__content:focus-within .schema-tree__actions { display: flex; }
:deep(.el-tree-node__content) { border-radius: 4px; }
:deep(.el-tree-node__content:hover) { background: var(--app-hover); }
</style>