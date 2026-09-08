<template>
  <el-menu :default-active="activeMenu" mode="horizontal" router class="top-menu">
    <el-menu-item v-for="item in MENU_ITEMS" :key="item.path" :index="item.path">
      <el-icon><component :is="item.icon" /></el-icon>
      <span>{{ item.title }}</span>
    </el-menu-item>
  </el-menu>
</template>

<script setup>
import { MENU_ITEMS } from '@/router/menu'

defineProps({ activeMenu: { type: String, required: true } })
</script>

<style scoped>
.top-menu {
  border-bottom: none !important;
  height: 100%;
}

.top-menu :deep(.el-menu-item) {
  height: var(--app-header-height);
  border-bottom: 2px solid transparent;
}

.top-menu :deep(.el-menu-item.is-active) {
  font-weight: 500;
}
</style>