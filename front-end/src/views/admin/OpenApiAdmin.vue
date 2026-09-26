<template>
  <div class="page-container">
    <template v-if="canView">
      <div class="page-header">
        <div class="page-header__main">
          <h2 class="page-title">{{ t('admin.openApi.title') }}</h2>
          <div class="page-desc">{{ t('admin.openApi.pageDesc', { path: '/api/open/v1' }) }}</div>
        </div>
        <div class="page-header__actions">
          <a class="doc-link" href="/api/open/docs" target="_blank" rel="noopener">
            <el-icon style="margin-right: 4px"><Document /></el-icon>{{ t('admin.openApi.docs') }}
          </a>
        </div>
      </div>

      <div class="page-card">
        <div class="page-card__header">
          <div class="page-card__header-title">{{ t('admin.openApi.listTitle') }}</div>
          <div class="page-card__header-right">
            <el-select
              v-model="typeFilter"
              :placeholder="t('admin.openApi.allTypes')"
              clearable
              style="width: 140px; margin-right: 8px"
              @change="load"
            >
              <el-option label="API Key" value="static" />
              <el-option :label="t('admin.openApi.patOption')" value="pat" />
            </el-select>
            <el-button type="primary" @click="openCreate">
              <el-icon style="margin-right: 4px"><Plus /></el-icon>{{ t('admin.openApi.create') }}
            </el-button>
          </div>
        </div>

        <el-table :data="rows" stripe v-loading="loading">
          <el-table-column type="index" :label="t('admin.openApi.index')" width="60" align="center" />
          <el-table-column prop="name" :label="t('admin.openApi.name')" min-width="140" />
          <el-table-column :label="t('admin.openApi.type')" width="120">
            <template #default="{ row }">
              <el-tag :type="row.type === 'pat' ? 'warning' : 'primary'" size="small" effect="plain">
                {{ t(row.type === 'pat' ? 'admin.openApi.typeLabels.pat' : 'admin.openApi.typeLabels.apiKey') }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="t('admin.openApi.prefix')" width="150">
            <template #default="{ row }">
              <code class="mono">{{ row.keyPrefix }}...</code>
            </template>
          </el-table-column>
          <el-table-column :label="t('admin.openApi.owner')" width="120">
            <template #default="{ row }">{{ usersName(row.userId) }}</template>
          </el-table-column>
          <el-table-column label="Scopes" min-width="180">
            <template #default="{ row }">
              <el-tag v-for="s in scopesOf(row)" :key="s" size="small" style="margin-right: 4px">{{ scopeLabel(s) }}</el-tag>
              <span v-if="row.type === 'pat'" class="muted">{{ t('admin.openApi.inheritPerms') }}</span>
              <span v-else-if="scopesOf(row).length === 0" class="muted">{{ t('admin.openApi.none') }}</span>
            </template>
          </el-table-column>
          <el-table-column :label="t('admin.openApi.status')" width="90">
            <template #default="{ row }">
              <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">
                {{ row.status === 'active' ? t('admin.openApi.enabled') : t('admin.openApi.disabled') }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="expiresAt" :label="t('admin.openApi.expiresAt')" width="180">
            <template #default="{ row }">{{ row.expiresAt ? formatDateTime(row.expiresAt, appStore.timezone) : '-' }}</template>
          </el-table-column>
          <el-table-column :label="t('admin.openApi.lastUsedAt')" width="180">
            <template #default="{ row }">{{ row.lastUsedAt ? formatDateTime(row.lastUsedAt, appStore.timezone) : '-' }}</template>
          </el-table-column>
          <el-table-column :label="t('admin.openApi.actions')" width="200" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openRotate(row)">{{ t('admin.openApi.rotate') }}</el-button>
              <el-button link :type="row.status === 'active' ? 'warning' : 'success'" @click="toggleActive(row)">
                {{ row.status === 'active' ? t('admin.openApi.disable') : t('admin.openApi.enable') }}
              </el-button>
              <el-button link type="danger" @click="onDelete(row)">{{ t('admin.openApi.delete') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 新建 Key -->
      <el-dialog v-model="createVisible" :title="t('admin.openApi.createDialog')" width="560px" @closed="resetForm">
        <el-form :model="form" label-width="96px">
          <el-form-item :label="t('admin.openApi.nameLabel')" required>
            <el-input v-model="form.name" maxlength="100" :placeholder="t('admin.openApi.namePlaceholder')" />
          </el-form-item>
          <el-form-item :label="t('admin.openApi.typeLabel')" required>
            <el-radio-group v-model="form.type">
              <el-radio value="static">{{ t('admin.openApi.typeStatic') }}</el-radio>
              <el-radio value="pat">{{ t('admin.openApi.typePat') }}</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item :label="t('admin.openApi.ownerLabel')" required>
            <el-select v-model="form.userId" filterable :placeholder="t('admin.openApi.ownerPlaceholder')" style="width: 100%">
              <el-option v-for="u in users" :key="u.id" :label="`${u.name || u.email}（${u.email}）`" :value="u.id" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="form.type === 'static'" label="Scopes">
            <el-checkbox-group v-model="form.scopes">
              <el-checkbox v-for="s in scopeOptions" :key="s.value" :value="s.value">{{ s.label }}</el-checkbox>
            </el-checkbox-group>
          </el-form-item>
          <el-form-item :label="t('admin.openApi.expiresLabel')">
            <el-date-picker v-model="form.expiresAt" type="datetime" :placeholder="t('admin.openApi.expiresPlaceholder')" value-format="YYYY-MM-DDTHH:mm:ss" style="width: 100%" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="createVisible = false">{{ t('common.actions.cancel') }}</el-button>
          <el-button type="primary" :loading="saving" @click="onCreate">{{ t('common.actions.create') }}</el-button>
        </template>
      </el-dialog>

      <!-- 一次性明文 -->
      <el-dialog v-model="secretVisible" :title="t('admin.openApi.secretDialog')" width="560px" :close-on-click-modal="false">
        <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 12px">
          {{ t('admin.openApi.secretWarning') }}
        </el-alert>
        <el-input v-model="secretText" readonly>
          <template #append>
            <el-button @click="copySecret">{{ t('admin.openApi.copy') }}</el-button>
          </template>
        </el-input>
      </el-dialog>
    </template>
    <el-empty v-if="!canView" :description="t('admin.openApi.noPermission')" />
  </div>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { adminApi } from '@/api'
import { openApiAdminApi, OPEN_SCOPES } from '@/api/open'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/utils/datetime'
import { useAppStore } from '@/stores/app'
// scope 是技术码（read/write/admin），展示走词典；未收录的码原样回退。
function scopeLabel(scope) {
  const key = `admin.openApi.scopeLabels.${scope}`
  const label = t(key)
  return label === key ? scope : label
}


const { t } = useI18n()
const auth = useAuthStore()
const appStore = useAppStore()
const canView = computed(() => auth.hasPermission('apikey', 'manage'))

const rows = ref([])
const users = ref([])
const typeFilter = ref('')
const loading = ref(false)
const scopeOptions = OPEN_SCOPES.map((s) => ({ value: s, label: s }))

const createVisible = ref(false)
const saving = ref(false)
const form = ref({ name: '', type: 'static', userId: null, scopes: [], expiresAt: null })
function resetForm() {
  form.value = { name: '', type: 'static', userId: null, scopes: [], expiresAt: null }
}

const secretVisible = ref(false)
const secretText = ref('')

const owners = {}
function usersName(id) {
  const u = users.value.find((x) => x.id === id)
  return u ? u.name || u.email : `#${id}`
}
function scopesOf(row) {
  return row.scopes || []
}

function copySecret() {
  navigator.clipboard?.writeText(secretText.value)
  ElMessage.success(t('admin.openApi.copied'))
}
function openCreate() {
  resetForm()
  createVisible.value = true
}
async function onCreate() {
  if (!form.value.name.trim()) return ElMessage.warning(t('admin.openApi.nameRequired'))
  if (!form.value.userId) return ElMessage.warning(t('admin.openApi.ownerRequired'))
  saving.value = true
  try {
    const r = await openApiAdminApi.create({
      name: form.value.name,
      type: form.value.type,
      userId: form.value.userId,
      scopes: form.value.type === 'static' ? form.value.scopes : [],
      expiresAt: form.value.expiresAt || null,
    })
    createVisible.value = false
    secretText.value = r.plaintext
    secretVisible.value = true
    ElMessage.success(t('admin.openApi.createSuccess'))
    await load()
  } finally {
    saving.value = false
  }
}
async function openRotate(row) {
  await ElMessageBox.confirm(
      t('admin.openApi.rotateConfirm', { name: row.name }),
      t('admin.openApi.rotateConfirmTitle'),
      { type: 'warning' },
    )
  const r = await openApiAdminApi.rotate(row.id)
  secretText.value = r.plaintext
  secretVisible.value = true
  ElMessage.success(t('admin.openApi.rotateSuccess'))
  await load()
}
async function toggleActive(row) {
  const next = row.status === 'active' ? false : true
  await openApiAdminApi.update(row.id, { isActive: next })
  ElMessage.success(next ? t('admin.openApi.toggledEnabled') : t('admin.openApi.toggledDisabled'))
  await load()
}
async function onDelete(row) {
  await ElMessageBox.confirm(
      t('admin.openApi.deleteConfirm', { name: row.name }),
      t('admin.openApi.deleteConfirmTitle'),
      { type: 'danger' },
    )
  await openApiAdminApi.remove(row.id)
  ElMessage.success(t('admin.openApi.deleteSuccess'))
  await load()
}
async function load() {
  loading.value = true
  try {
    const r = await openApiAdminApi.list(typeFilter.value ? { type: typeFilter.value } : {})
    rows.value = r.list
  } finally {
    loading.value = false
  }
}
async function loadUsers() {
  try {
    const r = await adminApi.users({ page: 1, pageSize: 500 })
    users.value = r.list || []
  } catch (e) { /* 无权限时不阻塞 */ }
}
onMounted(() => {
  load()
  loadUsers()
})
</script>
<style scoped>
.doc-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--app-primary);
  font-size: 14px;
  text-decoration: none;
}
.doc-link:hover {
  text-decoration: underline;
}
</style>