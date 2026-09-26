<template>
  <div class="page-container" v-loading="loading">
    <div class="page-header">
      <div class="page-header__main">
        <h2 class="page-title">{{ ds?.name || t('dataset.dataSource.detail.title') }}</h2>
        <div class="page-desc">{{ ds?.type }} · {{ ds?.is_active ? t('common.state.enabled') : t('common.state.disabled') }}</div>
      </div>
      <div class="page-header__actions">
        <el-button @click="$router.back()">{{ t('common.actions.back') }}</el-button>
        <el-button type="primary" :loading="testing" @click="doTest">{{ t('dataset.dataSource.dataSource.test') }}</el-button>
      </div>
    </div>

    <el-card v-if="ds" shadow="never" style="margin-bottom: 16px">
      <div style="display: flex; gap: 40px; font-size: 14px; color: var(--app-text-secondary)">
        <div><strong>{{ t('dataset.dataSource.detail.typePrefix') }}</strong>{{ ds.type }}</div>
        <div><strong>{{ t('dataset.dataSource.detail.modePrefix') }}</strong>{{ ds.mode === 'sync' ? t('dataset.dataSource.dataSource.form.modeSync') : t('dataset.dataSource.dataSource.form.modeDirect') }}</div>
        <div><strong>{{ t('dataset.dataSource.detail.lastTestPrefix') }}</strong>
          <el-tag v-if="ds.last_test_ok === true" type="success" >{{ t('common.state.success') }}</el-tag>
          <el-tag v-else-if="ds.last_test_ok === false" type="danger" >{{ t('common.state.failed') }}</el-tag>
          <span v-else>{{ t('dataset.dataSource.neverTested') }}</span>
          <span v-if="ds.last_test_msg"> — {{ ds.last_test_msg }}</span>
        </div>
      </div>
    </el-card>

    <el-card v-if="ds && ds.type === 'excel'" shadow="never">
      <template #header>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span>{{ t('dataset.dataSource.stats.fileSources') }}</span>
          <el-tag type="success" >Excel / CSV</el-tag>
        </div>
      </template>
      <div class="file-meta">
        <div class="file-meta__icon"><el-icon :size="20"><Document /></el-icon></div>
        <div class="file-meta__main">
          <div class="file-meta__name">{{ ds.config?.file || ds.name }}</div>
          <div class="file-meta__sub">
            {{ t('dataset.dataSource.detail.fileMetaRows', { count: (ds.config?.rowCount ?? 0).toLocaleString(locale) }) }} ·
            <strong>{{ ds.config?.columnCount ?? 0 }}</strong> {{ t('dataset.dataSource.detail.fileMetaCols', { count: ds.config?.columnCount ?? 0 }) }}
          </div>
        </div>
      </div>
      <el-alert type="info" :closable="false" show-icon style="margin-top: 10px" :title="t('dataset.dataSource.detail.excelNoSchemaTip')" />
    </el-card>

    <el-card v-if="ds && ds.type !== 'excel' && ds.mode === 'sync'" shadow="never" style="margin-bottom: 16px">
      <template #header>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span>{{ t('dataset.sync.title') }}</span>
          <el-button type="primary" @click="openSyncDialog()">{{ t('dataset.sync.create') }}</el-button>
        </div>
      </template>
      <el-table :data="tasks" v-loading="tasksLoading" size="small">
        <el-table-column :label="t('dataset.sync.colSourceTable')" min-width="140">
          <template #default="{ row }">{{ row.source_schema }}.{{ row.source_table }}</template>
        </el-table-column>
        <el-table-column :label="t('dataset.sync.colTargetTable')" prop="local_table" min-width="160" show-overflow-tooltip />
        <el-table-column :label="t('dataset.sync.colStrategy')" width="90">
          <template #default="{ row }">{{ row.strategy === 'full' ? t('dataset.sync.strategyFull') : t('dataset.sync.strategyIncremental') }}</template>
        </el-table-column>
        <el-table-column :label="t('dataset.sync.colStatus')" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.last_sync_status === 'running'" type="warning" effect="light" >{{ t('dataset.sync.statusRunning') }}</el-tag>
            <el-tag v-else-if="row.last_sync_status === 'success'" type="success" effect="plain" >{{ t('common.state.success') }}</el-tag>
            <el-tag v-else-if="row.last_sync_status === 'failed'" type="danger" effect="plain" >{{ t('common.state.failed') }}</el-tag>
            <el-tag v-else type="info" effect="plain" >{{ t('dataset.sync.statusNeverSynced') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('dataset.sync.colLastSync')" min-width="170">
          <template #default="{ row }">
            <template v-if="row.last_sync_at">{{ formatDateTime(row.last_sync_at, appStore.timezone) }}<span v-if="row.last_sync_rows != null" style="color: var(--app-text-secondary)"> · {{ t('dataset.sync.rowsSuffix', { count: row.last_sync_rows }) }}</span></template>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('dataset.sync.colNext')" min-width="110">
          <template #default="{ row }">{{ nextSync(row) }}</template>
        </el-table-column>
        <el-table-column :label="t('dataset.sync.colActions')" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" :loading="syncingId === row.id" :disabled="row.last_sync_status === 'running'" @click="runTask(row)">{{ t('dataset.sync.runNow') }}</el-button>
            <el-button link @click="openLogs(row)">{{ t('dataset.sync.logs') }}</el-button>
            <el-button link type="danger" @click="removeTask(row)">{{ t('common.actions.delete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!tasks.length && !tasksLoading" :description="t('dataset.sync.emptyTasks')" :image-size="60" />
    </el-card>

    <el-card v-if="ds && ds.type !== 'excel'" shadow="never">
      <template #header>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span>{{ t('dataset.schema.browseTitle') }}</span>
          <el-button  type="primary" @click="openBuilder()">{{ t('dataset.schema.newBuilder') }}</el-button>
        </div>
      </template>
      <el-input
        v-if="schemas.length"
        v-model="treeQuery"
        
:placeholder="t('dataset.schema.searchPlaceholder')"
        clearable
        class="schema-search"
      />
      <el-tree
        v-if="schemas.length"
        ref="treeRef"
        :data="schemaTree"
        lazy
        :load="loadNode"
        node-key="id"
        :props="{ children: 'children', label: 'label', disabled: 'disabled', isLeaf: 'isLeaf' }"
        :filter-node-method="filterNode"
      >
        <template #default="{ data }">
          <span class="tree-node">
            <el-icon :size="14" class="tree-node__icon"><SchemaNodeIcon :kind="data.type" :raw-type="data.rawType" /></el-icon>
            <span class="tree-node__label">{{ data.label }}</span>
            <span v-if="data.type === 'column'" class="tree-node__type" :class="'type--' + typeBadge(data).type">{{ typeBadge(data).text }}</span>
            <span class="tree-node__actions">
              <el-button v-if="data.type === 'table'" link @click.stop="openViewData(data)">{{ t('dataset.schema.viewData') }}</el-button>
              <el-button v-if="data.type === 'table'" link type="primary" @click.stop="openBuilder(`${data.schema}:${data.label}`)">{{ t('dataset.schema.newBuilder') }}</el-button>
              <el-button v-if="data.type === 'table'" link type="success" @click.stop="createDataset(data)">{{ t('dataset.schema.createDataset') }}</el-button>
            </span>
          </span>
        </template>
      </el-tree>
      <el-empty v-else :description="t('dataset.schema.empty')" />
    </el-card>

    <el-dialog v-model="syncDialog" :title="t('dataset.sync.dialogTitle')" width="560px" destroy-on-close>
      <el-form :model="syncForm" label-width="110px">
        <el-form-item :label="t('dataset.sync.sourceSchema')" required>
          <el-select v-model="syncForm.sourceSchema" :placeholder="t('dataset.dataSource.form.selectPlaceholder')" :loading="srcLoading" @change="onSourceSchema">
            <el-option v-for="s in srcSchemas" :key="s.name" :value="s.name" :label="s.name" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('dataset.sync.colSourceTable')" required>
          <el-select v-model="syncForm.sourceTable" :placeholder="t('dataset.dataSource.form.selectPlaceholder')" :loading="srcLoading" filterable @change="onSourceTable">
            <el-option v-for="t in srcTables" :key="t.name" :value="t.name" :label="t.name" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('dataset.sync.localTable')" required>
          <el-input v-model="syncForm.localTable" :placeholder="t('dataset.sync.localTablePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('dataset.sync.colStrategy')">
          <el-radio-group v-model="syncForm.strategy">
            <el-radio value="incremental" >{{ t('dataset.sync.strategyIncrementalRadio') }}</el-radio>
            <el-radio value="full" >{{ t('dataset.sync.strategyFullRadio') }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <template v-if="syncForm.strategy === 'incremental'">
          <el-form-item :label="t('dataset.sync.watermarkField')" required>
            <el-select v-model="syncForm.watermarkField" :placeholder="t('dataset.sync.watermarkPlaceholder')" :loading="srcLoading">
              <el-option v-for="c in srcColumns" :key="c.name" :value="c.name" :label="`${c.name}${c.type ? ' · ' + c.type : ''}`" />
            </el-select>
          </el-form-item>
          <el-form-item :label="t('dataset.field.primaryKey')" required>
            <el-select v-model="syncForm.primaryKey" multiple :placeholder="t('dataset.sync.primaryKeyPlaceholder')" :loading="srcLoading">
              <el-option v-for="c in srcColumns" :key="c.name" :value="c.name" :label="`${c.name}${c.type ? ' · ' + c.type : ''}`" />
            </el-select>
          </el-form-item>
          <el-form-item :label="t('dataset.sync.reconcileDelete')">
            <el-switch v-model="syncForm.reconcileDelete" />
            <span class="sync-form-tip">{{ t('dataset.sync.reconcileTip') }}</span>
          </el-form-item>
        </template>
        <el-form-item :label="t('dataset.sync.interval')" required>
          <el-input-number v-model="syncForm.intervalSeconds" :min="0" :step="60" style="width: 180px" />
          <span class="sync-form-tip">{{ t('dataset.sync.intervalTip') }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="syncDialog = false">{{ t('common.actions.cancel') }}</el-button>
        <el-button type="primary" :loading="savingSync" @click="createTask">{{ t('dataset.sync.createAndRun') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="logDialog" :title="t('dataset.sync.logDialogTitle')" width="720px">
      <el-table :data="logRows" v-loading="logLoading" size="small" max-height="420">
        <el-table-column :label="t('dataset.sync.logColTime')" width="170">
          <template #default="{ row }">{{ formatDateTime(row.started_at, appStore.timezone) }}</template>
        </el-table-column>
        <el-table-column :label="t('dataset.sync.logColResult')" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'failed' ? 'danger' : row.status === 'success' ? 'success' : 'warning'" size="small" effect="plain">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('dataset.sync.logColRows')" prop="rows_synced" width="70" />
        <el-table-column :label="t('dataset.sync.logColMessage')" prop="message" show-overflow-tooltip />
      </el-table>
    </el-dialog>

    <el-dialog v-model="viewDialog" :title="t('dataset.schema.viewDialogTitle', { schema: viewInfo.schema, table: viewInfo.table })" width="900px" destroy-on-close>
      <el-table :key="viewFields.join('|')" :data="viewRows" v-loading="viewLoading" size="small" max-height="440" border>
        <el-table-column v-for="f in viewFields" :key="f" :prop="f" :label="f" min-width="140" show-overflow-tooltip />
      </el-table>
      <div class="view-pager">
        <span class="view-pager__info">
          {{ viewInfo.total != null ? t('dataset.schema.viewTotal', { count: viewInfo.total }) : t('dataset.schema.viewSourcePreview') }} · {{ t('dataset.schema.viewPageOf', { page: viewInfo.page }) }}
        </span>
        <el-button size="small" :disabled="viewInfo.page <= 1 || viewLoading" @click="loadViewPage(viewInfo.page - 1)">{{ t('dataset.schema.prevPage') }}</el-button>
        <el-button size="small" :disabled="!viewHasMore || viewLoading" @click="loadViewPage(viewInfo.page + 1)">{{ t('dataset.schema.nextPage') }}</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import SchemaNodeIcon from '@/components/SchemaNodeIcon.vue'
import { datasourceApi, syncApi } from '@/api'
import { formatDateTime } from '@/utils/datetime'
import { fieldTypeLabel } from '@/utils/field-type-label'
import { t } from '@/i18n'
import { useAppStore } from '@/stores/app'

const { locale } = useI18n()
const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const ds = ref(null)
const loading = ref(false)
const testing = ref(false)
const schemas = ref([])
const treeQuery = ref('')
const treeRef = ref(null)

const syncDialog = ref(false)
const savingSync = ref(false)
const tasks = ref([])
const tasksLoading = ref(false)
const syncingId = ref(null)
const srcLoading = ref(false)
const srcSchemas = ref([])
const srcTables = ref([])
const srcColumns = ref([])
const logDialog = ref(false)
const logRows = ref([])
const logLoading = ref(false)
const viewDialog = ref(false)
const viewLoading = ref(false)
const viewFields = ref([])
const viewRows = ref([])
const viewHasMore = ref(false)
const viewInfo = ref({ schema: '', table: '', src: false, page: 1, total: null })
const syncForm = ref({ sourceSchema: '', sourceTable: '', localTable: '', strategy: 'incremental', watermarkField: '', primaryKey: [], intervalSeconds: 0 })
let pollTimer = null

function filterNode(value, data) {
  if (!value) return true
  return String(data.label || '').toLowerCase().includes(String(value).toLowerCase())
}

watch(treeQuery, (val) => {
  treeRef.value?.filter(String(val || ''))
})

const schemaTree = computed(() =>
  schemas.value.map((s) => ({
    id: `schema-${s.name}`, label: s.name, type: 'schema', children: [],
  }))
)

async function load() {
  if (!route.params.id) return
  loading.value = true
  try {
    ds.value = await datasourceApi.get(route.params.id)
    if (ds.value.type !== 'excel') schemas.value = await datasourceApi.schemas(route.params.id)
    if (ds.value.mode === 'sync') { await loadTasks(); schedulePoll() }
  } finally { loading.value = false }
}

async function loadNode(node, resolve) {
  try {
    const id = route.params.id
    const data = node.data || {}
    if (!data.type) {
      resolve(schemaTree.value)
    } else if (data.type === 'schema') {
      const tables = await datasourceApi.tables(id, data.label)
      resolve(tables.map((t) => ({
        id: `${data.label}-${t.name}`, label: t.name, type: 'table', schema: data.label, children: [],
      })))
    } else if (data.type === 'table') {
      const cols = await datasourceApi.columns(id, data.schema, data.label)
      resolve(cols.map((c) => ({
        id: `${data.schema}-${data.label}-${c.name}`, label: c.name, type: 'column', rawType: c.type, isLeaf: true,
      })))
    } else {
      resolve([])
    }
  } catch (e) { /* 拦截器已提示，避免节点卡在加载中 */ resolve([]) }
}

function typeBadge(data) {
  const raw = (data.rawType || '').toLowerCase()
  if (/int|float|double|decimal|numeric/.test(raw)) return { type: 'primary', text: fieldTypeLabel('number') }
  if (/date|time/.test(raw)) return { type: 'warning', text: fieldTypeLabel('date') }
  return { type: 'success', text: fieldTypeLabel('string') }
}

async function doTest() {
  testing.value = true
  try {
    const res = await datasourceApi.testSaved(route.params.id)
    ElMessage[res.ok ? 'success' : 'error'](
      res.ok
        ? t('dataset.dataSource.testSuccess', { message: res.message })
        : t('dataset.dataSource.testFailed', { message: res.message })
    )
    ds.value = await datasourceApi.get(route.params.id)
  } finally { testing.value = false }
}

function openBuilder(preTable) {
  const q = preTable ? { table: preTable } : {}
  router.push({ path: `/datasources/${route.params.id}/builder`, query: q })
}

function createDataset(data) {
  openBuilder(`${data.schema}:${data.label}`)
}

function nextSync(row) {
  if (row.last_sync_status === 'running') return t('dataset.sync.nextRunning')
  if (!row.interval_seconds || row.interval_seconds <= 0) return t('dataset.sync.nextManual')
  if (!row.last_sync_at) return t('dataset.sync.statusNeverSynced')
  const base = new Date(`${row.last_sync_at.replace(' ', 'T')}Z`)
  if (Number.isNaN(base.getTime())) return '—'
  const next = new Date(base.getTime() + row.interval_seconds * 1000)
  return formatDateTime(next.toISOString(), appStore.timezone)
}

async function loadTasks() {
  if (ds.value?.mode !== 'sync') return
  tasksLoading.value = true
  try { tasks.value = await syncApi.list(route.params.id) } finally { tasksLoading.value = false }
}

async function openSyncDialog(prefill) {
  syncForm.value = { sourceSchema: '', sourceTable: '', localTable: '', strategy: 'incremental', watermarkField: '', primaryKey: [], reconcileDelete: true, intervalSeconds: 0 }
  syncDialog.value = true
  if (prefill) Object.assign(syncForm.value, prefill)
  await loadSrcSchemas()
  if (syncForm.value.sourceSchema) await loadSrcTables(syncForm.value.sourceSchema)
  if (syncForm.value.sourceTable) await loadSrcColumns()
}

async function loadSrcSchemas() {
  srcLoading.value = true
  try {
    srcSchemas.value = await datasourceApi.schemas(route.params.id, { source: 1 })
    if (srcSchemas.value.length === 1 && srcSchemas.value[0].name) syncForm.value.sourceSchema ||= srcSchemas.value[0].name
  } finally { srcLoading.value = false }
}

async function onSourceSchema() {
  syncForm.value.sourceTable = ''
  srcTables.value = []
  if (syncForm.value.sourceSchema) await loadSrcTables(syncForm.value.sourceSchema)
}

async function loadSrcTables(schema) {
  srcLoading.value = true
  try { srcTables.value = await datasourceApi.tables(route.params.id, schema, { source: 1 }) } finally { srcLoading.value = false }
}

async function onSourceTable() {
  syncForm.value.watermarkField = ''
  syncForm.value.primaryKey = []
  syncForm.value.localTable = `sync_${route.params.id}_${syncForm.value.sourceTable}`
  srcColumns.value = []
  if (syncForm.value.sourceSchema && syncForm.value.sourceTable) await loadSrcColumns()
}

async function loadSrcColumns() {
  srcLoading.value = true
  try {
    srcColumns.value = await datasourceApi.columns(route.params.id, syncForm.value.sourceSchema, syncForm.value.sourceTable, { source: 1 })
  } finally { srcLoading.value = false }
}

async function createTask() {
  const f = syncForm.value
  if (!f.sourceSchema || !f.sourceTable) return ElMessage.warning(t('dataset.sync.errSourceRequired'))
  if (!f.localTable.trim()) return ElMessage.warning(t('dataset.sync.errLocalTable'))
  if (f.strategy === 'incremental' && !f.watermarkField) return ElMessage.warning(t('dataset.sync.errWatermark'))
  if (f.strategy === 'incremental' && !f.primaryKey.length) return ElMessage.warning(t('dataset.sync.errPrimaryKey'))
  savingSync.value = true
  try {
    await syncApi.create(route.params.id, {
      sourceSchema: f.sourceSchema,
      sourceTable: f.sourceTable,
      localTable: f.localTable.trim(),
      strategy: f.strategy,
      watermarkField: f.strategy === 'incremental' ? f.watermarkField : null,
      primaryKey: f.strategy === 'incremental' ? f.primaryKey : null,
      reconcileDelete: f.reconcileDelete !== false,
      intervalSeconds: f.intervalSeconds,
      runNow: true,
    })
    ElMessage.success(t('dataset.sync.created'))
    syncDialog.value = false
    await loadTasks()
    schedulePoll()
  } finally { savingSync.value = false }
}

async function runTask(row) {
  syncingId.value = row.id
  try {
    await syncApi.run(route.params.id, row.id)
    ElMessage.success(t('dataset.sync.runTriggered'))
    await loadTasks()
    schedulePoll()
  } finally { syncingId.value = null }
}

async function removeTask(row) {
  await ElMessageBox.confirm(
    t('dataset.sync.deleteConfirm', { schema: row.source_schema, table: row.source_table }),
    t('dataset.sync.deleteConfirmTitle'),
    { type: 'warning' }
  )
  await syncApi.remove(route.params.id, row.id)
  ElMessage.success(t('dataset.sync.deleteSuccess'))
  await loadTasks()
}

async function openLogs(row) {
  logDialog.value = true
  logLoading.value = true
  try { logRows.value = await syncApi.logs(route.params.id, row.id) } finally { logLoading.value = false }
}

function openViewData(data) {
  const isLocal = ds.value?.mode === 'sync' && data.schema === 'local'
  viewInfo.value = { schema: data.schema, table: data.label, src: !isLocal, page: 1, total: null }
  viewFields.value = []
  viewRows.value = []
  viewHasMore.value = false
  viewDialog.value = true
  loadViewPage(1)
}

async function loadViewPage(page) {
  if (page < 1) return
  viewLoading.value = true
  try {
    const { schema, table, src } = viewInfo.value
    const params = { page, pageSize: 50 }
    if (src) params.source = '1'
    const r = await datasourceApi.rows(route.params.id, schema, table, params)
    viewFields.value = r.fields || []
    viewRows.value = r.rows || []
    viewHasMore.value = !!r.hasMore
    viewInfo.value = { schema, table, src, page: r.page, total: r.total }
  } finally { viewLoading.value = false }
}

function schedulePoll() {
  if (pollTimer) return
  pollTimer = setInterval(() => {
    if (ds.value?.mode !== 'sync') return
    if (!tasks.value.some((t) => t.last_sync_status === 'running')) return
    loadTasks()
  }, 5000)
}

function stopPoll() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

watch(() => ds.value?.mode, () => { if (ds.value?.mode !== 'sync') { stopPoll() } else { loadTasks(); schedulePoll() } })

onMounted(() => {
  load()
  schedulePoll()
})
onBeforeUnmount(stopPoll)
</script>

<style scoped>
.schema-search { margin-bottom: 8px; }
.view-pager { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 10px; }
.view-pager__info { margin-right: auto; color: var(--el-text-color-secondary); font-size: 13px; }
.tree-node { display: flex; align-items: center; gap: 6px; font-size: 14px; min-width: 0; }
.file-meta { display: flex; align-items: center; gap: 14px; padding: 6px 0; }
.file-meta__icon { width: 44px; height: 44px; border-radius: 10px; background: var(--app-primary-light); color: var(--app-primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.file-meta__main { min-width: 0; }
.file-meta__name { font-size: 16px; font-weight: 600; color: var(--app-text-primary); margin-bottom: 4px; word-break: break-all; }
.file-meta__sub { font-size: 14px; color: var(--app-text-secondary); }
.tree-node__icon { color: var(--app-text-secondary); }
.tree-node__label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tree-node__type { font-size: 11px; flex: 0 0 auto; margin-left: 2px; }
.tree-node__type.type--primary { color: var(--el-color-primary); }
.tree-node__type.type--warning { color: var(--el-color-warning); }
.tree-node__type.type--success { color: var(--el-color-success); }
.tree-node__actions { display: none; gap: 2px; flex: 0 0 auto; white-space: nowrap; margin-left: 80px; }
.el-tree-node__content:hover .tree-node__actions,
.el-tree-node__content:focus-within .tree-node__actions { display: flex; }
:deep(.el-tree-node__content:hover) { background: var(--app-hover); border-radius: 4px; }
</style>
