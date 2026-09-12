<template>
  <div class="auth-page">
    <el-card class="auth-card">
      <h2 class="auth-title">注册账号</h2>
      <el-form :model="form" label-position="top" @submit.prevent="onSubmit">
        <el-form-item label="邮箱"><el-input v-model="form.email" placeholder="you@example.com" /></el-form-item>
        <el-form-item label="昵称"><el-input v-model="form.name" placeholder="你的昵称" /></el-form-item>
        <el-form-item label="密码"><el-input v-model="form.password" type="password" show-password /></el-form-item>
        <el-form-item label="确认密码"><el-input v-model="form.confirm" type="password" show-password @keyup.enter="onSubmit" /></el-form-item>
        <el-button type="primary" class="auth-btn" :loading="loading" @click="onSubmit">注 册</el-button>
        <div class="auth-switch">已有账号？<el-link type="primary" @click="$router.push('/login')">去登录</el-link></div>
      </el-form>
    </el-card>
  </div>
</template>
<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
const auth = useAuthStore()
const router = useRouter()
const form = reactive({ email: '', name: '', password: '', confirm: '' })
const loading = ref(false)
async function onSubmit() {
  if (!form.email || !form.name || !form.password) return ElMessage.warning('请填写邮箱、昵称和密码')
  if (form.password !== form.confirm) return ElMessage.warning('两次密码不一致')
  loading.value = true
  try {
    await auth.register({ email: form.email, name: form.name, password: form.password })
    ElMessage.success('注册成功，请登录')
    router.replace('/login')
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