<template>
  <el-dialog
    :model-value="modelValue"
    :title="t('form.share.title', { name })"
    width="680px"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="share-create">
      <el-switch v-model="requirePassword" inline-prompt :active-text="t('form.share.password')" :inactive-text="t('form.share.public')"
        style="margin-right: 2px" />
      <el-input v-model="password" type="password" show-password :disabled="!requirePassword"
        :placeholder="t('form.share.passwordPlaceholder')" style="width: 180px" />
      <el-date-picker v-model="expiresAt" type="datetime" :placeholder="t('form.share.expiresPlaceholder')"
        value-format="YYYY-MM-DDTHH:mm:ssZ" style="width: 200px" />
      <el-button type="primary" :loading="creating" @click="create">{{ t('form.share.create') }}</el-button>
    </div>

    <div class="share-tip">{{ t('form.share.tip') }}</div>

    <el-table :data="shares" v-loading="loading" :empty-text="t('form.share.empty')">
      <el-table-column :label="t('form.share.access')" width="80" align="center">
        <template #default="{ row }">
          <el-tag size="small" effect="plain" :type="row.hasPassword ? 'warning' : 'success'">
            {{ row.hasPassword ? t('form.share.password') : t('form.share.public') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('form.share.link')" min-width="260">
        <template #default="{ row }">
          <span class="share-link">{{ shareUrl(row) }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('form.share.expiresAt')" width="150">
        <template #default="{ row }">{{ row.expiresAt ? formatDateTime(row.expiresAt, appStore.timezone) : t('form.share.never') }}</template>
      </el-table-column>
      <el-table-column :label="t('form.share.status')" width="70" align="center">
        <template #default="{ row }">
          <el-switch :model-value="!!row.isActive" @change="(v) => toggleActive(row, v)" />
        </template>
      </el-table-column>
      <el-table-column :label="t('form.share.actions')" width="140" align="center">
        <template #default="{ row }">
          <el-button link type="primary" @click="copy(row)">{{ t('form.share.copyLink') }}</el-button>
          <el-button link type="danger" @click="remove(row)">{{ t('form.share.delete') }}</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { formApi } from '@/api'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { formatDateTime } from '@/utils/datetime'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  formId: { type: Number, required: true },
  name: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])
const { t } = useI18n()
const appStore = useAppStore()
const shares = ref([])
const loading = ref(false)
const creating = ref(false)
const requirePassword = ref(true)
const password = ref('')
const expiresAt = ref(null)

function shareUrl(row) {
  return `${window.location.origin}/f/${row.token}`
}

async function load() {
  if (!props.formId) return
  loading.value = true
  try {
    shares.value = (await formApi.shares(props.formId)) || []
  } finally {
    loading.value = false
  }
}

async function create() {
  if (requirePassword.value && (!password.value || password.value.length < 4)) {
    return ElMessage.warning(t('form.share.passwordTooShort'))
  }
  creating.value = true
  try {
    const s = await formApi.createShare(props.formId, {
      password: requirePassword.value ? password.value : null,
      expiresAt: expiresAt.value || null,
    })
    shares.value.unshift(s)
    password.value = ''
    expiresAt.value = null
    requirePassword.value = true
    ElMessage.success(t('form.share.createSuccess'))
  } finally {
    creating.value = false
  }
}

async function toggleActive(row, v) {
  await formApi.updateShare(props.formId, row.id, { isActive: v })
  row.isActive = v ? 1 : 0
  ElMessage.success(v ? t('form.share.enabled') : t('form.share.disabled'))
}

async function remove(row) {
  await formApi.deleteShare(props.formId, row.id)
  shares.value = shares.value.filter((s) => s.id !== row.id)
  ElMessage.success(t('form.share.deleteSuccess'))
}

async function copy(row) {
  try {
    await navigator.clipboard.writeText(shareUrl(row))
    ElMessage.success(t('form.share.copied'))
  } catch (e) {
    ElMessage.warning(t('form.share.copyFailed'))
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open && props.formId) load()
  },
)
</script>

<style scoped>
.share-create {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.share-tip {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-bottom: 10px;
}

.share-link {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}
</style>