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
        @node-context-menu="onNodeContextMenu"
        @edge-context-menu="onEdgeContextMenu"
        @pane-context-menu="onPaneContextMenu"
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
        </div>
        <div class="etl-toolbar-divider" />
        <div class="etl-toolbar-group">
          <el-tooltip content="撤销" placement="left"><button class="etl-canvas-toolbar__btn" :disabled="!past.length" @click="undo">↺</button></el-tooltip>
          <el-tooltip content="重做" placement="left"><button class="etl-canvas-toolbar__btn" :disabled="!future.length" @click="redo">↻</button></el-tooltip>
          <el-tooltip content="自动布局" placement="left"><button class="etl-canvas-toolbar__btn" @click="autoLayout">⊞</button></el-tooltip>
        </div>
      </div>

      <div v-if="ctxMenu.visible" class="etl-ctx-menu" :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }">
        <div class="etl-ctx-menu__item" @click="ctxMenuDelete">{{ ctxMenu.kind === 'node' ? '删除节点' : '删除连线' }}</div>
      </div>
    </div>

    <el-drawer
      v-model="drawerVisible"
      direction="rtl"
      size="650px"
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
              <el-option v-for="s in rightNodeOptions" :key="s.nodeId" :label="rightNodeLabel(s)" :value="s.nodeId" />
            </el-select>
          </div>
          <div v-if="!activeNode.rightNodeId" class="drawer-field">关联表（旧式）
            <el-select v-model="activeNode._joinTableValue"  filterable @change="onJoinTableChange">
              <el-option v-for="t in tableOptions" :key="t.id" :label="t.label" :value="t.id" />
            </el-select>
          </div>
          <el-table :data="activeNode.on" size="small" class="drawer-table">
            <el-table-column label="目标字段" min-width="150">
              <template #default="{ row }">
                <el-select v-model="row.to"  filterable @change="emitChange">
                  <el-option v-for="f in joinTargetFields" :key="f.pref" :label="f.pref" :value="f.pref" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="运算符" width="76" align="center">
              <template #default="{ row }"><span class="drawer-join-op">=</span></template>
            </el-table-column>
            <el-table-column label="源字段" min-width="150">
              <template #default="{ row }">
                <el-select v-model="row.from"  filterable @change="emitChange">
                  <el-option v-for="f in etlOutputFields(activeNode.sourceNode)" :key="f.pref" :label="f.pref" :value="f.pref" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="56" align="center">
              <template #default="{ $index }">
                <el-button link type="danger" @click="activeNode.on.splice($index, 1); emitChange()">删</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-button  @click="addJoinCondition">+ 条件</el-button>
        </template>

        <template v-if="activeNode.nodeType === 'filter'">
          <el-table :data="activeNode.conditions" size="small" class="drawer-table">
            <el-table-column label="列名" min-width="150">
              <template #default="{ row }">
                <el-select v-model="row.field"  filterable @change="emitChange">
                  <el-option v-for="f in etlOutputFields(activeNode.sourceNode)" :key="f.pref" :label="f.pref" :value="f.pref" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="运算符" width="96">
              <template #default="{ row }">
                <el-select v-model="row.op"  style="width: 100%" @change="emitChange">
                  <el-option v-for="o in STRING_OPS" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="值" min-width="110">
              <template #default="{ row }">
                <el-input v-model="row.value"  @change="emitChange" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="56" align="center">
              <template #default="{ $index }">
                <el-button link type="danger" @click="activeNode.conditions.splice($index, 1); emitChange()">删</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-button  @click="activeNode.conditions.push({ field: '', op: 'eq', value: '' }); emitChange()">+ 条件</el-button>
        </template>

        <template v-if="activeNode.nodeType === 'aggregate'">
          <div class="drawer-field">分组
            <el-select v-model="activeNode.groupBy" multiple collapse-tags collapse-tags-tooltip filterable :max-collapse-tags="3" style="width: 100%" @change="emitChange">
              <el-option v-for="f in etlOutputFields(activeNode.sourceNode)" :key="f.pref" :label="f.pref" :value="f.pref" />
            </el-select>
          </div>
          <el-table :data="activeNode.metrics" size="small" class="drawer-table">
            <el-table-column label="#" width="40" align="center">
              <template #default="{ $index }"><span class="drawer-metric-seq">{{ $index + 1 }}</span></template>
            </el-table-column>
            <el-table-column label="聚合方式" width="132">
              <template #default="{ row }">
                <el-select v-model="row.agg" style="width: 100%" @change="emitChange">
                  <el-option v-for="a in AGG_OPTIONS" :key="a.value" :label="a.label" :value="a.value" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="字段" min-width="140">
              <template #default="{ row }">
                <el-select v-if="row.agg !== 'count'" v-model="row.field" filterable style="width: 100%" @change="emitChange">
                  <el-option v-for="f in etlOutputFields(activeNode.sourceNode)" :key="f.pref" :label="f.pref" :value="f.pref" />
                </el-select>
                <span v-else class="drawer-metric-seq">—</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="56" align="center">
              <template #default="{ $index }">
                <el-button link type="danger" @click="activeNode.metrics.splice($index, 1); emitChange()">删</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-button  @click="activeNode.metrics.push({ agg: 'sum', field: '' }); emitChange()">+ 指标</el-button>
        </template>

        <template v-if="activeNode.nodeType === 'columnSelect'">
          <div class="drawer-field">选择输出列
            <el-select v-model="activeNode.columns" multiple collapse-tags collapse-tags-tooltip filterable :max-collapse-tags="3" style="width: 100%" @change="emitChange">
              <el-option v-for="f in etlOutputFields(activeNode.sourceNode)" :key="f.pref" :label="f.pref" :value="f.pref" />
            </el-select>
          </div>
        </template>

        <template v-if="activeNode.nodeType === 'dedup'">
          <div class="drawer-field">按列去重（不选则全列）
            <el-select v-model="activeNode.columns" multiple collapse-tags collapse-tags-tooltip filterable clearable :max-collapse-tags="3" style="width: 100%" @change="emitChange">
              <el-option v-for="f in etlOutputFields(activeNode.sourceNode)" :key="f.pref" :label="f.pref" :value="f.pref" />
            </el-select>
          </div>
        </template>

        <template v-if="activeNode.nodeType === 'valueReplace'">
          <el-table :data="activeNode.mappings" size="small" class="drawer-table">
            <el-table-column label="列名" min-width="140">
              <template #default="{ row }">
                <el-select v-model="row.field"  filterable @change="emitChange">
                  <el-option v-for="f in etlOutputFields(activeNode.sourceNode)" :key="f.pref" :label="f.pref" :value="f.pref" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="原值" min-width="96">
              <template #default="{ row }">
                <el-input v-model="row.from"  placeholder="原值" @change="emitChange" />
              </template>
            </el-table-column>
            <el-table-column label="→" width="40" align="center">
              <template #default="{ row }"><span class="drawer-join-op">→</span></template>
            </el-table-column>
            <el-table-column label="新值" min-width="96">
              <template #default="{ row }">
                <el-input v-model="row.to"  placeholder="新值" @change="emitChange" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="56" align="center">
              <template #default="{ $index }">
                <el-button link type="danger" @click="activeNode.mappings.splice($index, 1); emitChange()">删</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-button  @click="activeNode.mappings.push({ field: '', from: '', to: '' }); emitChange()">+ 替换规则</el-button>
        </template>

        <template v-if="activeNode.nodeType === 'nullReplace'">
          <el-table :data="activeNode.mappings" size="small" class="drawer-table">
            <el-table-column label="列名" min-width="160">
              <template #default="{ row }">
                <el-select v-model="row.field"  filterable @change="emitChange">
                  <el-option v-for="f in etlOutputFields(activeNode.sourceNode)" :key="f.pref" :label="f.pref" :value="f.pref" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="Null →" width="86" align="center">
              <template #default="{ row }"><span class="drawer-join-op">Null →</span></template>
            </el-table-column>
            <el-table-column label="默认值" min-width="120">
              <template #default="{ row }">
                <el-input v-model="row.to"  placeholder="默认值" @change="emitChange" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="56" align="center">
              <template #default="{ $index }">
                <el-button link type="danger" @click="activeNode.mappings.splice($index, 1); emitChange()">删</el-button>
              </template>
            </el-table-column>
          </el-table>
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
            <div style="margin-bottom:4px;font-size:12px;color:var(--app-text-secondary);line-height:1.7">
              <div>用 SQL 继续加工数据：</div>
              <div>· 有输入线连接上游节点时，<code>__etl_prev</code> 就代表上游节点的数据，可像查表一样用（如 <code>FROM __etl_prev</code>）；</div>
              <div>· 没有接上游节点时，SQL 会直接查询数据源里的真实表。</div>
            </div>
            <SqlCodeMirror v-model="activeNode.sql" :catalog="schemas" placeholder="SELECT * FROM __etl_prev WHERE ..." class="etl-sql-editor" @update:model-value="emitChange" />
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
        <div v-if="nodePreview.length" ref="previewWrapRef" class="drawer-preview-table">
          <TableV2 :columns="previewCols" :data="nodePreview" :width="previewWidth" :height="320" :row-height="36" :row-class="previewRowClass" />
        </div>
        <el-empty v-else :description="activeNode ? '点击「预览此节点」查看真实数据' : ''" :image-size="60" />
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { VueFlow, useVueFlow, MarkerType } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { ElMessage, TableV2 } from 'element-plus'
import { buildApi } from '@/api'
import { allFields, AGG_OPTIONS, STRING_OPS } from '@/utils/catalog'
import EtlNodeCard from './EtlNodeCard.vue'
import SqlCodeMirror from './SqlCodeMirror.vue'
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
const nodes = ref([])
const past = ref([])
const future = ref([])
const selectedNodeId = ref(null)
const previewingNode = ref(null)
const nodePreview = ref([])
const nodePreviewCols = ref([])
const nodeError = ref({})
const drawerVisible = ref(false)
const previewWrapRef = ref(null)
const previewWidth = ref(460)
const previewCols = computed(() => nodePreviewCols.value.map((c) => ({ key: c, title: c, dataKey: c, width: 150 })))
function previewRowClass({ rowIndex }) {
  return rowIndex % 2 === 1 ? 'drawer-preview-zebra' : ''
}
watch(nodePreview, async () => { await nextTick(); measurePreviewWidth() })
watch([drawerVisible, selectedNodeId], () => {
  if (drawerVisible.value) {
    nodePreview.value = []
    nodePreviewCols.value = []
  }
})
function measurePreviewWidth() {
  if (previewWrapRef.value) {
    const w = Math.floor(previewWrapRef.value.clientWidth)
    if (w >= 200) previewWidth.value = w
  }
}
const ctxMenu = reactive({ visible: false, x: 0, y: 0, kind: null, target: null }) // kind: 'node' | 'edge'

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
const rightNodeOptions = computed(() => nodes.value.filter((n) => n.nodeType !== 'output'))
const rightNodeLabel = (n) => {
  if (n.nodeType === 'source') return `${n.alias} (${n.schema}.${n.table})`
  return `${n.alias ? `${n.alias} ` : ''}${nodeTitle(n)} 输出`
}
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
    if (n.sourceNode && n.nodeType !== 'source' && n.sourceNode !== n.nodeId) {
      edges.push({
        id: `e_${n.sourceNode}_${n.nodeId}`,
        source: n.sourceNode,
        target: n.nodeId,
        sourceHandle: 'source',
        targetHandle: 'left',
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      })
    }
    if (n.rightNodeId && n.nodeType === 'join' && n.rightNodeId !== n.nodeId) {
      edges.push({
        id: `e_${n.rightNodeId}_${n.nodeId}_r`,
        source: n.rightNodeId,
        target: n.nodeId,
        sourceHandle: 'source',
        targetHandle: 'right',
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

/* ---- 自由连线约束 ---- */
let lastOccupiedWarn = 0
function warnOccupied() {
  const now = Date.now()
  if (now - lastOccupiedWarn > 800) {
    lastOccupiedWarn = now
    ElMessage.warning('该节点已有一个上游输入，请先删除原连线，或用「关联」节点做多路合并')
  }
}
function isValidConnection(c) {
  const from = defNode(c.source)
  const to = defNode(c.target)
  if (!from || !to || from.nodeId === to.nodeId) return false
  if (from.nodeType === 'output' || to.nodeType === 'source') return false
  const isRight = c.targetHandle === 'right'
  // 右输入手柄只能接 join 节点
  if (isRight && to.nodeType !== 'join') return false
  // 单值输入：目标对应输入（左 sourceNode / 右 rightNodeId）若已被其他节点占用则拒绝
  const occupied = isRight ? to.rightNodeId : to.sourceNode
  if (occupied && occupied !== from.nodeId) {
    warnOccupied()
    return false
  }
  // 不允许回环：from 的上游祖先链（含 join 右输入）上不能出现 to
  const stack = [from.nodeId]
  const seen = new Set()
  while (stack.length) {
    const id = stack.pop()
    if (id === to.nodeId) return false
    if (seen.has(id)) continue
    seen.add(id)
    const n = defNode(id)
    if (!n) continue
    if (n.sourceNode) stack.push(n.sourceNode)
    if (n.nodeType === 'join' && n.rightNodeId) stack.push(n.rightNodeId)
  }
  return true
}

/* 当前图的“链尾”：没有被任何节点引用为上游的节点 */
function chainTail() {
  const referenced = new Set()
  for (const n of nodes.value) {
    if (n.sourceNode) referenced.add(n.sourceNode)
    if (n.rightNodeId) referenced.add(n.rightNodeId)
  }
  const candidates = nodes.value.filter((n) => n.nodeType !== 'output' && !referenced.has(n.nodeId))
  return candidates[candidates.length - 1] || nodes.value.filter((n) => n.nodeType !== 'output').slice(-1)[0] || null
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
      ;(n.on || []).forEach((o) => {
        if (o.from && typeof o.from === 'object') o.from = prefOfRef(o.from)
        if (o.to && typeof o.to === 'object') o.to = prefOfRef(o.to)
      })
    }
    if (n.nodeType === 'aggregate') {
      ;(n.groupBy || []).forEach((g, i) => {
        if (g && typeof g === 'object') n.groupBy[i] = prefOfRef(g)
      })
    }
    if (n.nodeType === 'columnSelect' || n.nodeType === 'dedup') {
      ;(n.columns || []).forEach((c, i) => {
        if (c && typeof c === 'object') n.columns[i] = prefOfRef(c)
      })
    }
    if (n.nodeType === 'trim') {
      ;(n.columns || []).forEach((c, i) => {
        if (c && typeof c === 'object') n.columns[i] = prefOfRef(c)
      })
    }
    if (n.nodeType === 'filter') {
      ;(n.conditions || []).forEach((c) => {
        if (c.field && typeof c.field === 'object') c.field = prefOfRef(c.field)
      })
    }
    if (n.nodeType === 'valueReplace' || n.nodeType === 'nullReplace') {
      ;(n.mappings || []).forEach((m) => {
        if (m.field && typeof m.field === 'object') m.field = prefOfRef(m.field)
      })
    }
  }
}

function autoLayout(push = true) {
  if (push) pushSnapshot()
  const byId = new Map(nodes.value.map((n) => [n.nodeId, n]))
  const inDegree = new Map(nodes.value.map((n) => [n.nodeId, 0]))
  const upstreamOf = (id) => {
    const n = byId.get(id)
    const ups = []
    if (n.sourceNode) ups.push(n.sourceNode)
    if (n.nodeType === 'join' && n.rightNodeId) ups.push(n.rightNodeId)
    return ups
  }
  for (const n of nodes.value) {
    for (const up of upstreamOf(n.nodeId)) inDegree.set(up, (inDegree.get(up) || 0) + 1)
  }
  // 分层：源入度=0 的层0；其余 = max(上游层)+1；未连线的兜底
  const layer = new Map()
  const layerOf = (id, seen = new Set()) => {
    if (layer.has(id)) return layer.get(id)
    if (seen.has(id)) return 0
    seen.add(id)
    let l = 0
    for (const up of upstreamOf(id)) l = Math.max(l, layerOf(up, seen) + 1)
    layer.set(id, l)
    return l
  }
  for (const n of nodes.value) layerOf(n.nodeId)
  const grouped = new Map()
  for (const n of nodes.value) {
    const l = layer.get(n.nodeId) || 0
    if (!grouped.has(l)) grouped.set(l, [])
    grouped.get(l).push(n)
  }
  const baseX = 220
  const baseY = 90
  for (const [l, arr] of grouped) {
    const sorted = [...arr].sort((a, b) => NODE_ORDER.indexOf(a.nodeType) - NODE_ORDER.indexOf(b.nodeType) || (a.y || 0) - (b.y || 0))
    const mid = (sorted.length - 1) / 2
    sorted.forEach((n, i) => { n.x = l * baseX; n.y = (i - mid) * baseY })
  }
  void nextTick(() => fitView({ padding: 0.2, duration: 0 }))
}

function ensureChain(newNodeId = null) {
  // 只自动接入「本次新增且无上游」的节点（新加入的算子），不强制重排已有连线
  const tail = chainTail()
  if (newNodeId) {
    const n = defNode(newNodeId)
    if (n && n.nodeType !== 'source' && n.nodeType !== 'output' && !n.sourceNode && tail && tail.nodeId !== n.nodeId) {
      n.sourceNode = tail.nodeId
    }
  }
  let out = nodes.value.find((n) => n.nodeType === 'output')
  if (!out && nodes.value.some((n) => n.nodeType !== 'output')) {
    const last = chainTail()
    out = { nodeId: makeNodeId('output'), nodeType: 'output', sourceNode: last?.nodeId || null, limit: 1000 }
    nodes.value.push(out)
  }
  if (out && !out.sourceNode) {
    const lastReal = chainTail()
    if (lastReal) out.sourceNode = lastReal.nodeId
  }
  const outIdx = nodes.value.indexOf(out)
  if (outIdx != null && outIdx !== -1 && outIdx !== nodes.value.length - 1 && out) {
    nodes.value.splice(outIdx, 1)
    nodes.value.push(out)
  }
  emitChange()
}

let counter = 1
function makeNodeId(kind) { return `n_${kind}_${counter++}_${Date.now() % 100000}` }

function addNode(type, pos, openDrawer = true) {
  if (type === 'output' && nodes.value.some((n) => n.nodeType === 'output')) return ElMessage.warning('已存在输出')
  pushSnapshot()
  const node = makeNode(type)
  if (!node) return
  node.x = pos?.x ?? null
  node.y = pos?.y ?? null
  const outIdx = nodes.value.findIndex((n) => n.nodeType === 'output')
  if (outIdx >= 0) nodes.value.splice(outIdx, 0, node)
  else nodes.value.push(node)
  ensureChain(node.nodeId)
  if (node.x == null) autoLayout(false)
  else emitChange()
  selectedNodeId.value = node.nodeId
  if (openDrawer) drawerVisible.value = true
}

function makeNode(type) {
  if (type === 'source') {
    const idx = nodes.value.filter((n) => n.nodeType === 'source').length
    return { nodeId: makeNodeId('source'), nodeType: 'source', alias: `t${idx}`, schema: null, table: null, _tableValue: '' }
  }
  if (type === 'join') return {
    nodeId: makeNodeId('join'), nodeType: 'join', joinType: 'inner', sourceNode: null, rightNodeId: null,
    to: { alias: `t${nodes.value.length}`, schema: null, table: null },
    on: [{ from: '', to: '' }],
    _joinTableValue: '',
  }
  if (type === 'filter') return { nodeId: makeNodeId('filter'), nodeType: 'filter', sourceNode: null, conditions: [{ field: '', op: 'eq', value: '' }] }
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
  pushSnapshot()
  const removed = nodes.value[idx]
  const parentId = removed.sourceNode
  nodes.value.splice(idx, 1)
  for (const n of nodes.value) {
    if (n.sourceNode === nodeId) n.sourceNode = parentId || null
    if (n.rightNodeId === nodeId) n.rightNodeId = null
  }
  if (removed.nodeType !== 'output') ensureChain()
  if (selectedNodeId.value === nodeId) {
    selectedNodeId.value = null
    drawerVisible.value = false
  }
}

function deleteEdge(edgeId) {
  const edge = flowEdges.value.find((ed) => ed.id === edgeId)
  if (!edge) return
  const to = defNode(edge.target)
  if (!to) return
  pushSnapshot()
  if (edge.targetHandle === 'right') to.rightNodeId = null
  else to.sourceNode = null
  emitChange()
}

function onConnect(c) {
  pushSnapshot()
  const to = defNode(c.target)
  if (!to || !to.nodeId) return
  if (c.targetHandle === 'right' && to.nodeType === 'join') {
    to.rightNodeId = c.source
  } else {
    to.sourceNode = c.source
  }
  emitChange()
}

function onEdgeClick(edge) {
  const to = defNode(edge.target)
  if (!to) return
  pushSnapshot()
  if (edge.targetHandle === 'right') to.rightNodeId = null
  else to.sourceNode = null
  emitChange()
}

/* ---- 右键菜单 ---- */
function openCtxMenu(kind, target, ev) {
  ctxMenu.kind = kind
  ctxMenu.target = target
  ctxMenu.x = ev.clientX
  ctxMenu.y = ev.clientY
  ctxMenu.visible = true
}
function closeCtxMenu() {
  ctxMenu.visible = false
  ctxMenu.target = null
}
function onNodeContextMenu({ event, node }) {
  event.preventDefault()
  openCtxMenu('node', node.id, event)
}
function onEdgeContextMenu({ event, edge }) {
  event.preventDefault()
  openCtxMenu('edge', edge.id, event)
}
function onPaneContextMenu(event) {
  event.preventDefault()
  closeCtxMenu()
}
function ctxMenuDelete() {
  const { kind, target } = ctxMenu
  closeCtxMenu()
  if (kind === 'node') deleteNode(target)
  else if (kind === 'edge') deleteEdge(target)
}
function onGlobalMouseDown(ev) {
  if (ctxMenu.visible && !ev.target.closest('.etl-ctx-menu')) closeCtxMenu()
}
function onGlobalContextMenu(ev) {
  if (ctxMenu.visible && !ev.target.closest('.etl-ctx-menu')) closeCtxMenu()
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

function prefOfRef(r) {
  if (r == null || r === '') return ''
  if (typeof r === 'string') return r
  if (r.field == null) return ''
  return r.alias ? `${r.alias}.${r.field}` : r.field
}

function addJoinCondition() {
  const n = activeNode.value
  if (!n) return
  n.on.push({ from: '', to: '' })
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
  window.addEventListener('mousedown', onGlobalMouseDown, true)
  window.addEventListener('contextmenu', onGlobalContextMenu, true)
  if (!nodes.value.length) {
    addNode('source', null, false)
    ensureChain()
  }
  void nextTick(() => fitView({ padding: 0.2, duration: 0 }))
})
onUnmounted(() => {
  window.removeEventListener('mousedown', onGlobalMouseDown, true)
  window.removeEventListener('contextmenu', onGlobalContextMenu, true)
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

/* node / edge context menu */
.etl-ctx-menu { position: fixed; z-index: 3000; min-width: 110px; background: var(--el-bg-color, #fff); border: 1px solid var(--el-border-color); border-radius: 6px; box-shadow: 0 4px 16px rgba(0,0,0,.12); padding: 4px; }
.etl-ctx-menu__item { padding: 6px 10px; font-size: 13px; color: var(--el-color-danger); border-radius: 4px; cursor: pointer; user-select: none; text-align: left; }
.etl-ctx-menu__item:hover { background: var(--app-hover, #f5f7fa); }

/* drawer overrides */
.drawer-node-badge { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 5px; color: #fff; font-size: 12px; font-weight: 600; flex: 0 0 auto; }
.drawer-field { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; font-size: 14px; flex-wrap: wrap; }
.drawer-preview-actions { display: flex; align-items: center; gap: 8px; }
.drawer-error { font-size: 12px; color: var(--el-color-danger); }
.drawer-section-title { font-size: 14px; font-weight: 600; color: var(--app-text-secondary); margin-bottom: 6px; }
.etl-sql-editor :deep(.sql-editor-wrap) { height: 160px; }
.drawer-table { width: 100%; margin-bottom: 10px; }
.drawer-table :deep(.el-table__header th) { padding: 5px 0; font-size: 12px; }
.drawer-table :deep(.el-input__wrapper), .drawer-table :deep(.el-select) { width: 100%; }
.drawer-join-op { color: var(--app-text-secondary); }
.drawer-metric-seq { color: var(--app-text-secondary); font-family: Consolas, 'Courier New', monospace; }
.drawer-preview-table { width: 100%; border: 1px solid var(--el-border-color); border-radius: 6px; overflow: hidden; background: var(--el-bg-color); }
.drawer-preview-table :deep(.el-table-v2) { --el-table-header-bg-color: var(--el-fill-color-light); }
.drawer-preview-table :deep(.el-table-v2__header-row-cell), .drawer-preview-table :deep(.el-table-v2__row-cell) { padding: 0 8px; }
.drawer-preview-table :deep(.el-table-v2__row.drawer-preview-zebra) { background-color: var(--el-fill-color-light); }
.drawer-preview-table :deep(.el-table-v2__row:hover) { background-color: var(--el-fill-color); }
</style>
