<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__main">
        <h2 class="page-title">数据集</h2>
        <div class="page-desc">管理上传的 Excel / CSV 数据集，作为图表与看板的数据基础</div>
      </div>
      <div class="page-header__actions">
        <el-button type="primary" @click="$router.push('/datasets/new')">
          <el-icon style="margin-right: 6px"><Upload /></el-icon>上传数据
        </el-button>
      </div>
    </div>

    <div class="stat-strip">
      <div class="stat-item">
        <div class="stat-item__icon"><el-icon><FolderOpened /></el-icon></div>
        <div>
          <div class="stat-item__value">{{ total }}</div>
          <div class="stat-item__label">数据集总数</div>
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-item__icon"><el-icon><DataAnalysis /></el-icon></div>
        <div>
          <div class="stat-item__value">{{ totalRows.toLocaleString('zh-CN') }}</div>
          <div class="stat-item__label">累计数据行</div>
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-item__icon"><el-icon><Files /></el-icon></div>
        <div>
          <div class="stat-item__value">{{ totalCols }}</div>
          <div class="stat-item__label">字段总数</div>
        </div>
      </div>
    </div>

    <div class="page-card">
      <div class="page-card__header">
        <div class="page-card__header-title">数据集列表</div>
        <div class="page-card__header-right">
          <el-input
            v-model="search"
            placeholder="搜索数据集名称"
            clearable
            style="width: 240px"
            :prefix-icon="Search"
          />
          <el-tag type="info" effect="plain">共 {{ total }} 条</el-tag>
        </div>
      </div>

      <el-table :data="filtered" v-loading="loading" empty-text="还没有数据集，点击右上角「上传数据」开始">
        <el-table-column prop="name" label="名称" min-width="180">
          <template #default="{ row }">
            <div class="cell-name">
              <div class="cell-name__icon"><DbIcon v-if="row.source_type === 'sql'" :type="row.db_type" :size="16" /><el-icon v-else :size="16"><Files /></el-icon></div>
              <el-link type="primary" @click="$router.push(`/datasets/${row.id}`)">{{ row.name }}</el-link>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="row_count" label="行数" width="130" align="center">
          <template #default="{ row }">
            <span v-if="countingIds.has(row.id)" class="cell-muted">…</span>
            <span v-else class="cell-num">{{ (row.row_count || 0).toLocaleString('zh-CN') }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="column_count" label="列数" width="90" align="center" />
        <el-table-column prop="original_file" label="来源文件" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="cell-muted">{{ row.original_file || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            <span class="cell-muted">{{ formatDateTime(row.created_at, appStore.timezone) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary"  @click="$router.push(`/datasets/${row.id}`)">查看</el-button>
            <el-button v-if="row.source_type === 'sql' && row.datasource_id" link type="primary"  @click="openEditBuild(row)">编辑构建</el-button>
            <el-tooltip v-else-if="row.source_type === 'excel'" content="Excel 数据集不支持构建，请重新上传文件" placement="top">
              <span style="display:inline-flex"><el-button link type="primary" disabled>编辑构建</el-button></span>
            </el-tooltip>
            <el-button link type="primary"  @click="openRename(row)">重命名</el-button>
            <el-button link type="danger"  @click="remove(row)">删除</el-button>
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

    <el-dialog v-model="renameVisible" title="重命名数据集" width="440px">
      <el-input v-model="renameName" placeholder="请输入新的数据集名称" maxlength="100" @keyup.enter="confirmRename" />
      <template #footer>
        <el-button @click="renameVisible = false">取消</el-button>
        <el-button type="primary" :loading="renaming" @click="confirmRename">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { datasetApi } from '@/api'
import { useAppStore } from '@/stores/app'
import { formatDateTime } from '@/utils/datetime'
import DbIcon from '@/components/DbIcon.vue'

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
  if (!renameName.value.trim()) return ElMessage.warning('名称不能为空')
  renaming.value = true
  try {
    await datasetApi.rename(renamingId, renameName.value.trim())
    ElMessage.success('重命名成功')
    renameVisible.value = false
    load()
  } finally {
    renaming.value = false
  }
}

async function openEditBuild(row) {
  await ElMessageBox.confirm(`打开构建器编辑「${row.name}」？`, '编辑构建', { type: 'info' })
  router.push({ path: `/datasources/${row.datasource_id}/builder`, query: { editDatasetId: row.id } })
}

async function remove(row) {
  await ElMessageBox.confirm(`确定删除数据集「${row.name}」？删除后其下图表数据将不可用。`, '删除确认', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  })
  await datasetApi.remove(row.id)
  ElMessage.success('删除成功')
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
</style>