<template>
  <div class="etl-builder">
    <div class="etl-builder__left">
      <div class="etl-builder__panel-title">算子</div>
      <div
        v-for="op in palette"
        :key="op.type"
        class="palette-item"
        :class="{ 'palette-item--disabled': !op.enabled() }"
        draggable="true"
        @dragstart="onPaletteDrag($event, op.type)"
        @click="op.enabled() && addNode(op.type)"
      >
        <span class="palette-item__icon" :style="{ background: op.color }">{{ op.short }}</span>
        <span class="palette-item__label">{{ op.label }}</span>
      </div>
      <el-divider />
      <div class="etl-builder__panel-title">表 / 字段</div>
      <SchemaTree :catalog="schemas" @pick-field="() => {}" />
    </div>

    <div class="etl-builder__canvas" @dragover.prevent @drop="onCanvasDrop">
      <VueFlow
        :nodes="flowNodes"
        :edges="flowEdges"
        :is-valid-connection="isValidConnection"
        :delete-key-code="null"
        :fit-view-on-init="false"
        :default-viewport="{ zoom: 0.9, x: 40, y: 40 }"
        @connect="onConnect"
        @node-click="onNodeClick"
        @node-drag-stop="onDragStop"
        @edge-click="onEdgeClick"
      >
        <Background :gap="16" pattern-color="var(--app-border)" />
        <Controls position="top-right" />
        <template #node-etlNode="{ data }">
          <EtlNodeCard :node="data.node" :node-color="nodeColor(data.node)" :error="data.error" :selected="data.selected" @click.stop="selectNode(data.node)" />
        </template>
      </VueFlow>
    </div>

    <div class="etl-builder__right">
      <div class="etl-builder__panel-title">画布工具栏</div>
      <div class="toolbar">
        <el-button size="small" @click="undo" :disabled="!past.length">撤销</el-button>
        <el-button size="small" @click="redo" :disabled="!future.length">重做</el-button>
        <el-button size="small" @click="autoLayout">自动布局</el-button>
      </div>

      <div class="etl-builder__panel-title">配置</div>
      <template v-if="activeNode">
        <div class="etl-builder__node-head">
          <span>{{ nodeTitle(activeNode) }}</span>
          <el-button v-if="canDelete(activeNode)" link size="small" type="danger" @click="deleteNode(activeNode.nodeId)">删除节点</el-button>
        </div>

        <template v-if="activeNode.nodeType === 'source'">
          <div class="etl-builder__field">表
            <el-select v-model="activeNode._tableValue" size="small" filterable @change="onSourceChange">
              <el-option v-for="t in tableOptions" :key="t.id" :label="t.label" :value="t.id" />
            </el-select>
          </div>
        </template>

        <template v-if="activeNode.nodeType === 'join'">
          <div class="etl-builder__field">关联类型
            <el-select v-model="activeNode.joinType" size="small" style="width: 120px" @change="emitChange">
              <el-option label="INNER" value="inner" />
              <el-option label="LEFT" value="left" />
              <el-option label="RIGHT" value="right" />
            </el-select>
          </div>
          <div class="etl-builder__field">关联表
            <el-select v-model="activeNode._joinTableValue" size="small" filterable @change="onJoinTableChange">
              <el-option v-for="t in tableOptions" :key="t.id" :label="t.label" :value="t.id" />
            </el-select>
          </div>
          <div v-for="(c, i) in activeNode.on" :key="i" class="etl-builder__field">
            目标 {{ activeNode.to.alias }}:
            <el-select v-model="c.to.field" size="small" style="width: 130px" @change="emitChange">
              <el-option v-for="f in joinTargetFields" :key="f.name" :label="f.name" :value="f.name" />
            </el-select>
            = 源字段:
            <el-select v-model="c.from.field" size="small" style="width: 130px" @change="emitChange">
              <el-option v-for="f in sourceFields(activeNode, true)" :key="f.pref" :label="f.pref" :value="f.pref" />
            </el-select>
            <el-button link size="small" type="danger" @click="activeNode.on.splice(i, 1); emitChange()">删</el-button>
          </div>
          <el-button size="small" @click="activeNode.on.push({ from: { alias: 't0', field: '' }, to: { alias: activeNode.to.alias, field: '' } }); emitChange()">+ 条件</el-button>
        </template>

        <template v-if="activeNode.nodeType === 'filter'">
          <div v-for="(c, i) in activeNode.conditions" :key="i" class="etl-builder__field">
            <el-select v-model="c.field.alias" size="small" style="width: 70px" @change="emitChange">
              <el-option v-for="t in chainTables" :key="t.alias" :label="t.alias" :value="t.alias" />
            </el-select>
            <el-select v-model="c.field.field" size="small" style="width: 120px" @change="emitChange">
              <el-option v-for="f in filterFields" :key="f.pref" :label="f.pref" :value="f.pref" />
            </el-select>
            <el-select v-model="c.op" size="small" style="width: 90px" @change="emitChange">
              <el-option v-for="o in STRING_OPS" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <el-input v-model="c.value" size="small" style="width: 120px" @change="emitChange" />
            <el-button link size="small" type="danger" @click="activeNode.conditions.splice(i, 1); emitChange()">删</el-button>
          </div>
          <el-button size="small" @click="activeNode.conditions.push({ field: { alias: 't0', field: '' }, op: 'eq', value: '' }); emitChange()">+ 条件</el-button>
        </template>

        <template v-if="activeNode.nodeType === 'aggregate'">
          <div class="etl-builder__field">分组
            <el-select v-model="activeNode.groupBy" multiple collapse-tags filterable size="small" style="width: 100%" @change="emitChange">
              <el-option v-for="f in sourceFields(activeNode, false)" :key="f.pref" :label="f.pref" :value="f.pref" />
            </el-select>
          </div>
          <div v-for="(m, i) in activeNode.metrics" :key="i" class="etl-builder__field">
            <el-select v-model="m.agg" size="small" style="width: 120px" @change="emitChange">
              <el-option v-for="a in AGG_OPTIONS" :key="a.value" :label="a.label" :value="a.value" />
            </el-select>
            <el-select v-if="m.agg !== 'count'" v-model="m.field" size="small" style="width: 140px" filterable @change="emitChange">
              <el-option v-for="f in sourceFields(activeNode, false)" :key="f.pref" :label="f.pref" :value="f.pref" />
            </el-select>
            <el-button link size="small" type="danger" @click="activeNode.metrics.splice(i, 1); emitChange()">删</el-button>
          </div>
          <el-button size="small" @click="activeNode.metrics.push({ agg: 'sum', field: '' }); emitChange()">+ 指标</el-button>
        </template>

        <template v-if="activeNode.nodeType === 'output'">
          <div class="etl-builder__field">输出行数上限
            <el-input-number v-model="activeNode.limit" :min="1" :max="100000" size="small" @change="emitChange" />
          </div>
        </template>

        <div class="etl-builder__preview-actions">
          <el-button size="small" type="primary" :loading="previewingNode === activeNode.nodeId" @click="previewNode(activeNode)">预览此节点</el-button>
          <span v-if="nodeError[activeNode.nodeId]" class="etl-builder__error">{{ nodeError[activeNode.nodeId] }}</span>
        </div>
      </template>
      <el-empty v-else description="点击画布节点进行配置" />

      <div class="etl-builder__panel-title" style="margin-top: 16px">节点预览</div>
      <el-table v-if="nodePreview.length" :data="nodePreview" size="small" max-height="360">
        <el-table-column v-for="c in nodePreviewCols" :key="c" :prop="c" :label="c" min-width="110" show-overflow-tooltip />
      </el-table>
      <el-empty v-else :description="activeNode ? '点击「预览此节点」查看真实数据' : '选择节点后预览'" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { VueFlow, useVueFlow, MarkerType } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { ElMessage } from 'element-plus'
import { buildApi } from '@/api'
import { allFields, AGG_OPTIONS, STRING_OPS } from '@/utils/catalog'
import SchemaTree from './SchemaTree.vue'
import EtlNodeCard from './EtlNodeCard.vue'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'

const props = defineProps({ datasourceId: { type: [Number, String], required: true }, catalog: { type: Array, default: () => [] }, initialDefinition: Object })
const emit = defineEmits(['change'])

const schemas = ref([])
watch(() => props.catalog, (v) => { schemas.value = v || [] }, { immediate: true, deep: true })

const NODE_META = {
  source: { label: '输入源', short: '源', color: '#67c23a' },
  join: { label: '关联', short: '联', color: '#909399' },
  filter: { label: '过滤', short: '筛', color: '#e6a23c' },
  aggregate: { label: '聚合', short: '聚', color: '#409eff' },
  output: { label: '输出', short: '出', color: '#f56c6c' },
}
const NODE_ORDER = ['source', 'join', 'filter', 'aggregate', 'output']

// eslint-disable-next-line no-unused-vars
const noop = () => {}

const nodes = ref([])      // [{ nodeId, nodeType, sourceNode, x, y, ...defProps, _tableValue?, _joinTableValue?, joinType? }]
const past = ref([])
const future = ref([])
const selectedNodeId = ref(null)
const previewingNode = ref(null)
const nodePreview = ref([])
const nodePreviewCols = ref([])
const nodeError = ref({})

const { screenToFlowCoordinate, fitView } = useVueFlow()

const palette = computed(() => [
  { type: 'source', ...NODE_META.source, enabled: () => !nodes.value.some((n) => n.nodeType === 'source') },
  { type: 'join', ...NODE_META.join, enabled: () => true },
  { type: 'filter', ...NODE_META.filter, enabled: () => true },
  { type: 'aggregate', ...NODE_META.aggregate, enabled: () => true },
  { type: 'output', ...NODE_META.output, enabled: () => !nodes.value.some((n) => n.nodeType === 'output') },
])

const activeNode = computed(() => nodes.value.find((n) => n.nodeId === selectedNodeId.value) || null)
const tableOptions = computed(() => {
  const out = []
  for (const s of schemas.value) for (const t of s.tables || []) out.push({ id: `${s.schema}:${t.table}`, label: `${s.schema}.${t.table}`, schema: s.schema, table: t.table })
  return out
})
const chainTables = computed(() => nodes.value.filter((n) => n.nodeType === 'source').map((n) => ({ alias: n.alias, schema: n.schema, table: n.table })))
const joinTargetFields = computed(() => (activeNode.value?.nodeType === 'join' ? allFields(schemas.value, `${activeNode.value.to.schema}:${activeNode.value.to.table}`) : []))
const filterFields = computed(() => (activeNode.value?.nodeType === 'filter' ? sourceFields(activeNode.value, true) : []))

const flowNodes = computed(() => nodes.value.map((n) => ({
  id: n.nodeId,
  type: 'etlNode',
  position: { x: n.x || 0, y: n.y || 0 },
  data: { node: n, error: nodeError.value[n.nodeId] || null, selected: selectedNodeId.value === n.nodeId },
})))
const flowEdges = computed(() => nodes.value.filter((n) => n.sourceNode && n.nodeType !== 'source').map((n) => ({
  id: `e_${n.sourceNode}_${n.nodeId}`,
  source: n.sourceNode,
  target: n.nodeId,
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
})))

function nodeColor(n) { return NODE_META[n.nodeType]?.color || '#409eff' }
function nodeTitle(n) { return NODE_META[n.nodeType]?.label || n.nodeType }

function canDelete(n) { return ['join', 'filter', 'aggregate'].includes(n.nodeType) }

function stripInternal(nodesArr) {
  return JSON.parse(JSON.stringify(nodesArr)).map((n) => {
    const o = { ...n }
    for (const k of Object.keys(o)) if (k.startsWith('_')) delete o[k]
    return o
  })
}

const definition = computed(() => ({ type: 'etl', nodes: stripInternal(nodes.value) }))
function emitChange() { emit('change', { definition: definition.value }) }

function defNode(nodeId) { return nodes.value.find((n) => n.nodeId === nodeId) }

/* ---- 固定链约束 ---- */
function isValidConnection(c) {
  const from = defNode(c.source)
  const to = defNode(c.target)
  if (!from || !to || from.nodeId === to.nodeId) return false
  if (from.nodeType === 'output' || to.nodeType === 'source') return false
  if (to.sourceNode && to.sourceNode !== from.nodeId) return false
  // 防御成环（单输入规则下理论不可达）
  let cur = from
  while (cur) {
    if (cur.nodeId === to.nodeId) return false
    cur = cur.sourceNode ? defNode(cur.sourceNode) : null
  }
  return true
}

function pushSnapshot() {
  past.value.push(JSON.stringify(stripInternal(nodes.value)))
  if (past.value.length > 30) past.value.shift()
  future.value = []
}
function restoreFromSnapshot(list) {
  const snap = list.pop()
  if (!snap) return
  future.value.push(JSON.stringify(stripInternal(nodes.value)))
  const arr = JSON.parse(snap)
  rehydrate(arr)
  nodes.value = arr
  for (const k of Object.keys(nodeError.value)) if (!arr.some((n) => n.nodeId === k)) delete nodeError.value[k]
  if (!arr.some((n) => n.nodeId === selectedNodeId.value)) selectedNodeId.value = null
  nodePreview.value = []
  nodePreviewCols.value = []
  ensureChain()
  emitChange()
}
function undo() { restoreFromSnapshot(past.value) }
function redo() { restoreFromSnapshot(future.value) }

function rehydrate(arr) {
  for (const n of arr) {
    if (n.nodeType === 'source') n._tableValue = n.schema && n.table ? `${n.schema}:${n.table}` : ''
    if (n.nodeType === 'join') {
      n._joinTableValue = n.to?.schema && n.to?.table ? `${n.to.schema}:${n.to.table}` : ''
      n.joinType = n.joinType || 'inner'
    }
  }
}

function autoLayout(push = true) {
  if (push) pushSnapshot()
  const ordered = [...nodes.value].sort((a, b) => NODE_ORDER.indexOf(a.nodeType) - NODE_ORDER.indexOf(b.nodeType) || (a.y || 0) - (b.y || 0))
  let xi = 0
  for (const n of ordered) { n.x = xi; xi += 230; n.y = 0 }
  void nextTick(() => fitView({ padding: 0.2, duration: 0 }))
}

function ensureChain() {
  let prev = null
  for (const n of nodes.value) {
    if (n.nodeType === 'source') { prev = n; continue }
    if (prev) n.sourceNode = prev.nodeId
    prev = n
  }
  let out = nodes.value.find((n) => n.nodeType === 'output')
  if (!out) {
    const last = nodes.value[nodes.value.length - 1]
    nodes.value.push({ nodeId: makeNodeId('output'), nodeType: 'output', sourceNode: last?.nodeId, limit: 1000 })
  }
  const outIdx = nodes.value.indexOf(out)
  if (outIdx !== nodes.value.length - 1 && out) {
    nodes.value.splice(outIdx, 1)
    nodes.value.push(out)
  }
  const lastReal = nodes.value.filter((n) => n.nodeType !== 'output').slice(-1)[0]
  out = nodes.value.find((n) => n.nodeType === 'output')
  if (out) out.sourceNode = lastReal?.nodeId
  emitChange()
}

let counter = 1
function makeNodeId(kind) { return `n_${kind}_${counter++}_${Date.now() % 100000}` }

function addNode(type, pos) {
  if (type === 'source' && nodes.value.some((n) => n.nodeType === 'source')) return ElMessage.warning('已存在输入源')
  if (type === 'output' && nodes.value.some((n) => n.nodeType === 'output')) return ElMessage.warning('已存在输出')
  pushSnapshot()
  const node = makeNode(type)
  node.x = pos?.x ?? null
  node.y = pos?.y ?? null
  // 插入到 output 之前
  const outIdx = nodes.value.findIndex((n) => n.nodeType === 'output')
  if (outIdx >= 0) nodes.value.splice(outIdx, 0, node)
  else nodes.value.push(node)
  ensureChain()
  if (node.x == null) autoLayout(false)
  else emitChange()
  selectedNodeId.value = node.nodeId
}
function makeNode(type) {
  if (type === 'source') return { nodeId: makeNodeId('source'), nodeType: 'source', alias: 't0', schema: null, table: null, _tableValue: '' }
  if (type === 'join') return {
    nodeId: makeNodeId('join'), nodeType: 'join', joinType: 'inner', sourceNode: null,
    to: { alias: `t${chainTables.value.length + 1}`, schema: null, table: null },
    on: [{ from: { alias: 't0', field: '' }, to: { alias: `t${chainTables.value.length + 1}`, field: '' } }],
    _joinTableValue: '',
  }
  if (type === 'filter') return { nodeId: makeNodeId('filter'), nodeType: 'filter', sourceNode: null, conditions: [{ field: { alias: 't0', field: '' }, op: 'eq', value: '' }] }
  if (type === 'aggregate') return { nodeId: makeNodeId('aggregate'), nodeType: 'aggregate', sourceNode: null, groupBy: [], metrics: [{ agg: 'sum', field: '' }] }
  if (type === 'output') return { nodeId: makeNodeId('output'), nodeType: 'output', sourceNode: null, limit: 1000 }
  return null
}

function deleteNode(nodeId) {
  const idx = nodes.value.findIndex((n) => n.nodeId === nodeId)
  if (idx < 0) return
  if (['source', 'output'].includes(nodes.value[idx].nodeType)) return ElMessage.warning('输入源与输出节点不可删除')
  pushSnapshot()
  const removed = nodes.value[idx]
  const parentId = removed.sourceNode
  nodes.value.splice(idx, 1)
  // 后续节点指向被删节点的前驱
  for (const n of nodes.value) if (n.sourceNode === nodeId) n.sourceNode = parentId
  ensureChain()
  if (selectedNodeId.value === nodeId) selectedNodeId.value = null
}

function onConnect(c) {
  pushSnapshot()
  const to = defNode(c.target)
  if (!to) return
  to.sourceNode = c.source
  ensureChain()
}

function onEdgeClick(edge) {
  const to = defNode(edge.target)
  if (!to) return
  pushSnapshot()
  to.sourceNode = null
  ensureChain()
}

function onNodeClick({ node }) { selectNode(defNode(node.id)) }
function onDragStop({ node }) {
  const n = defNode(node.id)
  if (n) {
    n.x = node.position.x
    n.y = node.position.y
    emitChange()
  }
}
function selectNode(n) { if (n) selectedNodeId.value = n.nodeId }

function onPaletteDrag(e, type) { e.dataTransfer.setData('text/plain', type) }
function onCanvasDrop(e) {
  const type = e.dataTransfer.getData('text/plain')
  if (!type || !NODE_META[type]) return
  const pos = screenToFlowCoordinate({ x: e.clientX, y: e.clientY })
  addNode(type, pos)
}

/* ---- 节点配置联动 ---- */
function onSourceChange() {
  const n = activeNode.value
  if (!n) return
  const val = n._tableValue
  if (val && val.includes(':')) {
    const [schema, table] = val.split(':')
    n.schema = schema
    n.table = table
    if (!n.alias) n.alias = `t${nodes.value.filter((x) => x.nodeType === 'source').length}`
    ensureChain()
  }
}
function onJoinTableChange() {
  const n = activeNode.value
  if (!n || n.nodeType !== 'join') return
  const val = n._joinTableValue
  if (val && val.includes(':')) {
    const [schema, table] = val.split(':')
    n.to.schema = schema
    n.to.table = table
    if (!n.to.alias) n.to.alias = `t${chainTables.value.length + 1}`
    emitChange()
  }
}

function sourceFields(n, includePrefPrefix) {
  const out = []
  for (const src of nodes.value) {
    if (src.nodeType === 'source') for (const f of allFields(schemas.value, `${src.schema}:${src.table}`)) out.push({ ...f, pref: `${src.alias}.${f.name}` })
    if (src.nodeType === 'join') for (const f of allFields(schemas.value, `${src.to?.schema}:${src.to?.table}`)) out.push({ ...f, pref: `${src.to?.alias}.${f.name}` })
  }
  return out
}

/* ---- 预览 ---- */
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

/* ---- 还原 & 挂载 ---- */
function restore(def) {
  if (!def || def.type !== 'etl') return
  const arr = JSON.parse(JSON.stringify(def.nodes || []))
  if (!arr.some((n) => n.nodeType === 'source')) {
    arr.unshift({ nodeId: makeNodeId('source'), nodeType: 'source', alias: 't0', schema: null, table: null })
  }
  if (!arr.some((n) => n.nodeType === 'output')) {
    const last = arr[arr.length - 1]
    arr.push({ nodeId: makeNodeId('output'), nodeType: 'output', sourceNode: last?.nodeId, limit: 1000 })
  }
  rehydrate(arr)
  const hasPos = arr.every((n) => typeof n.x === 'number')
  if (!hasPos) {
    // 简单行式布局
    let xi = 0
    for (const n of arr) { n.x = xi; xi += 230; n.y = 0 }
  }
  nodes.value = arr
  // 依据 sourceNode 重建顺序（把被指节点排到引用者之后）
  orderByChain()
  emitChange()
  void nextTick(() => fitView({ padding: 0.2, duration: 0 }))
}

function orderByChain() {
  const ordered = []
  const seen = new Set()
  const head = nodes.value.find((n) => n.nodeType === 'source')
  const pool = [...nodes.value]
  let cur = head
  while (cur && !seen.has(cur.nodeId)) {
    seen.add(cur.nodeId)
    ordered.push(cur)
    cur = nodes.value.find((n) => n.sourceNode === cur.nodeId)
  }
  for (const n of pool) if (!seen.has(n.nodeId)) ordered.push(n)
  nodes.value = ordered
  ensureChain()
}

watch(() => props.initialDefinition, (d) => { if (d) restore(d) }, { immediate: true, deep: true })

defineExpose({ getDefinition: () => definition.value })

onMounted(() => {
  if (!nodes.value.length) {
    addNode('source')
    ensureChain()
  }
  void nextTick(() => fitView({ padding: 0.2, duration: 0 }))
})
</script>

<style scoped>
.etl-builder { display: flex; gap: 12px; height: 100%; }
.etl-builder__left { flex: 0 0 190px; border: 1px solid var(--el-border-color); border-radius: 8px; padding: 8px; overflow: auto; }
.etl-builder__canvas { flex: 1; min-width: 480px; border: 1px solid var(--el-border-color); border-radius: 8px; position: relative; overflow: hidden; background: var(--app-bg); }
.etl-builder__right { flex: 0 0 340px; border: 1px solid var(--el-border-color); border-radius: 8px; padding: 8px; overflow: auto; }
.etl-builder__panel-title { font-size: 13px; font-weight: 600; color: var(--app-text-secondary); margin-bottom: 8px; }
.palette-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; margin-bottom: 6px; border: 1px solid var(--el-border-color-light); border-radius: 6px; cursor: grab; font-size: 12px; }
.palette-item:hover { border-color: var(--app-primary); }
.palette-item--disabled { opacity: .45; cursor: not-allowed; }
.palette-item__icon { width: 22px; height: 22px; border-radius: 4px; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex: 0 0 auto; }
.palette-item__label { color: var(--app-text-primary); }
.etl-builder__node-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-weight: 600; }
.etl-builder__field { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; font-size: 13px; flex-wrap: wrap; }
.etl-builder__preview-actions { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.etl-builder__error { font-size: 12px; color: var(--el-color-danger); }
.toolbar { display: flex; gap: 6px; margin-bottom: 12px; }
</style>
