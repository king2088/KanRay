<template>
  <div class="auth-page">
    <el-card class="auth-card">
      <h2 class="auth-title">看板低代码平台</h2>
      <el-form :model="form" label-position="top" @submit.prevent="onSubmit">
        <el-form-item label="邮箱"><el-input v-model="form.email" placeholder="you@example.com" /></el-form-item>
        <el-form-item label="密码"><el-input v-model="form.password" type="password" show-password @keyup.enter="onSubmit" /></el-form-item>
        <el-button type="primary" class="auth-btn" :loading="loading" @click="onSubmit">登 录</el-button>
        <div class="auth-switch">没有账号？<el-link type="primary" @click="$router.push('/register')">去注册</el-link></div>
      </el-form>
    </el-card>
  </div>
</template>
<script setup>
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const form = reactive({ email: '', password: '' })
const loading = ref(false)
async function onSubmit() {
  if (!form.email || !form.password) return ElMessage.warning('请输入邮箱和密码')
  loading.value = true
  try {
    await auth.login(form.email, form.password)
    await auth.me()
    router.replace(route.query.redirect || '/')
  } catch (e) { /* http 已提示 */ }
  finally { loading.value = false }
}
</script>
<style scoped>
.auth-page { min-height: 100vh; display: grid; place-items: center; background: linear-gradient(135deg,#409EFF22,#fff); }
.auth-card { width: 380px; }
.auth-title { text-align: center; margin: 0 0 18px; color: #303133; }
.auth-btn { width: 100%; margin-top: 4px; }
.auth-switch { text-align: center; margin-top: 14px; font-size: 13px; color: #909399; }
</style>