<template>
  <el-container class="app-layout">
    <el-aside :width="collapsed ? '64px' : sidebarWidth" class="app-aside" :class="{ collapsed }">
      <div class="app-logo" @click="$router.push('/datasets')">
        <el-icon :size="20" class="app-logo__icon"><DataAnalysis /></el-icon>
        <span v-show="!collapsed" class="app-logo__text">看板低代码平台</span>
      </div>

      <el-menu
        :default-active="activeMenu"
        :collapse="collapsed"
        :collapse-transition="false"
        router
        background-color="#ffffff"
        text-color="#303133"
        active-text-color="#409eff"
        class="app-menu"
      >
        <el-menu-item index="/datasets">
          <el-icon><FolderOpened /></el-icon>
          <template #title>数据管理</template>
        </el-menu-item>
        <el-menu-item index="/charts">
          <el-icon><PieChart /></el-icon>
          <template #title>图表中心</template>
        </el-menu-item>
        <el-menu-item index="/dashboards">
          <el-icon><Odometer /></el-icon>
          <template #title>看板中心</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container class="app-main-wrap">
      <el-header class="app-header" :class="{ collapsed }">
        <div class="app-header__left">
          <el-icon class="collapse-btn" :size="18" @click="collapsed = !collapsed">
            <component :is="collapsed ? 'Expand' : 'Fold'" />
          </el-icon>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="currentTitle">{{ currentTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <div class="app-header__right">
          <el-button type="primary" size="small" @click="$router.push('/datasets/new')">
            <el-icon style="margin-right: 4px"><Upload /></el-icon>{{ collapsed ? '' : '上传数据' }}
          </el-button>
          <div class="user-chip">
            <div class="user-chip__avatar">管</div>
            <span v-show="!collapsed" class="user-chip__name">管理员</span>
          </div>
        </div>
      </el-header>

      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const sidebarWidth = '220px'
const collapsed = ref(false)

const activeMenu = computed(() => {
  const p = route.path
  if (p.startsWith('/dashboards')) return '/dashboards'
  if (p.startsWith('/charts')) return '/charts'
  return '/datasets'
})

const currentTitle = computed(() => route.meta.title || '看板低代码平台')
</script>

<style scoped>
.app-layout {
  height: 100vh;
}

/* ---------- 侧边栏（浅色扁平） ---------- */
.app-aside {
  background: #fff;
  border-right: 1px solid var(--app-border-light);
  transition: width 0.2s;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-aside.collapsed {
  width: 64px !important;
}

.app-logo {
  height: var(--app-header-height);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid var(--app-border-light);
  flex-shrink: 0;
}

.app-logo__icon {
  color: var(--app-primary);
  flex-shrink: 0;
}

.app-logo__text {
  font-size: 16px;
  font-weight: 600;
  color: var(--app-text-primary);
  white-space: nowrap;
}

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

/* ---------- 头部 ---------- */
.app-main-wrap {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.app-header {
  height: var(--app-header-height);
  background: #fff;
  border-bottom: 1px solid var(--app-border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 0 12px;
  flex-shrink: 0;
}

.app-header__left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.collapse-btn {
  cursor: pointer;
  color: var(--app-text-regular);
  padding: 6px;
  border-radius: var(--app-radius);
}
.collapse-btn:hover {
  background: var(--app-hover);
  color: var(--app-primary);
}

.app-header__right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-chip__avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--app-primary-light);
  color: var(--app-primary);
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-chip__name {
  font-size: 13px;
  color: var(--app-text-primary);
}

/* ---------- 主内容 ---------- */
.app-main {
  overflow: auto;
  padding: 0;
  background: var(--app-bg);
}
</style>