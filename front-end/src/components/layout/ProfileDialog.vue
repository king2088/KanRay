<template>
  <el-dialog v-model="show" :title="t('layout.profile.title')" width="420px" append-to-body>
    <el-tabs>
      <el-tab-pane :label="t('layout.profile.basicInfo')">
        <el-form label-position="top">
          <el-form-item :label="t('layout.profile.email')">
            <el-input :model-value="auth.user?.email" disabled />
          </el-form-item>
          <el-form-item :label="t('layout.profile.nickname')">
            <el-input v-model="name" maxlength="50" />
          </el-form-item>
          <el-button type="primary" :loading="saving" @click="saveProfile">{{ t('common.actions.save') }}</el-button>
        </el-form>
      </el-tab-pane>
      <el-tab-pane :label="t('layout.profile.changePassword')">
        <el-form label-position="top">
          <el-form-item :label="t('layout.profile.oldPassword')">
            <el-input v-model="pw.oldPassword" type="password" show-password />
          </el-form-item>
          <el-form-item :label="t('layout.profile.newPassword')">
            <el-input v-model="pw.newPassword" type="password" show-password :placeholder="t('layout.profile.newPasswordHint')" />
          </el-form-item>
          <el-form-item :label="t('layout.profile.confirmPassword')">
            <el-input v-model="pw.confirm" type="password" show-password @keyup.enter="savePassword" />
          </el-form-item>
          <el-button type="primary" :loading="savingPw" @click="savePassword">{{ t('layout.profile.changePassword') }}</el-button>
        </el-form>
      </el-tab-pane>
    </el-tabs>
  </el-dialog>
</template>
<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { authApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { t } from '@/i18n'

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue'])
const auth = useAuthStore()

const show = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const name = ref('')
const saving = ref(false)
const savingPw = ref(false)
const pw = reactive({ oldPassword: '', newPassword: '', confirm: '' })

watch(() => props.modelValue, (v) => {
  if (v) {
    name.value = auth.user?.name || ''
    pw.oldPassword = pw.newPassword = pw.confirm = ''
  }
})

async function saveProfile() {
  if (!String(name.value).trim()) return ElMessage.warning(t('layout.profile.nicknameRequired'))
  saving.value = true
  try {
    await authApi.updateProfile({ name: name.value.trim() })
    await auth.me()
    ElMessage.success(t('layout.profile.profileUpdated'))
  } finally {
    saving.value = false
  }
}

async function savePassword() {
  if (!pw.oldPassword || !pw.newPassword) return ElMessage.warning(t('layout.profile.passwordFieldsRequired'))
  if (pw.newPassword !== pw.confirm) return ElMessage.warning(t('layout.profile.passwordMismatch'))
  savingPw.value = true
  try {
    await authApi.changePassword({ oldPassword: pw.oldPassword, newPassword: pw.newPassword })
    ElMessage.success(t('layout.profile.passwordChanged'))
    emit('update:modelValue', false)
    await auth.logout()
    window.location.href = '/login'
  } finally {
    savingPw.value = false
  }
}
</script>