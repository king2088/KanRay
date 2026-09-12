<template>
  <nav class="top-menu">
    <router-link
      v-for="item in MENU_ITEMS"
      :key="item.path"
      :to="item.path"
      class="top-nav-item"
      :class="{ 'is-active': activeMenu === item.path }"
    >
      <el-icon :size="15"><component :is="item.icon" /></el-icon>
      <span>{{ item.title }}</span>
    </router-link>
    <template v-if="adminMenus.length">
      <span class="top-nav-label">
        <el-icon :size="15"><Setting /></el-icon>
        系统管理
      </span>
      <router-link
        v-for="m in adminMenus"
        :key="m.path"
        :to="m.path"
        class="top-nav-item"
        :class="{ 'is-active': activeMenu === m.path }"
      >
        <span>{{ m.title }}</span>
      </router-link>
    </template>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { MENU_ITEMS, visibleAdminMenus } from '@/router/menu'
import { useAuthStore } from '@/stores/auth'

defineProps({ activeMenu: { type: String, required: true } })

const auth = useAuthStore()
const adminMenus = computed(() => visibleAdminMenus(auth))
</script>

<style scoped>
.top-menu {
  display: flex;
  align-items: center;
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.top-nav-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 100%;
  padding: 0 14px;
  font-size: 14px;
  color: var(--app-text-regular);
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  cursor: pointer;
  text-decoration: none;
  transition: color 0.15s, background 0.15s;
  flex-shrink: 0;
}

.top-nav-item:hover {
  color: var(--app-primary);
  background: var(--app-hover);
}

.top-nav-item.is-active {
  color: var(--app-primary);
  font-weight: 600;
  border-bottom-color: var(--app-primary);
}

.top-nav-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 100%;
  padding: 0 14px;
  font-size: 13px;
  color: var(--app-text-regular);
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  user-select: none;
}
</style>