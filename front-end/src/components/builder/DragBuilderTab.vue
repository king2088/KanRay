<template>
  <div class="drag-builder">
    <div class="drag-builder__left">
      <div class="drag-builder__panel-title">目录 · 拖「表」进画布</div>
      <SchemaTree
        :catalog="schemas"
        :show-fields="false"
        @mount-table="mountTable"
      />
    </div>

    <div
      class="drag-builder__mid"
      :class="{ 'drag-builder__mid--over': dragOver }"
      @dragover.prevent="onDragOver"
      @drop="onMidDrop"
      @dragleave="dragOver = false"
    >
      <div v-if="dragOver" class="drag-builder__mid--overlay">松开以加入表</div>
      <el-tabs v-model="activeTab" type="card" class="drag-builder__tabs">
        <!-- 选字段 -->
        <el-tab-pane label="选字段" name="fields">
          <el-scrollbar class="drag-builder__scroll">
            <div>
              <div v-for="t in tables" :key="t.alias" class="field-card">
                <div class="field-card__head">
                  <button type="button" class="field-card__toggle" :class="{ 'is-closed': t.collapsed }" @click="t.collapsed = !t.collapsed">
                    <el-icon :size="14"><ArrowDown /></el-icon>
                  </button>
                  <span class="field-card__table">{{ t.schema }}.{{ t.table }}</span>
                  <el-input v-model="t.alias"  style="width: 110px" placeholder="别名" @focus="rememberAlias(t)" @change="onAliasChange(t)" />
                  <span class="field-card__actions">
                    <el-button link  type="primary" @click="selectAll(t, true)">全选</el-button>
                    <el-button link  @click="selectAll(t, false)">清空</el-button>
                    <el-button link  type="danger" @click="removeTable(t)">移除</el-button>
                  </span>
                </div>
                <el-collapse-transition>
                  <div v-show="!t.collapsed" :ref="(el) => bindSortable(el, tableKey(t))" class="field-card__rows">
                    <div v-for="(row, i) in rowList(t)" :key="row.name" class="field-row drag-row">
                      <el-checkbox v-model="row.checked"  @change="emitChange" />
                      <span class="field-row__name">{{ row.name }}</span>
                      <el-input v-model="row.label"  style="width: 120px" placeholder="别名" @change="emitChange" />
                      <el-radio-group v-model="row.kind"  @change="onKindChange(row)">
                        <el-radio-button label="dimension">维度</el-radio-button>
                        <el-radio-button label="metric">指标</el-radio-button>
                      </el-radio-group>
                      <el-tag v-if="row.role"  :type="row.role === 'metric' ? 'primary' : row.role === 'time' ? 'warning' : 'success'" effect="plain">{{ { metric: '指标', dimension: '维度', time: '时间' }[row.role] }}</el-tag>
                    </div>
                    <el-empty v-if="!rowList(t).length" :image-size="48" description="该表没有可列字段" />
                  </div>
                </el-collapse-transition>
              </div>
              <el-empty v-if="!tables.length" description="先上架数据表（左侧目录 → 上架 / 拖入）" />
            </div>
          </el-scrollbar>
        </el-tab-pane>

        <!-- 数据关联 -->
        <el-tab-pane label="数据关联" name="assoc">
          <el-scrollbar class="drag-builder__scroll">
            <div>
              <div class="drag-builder__join-title">关联条件（{{ joins.length }}）</div>
              <div v-for="(j, i) in joins" :key="i" class="join-row">
                <el-select v-model="j.type"  style="width: 90px">
                  <el-option label="INNER" value="inner" />
                  <el-option label="LEFT" value="left" />
                  <el-option label="RIGHT" value="right" />
                </el-select>
                <el-select v-model="j.fromAlias"  style="width: 90px" @change="emitChange">
                  <el-option v-for="t in tables" :key="t.alias" :value="t.alias" :label="t.alias" />
                </el-select>
                <el-select v-model="j.fromField"  filterable style="width: 140px" @change="emitChange">
                  <el-option v-for="f in tableFields(j.fromAlias)" :key="f.name" :value="f.name" :label="f.name" />
                </el-select>
                <span class="join-eq">=</span>
                <el-select v-model="j.toAlias"  style="width: 90px" @change="emitChange">
                  <el-option v-for="t in tables" :key="t.alias" :value="t.alias" :label="t.alias" />
                </el-select>
                <el-select v-model="j.toField"  filterable style="width: 140px" @change="emitChange">
                  <el-option v-for="f in tableFields(j.toAlias)" :key="f.name" :value="f.name" :label="f.name" />
                </el-select>
                <el-button link  type="danger" @click="joins.splice(i, 1); emitChange()">删</el-button>
              </div>
              <el-button  style="margin-top: 8px" :disabled="tables.length < 2" @click="addJoin">+ 关联条件</el-button>
              <div v-if="tables.length < 2" class="drag-builder__hint">至少上架 2 张表才能关联</div>
            </div>
          </el-scrollbar>
        </el-tab-pane>

        <!-- 聚合 -->
        <el-tab-pane label="聚合" name="agg">
          <el-scrollbar class="drag-builder__scroll">
            <div>
              <el-switch v-model="useAgg"  active-text="启用聚合" @change="emitChange" />
              <template v-if="useAgg">
                <div class="agg-block">
                  <div class="agg-title">分组维度</div>
                  <el-select v-model="aggGroupBy" multiple collapse-tags filterable  style="width: 100%">
                    <el-option v-for="o in fieldOptions" :key="o.value" :label="o.label" :value="o.value" />
                  </el-select>
                </div>
                <div class="agg-block">
                  <div class="agg-title">聚合指标</div>
                  <div v-for="(m, i) in aggMetrics" :key="i" class="agg-metric">
                    <el-select v-model="m.agg"  style="width: 130px" @change="emitChange">
                      <el-option v-for="a in AGG_OPTIONS" :key="a.value" :label="a.label" :value="a.value" />
                    </el-select>
                    <el-select v-if="m.agg !== 'count'" v-model="m.field"  filterable style="width: 160px" @change="emitChange">
                      <el-option v-for="o in fieldOptions" :key="o.value" :label="o.label" :value="o.value" />
                    </el-select>
                    <el-button link  type="danger" @click="aggMetrics.splice(i, 1); emitChange()">删</el-button>
                  </div>
                  <el-button  style="margin-top: 6px" @click="aggMetrics.push({ agg: 'sum', field: '' }); emitChange()">+ 指标</el-button>
                </div>
              </template>
            </div>
          </el-scrollbar>
        </el-tab-pane>
      </el-tabs>
    </div>

    <div class="drag-builder__preview">
      <div class="drag-builder__panel-title">{{ useAgg ? '聚合预览' : '明细预览' }}（前 {{ useAgg ? 1000 : previewLimit }} 行）</div>
      <div class="drag-builder__preview-actions">
        <el-button :loading="previewing" size="small" @click="runPreview">执行预览</el-button>
        <span v-if="lastError" class="drag-builder__error">{{ lastError }}</span>
      </div>
      <div class="drag-builder__preview-table">
        <el-table :data="previewRows" height="100%" empty-text="执行预览查看数据">
          <el-table-column v-for="c in previewCols" :key="c" :prop="c" :label="c" min-width="110" show-overflow-tooltip />
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import Sortable from 'sortablejs'
import { buildApi } from '@/api'
import { allFields, AGG_OPTIONS } from '@/utils/catalog'
import SchemaTree from './SchemaTree.vue'

const props = defineProps({ datasourceId: { type: [Number, String], required: true }, catalog: { type: Array, default: () => [] }, initialDefinition: Object })
const emit = defineEmits(['change'])

const schemas = ref([])
watch(() => props.catalog, (v) => { schemas.value = v || [] }, { immediate: true, deep: true })

const activeTab = ref('fields')
const tables = ref([])            // [{ alias, schema, table }]
const joins = ref([])             // [{ type, fromAlias, fromField, toAlias, toField }]
const rows = reactive({})         // `${schema}:${table}` -> [{ name, type, role, checked, label, kind }]
const useAgg = ref(false)
const aggGroupBy = ref([])
const aggMetrics = ref([])
const previewing = ref(false)
const previewRows = ref([])
const previewCols = ref([])
const lastError = ref('')
const previewLimit = 200
const sortables = {}
const aliasMemory = {}
const dragOver = ref(false)

function onDragOver(evt) {
  dragOver.value = [].includes.call(evt.dataTransfer.types, 'text/plain')
}

function onMidDrop(evt) {
  dragOver.value = false
  const tableId = evt.dataTransfer.getData('text/plain')
  if (!tableId) return
  mountTable(tableId)
}

function tableKey(t) { return `${t.schema}:${t.table}` }

function catalogTableId(id) {
  const [schema, table] = id.split(':')
  for (const s of schemas.value) {
    const found = (s.tables || []).find((t) => t.table === table && s.schema === schema)
    if (found) return { schema, table, columns: found.columns || [] }
  }
  return null
}

function rowList(t) { return rows[tableKey(t)] || [] }

function bindSortable(el, key) {
  if (!el) { sortables[key]?.destroy?.(); delete sortables[key]; return }
  if (sortables[key]) return
  sortables[key] = Sortable.create(el, {
    group: { name: 'drag-fields', pull: false, put: false },
    draggable: '.drag-row',
    animation: 150,
    onEnd: ({ oldIndex, newIndex }) => {
      const arr = rows[key]
      if (!arr || oldIndex === newIndex) return
      const [moved] = arr.splice(oldIndex, 1)
      arr.splice(newIndex, 0, moved)
      emitChange()
    },
  })
}

function initRowsForTable(key, columns) {
  if (!rows[key]) {
    rows[key] = (columns || []).map((c) => ({
      name: c.name, type: c.type || 'string', role: c.role || '',
      checked: false, label: c.name, kind: c.role === 'metric' ? 'metric' : 'dimension',
    }))
  }
  // 补齐 catalog 新增列
  for (const c of columns || []) {
    if (!rows[key].some((r) => r.name === c.name)) rows[key].push({ name: c.name, type: c.type || 'string', role: c.role || '', checked: false, label: c.name, kind: c.role === 'metric' ? 'metric' : 'dimension' })
  }
}

function mountTable(id, keepAlias = false) {
  const meta = catalogTableId(id)
  if (!meta) return ElMessage.warning('未在目录中找到该表')
  if (tables.value.some((t) => t.schema === meta.schema && t.table === meta.table)) return
  const key = `${meta.schema}:${meta.table}`
  initRowsForTable(key, meta.columns)
  tables.value.push({ alias: keepAlias ? keepAlias : `t${tables.value.length}`, schema: meta.schema, table: meta.table, collapsed: false })
  tryPreJoin()
  emitChange()
}

function rememberAlias(t) { aliasMemory[tableKey(t)] = t.alias }
function onAliasChange(t) {
  const old = aliasMemory[tableKey(t)] || t.alias
  aliasMemory[tableKey(t)] = t.alias
  if (old === t.alias) return
  for (const j of joins.value) {
    if (j.fromAlias === old) j.fromAlias = t.alias
    if (j.toAlias === old) j.toAlias = t.alias
  }
  const re = new RegExp(`^${old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.`)
  aggGroupBy.value = aggGroupBy.value.map((g) => g.replace(re, `${t.alias}.`))
  for (const m of aggMetrics.value) m.field = m.field.replace(re, `${t.alias}.`)
  emitChange()
}

function removeTable(t) {
  tables.value = tables.value.filter((x) => x.alias !== t.alias)
  joins.value = joins.value.filter((j) => j.fromAlias !== t.alias && j.toAlias !== t.alias)
  emitChange()
}

function selectAll(t, on) {
  const arr = rows[tableKey(t)]
  if (!arr) return
  arr.forEach((r) => { r.checked = on })
  emitChange()
}

function onKindChange(row) {
  row.type = row.kind === 'metric' ? 'number' : (row.kind === 'dimension' ? (row.role === 'time' ? 'date' : 'string') : 'string')
  emitChange()
}

function tableFields(alias) {
  const t = tables.value.find((x) => x.alias === alias)
  return t ? allFields(schemas.value, tableKey(t)).map((f) => ({ name: f.name, type: f.type })) : []
}

function tryPreJoin() {
  if (tables.value.length < 2) return
  const prev = tables.value[tables.value.length - 2]
  const cur = tables.value[tables.value.length - 1]
  const prevFields = tableFields(prev.alias).map((f) => f.name.toLowerCase())
  const curFields = tableFields(cur.alias).map((f) => f.name.toLowerCase())
  const common = prevFields.find((n) => curFields.includes(n))
  if (common) {
    joins.value.push({ type: 'inner', fromAlias: prev.alias, fromField: prevFields.find((n) => n === common), toAlias: cur.alias, toField: curFields.find((n) => n === common) })
    emitChange()
  }
}

function addJoin() {
  if (tables.value.length >= 2) {
    joins.value.push({ type: 'inner', fromAlias: tables.value[0].alias, fromField: '', toAlias: tables.value[1].alias, toField: '' })
    emitChange()
  }
}

const fieldOptions = computed(() => {
  const out = []
  for (const t of tables.value) {
    for (const r of rowList(t)) {
      if (r.checked) out.push({ value: `${t.alias}.${r.name}`, label: `${t.alias}.${r.name}`, source: t.alias, field: r.name })
    }
  }
  return out
})

const definition = computed(() => ({
  type: 'builder',
  tables: tables.value.map(({ alias, schema, table }) => ({ alias, schema, table })),
  joins: joins.value.map((j) => ({ type: j.type, from: { alias: j.fromAlias, field: j.fromField }, to: { alias: j.toAlias, field: j.toField } })),
  fields: tables.value.flatMap((t) => (rowList(t) || []).filter((r) => r.checked).map((r) => ({ source: t.alias, field: r.name, label: r.label, type: r.type }))),
  aggregation: useAgg.value ? { groupBy: aggGroupBy.value.map((g) => ({ alias: g.split('.')[0], field: g.split('.')[1] })), metrics: aggMetrics.value.filter((m) => m.agg === 'count' || m.field) } : null,
  limit: 1000,
}))

function emitChange() { emit('change', { definition: definition.value }) }

async function runPreview() {
  if (!tables.value.length) return ElMessage.warning('先上架数据表')
  if (!definition.value.fields.length) return ElMessage.warning('至少勾选一个字段')
  lastError.value = ''
  previewing.value = true
  try {
    if (useAgg.value) {
      const res = await buildApi.previewAggregate(props.datasourceId, definition.value, definition.value.aggregation, 1000)
      previewCols.value = res.rows.length ? Object.keys(res.rows[0]) : (res.fields || []).map((f) => f.name)
      previewRows.value = res.rows
    } else {
      const res = await buildApi.previewDetail(props.datasourceId, definition.value, previewLimit)
      previewCols.value = res.rows.length ? Object.keys(res.rows[0]) : (res.fields || []).map((f) => f.name)
      previewRows.value = res.rows
    }
  } catch (e) {
    lastError.value = e.message || '预览失败'
  } finally { previewing.value = false }
}

function restore(def) {
  if (!def || def.type !== 'builder') return
  tables.value = (def.tables || []).map((t) => ({ alias: t.alias, schema: t.schema, table: t.table, collapsed: false }))
  joins.value = (def.joins || []).map((j) => ({ type: j.type || 'inner', fromAlias: j.from?.alias, fromField: j.from?.field, toAlias: j.to?.alias, toField: j.to?.field }))
  for (const t of tables.value) {
    const key = tableKey(t)
    const meta = catalogTableId(key)
    initRowsForTable(key, meta ? meta.columns : [])
  }
  const order = []
  for (const f of def.fields || []) {
    const t = tables.value.find((x) => x.alias === f.source)
    if (!t) continue
    const arr = rows[tableKey(t)]
    const row = arr && arr.find((r) => r.name === f.field)
    if (row) {
      row.checked = true
      row.label = f.label || f.field
      row.type = f.type || row.type
      row.kind = row.type === 'number' ? 'metric' : 'dimension'
      order.push(row)
    }
  }
  // 保持定义中的字段顺序：已勾选行按定义顺序前移到各自表内首部
  for (const t of tables.value) {
    const key = tableKey(t)
    const arr = rows[key] || []
    const moved = arr.filter((r) => r.checked).sort((a, b) => order.indexOf(a) - order.indexOf(b))
    const rest = arr.filter((r) => !r.checked)
    rows[key] = [...moved, ...rest]
  }
  if (def.aggregation) {
    useAgg.value = true
    aggGroupBy.value = (def.aggregation.groupBy || []).map((g) => `${g.alias}.${g.field}`)
    aggMetrics.value = (def.aggregation.metrics || []).map((m) => ({ agg: m.agg, field: `${m.source || ''}.${m.field}`.replace(/^\./, '') }))
  }
  emitChange()
}

watch(() => props.initialDefinition, (d) => { if (d) restore(d) }, { immediate: true, deep: true })
defineExpose({ getDefinition: () => definition.value })
</script>

<style scoped>
.drag-builder { display: flex; gap: 12px; height: 100%; }
.drag-builder__left { flex: 0 0 260px; display: flex; flex-direction: column; min-height: 0; border: 1px solid var(--el-border-color); border-radius: 8px; overflow: hidden; padding: 8px; }
.drag-builder__panel-title { font-size: 14px; font-weight: 600; color: var(--app-text-secondary); margin-bottom: 8px; flex-shrink: 0; }
.drag-builder__mid { flex: 1; min-width: 480px; position: relative; display: flex; flex-direction: column; overflow: hidden; }
.drag-builder__tabs { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.drag-builder__tabs :deep(.el-tabs__header) { flex-shrink: 0; margin-bottom: 0; padding: 0 6px; }
.drag-builder__tabs :deep(.el-tabs__content) { flex: 1; min-height: 0; overflow: hidden; }
.drag-builder__tabs :deep(.el-tab-pane) { height: 100%; }
.drag-builder__scroll { height: 100%; }
.drag-builder__scroll :deep(.el-scrollbar__view) { padding-top: 10px; }
.drag-builder__mid--over { border: 1px dashed var(--el-color-primary); border-radius: 8px; }
.drag-builder__mid--overlay { position: absolute; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; color: var(--el-color-primary); background: var(--el-color-primary-light-9); border-radius: 8px; pointer-events: none; }
.drag-builder__preview { flex: 0 0 40%; min-width: 360px; border: 1px solid var(--el-border-color); border-radius: 8px; padding: 8px; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
.drag-builder__preview-actions { flex-shrink: 0; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
.drag-builder__preview-table { flex: 1; min-height: 0; border: 1px solid var(--el-border-color-light); border-radius: 4px; overflow: hidden; }
.drag-builder__error { font-size: 12px; color: var(--el-color-danger); }
.field-card { border: 1px solid var(--el-border-color-light); border-radius: 6px; padding: 8px; margin-bottom: 10px; }
.field-card__head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.field-card__table { font-size: 14px; font-weight: 600; flex-shrink: 0; }
.field-card__actions { display: flex; align-items: center; gap: 8px; margin-left: auto; flex-shrink: 0; }
.field-card__toggle { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border: none; background: transparent; cursor: pointer; border-radius: 4px; color: var(--app-text-secondary); padding: 0; flex: 0 0 auto; }
.field-card__toggle:hover { background: var(--app-hover); }
.field-card__toggle .el-icon { transition: transform 0.2s; }
.field-card__toggle.is-closed .el-icon { transform: rotate(-90deg); }
.field-card__rows { margin-top: 6px; }
.field-row { display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-radius: 4px; }
.field-row:hover { background: var(--app-hover); }
.field-row__name { flex: 0 0 130px; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.drag-row { cursor: grab; }
.join-row { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
.join-eq { color: var(--app-text-secondary); }
.drag-builder__join-title { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
.drag-builder__hint { font-size: 12px; color: var(--app-text-secondary); margin-top: 8px; }
.agg-block { margin-top: 12px; }
.agg-title { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
.agg-metric { display: flex; gap: 6px; margin-bottom: 6px; }
</style>