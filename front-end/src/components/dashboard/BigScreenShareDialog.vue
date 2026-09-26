<template>
  <el-dialog :model-value="modelValue" :title="t('dashboard.bigScreenShare.title', { name })" width="680px" @update:model-value="$emit('update:modelValue', $event)">
    <div class="share-create">
      <el-switch v-model="requirePassword" inline-prompt :active-text="t('dashboard.share.password')" :inactive-text="t('dashboard.share.public')" style="margin-right: 2px" />
      <el-input v-model="password" type="password" show-password :disabled="!requirePassword" :placeholder="t('dashboard.share.passwordPlaceholder')" style="width: 180px" />
      <el-date-picker v-model="expiresAt" type="datetime" :placeholder="t('dashboard.share.expiresPlaceholder')" value-format="YYYY-MM-DDTHH:mm:ssZ" style="width: 200px" />
      <el-button type="primary" :loading="creating" @click="create">{{ t('dashboard.share.create') }}</el-button>
    </div>

    <el-table :data="shares" v-loading="loading" :empty-text="t('dashboard.share.empty')">
      <el-table-column :label="t('dashboard.share.colAccess')" width="80" align="center">
        <template #default="{ row }">
          <el-tag size="small" effect="plain" :type="row.hasPassword ? 'warning' : 'success'">
            {{ row.hasPassword ? t('dashboard.share.password') : t('dashboard.share.public') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('dashboard.share.colLink')" min-width="260">
        <template #default="{ row }">
          <span class="share-link">{{ shareUrl(row) }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('dashboard.share.colExpires')" width="150">
        <template #default="{ row }">
          <span>{{ row.expiresAt || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('dashboard.share.colStatus')" width="70" align="center">
        <template #default="{ row }">
          <el-switch :model-value="!!row.isActive" @change="(v) => toggleActive(row, v)" />
        </template>
      </el-table-column>
      <el-table-column :label="t('dashboard.share.colActions')" width="140" align="center">
        <template #default="{ row }">
          <el-button link type="primary" @click="copy(row)">{{ t('dashboard.share.copyLink') }}</el-button>
          <el-button link type="danger" @click="remove(row)">{{ t('dashboard.share.remove') }}</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { t } from '@/i18n'
import { ElMessage } from 'element-plus'
import { bigScreenApi } from '@/api'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  screenId: { type: Number, default: null },
  name: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])
const shares = ref([])
const loading = ref(false)
const creating = ref(false)
const requirePassword = ref(true)
const password = ref('')
const expiresAt = ref(null)

function shareUrl(row) {
  return `${window.location.origin}/big-screen/share/${row.token}`
}

async function load() {
  if (!props.screenId) return
  loading.value = true
  try {
    shares.value = (await bigScreenApi.shares(props.screenId)) || []
  } finally {
    loading.value = false
  }
}

async function create() {
  if (requirePassword.value && (!password.value || password.value.length < 4)) {
    return ElMessage.warning(t('dashboard.share.errPasswordShort'))
  }
  creating.value = true
  try {
    const s = await bigScreenApi.createShare(props.screenId, {
      password: requirePassword.value ? password.value : null,
      expiresAt: expiresAt.value || null,
    })
    shares.value.unshift(s)
    password.value = ''
    expiresAt.value = null
    requirePassword.value = true
    ElMessage.success(s.hasPassword ? t('dashboard.share.created') : t('dashboard.share.createdPublic'))
  } finally {
    creating.value = false
  }
}

async function toggleActive(row, v) {
  await bigScreenApi.updateShare(row.id, { isActive: v })
  row.isActive = v ? 1 : 0
  ElMessage.success(v ? t('dashboard.share.enabled') : t('dashboard.share.disabled'))
}

async function remove(row) {
  await bigScreenApi.deleteShare(row.id)
  shares.value = shares.value.filter((s) => s.id !== row.id)
  ElMessage.success(t('dashboard.share.deleted'))
}

async function copy(row) {
  try {
    await navigator.clipboard.writeText(shareUrl(row))
    ElMessage.success(t('dashboard.share.copied'))
  } catch (e) {
    ElMessage.warning(t('dashboard.share.copyFailed'))
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open && props.screenId) load()
  },
)
</script>

<style scoped>
.share-create {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.share-link {
  font-size: 12px;
  color: #606266;
  word-break: break-all;
}
</style>