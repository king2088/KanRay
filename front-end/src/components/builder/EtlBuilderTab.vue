<template>
  <div class="etl-builder">
    <div class="etl-builder__left">
      <div class="etl-builder__panel-title">表 / 字段</div>
      <el-tree :data="computedTree" node-key="id" :props="{ label: 'n', children: 'children' }" @node-click="onNodeClick" />
      <el-divider />
      <div class="etl-builder__panel-title">节点操作</div>
      <el-button size="small" :disabled="!tableOptions.length" @click="addJoinNode">+ 关联节点</el-button>
      <el-button size="small" @click="addFilterNode">+ 筛选节点</el-button>
      <el-button size="small" @click="addAggNode">+ 聚合节点</el-button>
    </div>

    <div class="etl-builder__mid">
      <div class="etl-builder__panel-title">节点链路</div>
      <el-steps direction="vertical" :active="activeNodeIndex" class="etl-builder__steps">
        <el-step v-for="(n, i) in nodes" :key="n.nodeId" :title="nodeTitle(n)" :description="nodeDesc(n)">
          <template #icon>
            <el-tag :color="nodeTagColor(n)" effect="dark" size="small">{{ NODE_ICON[n.nodeType] }}</el-tag>
          </template>
          <template #default>
            <div style="display:flex;gap:6px;margin-top:4px">
              <el-button link size="small" type="primary" @click="selectNode(i)">配置</el-button>
              <el-button link size="small" type="success" :loading="previewingNode === n.nodeId" @click="previewNode(n)">预览此节点</el-button>
              <el-button v-if="canDelete(n)" link size="small" type="danger" @click="deleteNode(i)">删</el-button>
            </div>
            <el-tag v-if="nodeError[n.nodeId]" type="danger" size="small" style="margin-top:4px">{{ nodeError[n.nodeId] }}</el-tag>
          </template>
        </el-step>
      </el-steps>
    </div>

    <div class="etl-builder__config">
      <template v-if="activeNode">
        <div class="etl-builder__panel-title">配置 · {{ nodeTitle(activeNode) }}</div>
        <!-- source -->
        <template v-if="activeNode.nodeType === 'source'">
          <div class="etl-builder__field">表
            <el-select v-model="activeNode._tableValue" size="small" filterable @change="onSourceChange">
              <el-option v-for="t in tableOptions" :key="t.id" :label="t.label" :value="t.id" />
            </el-select>
          </div>
        </template>
        <!-- join -->
        <template v-if="activeNode.nodeType === 'join'">
          <div class="etl-builder__field">关联表
            <el-select v-model="activeNode._joinTableValue" size="small" filterable @change="onJoinTableChange">
              <el-option v-for="t in tableOptions" :key="t.id" :label="t.label" :value="t.id" />
            </el-select>
          </div>
          <div v-for="(c, i) in activeNode.on" :key="i" class="etl-builder__field">
            字段 {{ activeNode.to.alias }}:
            <el-select v-model="c.to.field" size="small" style="width:130px">
              <el-option v-for="f in joinTargetFields" :key="f.name" :label="f.name" :value="f.name" />
            </el-select>
            = 源字段:
            <el-select v-model="c.from.field" size="small" style="width:130px">
              <el-option v-for="f in sourceFields(activeNode)" :key="f.pref" :label="f.name" :value="f.pref" />
            </el-select>
            <el-button link size="small" type="danger" @click="activeNode.on.splice(i, 1)">删</el-button>
          </div>
          <el-button size="small" @click="activeNode.on.push({ from: { alias: activeNode.sourceAlias || 't0', field: '' }, to: { alias: activeNode.to.alias, field: '' } })">+ 条件</el-button>
        </template>
        <!-- filter -->
        <template v-if="activeNode.nodeType === 'filter'">
          <div v-for="(c, i) in activeNode.conditions" :key="i" class="etl-builder__field">
            <el-select v-model="c.field.alias" size="small" style="width:70px">
              <el-option v-for="t in tables" :key="t.alias" :label="t.alias" :value="t.alias" />
            </el-select>
            <el-select v-model="c.field.field" size="small" style="width:120px">
              <el-option v-for="f in filterFields" :key="f.pref" :label="f.name" :value="f.name" />
            </el-select>
            <el-select v-model="c.op" size="small" style="width:90px">
              <el-option v-for="o in STRING_OPS" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <el-input v-model="c.value" size="small" style="width:120px" />
            <el-button link size="small" type="danger" @click="activeNode.conditions.splice(i, 1)">删</el-button>
          </div>
          <el-button size="small" @click="activeNode.conditions.push({ field: { alias: 't0', field: '' }, op: 'eq', value: '' })">+ 条件</el-button>
        </template>
        <!-- aggregate -->
        <template v-if="activeNode.nodeType === 'aggregate'">
          <div class="etl-builder__field">分组
            <el-select v-model="activeNode.groupBy" multiple collapse-tags filterable size="small" style="width:100%" value-key="pref">
              <el-option v-for="f in sourceFields(activeNode)" :key="f.pref" :label="f.pref" :value="f.pref" />
            </el-select>
          </div>
          <div v-for="(m, i) in activeNode.metrics" :key="i" class="etl-builder__field">
            <el-select v-model="m.agg" size="small" style="width:120px">
              <el-option v-for="a in AGG_OPTIONS" :key="a.value" :label="a.label" :value="a.value" />
            </el-select>
            <el-select v-model="m.field" size="small" style="width:140px" filterable v-if="m.agg !== 'count'">
              <el-option v-for="f in sourceFields(activeNode)" :key="f.pref" :label="f.pref" :value="f.pref" />
            </el-select>
            <el-button link size="small" type="danger" @click="activeNode.metrics.splice(i, 1)">删</el-button>
          </div>
          <el-button size="small" @click="activeNode.metrics.push({ agg: 'sum', field: '' })">+ 指标</el-button>
        </template>
        <!-- output -->
        <template v-if="activeNode.nodeType === 'output'">
          <div class="etl-builder__field">输出行数上限
            <el-input-number v-model="activeNode.limit" :min="1" :max="100000" size="small" />
          </div>
        </template>
      </template>
      <el-empty v-else description="选择节点进行配置" />
    </div>

    <div class="etl-builder__preview">
      <div class="etl-builder__panel-title">节点预览</div>
      <el-table v-if="nodePreview.length" :data="nodePreview" size="small" max-height="400">
        <el-table-column v-for="c in nodePreviewCols" :key="c" :prop="c" :label="c" min-width="110" show-overflow-tooltip />
      </el-table>
      <el-empty v-else description="点击节点「预览此节点」查看真实数据" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { buildApi } from '@/api'
import { toTree, allFields, AGG_OPTIONS, STRING_OPS } from '@/utils/catalog'

const props = defineProps({ datasourceId: { type: [Number, String], required: true }, initialDefinition: Object })
const emit = defineEmits(['change'])

const NODE_ICON = { source: '源', join: '联', filter: '筛', aggregate: '聚', output: '出' }
const schemas = ref([])
const nodes = ref([])
const activeNodeIndex = ref(-1)
const previewingNode = ref(null)
const nodePreview = ref([])
const nodePreviewCols = ref([])
const nodeError = ref({})

const computedTree = computed(() => toTree(schemas.value))
const tableOptions = computed(() => {
  const out = []
  for (const s of schemas.value) for (const t of s.tables || []) out.push({ id: `${s.schema}:${t.table}`, label: `${s.schema}.${t.table}`, schema: s.schema, table: t.table })
  return out
})
const activeNode = computed(() => nodes.value[activeNodeIndex.value] || null)
const joinTargetFields = computed(() => activeNode.value?.nodeType === 'join' ? allFields(schemas.value, `${activeNode.value.to.schema}:${activeNode.value.to.table}`) : [])
const tables = computed(() => nodes.value.filter((n) => n.nodeType === 'source').map((n) => ({ alias: n.alias, schema: n.schema, table: n.table })))
const filterFields = computed(() => activeNode.value?.nodeType === 'filter' ? sourceFields(activeNode.value) : [])

function nodeTitle(n) { return { source: '数据源', join: '关联', filter: '筛选', aggregate: '聚合', output: '输出' }[n.nodeType] }
function nodeDesc(n) {
  if (n.nodeType === 'source') return `${n.schema || '-'}.${n.table || '-'}`
  if (n.nodeType === 'join') return `JOIN ${n.to?.schema || '-'}.${n.to?.table || '-'}`
  if (n.nodeType === 'filter') return `${(n.conditions || []).length} 个条件`
  if (n.nodeType === 'aggregate') return `${(n.metrics || []).length} 指标`
  return `LIMIT ${n.limit}`
}
function nodeTagColor(n) { return { source: '#67c23a', join: '#909399', filter: '#e6a23c', aggregate: '#409eff', output: '#f56c6c' }[n.nodeType] }
function canDelete(n) { return ['join', 'filter', 'aggregate'].includes(n.nodeType) }

/* ---- FIX 1: ensureChain – sequential linking, not skip-intermediate ---- */
function ensureChain() {
  if (!nodes.value.length) {
    nodes.value = [{ nodeId: 'n_src', nodeType: 'source', alias: 't0', schema: null, table: null }]
  }
  // Walk in order; each non-source node points to the one before it
  let prev = null
  for (const n of nodes.value) {
    if (n.nodeType === 'source') {
      prev = n
    } else if (prev) {
      n.sourceNode = prev.nodeId
      prev = n
    }
  }
  // Ensure output at end
  let out = nodes.value.find((n) => n.nodeType === 'output')
  if (!out) {
    const last = nodes.value[nodes.value.length - 1]
    nodes.value.push({ nodeId: 'n_out', nodeType: 'output', sourceNode: last?.nodeId, limit: 1000 })
  } else {
    // Move output to end if not already
    const outIdx = nodes.value.indexOf(out)
    if (outIdx !== nodes.value.length - 1) {
      nodes.value.splice(outIdx, 1)
      nodes.value.push(out)
    }
    const nonOut = nodes.value.filter((n) => n.nodeType !== 'output')
    if (nonOut.length) out.sourceNode = nonOut[nonOut.length - 1].nodeId
  }
  emitChange()
}

/* ---- FIX 3: onSourceChange uses computed activeNode, no activeNode_ hack ---- */
function onSourceChange() {
  fixSourceNode(activeNode.value)
}
function fixSourceNode(node) {
  if (!node) return
  const val = node._tableValue
  if (val && val.includes(':')) {
    const [schema, table] = val.split(':')
    node.schema = schema
    node.table = table
    node.alias = node.alias || `t${nodes.value.filter((n) => n.nodeType === 'source').length}`
    // Ensure sourceNode chain
    ensureChain()
    emitChange()
  }
}

/* ---- FIX 4: join table selection splits schema/table ---- */
function onJoinTableChange() {
  fixJoinTo(activeNode.value)
}
function fixJoinTo(node) {
  if (!node || node.nodeType !== 'join') return
  const val = node._joinTableValue
  if (val && val.includes(':')) {
    const [schema, table] = val.split(':')
    node.to.schema = schema
    node.to.table = table
    emitChange()
  }
}

/* ---- Node CRUD ---- */
function addJoinNode() {
  const idx = nodes.value.length - 1
  nodes.value.splice(idx, 0, {
    nodeId: `n_j${Date.now()}`, nodeType: 'join',
    sourceNode: null,
    to: { alias: `t${tables.value.length + 1}`, schema: null, table: null },
    on: [{ from: { alias: 't0', field: '' }, to: { alias: `t${tables.value.length + 1}`, field: '' } }],
    _joinTableValue: '',
  })
  ensureChain()
}
function addFilterNode() {
  const idx = nodes.value.length - 1
  nodes.value.splice(idx, 0, {
    nodeId: `n_f${Date.now()}`, nodeType: 'filter',
    sourceNode: null,
    conditions: [{ field: { alias: 't0', field: '' }, op: 'eq', value: '' }],
  })
  ensureChain()
}
function addAggNode() {
  const idx = nodes.value.length - 1
  nodes.value.splice(idx, 0, {
    nodeId: `n_a${Date.now()}`, nodeType: 'aggregate',
    sourceNode: null,
    groupBy: [],
    metrics: [{ agg: 'sum', field: '' }],
  })
  ensureChain()
}
function deleteNode(i) { nodes.value.splice(i, 1); ensureChain() }
function selectNode(i) { activeNodeIndex.value = i }

/* ---- sourceFields: all fields from tables in chain with composite pref ---- */
function sourceFields(n) {
  const out = []
  for (const src of nodes.value) {
    if (src.nodeType === 'source') for (const f of allFields(schemas.value, `${src.schema}:${src.table}`)) out.push({ ...f, pref: `${src.alias}.${f.name}` })
    if (src.nodeType === 'join') for (const f of allFields(schemas.value, `${src.to?.schema}:${src.to?.table}`)) out.push({ ...f, pref: `${src.to?.alias}.${f.name}` })
  }
  return out
}

/* ---- Preview ---- */
async function previewNode(node) {
  previewingNode.value = node.nodeId
  nodeError.value[node.nodeId] = null
  try {
    const res = await buildApi.previewNode(props.datasourceId, definition.value, node.nodeId, 200)
    nodePreview.value = res.rows
    nodePreviewCols.value = res.rows.length ? Object.keys(res.rows[0]) : (res.fields || []).map((f) => f.name)
  } catch (e) {
    nodeError.value[node.nodeId] = e.message || '节点执行失败'
  } finally { previewingNode.value = null }
}

/* ---- definition + emit ---- */
const stripInternal = (arr) => JSON.parse(JSON.stringify(arr)).map((n) => {
  const o = { ...n }
  for (const k of Object.keys(o)) if (k.startsWith('_')) delete o[k]
  return o
})
const definition = computed(() => ({ type: 'etl', nodes: stripInternal(nodes.value) }))
function emitChange() { emit('change', { definition: definition.value }) }

function onNodeClick(data) { if (data.kind === 'field') insertFieldSql(data.raw) }
function insertFieldSql() {}

/* ---- FIX 2: restore normalizes composite strings for aggregate groupBy/metrics ---- */
function restore(def) {
  if (!def || def.type !== 'etl') return
  const restored = JSON.parse(JSON.stringify(def.nodes || []))
  for (const n of restored) {
    if (n.nodeType === 'source') {
      n._tableValue = n.schema && n.table ? `${n.schema}:${n.table}` : ''
    }
    if (n.nodeType === 'join') {
      n._joinTableValue = n.to?.schema && n.to?.table ? `${n.to.schema}:${n.to.table}` : ''
    }
    if (n.nodeType === 'aggregate') {
      // Normalize groupBy: {alias,field} → composite string; string keep as-is
      n.groupBy = (n.groupBy || []).map((g) => {
        if (typeof g === 'string') return g
        return g.alias && g.field ? `${g.alias}.${g.field}` : ''
      }).filter(Boolean)
      // Normalize metrics field: {source/alias,field} → composite string; string keep as-is
      n.metrics = (n.metrics || []).map((m) => {
        let f = m.field
        if (typeof f === 'object' && f !== null) {
          const alias = f.source || f.alias
          f = alias && f.field ? `${alias}.${f.field}` : ''
        }
        return { agg: m.agg, field: f || '' }
      })
    }
  }
  nodes.value = restored
  if (!nodes.value.length) ensureChain()
  emitChange()
}

watch(() => props.initialDefinition, (d) => { if (d) restore(d) }, { immediate: true, deep: true })

defineExpose({ getDefinition: () => definition.value })

onMounted(async () => {
  schemas.value = await buildApi.sqlAssist(props.datasourceId)
  // Sync _tableValue for existing source nodes
  for (const n of nodes.value) {
    if (n.nodeType === 'source') n._tableValue = n.schema && n.table ? `${n.schema}:${n.table}` : ''
    if (n.nodeType === 'join') n._joinTableValue = n.to?.schema && n.to?.table ? `${n.to.schema}:${n.to.table}` : ''
  }
  ensureChain()
})
</script>

<style scoped>
.etl-builder { display: flex; gap: 12px; height: 100%; }
.etl-builder__left { flex: 0 0 210px; border: 1px solid var(--el-border-color); border-radius: 8px; padding: 8px; overflow: auto; }
.etl-builder__mid { flex: 1; min-width: 280px; overflow: auto; }
.etl-builder__config { flex: 0 0 300px; border: 1px solid var(--el-border-color); border-radius: 8px; padding: 8px; overflow: auto; }
.etl-builder__preview { flex: 0 0 38%; min-width: 320px; border: 1px solid var(--el-border-color); border-radius: 8px; padding: 8px; overflow: auto; }
.etl-builder__panel-title { font-size: 13px; font-weight: 600; color: var(--app-text-secondary); margin-bottom: 8px; }
.etl-builder__field { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; font-size: 13px; flex-wrap: wrap; }
</style>
