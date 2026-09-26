<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__main">
        <h2 class="page-title">{{ t('form.list.title') }}</h2>
        <div class="page-desc">{{ t('form.list.pageDesc') }}</div>
      </div>
      <div class="page-header__actions">
        <el-button type="primary" @click="create">
          <el-icon style="margin-right: 4px"><Plus /></el-icon>{{ t('form.list.create') }}
        </el-button>
      </div>
    </div>

    <div class="page-card">
      <div class="page-card__header">
        <div class="page-card__header-title">{{ t('form.list.listTitle') }}</div>
        <div class="page-card__header-right">
          <el-input
            v-model="search"
            :placeholder="t('form.list.searchPlaceholder')"
            clearable
            style="width: 240px"
            :prefix-icon="Search"
          />
          <el-tag type="info" effect="plain">{{ t('form.list.totalCount', { count: total }) }}</el-tag>
        </div>
      </div>

      <el-table :data="filtered" v-loading="loading" :empty-text="t('form.list.empty')">
        <el-table-column prop="name" :label="t('form.list.name')" min-width="200">
          <template #default="{ row }">
            <div class="cell-name">
              <div class="cell-name__icon"><el-icon><Tickets /></el-icon></div>
              <el-link type="primary" @click="$router.push(`/forms/${row.id}/design`)">{{ row.name }}</el-link>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="description" :label="t('form.list.description')" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="cell-muted">{{ row.description || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" :label="t('form.list.status')" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" effect="plain">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" :label="t('form.list.updatedAt')" width="180">
          <template #default="{ row }">
            <span class="cell-muted">{{ formatDateTime(row.updatedAt, appStore.timezone) }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('form.list.actions')" width="350" fixed="right" align="center">
          <template #default="{ row }">
            <el-button v-if="canShare" link type="primary" @click="openShare(row)">
              <el-icon style="margin-right: 2px"><Share /></el-icon>{{ t('form.list.share') }}
            </el-button>
            <el-button link type="primary" @click="$router.push(`/forms/${row.id}/design`)">{{ t('form.list.design') }}</el-button>
            <el-button link type="primary" @click="$router.push(`/forms/${row.id}/fill`)">{{ t('form.list.fill') }}</el-button>
            <el-button link type="primary" @click="$router.push(`/forms/${row.id}/submissions`)">{{ t('form.list.submissions') }}</el-button>
            <el-button link type="danger" @click="remove(row)">{{ t('form.list.delete') }}</el-button>
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

    <FormShareDialog v-if="shareDialog.open" v-model="shareDialog.open" :form-id="shareDialog.formId" :name="shareDialog.name" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Share, Tickets } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { formApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { formatDateTime } from '@/utils/datetime'
import FormShareDialog from '@/components/form/FormShareDialog.vue'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const appStore = useAppStore()
const canShare = computed(() => auth.hasPermission('form', 'share'))

const forms = ref([])
const loading = ref(false)
const search = ref('')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const shareDialog = ref({ open: false, formId: 0, name: '' })

const filtered = computed(() => {
  const kw = search.value.trim().toLowerCase()
  if (!kw) return forms.value
  return forms.value.filter((d) => d.name.toLowerCase().includes(kw))
})

function statusLabel(s) {
  return {
    draft: t('form.list.draft'),
    published: t('form.list.published'),
    closed: t('form.list.closed'),
  }[s] || s
}
function statusType(s) {
  return { draft: 'info', published: 'success', closed: 'warning' }[s] || 'info'
}

async function load() {
  loading.value = true
  try {
    const res = await formApi.list()
    forms.value = res
    total.value = res.length
  } finally {
    loading.value = false
  }
}

async function create() {
  try {
    const { value } = await ElMessageBox.prompt(t('form.list.createPrompt'), t('form.list.createTitle'), {
      inputValidator: (v) => (v && v.trim() ? true : t('form.list.nameRequired')),
      inputPlaceholder: t('form.list.createPlaceholder'),
    })
    const f = await formApi.create(value)
    ElMessage.success(t('form.list.created'))
    router.push(`/forms/${f.id}/design`)
  } catch (e) {
    if (e === 'cancel' || e?.action === 'cancel') return
  }
}

function openShare(row) {
  shareDialog.value = { open: true, formId: row.id, name: row.name }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(
      t('form.list.deleteConfirm', { name: row.name }),
      t('form.list.deleteConfirmTitle'),
      { type: 'warning' },
    )
  } catch (e) {
    return
  }
  await formApi.remove(row.id)
  ElMessage.success(t('form.list.deleteSuccess'))
  load()
}

function onSizeChange(v) {
  pageSize.value = v
  page.value = 1
  load()
}
function onPageChange(v) {
  page.value = v
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
  color: var(--el-text-color-secondary);
}
</style>