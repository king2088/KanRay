<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__main">
        <h2 class="page-title">{{ t('form.submissions.title') }}</h2>
        <div class="page-desc">{{ formName }}</div>
      </div>
      <div class="page-header__actions">
        <el-switch v-model="mine" inline-prompt :active-text="t('form.submissions.mineOnly')" :inactive-text="t('form.submissions.all')" @change="load" />
        <el-button @click="$router.push(`/forms/${id}/design`)">{{ t('form.submissions.backToDesign') }}</el-button>
        <el-button type="primary" @click="$router.push(`/forms/${id}/fill`)">
          <el-icon style="margin-right: 4px"><EditPen /></el-icon>{{ t('form.submissions.goFill') }}
        </el-button>
      </div>
    </div>

    <div class="page-card">
      <div class="page-card__header">
        <div class="page-card__header-title">{{ t('form.submissions.totalCount', { count: total }) }}</div>
        <div class="page-card__header-right">
          <el-tag v-if="form?.tableName" effect="plain" type="info">{{ t('form.submissions.dataTable', { table: form.tableName }) }}</el-tag>
        </div>
      </div>

      <div v-loading="loading">
        <div v-if="columns.length" class="subs-table">
          <el-table :data="rows" border size="small" max-height="560">
            <el-table-column prop="id" label="No." width="70" align="center" />
            <el-table-column v-for="col in columns" :key="col.key" :prop="col.key" :label="col.label" min-width="140" show-overflow-tooltip>
              <template #default="{ row }">
                <span v-if="col.type === 'number'">{{ row[col.key] }}</span>
                <span v-else>{{ fmt(row[col.key]) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="submittedBy" :label="t('form.submissions.submitter')" width="120" show-overflow-tooltip>
              <template #default="{ row }">
                <span>{{ row.submittedBy ? row.submitterName || t('form.submissions.userRef', { id: row.submittedBy }) : t('form.submissions.anonymous') }}</span>
              </template>
            </el-table-column>
            <el-table-column :label="t('form.submissions.submittedAt')" width="170" sortable :sort-method="sortTime">
              <template #default="{ row }">
                <span class="cell-muted">{{ formatDateTime(row.submittedAt, appStore.timezone) }}</span>
              </template>
            </el-table-column>
            <el-table-column :label="t('form.submissions.actions')" width="150" align="center" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="edit(row)">{{ t('form.submissions.edit') }}</el-button>
                <el-button link type="danger" @click="remove(row)">{{ t('form.submissions.delete') }}</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <el-empty v-else-if="!loading" :description="t('form.submissions.empty')" />
      </div>

      <div v-if="total > pageSize" class="page-card__footer">
        <el-pagination
          layout="total, prev, pager, next"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          background
          @current-change="onPageChange"
        />
      </div>
    </div>

    <el-dialog v-model="editOpen" :title="t('form.submissions.editTitle', { id: editing?.id ?? '' })" width="620px">
      <FormRenderer v-if="editing" :ref="setEditRenderer" :fields="form.schema.fields" :initial-model="editValues" :description="form.description" />
      <template #footer>
        <el-button @click="editOpen = false">{{ t('common.actions.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="saveEdit">{{ t('common.actions.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { EditPen } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { formApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { formatDateTime } from '@/utils/datetime'
import FormRenderer from '@/components/form/FormRenderer.vue'

const { t } = useI18n()
const route = useRoute()
const auth = useAuthStore()
const appStore = useAppStore()
const id = String(route.params.id)

const form = ref(null)
const formName = ref('')
const rows = ref([])
const columns = ref([])
const total = ref(0)
const loading = ref(false)
const mine = ref(false)
const page = ref(1)
const pageSize = ref(10)

const editOpen = ref(false)
const editing = ref(null)
const editValues = ref({})
const editRenderer = ref(null)
const saving = ref(false)

const canEditAll = computed(() => auth.hasPermission('form', 'submission:update'))

function setEditRenderer(r) {
  if (r) {
    editRenderer.value = r
    editValues.value = r.model
  }
}

function fmt(v) {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}
function sortTime(a, b) {
  return new Date(a.submittedAt).valueOf() - new Date(b.submittedAt).valueOf()
}

async function load() {
  loading.value = true
  try {
    const payload = await formApi.get(id)
    form.value = payload
    formName.value = payload.name
    columns.value = (payload.schema?.fields || []).filter((f) => f.type !== 'static')
    const res = await formApi.submissions(id, mine.value, { page: page.value, pageSize: pageSize.value })
    rows.value = res.rows
    total.value = res.total
    if (!rows.value.length && page.value > 1) {
      page.value -= 1
      return load()
    }
  } finally {
    loading.value = false
  }
}

function onPageChange(v) {
  page.value = v
  load()
}

function edit(row) {
  if (!canEditAll.value && row.submittedBy !== auth.user?.id) {
    return ElMessage.warning(t('form.submissions.onlyOwnEdit'))
  }
  editing.value = row
  editValues.value = { ...row }
  editOpen.value = true
}

async function saveEdit() {
  const ok = await editRenderer.value.validate().catch(() => false)
  if (!ok) return ElMessage.warning(t('form.fill.requiredMissing'))
  saving.value = true
  try {
    const values = {}
    for (const f of form.value.schema.fields) {
      if (f.type === 'static') continue
      const v = editValues.value[f.key]
      if (v !== undefined && v !== null && v !== '') values[f.key] = v
    }
    await formApi.updateSubmission(id, editing.value.id, { values })
    editOpen.value = false
    ElMessage.success(t('form.submissions.saved'))
    load()
  } finally {
    saving.value = false
  }
}

async function remove(row) {
  if (!canEditAll.value && row.submittedBy !== auth.user?.id) {
    return ElMessage.warning(t('form.submissions.onlyOwnDelete'))
  }
  try {
    await ElMessageBox.confirm(
      t('form.submissions.deleteConfirm', { id: row.id }),
      t('form.submissions.deleteConfirmTitle'),
      { type: 'warning' },
    )
  } catch (e) {
    return
  }
  await formApi.removeSubmission(id, row.id)
  ElMessage.success(t('form.submissions.deleteSuccess'))
  load()
}

onMounted(load)
watch(mine, () => { page.value = 1; load() })
</script>

<style scoped>
.subs-table {
  min-height: 120px;
}
.cell-muted {
  color: var(--el-text-color-secondary);
}
</style>