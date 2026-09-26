<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__main">
        <h2 class="page-title">{{ t('openapi.token.title') }}</h2>
        <div class="page-desc">{{ t('openapi.token.pageDesc', { path: '/api/open/v1' }) }}</div>
      </div>
    </div>

    <div class="page-card">
      <div class="page-card__header">
        <div class="page-card__header-title">{{ t('openapi.token.listTitle') }}</div>
        <div class="page-card__header-right">
          <el-button type="primary" @click="createVisible = true">
            <el-icon style="margin-right: 4px"><Plus /></el-icon>{{ t('openapi.token.create') }}
          </el-button>
        </div>
      </div>

      <el-table :data="rows" stripe v-loading="loading">
        <el-table-column type="index" :label="t('openapi.token.index')" width="60" align="center" />
        <el-table-column prop="name" :label="t('openapi.token.name')" min-width="160" />
        <el-table-column :label="t('openapi.token.prefix')" width="150">
          <template #default="{ row }"><code class="mono">{{ row.keyPrefix }}...</code></template>
        </el-table-column>
        <el-table-column :label="t('openapi.token.status')" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">
              {{ row.status === 'active' ? t('openapi.token.enabled') : t('openapi.token.disabled') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('openapi.token.createdAt')" width="180">
          <template #default="{ row }">{{ formatDateTime(row.createdAt, appStore.timezone) }}</template>
        </el-table-column>
        <el-table-column :label="t('openapi.token.expiresAt')" width="180">
          <template #default="{ row }">{{ row.expiresAt ? formatDateTime(row.expiresAt, appStore.timezone) : '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('openapi.token.lastUsedAt')" width="180">
          <template #default="{ row }">{{ row.lastUsedAt ? formatDateTime(row.lastUsedAt, appStore.timezone) : '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('openapi.token.actions')" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="onRotate(row)">{{ t('openapi.token.rotate') }}</el-button>
            <el-button link :type="row.status === 'active' ? 'warning' : 'success'" @click="onToggle(row)">
              {{ row.status === 'active' ? t('openapi.token.disable') : t('openapi.token.enable') }}
            </el-button>
            <el-button link type="danger" @click="onDelete(row)">{{ t('openapi.token.delete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="createVisible" :title="t('openapi.token.createDialog')" width="460px" @closed="resetForm">
      <el-form :model="form" label-width="96px" @submit.prevent>
        <el-form-item :label="t('openapi.token.nameLabel')" required>
          <el-input v-model="form.name" maxlength="100" :placeholder="t('openapi.token.namePlaceholder')" @keyup.enter="onCreate" />
        </el-form-item>
        <el-form-item :label="t('openapi.token.expiresLabel')">
          <el-date-picker v-model="form.expiresAt" type="datetime" :placeholder="t('openapi.token.expiresPlaceholder')" value-format="YYYY-MM-DDTHH:mm:ss" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">{{ t('common.actions.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="onCreate">{{ t('common.actions.create') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="secretVisible" :title="t('openapi.token.secretDialog')" width="560px" :close-on-click-modal="false">
      <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 12px">
        {{ t('openapi.token.secretWarning') }}
      </el-alert>
      <el-input v-model="secretText" readonly>
        <template #append><el-button @click="copySecret">{{ t('openapi.token.copy') }}</el-button></template>
      </el-input>
    </el-dialog>
  </div>
</template>
<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { tokenApi } from '@/api/open'
import { formatDateTime } from '@/utils/datetime'
import { useAppStore } from '@/stores/app'

const { t } = useI18n()
const appStore = useAppStore()
const rows = ref([])
const loading = ref(false)
const createVisible = ref(false)
const saving = ref(false)
const form = ref({ name: '', expiresAt: null })
const secretVisible = ref(false)
const secretText = ref('')

function resetForm() {
  form.value = { name: '', expiresAt: null }
}

function copySecret() {
  navigator.clipboard?.writeText(secretText.value)
  ElMessage.success(t('openapi.token.copied'))
}
async function onCreate() {
  if (!form.value.name.trim()) return ElMessage.warning(t('openapi.token.nameRequired'))
  saving.value = true
  try {
    const r = await tokenApi.create({ name: form.value.name, expiresAt: form.value.expiresAt || null })
    createVisible.value = false
    secretText.value = r.plaintext
    secretVisible.value = true
    ElMessage.success(t('openapi.token.createSuccess'))
    await load()
  } finally {
    saving.value = false
  }
}
async function onRotate(row) {
  await ElMessageBox.confirm(
      t('openapi.token.rotateConfirm', { name: row.name }),
      t('openapi.token.rotateConfirmTitle'),
      { type: 'warning' },
    )
  const r = await tokenApi.rotate(row.id)
  secretText.value = r.plaintext
  secretVisible.value = true
  ElMessage.success(t('openapi.token.rotateSuccess'))
  await load()
}
async function onToggle(row) {
  const next = row.status === 'active' ? false : true
  await tokenApi.update(row.id, { isActive: next })
  ElMessage.success(next ? t('openapi.token.toggledEnabled') : t('openapi.token.toggledDisabled'))
  await load()
}
async function onDelete(row) {
  await ElMessageBox.confirm(
      t('openapi.token.deleteConfirm', { name: row.name }),
      t('openapi.token.deleteConfirmTitle'),
      { type: 'danger' },
    )
  await tokenApi.remove(row.id)
  ElMessage.success(t('openapi.token.deleteSuccess'))
  await load()
}
async function load() {
  loading.value = true
  try {
    const r = await tokenApi.list()
    rows.value = r.list
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>