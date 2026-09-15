<template>
  <el-dropdown trigger="click" @command="onCommand">
    <span class="user-menu">
      <el-avatar class="user-avatar">
        {{ (auth.user?.name || auth.user?.email || 'U').slice(0, 1).toUpperCase() }}
      </el-avatar>
      <span class="user-name">{{ auth.user?.name || auth.user?.email }}</span>
      <span v-if="auth.user?.roles?.length" class="user-roles">
        {{ auth.user.roles.map((r) => r.name).join('、') }}
      </span>
      <el-icon><ArrowDown /></el-icon>
    </span>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="profile">
          <el-icon><User /></el-icon>个人中心
        </el-dropdown-item>
        <el-dropdown-item v-if="auth.hasPermission('user', 'read')" command="admin">
          <el-icon><Setting /></el-icon>系统管理
        </el-dropdown-item>
        <el-dropdown-item divided command="logout">
          <el-icon><SwitchButton /></el-icon>退出登录
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
  <ProfileDialog v-model="profileOpen" />
</template>
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import ProfileDialog from './ProfileDialog.vue'

const auth = useAuthStore()
const router = useRouter()
const profileOpen = ref(false)

function onCommand(c) {
  if (c === 'profile') profileOpen.value = true
  else if (c === 'admin') router.push('/admin/users')
  else if (c === 'logout') {
    auth.logout()
    window.location.href = '/login'
  }
}
</script>
<style scoped>
.user-menu {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: var(--app-text-primary);
}
.user-avatar {
  --el-avatar-size: var(--avatar-size, 30px);
  background: var(--app-primary);
  color: #fff;
}
.user-name {
  font-size: var(--nav-font-size, 15px);
}
.user-roles {
  font-size: calc(var(--nav-font-size, 15px) - 2px);
  color: var(--app-text-regular);
}

.user-menu .el-icon {
  font-size: calc(var(--nav-icon-size, 18px) * 0.75);
}
</style>