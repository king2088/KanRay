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
        <template #node-etlNode="{ data }">
          <EtlNodeCard :node="data.node" :node-color="nodeColor(data.node)" :error="data.error" :selected="data.selected" @click.stop="selectNodeFromCard(data.node)" />
        </template>
      </VueFlow>

      <div class="etl-canvas-toolbar">
        <div class="etl-toolbar-group">
          <el-tooltip content="放大" placement="left"><button class="etl-canvas-toolbar__btn" @click="zoomIn()">+</button></el-tooltip>
          <el-tooltip content="缩小" placement="left"><button class="etl-canvas-toolbar__btn" @click="zoomOut()">-</button></el-tooltip>
          <el-tooltip content="适应画布" placement="left"><button class="etl-canvas-toolbar__btn" @click="fitView({ padding: 0.2 })">⊞</button></el-tooltip>
        </div>
        <div class="etl-toolbar-divider" />
        <div class="etl-toolbar-group">
          <el-tooltip content="撤销" placement="left"><button class="etl-canvas-toolbar__btn" :disabled="!past.length" @click="undo">↺</button></el-tooltip>
          <el-tooltip content="重做" placement="left"><button class="etl-canvas-toolbar__btn" :disabled="!future.length" @click="redo">↻</button></el-tooltip>
          <el-tooltip content="自动布局" placement="left"><button class="etl-canvas-toolbar__btn" @click="autoLayout">⊞</button></el-tooltip>
        </div>
      </div>
    </div>

    <el-drawer
      v-model="drawerVisible"
      direction="rtl"
      size="380px"
      :show-close="true"
      :with-header="true"
      :z-index="2000"
      class="etl-config-drawer"
    >
      <template #header>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="drawer-node-badge" :style="{ background: activeNode ? nodeColor(activeNode) : '#409eff' }">{{ activeNode ? NODE_META[activeNode.nodeType]?.short : '' }}</span>
          <span style="font-weight:600;font-size:15px">{{ activeNode ? nodeTitle(activeNode) : '' }}</span>
        </div>
      </template>

      <template v-if="activeNode">
        <div class="drawer-toolbar" style="margin-bottom:16px">
          <el-button v-if="canDelete(activeNode)"  type="danger" plain @click="deleteNode(activeNode.nodeId)">删除节点</el-button>
        </div>

        <template v-if="activeNode.nodeType === 'source'">
          <div class="drawer-field">表
            <el-select v-model="activeNode._tableValue"  filterable @change="onSourceChange">
              <el-option v-for="t in tableOptions" :key="t.id" :label="t.label" :value="t.id" />
            </el-select>
          </div>
        </template>

        <template v-if="activeNode.nodeType === 'join'">
          <div class="drawer-field">关联类型
            <el-select v-model="activeNode.joinType"  style="width: 120px" @change="emitChange">
              <el-option label="INNER" value="inner" />
              <el-option label="LEFT" value="left" />
              <el-option label="RIGHT" value="right" />
            </el-select>
          </div>
          <div class="drawer-field">关联节点（右侧输入）
            <el-select v-model="activeNode.rightNodeId"  filterable clearable @change="onRightNodeChange">
              <el-option v-for="s in sourceNodeOptions" :key="s.nodeId" :label="`${s.alias} (${s.schema}.${s.table})`" :value="s.nodeId" />
            </el-select>
          </div>
          <div v-if="!activeNode.rightNodeId" class="drawer-field">关联表（旧式）
            <el-select v-model="activeNode._joinTableValue"  filterable @change="onJoinTableChange">
              <el-option v-for="t in tableOptions" :key="t.id" :label="t.label" :value="t.id" />
            </el-select>
          </div>
          <div v-for="(c, i) in activeNode.on" :key="i" class="drawer-field">
            目标:
            <el-select v-model="c.to.field"  style="width: 120px" @change="emitChange">
              <el-option v-for="f in joinTargetFields" :key="f.pref" :label="f.pref" :value="f.name" />
            </el-select>
            = 源字段:
            <el-select v-model="c.from.field"  style="width: 120px" @change="emitChange">
              <el-option v-for="f in etlOutputFields(activeNode)" :key="f.pref" :label="f.pref" :value="f.name" />
            </el-select>
            <el-button link  type="danger" @click="activeNode.on.splice(i, 1); emitChange()">删</el-button>
          </div>
          <el-button  @click="addJoinCondition">+ 条件</el-button>
        </template>

        <template v-if="activeNode.nodeType === 'filter'">
          <div v-for="(c, i) in activeNode.conditions" :key="i" class="drawer-field">
            <el-select v-model="c.field.alias"  style="width: 65px" @change="emitChange">
              <el-option v-for="t in chainTables" :key="t.alias" :label="t.alias" :value="t.alias" />
            </el-select>
            <el-select v-model="c.field.field"  style="width: 110px" @change="emitChange">
              <el-option v-for="f in etlOutputFields(activeNode)" :key="f.pref" :label="f.pref" :value="f.name" />
            </el-select>
            <el-select v-model="c.op"  style="width: 85px" @change="emitChange">
              <el-option v-for="o in STRING_OPS" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <el-input v-model="c.value"  style="width: 110px" @change="emitChange" />
            <el-button link  type="danger" @click="activeNode.conditions.splice(i, 1); emitChange()">删</el-button>
          </div>
          <el-button  @click="activeNode.conditions.push({ field: { alias: 't0', field: '' }, op: 'eq', value: '' }); emitChange()">+ 条件</el-button>
        </template>

        <template v-if="activeNode.nodeType === 'aggregate'">
          <div class="drawer-field">分组
            <el-select v-model="activeNode.groupBy" multiple collapse-tags filterable  style="width: 100%" @change="emitChange">
              <el-option v-for="f in etlOutputFields(activeNode)" :key="f.pref" :label="f.pref" :value="f.pref" />
            </el-select>
          </div>
          <div v-for="(m, i) in activeNode.metrics" :key="i" class="drawer-field">
            <el-select v-model="m.agg"  style="width: 110px" @change="emitChange">
              <el-option v-for="a in AGG_OPTIONS" :key="a.value" :label="a.label" :value="a.value" />
            </el-select>
            <el-select v-if="m.agg !== 'count'" v-model="m.field"  style="width: 130px" filterable @change="emitChange">
              <el-option v-for="f in etlOutputFields(activeNode)" :key="f.pref" :label="f.pref" :value="f.name" />
            </el-select>
            <el-button link  type="danger" @click="activeNode.metrics.splice(i, 1); emitChange()">删</el-button>
          </div>
          <el-button  @click="activeNode.metrics.push({ agg: 'sum', field: '' }); emitChange()">+ 指标</el-button>
        </template>

        <template v-if="activeNode.nodeType === 'columnSelect'">
          <div class="drawer-field">选择输出列
            <el-select v-model="activeNode.columns" multiple collapse-tags filterable  style="width: 100%" @change="emitChange">
              <el-option v-for="f in etlOutputFields(activeNode)" :key="f.pref" :label="f.pref" :value="f.pref" />
            </el-select>
          </div>
        </template>

        <template v-if="activeNode.nodeType === 'dedup'">
          <div class="drawer-field">按列去重（不选则全列）
            <el-select v-model="activeNode.columns" multiple collapse-tags filterable clearable  style="width: 100%" @change="emitChange">
              <el-option v-for="f in etlOutputFields(activeNode)" :key="f.pref" :label="f.pref" :value="f.pref" />
            </el-select>
          </div>
        </template>

        <template v-if="activeNode.nodeType === 'valueReplace'">
          <div v-for="(m, i) in activeNode.mappings" :key="i" class="drawer-field">
            <el-select v-model="m.field"  style="width: 120px" filterable @change="onValueReplaceFieldChange(m)">
              <el-option v-for="f in etlOutputFields(activeNode)" :key="f.pref" :label="f.pref" :value="f.pref" />
            </el-select>
            为
            <el-input v-model="m.from"  style="width: 85px" placeholder="原值" @change="emitChange" />
            →
            <el-input v-model="m.to"  style="width: 85px" placeholder="新值" @change="emitChange" />
            <el-button link  type="danger" @click="activeNode.mappings.splice(i, 1); emitChange()">删</el-button>
          </div>
          <el-button  @click="activeNode.mappings.push({ field: '', from: '', to: '' }); emitChange()">+ 替换规则</el-button>
        </template>

        <template v-if="activeNode.nodeType === 'nullReplace'">
          <div v-for="(m, i) in activeNode.mappings" :key="i" class="drawer-field">
            <el-select v-model="m.field"  style="width: 120px" filterable @change="onNullReplaceFieldChange(m)">
              <el-option v-for="f in etlOutputFields(activeNode)" :key="f.pref" :label="f.pref" :value="f.pref" />
            </el-select>
            Null →
            <el-input v-model="m.to"  style="width: 120px" placeholder="默认值" @change="emitChange" />
            <el-button link  type="danger" @click="activeNode.mappings.splice(i, 1); emitChange()">删</el-button>
          </div>
          <el-button  @click="activeNode.mappings.push({ field: '', to: '' }); emitChange()">+ 替换规则</el-button>
        </template>

        <template v-if="activeNode.nodeType === 'trim'">
          <div class="drawer-field">去空格列（不选则全部）
            <el-select v-model="activeNode.columns" multiple collapse-tags filterable clearable  style="width: 100%" @change="emitChange">
              <el-option v-for="f in etlOutputFields(activeNode)" :key="f.pref" :label="f.pref" :value="f.pref" />
            </el-select>
          </div>
        </template>

        <template v-if="activeNode.nodeType === 'sqlNode'">
          <div class="drawer-field" style="flex-direction:column;align-items:stretch">
            <span style="margin-bottom:4px;font-size:12px;color:var(--app-text-secondary)">自定义 SQL（可用 <code>__etl_prev</code> 引用上游子查询）</span>
            <el-input v-model="activeNode.sql" type="textarea" :rows="4"  placeholder="SELECT * FROM __etl_prev WHERE ..." @change="emitChange" />
          </div>
        </template>

        <template v-if="activeNode.nodeType === 'output'">
          <div class="drawer-field">输出行数上限
            <el-input-number v-model="activeNode.limit" :min="1" :max="100000"  @change="emitChange" />
          </div>
        </template>

        <el-divider />
        <div class="drawer-preview-actions">
          <el-button  type="primary" :loading="previewingNode === activeNode.nodeId" @click="previewNode(activeNode)">预览此节点</el-button>
          <span v-if="nodeError[activeNode.nodeId]" class="drawer-error">{{ nodeError[activeNode.nodeId] }}</span>
        </div>

        <div class="drawer-section-title" style="margin-top:12px">节点预览</div>
        <el-table v-if="nodePreview.length" :data="nodePreview"  max-height="320">
          <el-table-column v-for="c in nodePreviewCols" :key="c" :prop="c" :label="c" min-width="110" show-overflow-tooltip />
        </el-table>
        <el-empty v-else :description="activeNode ? '点击「预览此节点」查看真实数据' : ''" :image-size="60" />
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { VueFlow, useVueFlow, MarkerType } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { ElMessage } from 'element-plus'
import { buildApi } from '@/api'
import { allFields, AGG_OPTIONS, STRING_OPS } from '@/utils/catalog'
import EtlNodeCard from './EtlNodeCard.vue'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

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
  columnSelect: { label: '选择列', short: '选', color: '#9b59b6' },
  dedup: { label: '去重', short: '去', color: '#1abc9c' },
  valueReplace: { label: '值替换', short: '替', color: '#e67e22' },
  nullReplace: { label: 'Null替换', short: '空', color: '#e74c3c' },
  trim: { label: '去空格', short: '格', color: '#3498db' },
  sqlNode: { label: 'SQL', short: 'SQL', color: '#34495e' },
}
const NODE_ORDER = ['source', 'join', 'filter', 'columnSelect', 'dedup', 'valueReplace', 'nullReplace', 'trim', 'sqlNode', 'aggregate', 'output']
const TRANSFORM_TYPES = new Set(['join', 'filter', 'columnSelect', 'dedup', 'valueReplace', 'nullReplace', 'trim', 'sqlNode', 'aggregate'])

const nodes = ref([])
const past = ref([])
const future = ref([])
const selectedNodeId = ref(null)
const previewingNode = ref(null)
const nodePreview = ref([])
const nodePreviewCols = ref([])
const nodeError = ref({})
const drawerVisible = ref(false)

const { screenToFlowCoordinate, fitView, zoomIn, zoomOut } = useVueFlow()

const palette = computed(() => [
  { type: 'source', ...NODE_META.source, enabled: () => true },
  { type: 'join', ...NODE_META.join, enabled: () => true },
  { type: 'filter', ...NODE_META.filter, enabled: () => true },
  { type: 'columnSelect', ...NODE_META.columnSelect, enabled: () => true },
  { type: 'dedup', ...NODE_META.dedup, enabled: () => true },
  { type: 'valueReplace', ...NODE_META.valueReplace, enabled: () => true },
  { type: 'nullReplace', ...NODE_META.nullReplace, enabled: () => true },
  { type: 'trim', ...NODE_META.trim, enabled: () => true },
  { type: 'sqlNode', ...NODE_META.sqlNode, enabled: () => true },
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
const sourceNodeOptions = computed(() => nodes.value.filter((n) => n.nodeType === 'source'))
const joinTargetFields = computed(() => {
  if (!activeNode.value || activeNode.value.nodeType !== 'join') return []
  if (activeNode.value.rightNodeId) {
    return etlOutputFields(activeNode.value.rightNodeId)
  }
  if (activeNode.value.to?.schema && activeNode.value.to?.table) {
    return allFields(schemas.value, `${activeNode.value.to.schema}:${activeNode.value.to.table}`).map((f) => ({ ...f, pref: `${activeNode.value.to.alias}.${f.name}` }))
  }
  return []
})

const flowNodes = computed(() => nodes.value.map((n) => ({
  id: n.nodeId,
  type: 'etlNode',
  position: { x: n.x || 0, y: n.y || 0 },
  data: { node: n, error: nodeError.value[n.nodeId] || null, selected: selectedNodeId.value === n.nodeId },
})))
const flowEdges = computed(() => {
  const edges = []
  for (const n of nodes.value) {
    if (n.sourceNode && n.nodeType !== 'source') {
      edges.push({
        id: `e_${n.sourceNode}_${n.nodeId}`,
        source: n.sourceNode,
        target: n.nodeId,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      })
    }
    if (n.rightNodeId && n.nodeType === 'join') {
      edges.push({
        id: `e_${n.rightNodeId}_${n.nodeId}_r`,
        source: n.rightNodeId,
        target: n.nodeId,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        style: { stroke: '#909399', strokeDasharray: '5,5' },
      })
    }
  }
  return edges
})

function nodeColor(n) { return NODE_META[n.nodeType]?.color || '#409eff' }
function nodeTitle(n) { return NODE_META[n.nodeType]?.label || n.nodeType }

function canDelete(n) { return TRANSFORM_TYPES.has(n.nodeType) }

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

/* ---- 累计字段追踪 ---- */
function etlOutputFields(nodeOrId) {
  const node = typeof nodeOrId === 'string' ? defNode(nodeOrId) : nodeOrId
  if (!node) return []
  switch (node.nodeType) {
    case 'source':
      return allFields(schemas.value, `${node.schema}:${node.table}`).map((f) => ({ ...f, pref: `${node.alias}.${f.name}` }))
    case 'join': {
      const left = node.sourceNode ? etlOutputFields(node.sourceNode) : []
      let right = []
      if (node.rightNodeId) {
        right = etlOutputFields(node.rightNodeId)
      } else if (node.to?.schema && node.to?.table) {
        right = allFields(schemas.value, `${node.to.schema}:${node.to.table}`).map((f) => ({ ...f, pref: `${node.to.alias}.${f.name}` }))
      }
      return [...left, ...right]
    }
    case 'filter':
    case 'valueReplace':
    case 'nullReplace':
    case 'trim':
    case 'output':
    case 'sqlNode':
      return node.sourceNode ? etlOutputFields(node.sourceNode) : []
    case 'columnSelect': {
      const input = node.sourceNode ? etlOutputFields(node.sourceNode) : []
      return (node.columns || []).map((col) => {
        const r = typeof col === 'string' ? col : `${col.alias}.${col.field}`
        return input.find((f) => f.pref === r) || { name: r, label: r, type: 'string', pref: r }
      })
    }
    case 'dedup': {
      if (!(node.columns || []).length) return node.sourceNode ? etlOutputFields(node.sourceNode) : []
      const input = node.sourceNode ? etlOutputFields(node.sourceNode) : []
      return (node.columns || []).map((col) => {
        const r = typeof col === 'string' ? col : `${col.alias}.${col.field}`
        return input.find((f) => f.pref === r) || { name: r, label: r, type: 'string', pref: r }
      })
    }
    case 'aggregate': {
      const dims = (node.groupBy || []).map((g, i) => {
        const pref = typeof g === 'string' ? g : `${g.alias}.${g.field}`
        return { name: `d_${i}`, label: pref, type: 'string', pref: `d_${i}` }
      })
      const metrics = (node.metrics || []).map((m, i) => ({
        name: `m_${i}`, label: m.label || `${m.field}(${m.agg})`, type: 'number', pref: `m_${i}`,
      }))
      return [...dims, ...metrics]
    }
    default:
      return []
  }
}

/* ---- 固定链约束 ---- */
function isValidConnection(c) {
  const from = defNode(c.source)
  const to = defNode(c.target)
  if (!from || !to || from.nodeId === to.nodeId) return false
  if (from.nodeType === 'output' || to.nodeType === 'source') return false
  if (to.sourceNode && to.sourceNode !== from.nodeId) return false
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
  const sources = nodes.value.filter((n) => n.nodeType === 'source')
  const transforms = nodes.value.filter((n) => n.nodeType !== 'source' && n.nodeType !== 'output')
  if (sources.length > 0) {
    let prev = sources[0]
    for (const t of transforms) {
      t.sourceNode = prev.nodeId
      prev = t
    }
  }
  let out = nodes.value.find((n) => n.nodeType === 'output')
  if (!out) {
    const last = nodes.value.filter((n) => n.nodeType !== 'output').slice(-1)[0]
    nodes.value.push({ nodeId: makeNodeId('output'), nodeType: 'output', sourceNode: last?.nodeId, limit: 1000 })
  }
  out = nodes.value.find((n) => n.nodeType === 'output')
  const lastReal = nodes.value.filter((n) => n.nodeType !== 'output').slice(-1)[0]
  if (out) out.sourceNode = lastReal?.nodeId
  const outIdx = nodes.value.indexOf(out)
  if (outIdx !== nodes.value.length - 1 && out) {
    nodes.value.splice(outIdx, 1)
    nodes.value.push(out)
  }
  emitChange()
}

let counter = 1
function makeNodeId(kind) { return `n_${kind}_${counter++}_${Date.now() % 100000}` }

function addNode(type, pos) {
  if (type === 'output' && nodes.value.some((n) => n.nodeType === 'output')) return ElMessage.warning('已存在输出')
  pushSnapshot()
  const node = makeNode(type)
  if (!node) return
  node.x = pos?.x ?? null
  node.y = pos?.y ?? null
  const outIdx = nodes.value.findIndex((n) => n.nodeType === 'output')
  if (outIdx >= 0) nodes.value.splice(outIdx, 0, node)
  else nodes.value.push(node)
  ensureChain()
  if (node.x == null) autoLayout(false)
  else emitChange()
  selectedNodeId.value = node.nodeId
  drawerVisible.value = true
}

function makeNode(type) {
  if (type === 'source') {
    const idx = nodes.value.filter((n) => n.nodeType === 'source').length
    return { nodeId: makeNodeId('source'), nodeType: 'source', alias: `t${idx}`, schema: null, table: null, _tableValue: '' }
  }
  if (type === 'join') return {
    nodeId: makeNodeId('join'), nodeType: 'join', joinType: 'inner', sourceNode: null, rightNodeId: null,
    to: { alias: `t${nodes.value.length}`, schema: null, table: null },
    on: [{ from: { alias: 't0', field: '' }, to: { alias: `t${nodes.value.length}`, field: '' } }],
    _joinTableValue: '',
  }
  if (type === 'filter') return { nodeId: makeNodeId('filter'), nodeType: 'filter', sourceNode: null, conditions: [{ field: { alias: 't0', field: '' }, op: 'eq', value: '' }] }
  if (type === 'aggregate') return { nodeId: makeNodeId('aggregate'), nodeType: 'aggregate', sourceNode: null, groupBy: [], metrics: [{ agg: 'sum', field: '' }] }
  if (type === 'columnSelect') return { nodeId: makeNodeId('columnSelect'), nodeType: 'columnSelect', sourceNode: null, columns: [] }
  if (type === 'dedup') return { nodeId: makeNodeId('dedup'), nodeType: 'dedup', sourceNode: null, columns: [] }
  if (type === 'valueReplace') return { nodeId: makeNodeId('valueReplace'), nodeType: 'valueReplace', sourceNode: null, mappings: [{ field: '', from: '', to: '' }] }
  if (type === 'nullReplace') return { nodeId: makeNodeId('nullReplace'), nodeType: 'nullReplace', sourceNode: null, mappings: [{ field: '', to: '' }] }
  if (type === 'trim') return { nodeId: makeNodeId('trim'), nodeType: 'trim', sourceNode: null, columns: [] }
  if (type === 'sqlNode') return { nodeId: makeNodeId('sqlNode'), nodeType: 'sqlNode', sourceNode: null, sql: '' }
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
  for (const n of nodes.value) {
    if (n.sourceNode === nodeId) n.sourceNode = parentId
    if (n.rightNodeId === nodeId) n.rightNodeId = null
  }
  ensureChain()
  if (selectedNodeId.value === nodeId) {
    selectedNodeId.value = null
    drawerVisible.value = false
  }
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

function onNodeClick({ node }) {
  selectNode(defNode(node.id))
  drawerVisible.value = true
}
function onDragStop({ node }) {
  const n = defNode(node.id)
  if (n) {
    n.x = node.position.x
    n.y = node.position.y
    emitChange()
  }
}
function selectNode(n) { if (n) selectedNodeId.value = n.nodeId }
function selectNodeFromCard(n) { if (n) { selectedNodeId.value = n.nodeId; drawerVisible.value = true } }

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
    if (!n.to.alias) n.to.alias = `t${nodes.value.length}`
    emitChange()
  }
}
function onRightNodeChange() {
  const n = activeNode.value
  if (!n || n.nodeType !== 'join') return
  if (n.rightNodeId) {
    const ref = defNode(n.rightNodeId)
    if (ref) {
      n.to = n.to || {}
      n.to.alias = ref.alias
      n.to.schema = ref.schema
      n.to.table = ref.table
    }
  }
  emitChange()
}

function parsePrefField(pref) {
  const dot = pref.indexOf('.')
  if (dot < 0) return { alias: '', field: pref }
  return { alias: pref.substring(0, dot), field: pref.substring(dot + 1) }
}

function onValueReplaceFieldChange(m) {
  if (m.field && typeof m.field === 'string') m.field = parsePrefField(m.field)
  emitChange()
}
function onNullReplaceFieldChange(m) {
  if (m.field && typeof m.field === 'string') m.field = parsePrefField(m.field)
  emitChange()
}

function addJoinCondition() {
  const n = activeNode.value
  if (!n) return
  const rightAlias = n.rightNodeId ? (defNode(n.rightNodeId)?.alias || 'jr') : (n.to?.alias || 'jr')
  n.on.push({ from: { alias: 't0', field: '' }, to: { alias: rightAlias, field: '' } })
  emitChange()
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
    let xi = 0
    for (const n of arr) { n.x = xi; xi += 230; n.y = 0 }
  }
  nodes.value = arr
  orderByChain()
  emitChange()
  void nextTick(() => fitView({ padding: 0.2, duration: 0 }))
}

function orderByChain() {
  const ordered = []
  const visited = new Set()
  const head = nodes.value.find((n) => n.nodeType === 'source')
  const pool = [...nodes.value]
  let cur = head
  while (cur && !visited.has(cur.nodeId)) {
    visited.add(cur.nodeId)
    ordered.push(cur)
    cur = nodes.value.find((n) => n.sourceNode === cur.nodeId)
  }
  for (const n of pool) if (!visited.has(n.nodeId)) ordered.push(n)
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
.etl-builder__panel-title { font-size: 14px; font-weight: 600; color: var(--app-text-secondary); margin-bottom: 8px; }
.palette-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; margin-bottom: 6px; border: 1px solid var(--el-border-color-light); border-radius: 6px; cursor: grab; font-size: 13px; }
.palette-item:hover { border-color: var(--app-primary); }
.palette-item--disabled { opacity: .45; cursor: not-allowed; }
.palette-item__icon { width: 22px; height: 22px; border-radius: 4px; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex: 0 0 auto; }
.palette-item__label { color: var(--app-text-primary); }

/* canvas toolbar (zoom + undo/redo/autoLayout) */
.etl-canvas-toolbar { position: absolute; top: 8px; right: 8px; z-index: 5; display: flex; flex-direction: column; align-items: center; gap: 0; background: var(--el-bg-color, #fff); border: 1px solid var(--el-border-color); border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,.08); padding: 4px; }
.etl-toolbar-group { display: flex; flex-direction: column; gap: 2px; }
.etl-toolbar-divider { width: 60%; height: 1px; background: var(--el-border-color-light, #e4e7ed); margin: 4px 0; }
.etl-canvas-toolbar__btn { width: 28px; height: 28px; border: none; background: transparent; border-radius: 4px; cursor: pointer; font-size: 15px; color: var(--app-text-primary, #303133); display: flex; align-items: center; justify-content: center; transition: background .15s; padding: 0; }
.etl-canvas-toolbar__btn:hover { background: var(--app-hover, #f5f7fa); }
.etl-canvas-toolbar__btn:disabled { opacity: .35; cursor: not-allowed; }

/* drawer overrides */
.drawer-node-badge { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 5px; color: #fff; font-size: 12px; font-weight: 600; flex: 0 0 auto; }
.drawer-field { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; font-size: 14px; flex-wrap: wrap; }
.drawer-toolbar { display: flex; align-items: center; gap: 8px; }
.drawer-preview-actions { display: flex; align-items: center; gap: 8px; }
.drawer-error { font-size: 12px; color: var(--el-color-danger); }
.drawer-section-title { font-size: 14px; font-weight: 600; color: var(--app-text-secondary); margin-bottom: 6px; }
</style>
