<template>
  <div class="page-container" v-loading="loading">
    <div class="page-header">
      <div class="page-header__main">
        <h2 class="page-title">{{ ds?.name || '数据源详情' }}</h2>
        <div class="page-desc">{{ ds?.type }} · {{ ds?.is_active ? '启用' : '停用' }}</div>
      </div>
      <div class="page-header__actions">
        <el-button @click="$router.back()">返回</el-button>
        <el-button type="primary" :loading="testing" @click="doTest">测试连接</el-button>
      </div>
    </div>

    <el-card v-if="ds" shadow="never" style="margin-bottom: 16px">
      <div style="display: flex; gap: 40px; font-size: 14px; color: var(--app-text-secondary)">
        <div><strong>类型：</strong>{{ ds.type }}</div>
        <div><strong>模式：</strong>{{ ds.mode === 'sync' ? '同步' : '直连' }}</div>
        <div><strong>最近测试：</strong>
          <el-tag v-if="ds.last_test_ok === true" type="success" >成功</el-tag>
          <el-tag v-else-if="ds.last_test_ok === false" type="danger" >失败</el-tag>
          <span v-else>未测试</span>
          <span v-if="ds.last_test_msg"> — {{ ds.last_test_msg }}</span>
        </div>
      </div>
    </el-card>

    <el-card v-if="ds && ds.type === 'excel'" shadow="never">
      <template #header>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span>文件数据源</span>
          <el-tag type="success" >Excel / CSV</el-tag>
        </div>
      </template>
      <div class="file-meta">
        <div class="file-meta__icon"><el-icon :size="20"><Document /></el-icon></div>
        <div class="file-meta__main">
          <div class="file-meta__name">{{ ds.config?.file || ds.name }}</div>
          <div class="file-meta__sub">
            共 <strong>{{ (ds.config?.rowCount ?? 0).toLocaleString('zh-CN') }}</strong> 行 ·
            <strong>{{ ds.config?.columnCount ?? 0 }}</strong> 列，已作为数据集导入，可直接用于图表构建
          </div>
        </div>
      </div>
      <el-alert type="info" :closable="false" show-icon style="margin-top: 10px" title="Excel / CSV 文件数据源不支持 Schema 浏览，请在数据集列表中管理并预览数据" />
    </el-card>

    <el-card v-if="ds && ds.type !== 'excel' && ds.mode === 'sync'" shadow="never" style="margin-bottom: 16px">
      <template #header>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span>同步任务</span>
          <el-button type="primary" @click="openSyncDialog()">新建同步</el-button>
        </div>
      </template>
      <el-table :data="tasks" v-loading="tasksLoading" size="small">
        <el-table-column label="源表" min-width="140">
          <template #default="{ row }">{{ row.source_schema }}.{{ row.source_table }}</template>
        </el-table-column>
        <el-table-column label="目标表" prop="local_table" min-width="160" show-overflow-tooltip />
        <el-table-column label="策略" width="90">
          <template #default="{ row }">{{ row.strategy === 'full' ? '全量' : '增量' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.last_sync_status === 'running'" type="warning" effect="light" >同步中</el-tag>
            <el-tag v-else-if="row.last_sync_status === 'success'" type="success" effect="plain" >成功</el-tag>
            <el-tag v-else-if="row.last_sync_status === 'failed'" type="danger" effect="plain" >失败</el-tag>
            <el-tag v-else type="info" effect="plain" >未同步</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最近同步" min-width="170">
          <template #default="{ row }">
            <template v-if="row.last_sync_at">{{ row.last_sync_at }}<span v-if="row.last_sync_rows != null" style="color: var(--app-text-secondary)"> · {{ row.last_sync_rows }} 行</span></template>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="下次" min-width="110">
          <template #default="{ row }">{{ nextSync(row) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" :loading="syncingId === row.id" :disabled="row.last_sync_status === 'running'" @click="runTask(row)">立即同步</el-button>
            <el-button link @click="openLogs(row)">日志</el-button>
            <el-button link type="danger" @click="removeTask(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!tasks.length && !tasksLoading" description="暂无同步任务。同步后数据落到本机存储，浏览树中可看到本地表。" :image-size="60" />
    </el-card>

    <el-card v-if="ds && ds.type !== 'excel'" shadow="never">
      <template #header>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span>Schema 浏览</span>
          <el-button  type="primary" @click="openBuilder()">新建构建</el-button>
        </div>
      </template>
      <el-input
        v-if="schemas.length"
        v-model="treeQuery"
        
        placeholder="搜索已加载的表 / 字段"
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
              <el-button v-if="data.type === 'table'" link  type="primary" @click.stop="openBuilder(`${data.schema}:${data.label}`)">新建构建</el-button>
              <el-button v-if="data.type === 'table'" link  @click.stop="createDataset(data)">创建数据集</el-button>
            </span>
          </span>
        </template>
      </el-tree>
      <el-empty v-else description="暂无 Schema 数据" />
    </el-card>

    <el-dialog v-model="syncDialog" title="新建同步任务" width="560px" destroy-on-close>
      <el-form :model="syncForm" label-width="110px">
        <el-form-item label="源 Schema" required>
          <el-select v-model="syncForm.sourceSchema" placeholder="请选择" :loading="srcLoading" @change="onSourceSchema">
            <el-option v-for="s in srcSchemas" :key="s.name" :value="s.name" :label="s.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="源表" required>
          <el-select v-model="syncForm.sourceTable" placeholder="请选择" :loading="srcLoading" filterable @change="onSourceTable">
            <el-option v-for="t in srcTables" :key="t.name" :value="t.name" :label="t.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标表名" required>
          <el-input v-model="syncForm.localTable" placeholder="本地落库表名" />
        </el-form-item>
        <el-form-item label="策略">
          <el-radio-group v-model="syncForm.strategy">
            <el-radio value="incremental" >按水印增量</el-radio>
            <el-radio value="full" >每次全量</el-radio>
          </el-radio-group>
        </el-form-item>
        <template v-if="syncForm.strategy === 'incremental'">
          <el-form-item label="水印字段" required>
            <el-select v-model="syncForm.watermarkField" placeholder="选择单调递增的时间/数值列" :loading="srcLoading">
              <el-option v-for="c in srcColumns" :key="c.name" :value="c.name" :label="`${c.name}${c.type ? ' · ' + c.type : ''}`" />
            </el-select>
          </el-form-item>
          <el-form-item label="主键" required>
            <el-select v-model="syncForm.primaryKey" multiple placeholder="用于增量更新去重（upsert）" :loading="srcLoading">
              <el-option v-for="c in srcColumns" :key="c.name" :value="c.name" :label="`${c.name}${c.type ? ' · ' + c.type : ''}`" />
            </el-select>
          </el-form-item>
          <el-form-item label="删除对账">
            <el-switch v-model="syncForm.reconcileDelete" />
            <span class="sync-form-tip">增量同步时比对主键，本地删除源端已删的行（大表每次多扫一遍主键）</span>
          </el-form-item>
        </template>
        <el-form-item label="刷新周期" required>
          <el-input-number v-model="syncForm.intervalSeconds" :min="0" :step="60" style="width: 180px" />
          <span class="sync-form-tip">秒；0 = 仅手动</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="syncDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingSync" @click="createTask">创建并同步</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="logDialog" title="同步日志" width="720px">
      <el-table :data="logRows" v-loading="logLoading" size="small" max-height="420">
        <el-table-column label="时间" prop="created_at" width="170" />
        <el-table-column label="级别" width="80">
          <template #default="{ row }">
            <el-tag :type="row.level === 'error' ? 'danger' : row.level === 'warn' ? 'warning' : 'success'" size="small" effect="plain">{{ row.level }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="内容" prop="message" show-overflow-tooltip />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import SchemaNodeIcon from '@/components/SchemaNodeIcon.vue'
import { datasourceApi, syncApi } from '@/api'

const route = useRoute()
const router = useRouter()
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
  return /int|float|double|decimal|numeric/.test(raw) ? { type: 'primary', text: '数值' } : /date|time/.test(raw) ? { type: 'warning', text: '时间' } : { type: 'success', text: '文本' }
}

async function doTest() {
  testing.value = true
  try {
    const res = await datasourceApi.testSaved(route.params.id)
    ElMessage[res.ok ? 'success' : 'error'](`测试${res.ok ? '成功' : '失败'}: ${res.message}`)
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

function pad2(n) { return String(n).padStart(2, '0') }
function fmt(d) { return d ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}` : '' }

function nextSync(row) {
  if (row.last_sync_status === 'running') return '同步中…'
  if (!row.interval_seconds || row.interval_seconds <= 0) return '手动'
  if (!row.last_sync_at) return '未同步'
  return fmt(new Date(new Date(row.last_sync_at.replace(' ', 'T')).getTime() + row.interval_seconds * 1000))
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
  if (!f.sourceSchema || !f.sourceTable) return ElMessage.warning('请选择源 Schema 与源表')
  if (!f.localTable.trim()) return ElMessage.warning('请填写目标表名')
  if (f.strategy === 'incremental' && !f.watermarkField) return ElMessage.warning('增量策略需要水印字段')
  if (f.strategy === 'incremental' && !f.primaryKey.length) return ElMessage.warning('增量策略需要主键字段')
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
    ElMessage.success('已创建，正在进行首次同步')
    syncDialog.value = false
    await loadTasks()
    schedulePoll()
  } finally { savingSync.value = false }
}

async function runTask(row) {
  syncingId.value = row.id
  try {
    await syncApi.run(route.params.id, row.id)
    ElMessage.success('已触发同步')
    await loadTasks()
    schedulePoll()
  } finally { syncingId.value = null }
}

async function removeTask(row) {
  await ElMessageBox.confirm(`删除同步任务 ${row.source_schema}.${row.source_table}？本地已落库的表不会被删除。`, '删除同步任务', { type: 'warning' })
  await syncApi.remove(route.params.id, row.id)
  ElMessage.success('已删除')
  await loadTasks()
}

async function openLogs(row) {
  logDialog.value = true
  logLoading.value = true
  try { logRows.value = await syncApi.logs(route.params.id, row.id) } finally { logLoading.value = false }
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
.tree-node__actions { display: none; gap: 2px; flex: 0 0 auto; white-space: nowrap; }
.el-tree-node__content:hover .tree-node__actions,
.el-tree-node__content:focus-within .tree-node__actions { display: flex; }
:deep(.el-tree-node__content:hover) { background: var(--app-hover); border-radius: 4px; }
</style>
