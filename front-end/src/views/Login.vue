<template>
  <div class="auth-page">
    <el-card class="auth-card">
      <div class="auth-logo"><img src="/logo.svg?v=3" alt="KanRay logo" /></div>
      <h2 class="auth-title">KanRay</h2>
      <el-form :model="form" label-position="top" @submit.prevent="onSubmit">
        <el-form-item :label="t('auth.login.email')"><el-input v-model="form.email" placeholder="you@example.com" /></el-form-item>
        <el-form-item :label="t('auth.login.password')"><el-input v-model="form.password" type="password" show-password @keyup.enter="onSubmit" /></el-form-item>
        <el-button type="primary" class="auth-btn" :loading="loading" @click="onSubmit">{{ t('auth.login.submit') }}</el-button>
        <div class="auth-switch">{{ t('auth.login.noAccount') }}<el-link type="primary" @click="$router.push('/register')">{{ t('auth.login.toRegister') }}</el-link></div>
      </el-form>
    </el-card>
  </div>
</template>
<script setup>
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { t } from '@/i18n'
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const form = reactive({ email: '', password: '' })
const loading = ref(false)
async function onSubmit() {
  if (!form.email || !form.password) return ElMessage.warning(t('auth.login.emailAndPasswordRequired'))
  loading.value = true
  try {
    await auth.login(form.email, form.password)
    await auth.me()
    router.replace(route.query.redirect || '/datasources')
  } catch (e) { /* http 已提示 */ }
  finally { loading.value = false }
}
</script>
<style scoped>
.auth-page { min-height: 100vh; display: grid; place-items: center; background: linear-gradient(rgba(47, 72, 94, 0.26), rgba(47, 72, 94, 0.30)), url('/bg.jpg') center / cover no-repeat; }
.auth-card { width: 380px; background: var(--app-surface); border: 1px solid var(--app-border-light); border-radius: 12px; box-shadow: var(--app-shadow-card); }
.auth-logo { display: flex; justify-content: center; margin-bottom: 12px; }
.auth-logo img { width: 56px; height: 56px; border-radius: 14px; }
.auth-title { text-align: center; margin: 0 0 18px; color: var(--app-text-primary); }
.auth-btn { width: 100%; margin-top: 4px; }
.auth-switch { text-align: center; margin-top: 14px; font-size: 14px; color: var(--app-text-secondary); }
</style>