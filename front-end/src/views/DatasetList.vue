<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__main">
        <h2 class="page-title">{{ t('dataset.list.title') }}</h2>
        <div class="page-desc">{{ t('dataset.list.pageDesc') }}</div>
      </div>
    </div>

    <div class="stat-strip">
      <div class="stat-item">
        <div class="stat-item__icon"><el-icon><FolderOpened /></el-icon></div>
        <div>
          <div class="stat-item__value">{{ total }}</div>
          <div class="stat-item__label">{{ t('dataset.list.stats.total') }}</div>
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-item__icon"><el-icon><DataAnalysis /></el-icon></div>
        <div>
          <div class="stat-item__value">{{ totalRows.toLocaleString(locale) }}</div>
          <div class="stat-item__label">{{ t('dataset.list.stats.totalRows') }}</div>
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-item__icon"><el-icon><Files /></el-icon></div>
        <div>
          <div class="stat-item__value">{{ totalCols }}</div>
          <div class="stat-item__label">{{ t('dataset.list.stats.totalCols') }}</div>
        </div>
      </div>
    </div>

    <div class="page-card">
      <div class="page-card__header">
        <div class="page-card__header-title">{{ t('dataset.list.listTitle') }}</div>
        <div class="page-card__header-right">
          <el-input
            v-model="search"
            :placeholder="t('dataset.list.searchPlaceholder')"
            clearable
            style="width: 240px"
            :prefix-icon="Search"
          />
          <el-tag type="info" effect="plain">{{ t('dataset.list.totalCount', { count: total }) }}</el-tag>
        </div>
      </div>

      <el-table :data="filtered" v-loading="loading" :empty-text="t('dataset.list.emptyHint')">
        <el-table-column prop="name" :label="t('dataset.list.name')" min-width="180">
          <template #default="{ row }">
            <div class="cell-name">
              <div class="cell-name__icon"><DbIcon v-if="row.source_type === 'sql'" :type="row.db_type" :size="16" /><el-icon v-else-if="row.source_type === 'form'" :size="16"><Tickets /></el-icon><el-icon v-else :size="16"><Files /></el-icon></div>
              <el-link type="primary" @click="$router.push(`/datasets/${row.id}`)">{{ row.name }}</el-link>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="row_count" :label="t('dataset.list.rowCount')" width="130" align="center">
          <template #default="{ row }">
            <span v-if="countingIds.has(row.id)" class="cell-muted">…</span>
            <span v-else class="cell-num">{{ (row.row_count || 0).toLocaleString(locale) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="column_count" :label="t('dataset.list.colCols')" width="90" align="center" />
        <el-table-column prop="original_file" :label="t('dataset.list.colSourceFile')" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="cell-muted">{{ row.original_file || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" :label="t('dataset.list.colCreatedAt')" width="180">
          <template #default="{ row }">
            <span class="cell-muted">{{ formatDateTime(row.created_at, appStore.timezone) }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('dataset.list.actions')" width="260" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary"  @click="$router.push(`/datasets/${row.id}`)">{{ t('dataset.list.view') }}</el-button>
            <el-button v-if="row.source_type === 'sql' && row.datasource_id" link type="primary"  @click="openEditBuild(row)">{{ t('dataset.list.editBuild') }}</el-button>
            <el-tooltip v-else-if="row.source_type === 'excel' || row.source_type === 'form'" :content="editBuildDisabledTip(row)" placement="top">
              <span class="edit-build-tip"><el-button link type="primary" disabled>{{ t('dataset.list.editBuild') }}</el-button></span>
            </el-tooltip>
            <el-button link type="primary"  @click="openRename(row)">{{ t('dataset.list.rename') }}</el-button>
            <el-button link type="danger"  @click="remove(row)">{{ t('common.actions.delete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="page-card__footer">
        <el-pagination
          layout="total, sizes, prev, pager, next"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          :page-sizes="[10, 20, 50]"
          background
          @size-change="onSizeChange"
          @current-change="onPageChange"
        />
      </div>
    </div>

    <el-dialog v-model="renameVisible" :title="t('dataset.list.renameTitle')" width="440px">
      <el-input v-model="renameName" :placeholder="t('dataset.list.renamePlaceholder')" maxlength="100" @keyup.enter="confirmRename" />
      <template #footer>
        <el-button @click="renameVisible = false">{{ t('common.actions.cancel') }}</el-button>
        <el-button type="primary" :loading="renaming" @click="confirmRename">{{ t('common.actions.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { datasetApi } from '@/api'
import { useAppStore } from '@/stores/app'
import { formatDateTime } from '@/utils/datetime'
import { t } from '@/i18n'
import DbIcon from '@/components/DbIcon.vue'

const { locale } = useI18n()
const router = useRouter()
const appStore = useAppStore()

const datasets = ref([])
const loading = ref(false)
const search = ref('')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const renameVisible = ref(false)
const renameName = ref('')
const renaming = ref(false)
const countingIds = ref(new Set())
let renamingId = null

const filtered = computed(() => {
  const kw = search.value.trim().toLowerCase()
  if (!kw) return datasets.value
  return datasets.value.filter((d) => d.name.toLowerCase().includes(kw))
})

const totalRows = computed(() => datasets.value.reduce((s, d) => s + (d.row_count || 0), 0))
const totalCols = computed(() => datasets.value.reduce((s, d) => s + (d.column_count || 0), 0))

async function load() {
  loading.value = true
  try {
    const res = await datasetApi.listPaged(page.value, pageSize.value)
    datasets.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
    enrichRowCounts()
  }
}

async function enrichRowCounts() {
  const pending = datasets.value.filter((d) => !d.row_count && d.datasource_id).map((d) => d.id)
  if (!pending.length) return
  countingIds.value = new Set(pending)
  try {
    const res = await datasetApi.rowCounts(pending)
    const counts = res && res.counts ? res.counts : {}
    datasets.value = datasets.value.map((d) => (counts[d.id] != null ? { ...d, row_count: counts[d.id] } : d))
  } catch {
    // datasource unavailable — keep 0
  } finally {
    countingIds.value = new Set()
  }
}

function onPageChange(p) {
  page.value = p
  load()
}

function onSizeChange(size) {
  pageSize.value = size
  page.value = 1
  load()
}

function openRename(row) {
  renamingId = row.id
  renameName.value = row.name
  renameVisible.value = true
}

async function confirmRename() {
  if (!renameName.value.trim()) return ElMessage.warning(t('dataset.list.renameRequired'))
  renaming.value = true
  try {
    await datasetApi.rename(renamingId, renameName.value.trim())
    ElMessage.success(t('dataset.list.renameSuccess'))
    renameVisible.value = false
    load()
  } finally {
    renaming.value = false
  }
}

async function openEditBuild(row) {
  await ElMessageBox.confirm(
    t('dataset.list.editBuildConfirm', { name: row.name }),
    t('dataset.list.editBuild'),
    { type: 'info' }
  )
  router.push({ path: `/datasources/${row.datasource_id}/builder`, query: { editDatasetId: row.id } })
}

function editBuildDisabledTip(row) {
  if (row.source_type === 'form') return t('dataset.list.editBuildTipForm')
  return t('dataset.list.editBuildTipFile')
}

async function remove(row) {
  await ElMessageBox.confirm(
    t('dataset.list.deleteConfirm', { name: row.name }),
    t('dataset.list.deleteConfirmTitle'),
    {
      type: 'warning',
      confirmButtonText: t('common.actions.delete'),
      cancelButtonText: t('common.actions.cancel'),
    }
  )
  await datasetApi.remove(row.id)
  ElMessage.success(t('dataset.list.deleteSuccess'))
  load()
}

onMounted(load)
</script>

<style scoped>
.cell-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cell-name__icon {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: var(--app-primary-light);
  color: var(--app-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cell-num {
  font-weight: 600;
  color: var(--app-text-primary);
}

.cell-muted {
  color: var(--app-text-secondary);
  font-size: 14px;
}

.edit-build-tip {
  display: inline-flex;
  vertical-align: middle;
  margin: 0 12px;
}
.edit-build-tip .el-button {
  margin-left: 0;
}
</style>
