<template>
  <el-menu
    :default-active="activeMenu"
    :collapse="collapsed"
    :collapse-transition="false"
    router
    class="app-menu"
  >
    <el-menu-item v-for="item in MENU_ITEMS" :key="item.path" :index="item.path">
      <el-icon><component :is="item.icon" /></el-icon>
      <template #title>{{ item.title }}</template>
    </el-menu-item>
    <el-sub-menu v-if="adminMenus.length" index="admin-root">
      <template #title>
        <el-icon><Setting /></el-icon>
        <span>系统管理</span>
      </template>
      <el-menu-item v-for="m in adminMenus" :key="m.path" :index="m.path">
        <el-icon><component :is="m.icon" /></el-icon>
        <template #title>{{ m.title }}</template>
      </el-menu-item>
    </el-sub-menu>
  </el-menu>
</template>

<script setup>
import { computed } from 'vue'
import { MENU_ITEMS, visibleAdminMenus } from '@/router/menu'
import { useAuthStore } from '@/stores/auth'

defineProps({
  collapsed: { type: Boolean, default: false },
  activeMenu: { type: String, required: true },
})

const auth = useAuthStore()
const adminMenus = computed(() => visibleAdminMenus(auth))
</script>

<style scoped>
.app-menu {
  border-right: none !important;
  flex: 1;
  overflow-y: auto;
  padding-top: 6px;
  --el-menu-item-height: 50px;
}

.app-menu:not(.el-menu--collapse) {
  width: 100%;
}

.app-menu :deep(.el-menu-item) {
  border-left: 2px solid transparent;
}

.app-menu :deep(.el-menu-item.is-active) {
  background: var(--app-primary-light);
  border-left-color: var(--app-primary);
}

.app-menu :deep(.el-menu-item:hover:not(.is-active)) {
  background: var(--app-hover);
}
</style>