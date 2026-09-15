<template>
  <el-menu
    :default-active="activeMenu"
    :collapse="collapsed"
    :collapse-transition="false"
    router
    class="app-menu"
  >
    <!-- 垂直布局：渲染完整菜单树（一级 + 有子级的折叠菜单） -->
    <template v-if="mode === 'vertical'">
      <template v-for="item in menus" :key="item.path">
        <el-menu-item v-if="!item.children.length" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>
        <el-sub-menu v-else :index="item.path">
          <template #title>
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.title }}</span>
          </template>
          <el-menu-item v-for="child in item.children" :key="child.path" :index="child.path">
            <el-icon><component :is="child.icon" /></el-icon>
            <template #title>{{ child.title }}</template>
          </el-menu-item>
        </el-sub-menu>
      </template>
    </template>

    <!-- 混合布局：只渲染当前一级菜单对应的二级菜单 -->
    <template v-else>
      <template v-if="groupParent">
        <div class="app-menu__group-title">
          <el-icon><component :is="groupParent.icon" /></el-icon>
          <span>{{ groupParent.title }}</span>
        </div>
        <el-menu-item v-for="child in groupParent.children" :key="child.path" :index="child.path">
          <el-icon><component :is="child.icon" /></el-icon>
          <template #title>{{ child.title }}</template>
        </el-menu-item>
      </template>
      <div v-else class="app-menu__empty">该模块暂无子菜单</div>
    </template>
  </el-menu>
</template>

<script setup>
import { computed } from 'vue'
import { visibleMenus } from '@/router/menu'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  collapsed: { type: Boolean, default: false },
  activeMenu: { type: String, required: true },
  mode: { type: String, default: 'vertical' },
  group: { type: String, default: null },
})

const auth = useAuthStore()
const menus = computed(() => visibleMenus(auth))
const groupParent = computed(() =>
  props.mode === 'mixed' ? menus.value.find((m) => m.path === props.group) || null : null
)
</script>

<style scoped>
.app-menu {
  border-right: none !important;
  flex: 1;
  overflow-y: auto;
  padding-top: 6px;
  --el-menu-item-height: var(--nav-item-height, 52px);
}

.app-menu:not(.el-menu--collapse) {
  width: 100%;
}

.app-menu :deep(.el-menu-item) {
  border-left: 2px solid transparent;
  font-size: var(--nav-font-size, 15px);
}

.app-menu :deep(.el-menu-item .el-icon),
.app-menu :deep(.el-sub-menu__title .el-icon) {
  font-size: var(--nav-icon-size, 18px);
}

.app-menu :deep(.el-sub-menu__title) {
  font-size: var(--nav-font-size, 15px);
}

.app-menu :deep(.el-menu-item.is-active) {
  background: var(--app-primary-light);
  border-left-color: var(--app-primary);
}

.app-menu :deep(.el-menu-item:hover:not(.is-active)) {
  background: var(--app-hover);
}

.app-menu__group-title {
  display: flex;
  align-items: center;
  gap: var(--nav-icon-gap, 8px);
  padding: 14px 16px;
  font-size: var(--nav-font-size, 15px);
  font-weight: 600;
  color: var(--app-text-secondary);
  border-bottom: 1px solid var(--app-border-light);
  user-select: none;
}

.app-menu__group-title .el-icon {
  font-size: var(--nav-icon-size, 18px);
}

.app-menu__empty {
  padding: 32px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--app-text-placeholder);
}
</style>