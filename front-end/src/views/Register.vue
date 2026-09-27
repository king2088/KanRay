<template>
  <div class="auth-page">
    <el-card class="auth-card">
      <h2 class="auth-title">{{ t('auth.register.title') }}</h2>
      <el-form :model="form" label-position="top" @submit.prevent="onSubmit">
        <el-form-item :label="t('auth.register.email')"><el-input v-model="form.email" placeholder="you@example.com" /></el-form-item>
        <el-form-item :label="t('auth.register.nickname')"><el-input v-model="form.name" :placeholder="t('auth.register.nicknamePlaceholder')" /></el-form-item>
        <el-form-item :label="t('auth.register.password')"><el-input v-model="form.password" type="password" show-password /></el-form-item>
        <el-form-item :label="t('auth.register.confirmPassword')"><el-input v-model="form.confirm" type="password" show-password @keyup.enter="onSubmit" /></el-form-item>
        <el-button type="primary" class="auth-btn" :loading="loading" @click="onSubmit">{{ t('auth.register.submit') }}</el-button>
        <LocaleSelect />
        <div class="auth-switch">{{ t('auth.register.hasAccount') }}<el-link type="primary" @click="$router.push('/login')">{{ t('auth.register.toLogin') }}</el-link></div>
      </el-form>
    </el-card>
  </div>
</template>
<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import LocaleSelect from '@/components/auth/LocaleSelect.vue'
import { t } from '@/i18n'
const auth = useAuthStore()
const router = useRouter()
const form = reactive({ email: '', name: '', password: '', confirm: '' })
const loading = ref(false)
async function onSubmit() {
  if (!form.email || !form.name || !form.password) return ElMessage.warning(t('auth.register.requiredFields'))
  if (form.password !== form.confirm) return ElMessage.warning(t('auth.register.passwordMismatch'))
  loading.value = true
  try {
    await auth.register({ email: form.email, name: form.name, password: form.password })
    ElMessage.success(t('auth.register.success'))
    router.replace('/login')
  } catch (e) { /* http 已提示 */ }
  finally { loading.value = false }
}
</script>
<style scoped>
.auth-page { min-height: 100vh; display: grid; place-items: center; background: linear-gradient(rgba(47, 72, 94, 0.26), rgba(47, 72, 94, 0.30)), url('/r-bg.jpg') center / cover no-repeat; }
.auth-card { width: 450px; background: var(--app-surface); border: 1px solid var(--app-border-light); border-radius: 12px; box-shadow: var(--app-shadow-card); }
.auth-title { text-align: center; margin: 0 0 18px; color: var(--app-text-primary); }
.auth-btn { width: 100%; margin-top: 4px; }
.auth-switch { text-align: center; margin-top: 14px; font-size: 14px; color: var(--app-text-secondary); }
</style>