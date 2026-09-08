<template>
  <el-container class="app-layout">
    <el-aside width="220px" class="app-aside">
      <div class="app-logo">
        <el-icon :size="24"><DataAnalysis /></el-icon>
        <span>看板低代码平台</span>
      </div>
      <el-menu :default-active="activeMenu" router class="app-menu">
        <el-menu-item index="/datasets">
          <el-icon><FolderOpened /></el-icon>
          <span>数据管理</span>
        </el-menu-item>
        <el-menu-item index="/charts">
          <el-icon><PieChart /></el-icon>
          <span>图表中心</span>
        </el-menu-item>
        <el-menu-item index="/dashboards">
          <el-icon><Odometer /></el-icon>
          <span>看板中心</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container class="app-main-wrap">
      <el-header class="app-header">
        <div class="app-header-title">{{ currentTitle }}</div>
        <div class="app-header-actions">
          <el-button type="primary" size="small" @click="$router.push('/datasets/new')">
            <el-icon style="margin-right: 4px"><Upload /></el-icon>上传数据
          </el-button>
        </div>
      </el-header>

      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
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

.app-aside {
  background: #fff;
  border-right: 1px solid #e4e7ed;
}

.app-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 18px 16px;
  font-size: 16px;
  font-weight: 600;
  color: #409eff;
}

.app-menu {
  border-right: none;
}

.app-main-wrap {
  display: flex;
  flex-direction: column;
}

.app-header {
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.app-header-title {
  font-size: 16px;
  font-weight: 600;
}

.app-main {
  overflow: auto;
  padding: 0;
  background: #f4f6f9;
}
</style>