<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__main">
        <h2 class="page-title">{{ t('dashboard.list.title') }}</h2>
        <div class="page-desc">{{ t('dashboard.list.desc') }}</div>
      </div>
      <div class="page-header__actions">
        <el-button type="primary" @click="create">
          <el-icon style="margin-right: 4px"><Plus /></el-icon>{{ t('dashboard.list.create') }}
        </el-button>
      </div>
    </div>

    <div class="page-card">
      <div class="page-card__header">
        <div class="page-card__header-title">{{ t('dashboard.list.listTitle') }}</div>
        <div class="page-card__header-right">
          <el-input
            v-model="search"
            :placeholder="t('dashboard.list.searchPlaceholder')"
            clearable
            style="width: 240px"
            :prefix-icon="Search"
          />
          <el-tag type="info" effect="plain">{{ t('dashboard.list.totalTag', { n: total }) }}</el-tag>
        </div>
      </div>

      <el-table :data="filtered" v-loading="loading" :empty-text="t('dashboard.list.empty')">
        <el-table-column prop="name" :label="t('dashboard.list.colName')" min-width="220">
          <template #default="{ row }">
            <div class="cell-name">
              <div class="cell-name__icon"><el-icon><Odometer /></el-icon></div>
              <el-link type="primary" @click="$router.push(`/dashboards/${row.id}`)">{{ row.name }}</el-link>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="t('dashboard.list.colItemCount')" width="120" align="center">
          <template #default="{ row }">
            <el-tag  effect="plain">{{ row.layout.length }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" :label="t('dashboard.list.colUpdatedAt')" width="190">
          <template #default="{ row }">
            <span class="cell-muted">{{ formatDateTime(row.updatedAt, appStore.timezone) }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('dashboard.list.colActions')" width="270" fixed="right" align="center">
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              @click="$router.push(`/dashboards/${row.id}`)"
            >{{ t('dashboard.list.view') }}</el-button>
            <el-button
              link
              type="primary"
              @click="$router.push(`/dashboards/${row.id}/edit`)"
            >{{ t('dashboard.list.edit') }}</el-button>
            <el-button v-if="canShare" link type="primary" @click="openShare(row)">
              <el-icon style="margin-right: 2px"><Share /></el-icon>{{ t('dashboard.list.share') }}
            </el-button>
            <el-button link type="danger"  @click="remove(row)">{{ t('dashboard.list.remove') }}</el-button>
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

    <ShareDialog
      v-model="shareDialog.open"
      :dashboard-id="shareDialog.dashboardId"
      :name="shareDialog.name"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { t } from '@/i18n'
import { Plus, Search, Share } from '@element-plus/icons-vue'
import { dashboardApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { formatDateTime } from '@/utils/datetime'
import ShareDialog from '@/components/dashboard/ShareDialog.vue'

const router = useRouter()
const auth = useAuthStore()
const appStore = useAppStore()
const canShare = computed(() => auth.hasPermission('dashboard', 'share'))
const shareDialog = ref({ open: false, dashboardId: 0, name: '' })
function openShare(row) {
  shareDialog.value = { open: true, dashboardId: row.id, name: row.name }
}
const dashboards = ref([])
const loading = ref(false)
const search = ref('')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

const filtered = computed(() => {
  const kw = search.value.trim().toLowerCase()
  if (!kw) return dashboards.value
  return dashboards.value.filter((d) => d.name.toLowerCase().includes(kw))
})

async function load() {
  loading.value = true
  try {
    const res = await dashboardApi.listPaged(page.value, pageSize.value)
    dashboards.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
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

async function create() {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  const d = await dashboardApi.create(t('dashboard.list.defaultName', { suffix }))
  ElMessage.success(t('dashboard.list.created'))
  router.push(`/dashboards/${d.id}/edit`)
}

async function remove(row) {
  await ElMessageBox.confirm(t('dashboard.list.deleteConfirm', { name: row.name }), t('dashboard.list.deleteConfirmTitle'), {
    type: 'warning',
    confirmButtonText: t('common.actions.delete'),
    cancelButtonText: t('common.actions.cancel'),
  })
  await dashboardApi.remove(row.id)
  ElMessage.success(t('dashboard.list.deleteSuccess'))
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
  border-radius: var(--app-radius);
  background: var(--app-primary-light);
  color: var(--app-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cell-muted {
  color: var(--app-text-secondary);
  font-size: 14px;
}
</style>