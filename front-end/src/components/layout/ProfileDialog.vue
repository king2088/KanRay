<template>
  <el-dialog v-model="show" title="个人中心" width="420px" append-to-body>
    <el-tabs>
      <el-tab-pane label="基本资料">
        <el-form label-position="top">
          <el-form-item label="邮箱">
            <el-input :model-value="auth.user?.email" disabled />
          </el-form-item>
          <el-form-item label="昵称">
            <el-input v-model="name" maxlength="50" />
          </el-form-item>
          <el-button type="primary" :loading="saving" @click="saveProfile">保存</el-button>
        </el-form>
      </el-tab-pane>
      <el-tab-pane label="修改密码">
        <el-form label-position="top">
          <el-form-item label="原密码">
            <el-input v-model="pw.oldPassword" type="password" show-password />
          </el-form-item>
          <el-form-item label="新密码">
            <el-input v-model="pw.newPassword" type="password" show-password placeholder="至少8位，含字母和数字" />
          </el-form-item>
          <el-form-item label="确认新密码">
            <el-input v-model="pw.confirm" type="password" show-password @keyup.enter="savePassword" />
          </el-form-item>
          <el-button type="primary" :loading="savingPw" @click="savePassword">修改密码</el-button>
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
  if (!String(name.value).trim()) return ElMessage.warning('昵称不能为空')
  saving.value = true
  try {
    await authApi.updateProfile({ name: name.value.trim() })
    await auth.me()
    ElMessage.success('资料已更新')
  } finally {
    saving.value = false
  }
}

async function savePassword() {
  if (!pw.oldPassword || !pw.newPassword) return ElMessage.warning('请填写完整')
  if (pw.newPassword !== pw.confirm) return ElMessage.warning('两次密码不一致')
  savingPw.value = true
  try {
    await authApi.changePassword({ oldPassword: pw.oldPassword, newPassword: pw.newPassword })
    ElMessage.success('密码已修改，请重新登录')
    emit('update:modelValue', false)
    await auth.logout()
    window.location.href = '/login'
  } finally {
    savingPw.value = false
  }
}
</script>