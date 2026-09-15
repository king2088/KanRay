<template>
  <nav class="top-menu">
    <template v-for="item in menus" :key="item.path">
      <!-- 水平布局：一级菜单含子级时以下拉方式展示 -->
      <el-dropdown
        v-if="mode === 'horizontal' && item.children.length"
        class="top-dropdown"
        trigger="hover"
        placement="bottom-start"
        @command="go"
      >
        <span class="top-nav-item" :class="{ 'is-active': isItemActive(item) }">
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.title }}</span>
          <el-icon class="top-nav-caret"><ArrowDown /></el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              v-for="child in item.children"
              :key="child.path"
              :command="child.path"
              :class="{ 'is-active': activeMenu === child.path }"
            >
              {{ child.title }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <!-- 混合布局：一级菜单含子级时选中以在左侧展示二级菜单 -->
      <span
        v-else-if="mode === 'mixed' && item.children.length"
        class="top-nav-item"
        :class="{ 'is-active': group === item.path }"
        @click="emit('select-group', item.path)"
      >
        <el-icon><component :is="item.icon" /></el-icon>
        <span>{{ item.title }}</span>
      </span>

      <!-- 无子级的一级菜单直接跳转 -->
      <router-link
        v-else
        :to="item.path"
        class="top-nav-item"
        :class="{ 'is-active': isItemActive(item) }"
      >
        <el-icon><component :is="item.icon" /></el-icon>
        <span>{{ item.title }}</span>
      </router-link>
    </template>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { visibleMenus } from '@/router/menu'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  activeMenu: { type: String, required: true },
  mode: { type: String, default: 'horizontal' },
  group: { type: String, default: null },
})
const emit = defineEmits(['select-group'])

const auth = useAuthStore()
const router = useRouter()
const menus = computed(() => visibleMenus(auth))

// 顶部菜单高亮规则：
//  - 混合布局：以当前一级分组为准（含子级项也跟随 group）
//  - 水平布局：叶子项按 activeMenu，含子级项按其子菜单是否命中 activeMenu
function isItemActive(item) {
  if (props.mode === 'mixed') return props.group === item.path
  if (item.children.length)
    return props.activeMenu === item.path || props.activeMenu.startsWith(item.path + '/')
  return props.activeMenu === item.path
}

function go(path) {
  router.push(path)
}
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

.top-dropdown {
  height: 100%;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.top-dropdown :deep(.el-dropdown__trigger),
.top-dropdown :deep(.el-tooltip__trigger) {
  height: 100%;
  display: inline-flex;
  align-items: center;
}

.top-nav-item {
  display: inline-flex;
  align-items: center;
  gap: var(--nav-icon-gap, 8px);
  height: 100%;
  padding: 0 14px;
  font-size: var(--nav-font-size, 15px);
  color: var(--app-text-regular);
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  cursor: pointer;
  text-decoration: none;
  transition: color 0.15s, background 0.15s;
  flex-shrink: 0;
}

.top-nav-item .el-icon {
  font-size: var(--nav-icon-size, 18px);
}

.top-nav-caret {
  font-size: calc(var(--nav-icon-size, 18px) * 0.7);
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
</style>