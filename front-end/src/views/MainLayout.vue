<template>
  <el-container class="app-layout">
    <!-- 垂直布局：左侧侧栏可折叠 -->
    <template v-if="store.layout === 'vertical'">
      <el-aside
        :width="store.collapsed ? '64px' : '220px'"
        class="app-aside"
        :class="{ collapsed: store.collapsed }"
      >
        <AppLogo :collapsed="store.collapsed" />
        <SideMenu :collapsed="store.collapsed" :active-menu="activeMenu" />
      </el-aside>

      <el-container class="app-main-wrap">
        <el-header class="app-header">
          <div class="app-header__left">
            <el-tooltip content="折叠 / 展开侧栏" placement="bottom">
              <el-icon class="collapse-btn" @click="store.toggleCollapsed()">
                <component :is="store.collapsed ? 'Expand' : 'Fold'" />
              </el-icon>
            </el-tooltip>
            <el-breadcrumb separator="/">
              <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
              <el-breadcrumb-item v-if="currentTitle">{{ currentTitle }}</el-breadcrumb-item>
            </el-breadcrumb>
          </div>
          <HeaderBar :settings-open="settingsOpen" @update:settings-open="settingsOpen = $event" />
        </el-header>
        <el-main class="app-main">
          <router-view />
        </el-main>
      </el-container>
    </template>

    <!-- 混合布局：顶部菜单 + 左侧 64px 图标窄栏 -->
    <template v-else-if="store.layout === 'mixed'">
      <el-aside width="64px" class="app-aside app-aside--rail">
        <AppLogo :collapsed="true" />
        <SideMenu :collapsed="true" :active-menu="activeMenu" />
      </el-aside>

      <el-container class="app-main-wrap">
        <el-header class="app-header">
          <div class="app-header__left">
            <TopMenu :active-menu="activeMenu" />
          </div>
          <HeaderBar :settings-open="settingsOpen" @update:settings-open="settingsOpen = $event" />
        </el-header>
        <el-main class="app-main">
          <router-view />
        </el-main>
      </el-container>
    </template>

    <!-- 水平布局：顶部菜单，无侧栏 -->
    <template v-else>
      <el-container class="app-main-wrap">
        <el-header class="app-header app-header--horizontal">
          <div class="app-header__left">
            <AppLogo :collapsed="true" />
            <TopMenu :active-menu="activeMenu" />
          </div>
          <HeaderBar :settings-open="settingsOpen" @update:settings-open="settingsOpen = $event" />
        </el-header>
        <el-main class="app-main">
          <router-view />
        </el-main>
      </el-container>
    </template>
  </el-container>

  <AppSettingsDrawer v-model="settingsOpen" />
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { activeMenuOf } from '@/router/menu'
import AppLogo from '@/components/layout/AppLogo.vue'
import SideMenu from '@/components/layout/SideMenu.vue'
import TopMenu from '@/components/layout/TopMenu.vue'
import HeaderBar from '@/components/layout/HeaderBar.vue'
import AppSettingsDrawer from '@/components/layout/AppSettingsDrawer.vue'

const route = useRoute()
const store = useAppStore()
const settingsOpen = ref(false)

const activeMenu = computed(() => activeMenuOf(route.path))
const currentTitle = computed(() => route.meta.title || '看板低代码平台')
</script>

<style scoped>
.app-layout {
  height: 100vh;
}

/* ---------- 侧边栏（浅色扁平） ---------- */
.app-aside {
  background: var(--app-card);
  border-right: 1px solid var(--app-border-light);
  transition: width 0.2s;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-aside.collapsed {
  width: 64px !important;
}

.app-aside--rail {
  width: 64px !important;
  flex-shrink: 0;
}

/* ---------- 头部 ---------- */
.app-main-wrap {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.app-header {
  height: var(--app-header-height);
  background: var(--app-card);
  border-bottom: 1px solid var(--app-border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 0 12px;
  flex-shrink: 0;
}

.app-header--horizontal {
  padding-left: 16px;
}

.app-header__left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.collapse-btn {
  cursor: pointer;
  color: var(--app-text-regular);
  border-radius: var(--app-radius);
  font-size: 14px;
}
.collapse-btn:hover {
  background: var(--app-hover);
  color: var(--app-primary);
}

/* ---------- 主内容 ---------- */
.app-main {
  overflow: auto;
  padding: 0;
  background: var(--app-bg);
}
</style>