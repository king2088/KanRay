<template>
  <div class="drag-builder">
    <!-- 左侧：表 + 字段 -->
    <div class="drag-builder__left">
      <div class="drag-builder__panel-title">数据表</div>
      <el-tree :data="tableTree" node-key="id" :props="{ label: 'n', children: 'children' }" @node-click="onTableNode">
        <template #default="{ data }">
          <span style="font-size:12px">{{ data.n }}</span>
          <el-button v-if="data.kind === 'table'" link type="primary" size="small" @click.stop="addTable(data)">加表</el-button>
        </template>
      </el-tree>
    </div>

    <!-- 中间：构建区 -->
    <div class="drag-builder__mid">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="选字段" name="fields">
          <div v-for="t in tables" :key="t.alias" class="drag-builder__tablecard">
            <div class="drag-builder__tablecard-title">{{ t.schema }}.{{ t.table }} <el-tag size="small">{{ t.alias }}</el-tag>
              <el-button link size="small" type="danger" @click="removeTable(t)">移除</el-button>
            </div>
            <div class="drag-builder__fieldlist">
              <el-checkbox v-for="f in tableFields(t)" :key="`${t.alias}.${f.name}`" :model-value="isSelected(t.alias, f.name)" @change="(v) => toggleField(t, f, v)">
                {{ f.name }}
              </el-checkbox>
            </div>
          </div>
          <el-empty v-if="!tables.length" description="从左侧选择表" />
        </el-tab-pane>

        <el-tab-pane label="关联" name="joins">
          <div v-for="(j, i) in joins" :key="i" class="drag-builder__joinrow">
            <el-select v-model="j.fromAlias" size="small" style="width:90px">
              <el-option v-for="t in tables" :key="t.alias" :label="t.alias" :value="t.alias" />
            </el-select>
            <el-select v-model="j.fromField" size="small" style="width:130px">
              <el-option v-for="f in tableFieldsByAlias(j.fromAlias)" :key="f.name" :label="f.name" :value="f.name" />
            </el-select>
            <span>=</span>
            <el-select v-model="j.toAlias" size="small" style="width:90px">
              <el-option v-for="t in tables" :key="t.alias" :label="t.alias" :value="t.alias" />
            </el-select>
            <el-select v-model="j.toField" size="small" style="width:130px">
              <el-option v-for="f in tableFieldsByAlias(j.toAlias)" :key="f.name" :label="f.name" :value="f.name" />
            </el-select>
            <el-select v-model="j.type" size="small" style="width:90px">
              <el-option label="INNER" value="inner" /><el-option label="LEFT" value="left" />
            </el-select>
            <el-button link size="small" type="danger" @click="joins.splice(i, 1)">删</el-button>
          </div>
          <el-button size="small" @click="addJoin">+ 添加关联</el-button>
          <el-empty v-if="!joins.length" description="可添加表间关联（同名列会在所有表内自动预填第一条）" />
        </el-tab-pane>

        <el-tab-pane label="聚合（可选）" name="agg">
          <div class="drag-builder__agg">
            <div class="drag-builder__agg-block">
              <div class="drag-builder__agg-title">分组维度</div>
              <el-select v-model="aggGroupBy" multiple collapse-tags size="small" filterable placeholder="选择字段（已选字段）" style="width:100%">
                <el-option v-for="f in selectedFieldOptions" :key="f.value" :label="f.label" :value="f.value" />
              </el-select>
            </div>
            <div class="drag-builder__agg-block">
              <div class="drag-builder__agg-title">聚合指标</div>
              <div v-for="(m, i) in aggMetrics" :key="i" class="drag-builder__agg-metric">
                <el-select v-model="m.agg" size="small" style="width:130px">
                  <el-option v-for="a in AGG_OPTIONS" :key="a.value" :label="a.label" :value="a.value" />
                </el-select>
                <el-select v-model="m.source" size="small" style="width:100px">
                  <el-option v-for="t in tables" :key="t.alias" :label="t.alias" :value="t.alias" />
                </el-select>
                <el-select v-model="m.field" size="small" style="width:150px" filterable>
                  <el-option v-for="f in tableFieldsByAlias(m.source)" :key="f.name" :label="f.name" :value="f.name" />
                </el-select>
                <el-button link size="small" type="danger" @click="aggMetrics.splice(i, 1)">删</el-button>
              </div>
              <el-button size="small" @click="aggMetrics.push({ agg: 'sum', source: tables[0]?.alias, field: '' })">+ 指标</el-button>
              <el-checkbox v-model="useAgg" class="drag-builder__agg-toggle">启用聚合（保存仍按明细注册，仅预览聚合效果）</el-checkbox>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 右侧预览 -->
    <div class="drag-builder__preview">
      <el-tabs v-model="previewTab">
        <el-tab-pane label="明细" name="detail">
          <el-button size="small" type="primary" :loading="previewing" @click="runDetail">预览</el-button>
        </el-tab-pane>
        <el-tab-pane label="聚合" name="agg">
          <el-button size="small" type="primary" :loading="previewing" @click="runAgg">预览聚合</el-button>
        </el-tab-pane>
      </el-tabs>
      <el-table :data="previewRows" size="small" max-height="360" empty-text="预览结果" v-loading="previewing">
        <el-table-column v-for="c in previewCols" :key="c" :prop="c" :label="c" min-width="110" show-overflow-tooltip />
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { buildApi } from '@/api'
import { toTree, allFields, AGG_OPTIONS } from '@/utils/catalog'

const props = defineProps({ datasourceId: { type: [Number, String], required: true }, initialDefinition: Object })
const emit = defineEmits(['change'])

const activeTab = ref('fields')
const schemas = ref([])
const tableTree = computed(() => toTree(schemas.value))
const tables = ref([])          // [{ alias, schema, table }]
const joins = ref([])           // [{ type, fromAlias, fromField, toAlias, toField }]
const selectedFields = ref([])  // [{ source, field, label, type }]
const aggGroupBy = ref([])
const aggMetrics = ref([])
const useAgg = ref(false)
const previewTab = ref('detail')
const previewing = ref(false)
const previewRows = ref([])
const previewCols = ref([])

const selectedFieldOptions = computed(() => selectedFields.value.map((f) => ({
  value: `${f.source}.${f.field}`, label: `${f.source}.${f.field}`,
})))

function tableFieldsByAlias(alias) {
  const t = tables.value.find((x) => x.alias === alias)
  return t ? allFields(schemas.value, `${t.schema}:${t.table}`) : []
}
function tableFields(t) { return allFields(schemas.value, `${t.schema}:${t.table}`) }
function isSelected(alias, name) { return selectedFields.value.some((f) => f.source === alias && f.field === name) }
function toggleField(t, f, on) {
  if (on) selectedFields.value.push({ source: t.alias, field: f.name, label: f.name, type: f.role === 'metric' ? 'number' : f.type === 'date' ? 'date' : 'string' })
  else selectedFields.value = selectedFields.value.filter((x) => !(x.source === t.alias && x.field === f.name))
  emitChange()
}
function onTableNode(data) {
  if (data.kind === 'field') {
    const t = tables.value.find((x) => x.schema === data.raw.schema && x.table === data.raw.table)
    if (t) toggleField(t, data.raw, !isSelected(t.alias, data.raw.name))
  }
}
function addTable(data) {
  const alias = `t${tables.value.length}`
  const t = { alias, schema: data.id.split(':')[0], table: data.id.split(':')[1] }
  tables.value.push(t)
  // 同名自动预填 join
  tryPreJoin()
  emitChange()
}
function removeTable(t) {
  tables.value = tables.value.filter((x) => x.alias !== t.alias)
  selectedFields.value = selectedFields.value.filter((x) => x.source !== t.alias)
  joins.value = joins.value.filter((j) => j.fromAlias !== t.alias && j.toAlias !== t.alias)
  emitChange()
}
function tryPreJoin() {
  if (tables.value.length < 2) return
  const prev = tables.value[tables.value.length - 2]
  const cur = tables.value[tables.value.length - 1]
  const prevFields = allFields(schemas.value, `${prev.schema}:${prev.table}`).map((f) => f.name.toLowerCase())
  const curFields = allFields(schemas.value, `${cur.schema}:${cur.table}`).map((f) => f.name.toLowerCase())
  const common = prevFields.find((n) => curFields.includes(n))
  if (common) {
    joins.value.push({ type: 'inner', fromAlias: prev.alias, fromField: prevFields.find((n) => n === common), toAlias: cur.alias, toField: curFields.find((n) => n === common) })
  }
  emitChange()
}
function addJoin() {
  if (tables.value.length >= 2) joins.value.push({ type: 'inner', fromAlias: tables.value[0].alias, fromField: '', toAlias: tables.value[1].alias, toField: '' })
  emitChange()
}

const definition = computed(() => ({
  type: 'builder',
  tables: tables.value,
  joins: joins.value.map((j) => ({ type: j.type, from: { alias: j.fromAlias, field: j.fromField }, to: { alias: j.toAlias, field: j.toField } })),
  fields: selectedFields.value.map((f) => ({ source: f.source, field: f.field, label: f.label, type: f.type })),
  aggregation: useAgg.value ? { groupBy: aggGroupBy.value.map((g) => ({ alias: g.split('.')[0], field: g.split('.')[1] })), metrics: aggMetrics.value.filter((m) => m.field) } : null,
  limit: 1000,
}))
function emitChange() { emit('change', { definition: definition.value }) }

async function runDetail() {
  if (!selectedFields.value.length) return ElMessage.warning('至少选择一个字段')
  previewing.value = true
  try {
    const res = await buildApi.previewDetail(props.datasourceId, definition.value, 200)
    previewCols.value = res.rows.length ? Object.keys(res.rows[0]) : (res.fields || []).map((f) => f.name)
    previewRows.value = res.rows
  } finally { previewing.value = false }
}
async function runAgg() {
  if (!useAgg.value) { useAgg.value = true }
  previewing.value = true
  try {
    const res = await buildApi.previewAggregate(props.datasourceId, definition.value, definition.value.aggregation, 1000)
    previewCols.value = res.rows.length ? Object.keys(res.rows[0]) : (res.fields || []).map((f) => f.name)
    previewRows.value = res.rows
  } finally { previewing.value = false }
}

function restore(def) {
  if (!def || def.type !== 'builder') return
  tables.value = (def.tables || []).map((t, i) => ({ alias: t.alias, schema: t.schema, table: t.table }))
  joins.value = (def.joins || []).map((j) => ({ type: j.type || 'inner', fromAlias: j.from?.alias, fromField: j.from?.field, toAlias: j.to?.alias, toField: j.to?.field }))
  selectedFields.value = (def.fields || []).map((f) => ({ source: f.source, field: f.field, label: f.label || f.field, type: f.type || 'string' }))
  if (def.aggregation) {
    useAgg.value = true
    aggGroupBy.value = (def.aggregation.groupBy || []).map((g) => `${g.alias}.${g.field}`)
    aggMetrics.value = (def.aggregation.metrics || []).map((m) => ({ agg: m.agg, source: m.source, field: m.field }))
  }
  emitChange()
}
watch(() => props.initialDefinition, (d) => { if (d) restore(d) }, { immediate: true, deep: true })
defineExpose({ getDefinition: () => definition.value, getFields: () => selectedFields.value })

onMounted(async () => {
  schemas.value = await buildApi.sqlAssist(props.datasourceId)
})
</script>

<style scoped>
.drag-builder { display: flex; gap: 12px; height: 100%; }
.drag-builder__left { flex: 0 0 240px; border: 1px solid var(--el-border-color); border-radius: 8px; overflow: auto; padding: 8px; }
.drag-builder__panel-title { font-size: 13px; font-weight: 600; color: var(--app-text-secondary); margin-bottom: 8px; }
.drag-builder__mid { flex: 1; min-width: 360px; overflow: auto; }
.drag-builder__preview { flex: 0 0 40%; min-width: 360px; border: 1px solid var(--el-border-color); border-radius: 8px; padding: 8px; }
.drag-builder__tablecard { border: 1px solid var(--el-border-color-light); border-radius: 6px; padding: 8px; margin-bottom: 8px; }
.drag-builder__tablecard-title { font-size: 13px; font-weight: 600; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
.drag-builder__fieldlist { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 13px; }
.drag-builder__joinrow { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
.drag-builder__agg { display: flex; gap: 16px; }
.drag-builder__agg-block { flex: 1; }
.drag-builder__agg-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.drag-builder__agg-metric { display: flex; gap: 6px; margin-bottom: 6px; }
.drag-builder__agg-toggle { margin-top: 12px; }
</style>