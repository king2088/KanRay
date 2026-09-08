# Admin Theme / Layouts / Pagination / Dashboard Editor UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add theme (dark + primary color), 3 layout modes, a settings drawer, fix collapse button visibility, add list pagination (backend+frontend), move dashboard "add chart" into a right library panel, and rework dashboard drag-reorder with front/back move buttons.

**Architecture:** Pinia `app` store (localStorage persisted) drives `applyTheme()` (EP dark class + CSS vars) and layout mode selection; MainLayout is refactored into layout components. Backend list routes gain optional `page`/`pageSize` returning `{ list, total }` while keeping array shape when unpaged. Dashboard editor body becomes `canvas + right library panel`; reorder switches from live-splice drag to compute-at-drop drag plus explicit move buttons.

**Tech Stack:** Vue 3.5, Pinia 3, vue-router 4, Element Plus 2.10 (dark css-vars + `--el-color-primary` overrides), Express + better-sqlite3, playwright-core (e2e).

---

## Files

**Create:**
- `front-end/src/utils/theme.js`
- `front-end/src/stores/app.js`
- `front-end/src/router/menu.js`
- `front-end/src/components/layout/AppLogo.vue`
- `front-end/src/components/layout/SideMenu.vue`
- `front-end/src/components/layout/TopMenu.vue`
- `front-end/src/components/layout/HeaderBar.vue`
- `front-end/src/components/layout/AppSettingsDrawer.vue`
- `front-end/src/components/dashboard/ChartLibraryPanel.vue`
- `backend/src/utils/pagination.js`
- `docs/superpowers/plans/2026-09-08-admin-theme-and-dashboard-improvements.md` (this file)

**Modify:**
- `front-end/src/main.js`
- `front-end/src/assets/main.css`
- `front-end/src/components/charts/EChartRenderer.vue`
- `front-end/src/views/MainLayout.vue` (rewrite)
- `front-end/src/views/DatasetList.vue`
- `front-end/src/views/ChartList.vue`
- `front-end/src/views/DashboardList.vue`
- `front-end/src/views/DashboardEditor.vue`
- `front-end/src/components/dashboard/DashboardCanvas.vue`
- `front-end/src/api/index.js`
- `backend/src/routes/dataset.routes.js`
- `backend/src/routes/chart.routes.js`
- `backend/src/routes/dashboard.routes.js`
- `front-end/scripts/e2e-smoke.cjs`

---

### Task 1: Theme foundation (theme.js, app store, main.js, dark CSS, transparent chart bg)

**Files:**
- Create: `front-end/src/utils/theme.js`
- Create: `front-end/src/stores/app.js`
- Modify: `front-end/src/main.js`
- Modify: `front-end/src/assets/main.css`
- Modify: `front-end/src/components/charts/EChartRenderer.vue`

- [ ] **Step 1: Create `front-end/src/utils/theme.js`**

```js
function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
}

function toHex(n) {
  return Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')
}

/** 把基色与 target(#ffffff/#000000) 按 amount 混合 */
export function mixColor(hex, target, amount) {
  const t = hexToRgb(target === '#000' || target === '#000000' ? '#000000' : '#ffffff')
  const c = hexToRgb(hex || '#409eff')
  return `#${toHex(c.r + (t.r - c.r) * amount)}${toHex(c.g + (t.g - c.g) * amount)}${toHex(c.b + (t.b - c.b) * amount)}`
}

/** 根据设置应用暗黑模式 + 主题色（写 CSS 变量到 documentElement） */
export function applyTheme(settings = {}) {
  const root = document.documentElement
  root.classList.toggle('dark', !!settings.dark)
  const p = settings.primaryColor || '#409eff'
  const vars = {
    '--el-color-primary': p,
    '--el-color-primary-light-3': mixColor(p, '#fff', 0.3),
    '--el-color-primary-light-5': mixColor(p, '#fff', 0.5),
    '--el-color-primary-light-7': mixColor(p, '#fff', 0.7),
    '--el-color-primary-light-8': mixColor(p, '#fff', 0.8),
    '--el-color-primary-light-9': mixColor(p, '#fff', 0.9),
    '--el-color-primary-dark-2': mixColor(p, '#000', 0.2),
    '--app-primary': p,
    '--app-primary-light': mixColor(p, '#fff', 0.9),
    '--app-primary-darker': mixColor(p, '#000', 0.1),
  }
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
}
```

- [ ] **Step 2: Create `front-end/src/stores/app.js`**

```js
import { defineStore } from 'pinia'
import { applyTheme } from '@/utils/theme'

const KEY = 'kanban-app-settings'
const DEFAULTS = { layout: 'vertical', collapsed: false, dark: false, primaryColor: '#409eff' }

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch (e) {
    return { ...DEFAULTS }
  }
}

export const useAppStore = defineStore('app', {
  state: () => load(),
  actions: {
    persist() {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          layout: this.layout,
          collapsed: this.collapsed,
          dark: this.dark,
          primaryColor: this.primaryColor,
        }),
      )
    },
    applyInitial() {
      applyTheme({ dark: this.dark, primaryColor: this.primaryColor })
    },
    setLayout(v) {
      this.layout = v
      if (v !== 'vertical') this.collapsed = false
      this.persist()
    },
    toggleCollapsed() {
      this.collapsed = !this.collapsed
      this.persist()
    },
    toggleDark() {
      this.dark = !this.dark
      applyTheme({ dark: this.dark, primaryColor: this.primaryColor })
      this.persist()
    },
    setPrimaryColor(v) {
      this.primaryColor = v
      applyTheme({ dark: this.dark, primaryColor: v })
      this.persist()
    },
  },
})
```

- [ ] **Step 3: Modify `front-end/src/main.js`** — add pinia store wiring + dark css import + pre-mount applyTheme.

```js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import router from './router'
import { useAppStore } from './stores/app'
import './assets/main.css'

const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

const pinia = createPinia()
app.use(pinia)
app.use(router)
app.use(ElementPlus, { locale: zhCn })

useAppStore(pinia).applyInitial()

app.mount('#app')
```

- [ ] **Step 4: Modify `front-end/src/assets/main.css`** — append `html.dark` overrides at end of file.

```css
/* ============================================================
   暗黑模式（Element Plus 提供 --el-*，这里覆盖应用自定义 token）
   ============================================================ */

html.dark {
  --app-bg: #121212;
  --app-card: #1e1e1e;
  --app-text-primary: #e5eaf3;
  --app-text-regular: #cfd3dc;
  --app-text-secondary: #a3a6ad;
  --app-border: #4c4d4f;
  --app-border-light: #363637;
  --app-hover: #2a2a2b;
  color-scheme: dark;
}

html.dark body {
  background: var(--app-bg);
  color: var(--app-text-primary);
}

html.dark ::-webkit-scrollbar-thumb {
  background: #4c4d4f;
}
html.dark ::-webkit-scrollbar-thumb:hover {
  background: #606266;
}
```

- [ ] **Step 5: Modify `front-end/src/components/charts/EChartRenderer.vue`** — transparent background so charts blend into dark cards.

In `render()` change:
```js
  const opt = toEChartsOption(props.chartType, props.data, props.options)
```
to:
```js
  const opt = toEChartsOption(props.chartType, props.data, props.options)
  if (!opt.backgroundColor) opt.backgroundColor = 'transparent'
```

- [ ] **Step 6: Replace hardcoded surface whites with theme vars**

Grep `background: #fff` in `front-end/src` and replace each occurrence in layout/header/canvas surfaces with `background: var(--app-card)`. Affected files: `views/MainLayout.vue` (logo/header/aside), `components/dashboard/DashboardCanvas.vue` (`.grid-item`, `.item-header`), `views/ChartBuilder.vue` (toolbar/config/preview), `views/DashboardList.vue`/`DashboardEditor.vue`/`DashboardView.vue` (their top bars). This step will be applied naturally as each file is rewritten in Tasks 2/3/7/8; only file not touched elsewhere is `ChartBuilder.vue` — change its `background: #fff` occurrences now. Use `rg -l "background: #fff" src` to confirm none remain after later tasks.

- [ ] **Step 7: Verify**

Run: `cd front-end && npm run build`
Expected: build succeeds. No runtime check yet (theme toggling verified via e2e in Task 9).

- [ ] **Step 8: Commit**

```bash
git add front-end/src/utils/theme.js front-end/src/stores/app.js front-end/src/main.js front-end/src/assets/main.css front-end/src/components/charts/EChartRenderer.vue
git commit -m "feat(theme): add dark mode + primary color system with persisted app store"
```

---

### Task 2: Menu constants + layout components + MainLayout rewrite (3 layout modes + collapse fix)

**Files:**
- Create: `front-end/src/router/menu.js`
- Create: `front-end/src/components/layout/AppLogo.vue`
- Create: `front-end/src/components/layout/SideMenu.vue`
- Create: `front-end/src/components/layout/TopMenu.vue`
- Create: `front-end/src/components/layout/HeaderBar.vue`
- Rewrite: `front-end/src/views/MainLayout.vue`

- [ ] **Step 1: Create `front-end/src/router/menu.js`**

```js
import { FolderOpened, PieChart, Odometer } from '@element-plus/icons-vue'

export const MENU_ITEMS = [
  { path: '/datasets', title: '数据管理', icon: FolderOpened },
  { path: '/charts', title: '图表中心', icon: PieChart },
  { path: '/dashboards', title: '看板中心', icon: Odometer },
]

export function activeMenuOf(path) {
  if (path.startsWith('/dashboards')) return '/dashboards'
  if (path.startsWith('/charts')) return '/charts'
  return '/datasets'
}
```

- [ ] **Step 2: Create `front-end/src/components/layout/AppLogo.vue`**

```vue
<template>
  <div class="app-logo" @click="$router.push('/datasets')">
    <el-icon :size="20" class="app-logo__icon"><DataAnalysis /></el-icon>
    <span v-show="!collapsed" class="app-logo__text">看板低代码平台</span>
  </div>
</template>

<script setup>
defineProps({ collapsed: { type: Boolean, default: false } })
</script>

<style scoped>
.app-logo {
  height: var(--app-header-height);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid var(--app-border-light);
  background: var(--app-card);
  flex-shrink: 0;
}
.app-logo__icon { color: var(--app-primary); flex-shrink: 0; }
.app-logo__text {
  font-size: 16px;
  font-weight: 600;
  color: var(--app-text-primary);
  white-space: nowrap;
}
</style>
```

- [ ] **Step 3: Create `front-end/src/components/layout/SideMenu.vue`**

```vue
<template>
  <el-menu
    :default-active="active"
    :collapse="collapsed"
    :collapse-transition="false"
    router
    background-color="var(--app-card)"
    text-color="var(--app-text-regular)"
    active-text-color="var(--app-primary)"
    class="side-menu"
  >
    <el-menu-item v-for="item in MENU_ITEMS" :key="item.path" :index="item.path">
      <el-icon><component :is="item.icon" /></el-icon>
      <template #title>{{ item.title }}</template>
    </el-menu-item>
  </el-menu>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { MENU_ITEMS, activeMenuOf } from '@/router/menu'

const props = defineProps({ collapsed: { type: Boolean, default: false } })
const route = useRoute()
const active = computed(() => activeMenuOf(route.path))
</script>

<style scoped>
.side-menu {
  border-right: none !important;
  flex: 1;
  overflow-y: auto;
  padding-top: 6px;
  --el-menu-item-height: 50px;
}
.side-menu:not(.el-menu--collapse) { width: 100%; }
.side-menu :deep(.el-menu-item) { border-left: 2px solid transparent; }
.side-menu :deep(.el-menu-item.is-active) {
  background: var(--app-primary-light);
  border-left-color: var(--app-primary);
}
.side-menu :deep(.el-menu-item:hover:not(.is-active)) { background: var(--app-hover); }
</style>
```

- [ ] **Step 4: Create `front-end/src/components/layout/TopMenu.vue`**

```vue
<template>
  <el-menu
    :default-active="active"
    mode="horizontal"
    router
    class="top-menu"
    :ellipsis="false"
  >
    <el-menu-item v-for="item in MENU_ITEMS" :key="item.path" :index="item.path">
      <el-icon><component :is="item.icon" /></el-icon>
      <span>{{ item.title }}</span>
    </el-menu-item>
  </el-menu>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { MENU_ITEMS, activeMenuOf } from '@/router/menu'

const route = useRoute()
const active = computed(() => activeMenuOf(route.path))
</script>

<style scoped>
.top-menu {
  border-bottom: none !important;
  flex: 1;
  min-width: 0;
  --el-menu-item-height: var(--app-header-height);
}
.top-menu :deep(.el-menu-item) { padding: 0 18px; }
</style>
```

- [ ] **Step 5: Create `front-end/src/components/layout/HeaderBar.vue`**

```vue
<template>
  <div class="header-bar">
    <div class="header-left">
      <el-tooltip v-if="store.layout === 'vertical'" content="折叠 / 展开菜单" placement="bottom">
        <el-icon :size="20" class="collapse-btn" @click="store.toggleCollapsed()">
          <component :is="store.collapsed ? 'Expand' : 'Fold'" />
        </el-icon>
      </el-tooltip>
      <el-breadcrumb separator="/">
        <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
        <el-breadcrumb-item v-if="currentTitle">{{ currentTitle }}</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="header-right">
      <el-tooltip content="系统设置" placement="bottom">
        <el-icon :size="18" class="header-icon" @click="emit('open-settings')"><Setting /></el-icon>
      </el-tooltip>
      <div class="user-chip">
        <div class="user-chip__avatar">管</div>
        <span class="user-chip__name">管理员</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'

const emit = defineEmits(['open-settings'])
const store = useAppStore()
const route = useRoute()
const currentTitle = computed(() => route.meta.title || '看板低代码平台')
</script>

<style scoped>
.header-bar {
  height: var(--app-header-height);
  background: var(--app-card);
  border-bottom: 1px solid var(--app-border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px 0 8px;
  flex-shrink: 0;
}
.header-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.collapse-btn {
  cursor: pointer;
  color: var(--app-text-regular);
  padding: 9px;
  border-radius: var(--app-radius);
  display: inline-flex;
}
.collapse-btn:hover { background: var(--app-hover); color: var(--app-primary); }
.header-right { display: flex; align-items: center; gap: 14px; }
.header-icon {
  cursor: pointer;
  color: var(--app-text-regular);
  padding: 8px;
  border-radius: var(--app-radius);
  display: inline-flex;
}
.header-icon:hover { background: var(--app-hover); color: var(--app-primary); }
.user-chip { display: flex; align-items: center; gap: 8px; }
.user-chip__avatar {
  width: 30px; height: 30px; border-radius: 50%;
  background: var(--app-primary-light); color: var(--app-primary);
  font-weight: 600; font-size: 14px;
  display: flex; align-items: center; justify-content: center;
}
.user-chip__name { font-size: 13px; color: var(--app-text-primary); }
</style>
```

- [ ] **Step 6: Rewrite `front-end/src/views/MainLayout.vue`** to support vertical/horizontal/mixed from the app store.

```vue
<template>
  <el-container class="app-layout">
    <!-- 垂直：左侧菜单；混合：顶部菜单 + 左侧图标窄栏；水平：仅顶部菜单 -->
    <template v-if="store.layout === 'vertical'">
      <el-aside :width="store.collapsed ? '64px' : '220px'" class="app-aside">
        <AppLogo :collapsed="store.collapsed" />
        <SideMenu :collapsed="store.collapsed" />
      </el-aside>
    </template>

    <el-container class="app-main-wrap">
      <template v-if="store.layout !== 'vertical'">
        <div class="top-bar">
          <div class="top-bar__logo">
            <AppLogo :collapsed="store.layout === 'mixed' ? false : true" />
          </div>
          <TopMenu />
          <HeaderBar @open-settings="settingsVisible = true" />
        </div>
      </template>
      <HeaderBar v-else @open-settings="settingsVisible = true" />

      <el-container class="app-body">
        <el-aside v-if="store.layout === 'mixed'" width="64px" class="mixed-rail">
          <SideMenu :collapsed="true" />
        </el-aside>
        <el-main class="app-main">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </el-container>

  <AppSettingsDrawer v-model="settingsVisible" />
</template>

<script setup>
import { ref } from 'vue'
import { useAppStore } from '@/stores/app'
import AppLogo from '@/components/layout/AppLogo.vue'
import SideMenu from '@/components/layout/SideMenu.vue'
import TopMenu from '@/components/layout/TopMenu.vue'
import HeaderBar from '@/components/layout/HeaderBar.vue'
import AppSettingsDrawer from '@/components/layout/AppSettingsDrawer.vue'

const store = useAppStore()
const settingsVisible = ref(false)
</script>

<style scoped>
.app-layout { height: 100vh; }
.app-aside {
  background: var(--app-card);
  border-right: 1px solid var(--app-border-light);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.app-main-wrap { display: flex; flex-direction: column; min-width: 0; }
.top-bar {
  height: var(--app-header-height);
  background: var(--app-card);
  border-bottom: 1px solid var(--app-border-light);
  display: flex;
  align-items: stretch;
  flex-shrink: 0;
}
.top-bar__logo { display: flex; align-items: center; }
.app-body { flex: 1; min-height: 0; }
.mixed-rail {
  background: var(--app-card);
  border-right: 1px solid var(--app-border-light);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.app-main { overflow: auto; padding: 0; background: var(--app-bg); }
</style>
```

Note: `AppLogo`/`SideMenu`/`HeaderBar` are each 52px tall as designed; in `top-bar` HeaderBar has `flex: 1` via `.top-bar` children — add `flex: 1; min-width: 0;` to `.header-bar` when inside top-bar. Simplify by adding the following to HeaderBar's scoped style:
```css
.top-bar :deep(.header-bar) { flex: 1; min-width: 0; border-bottom: none; }
```
and in MainLayout add `.top-bar :deep(...)` is scoped in HeaderBar — instead, in MainLayout scoped style add:
```css
.top-bar > :deep(.header-bar) { flex: 1; min-width: 0; border-bottom: none; }
```
Wait — simplest: give HeaderBar `flex: 1` default and accept border-bottom in vertical too (it already has border-bottom). In top-bar, HeaderBar should fill remaining width; add to HeaderBar root `flex: 1` won't hurt vertical. So just add in HeaderBar style: remove `border-bottom` when used in top-bar is cosmetic duplication — keep it, minor. Leave as-is; visual double border acceptable but let's avoid: in MainLayout `.top-bar` has border-bottom, and HeaderBar inside also has one → double line. Add to MainLayout scoped:
```css
.top-bar .header-bar { border-bottom: none; }
```
(plain class selector works since HeaderBar's root class is `.header-bar` and attribute selectors aren't scoped to children classes applied at a weirder depth — `.top-bar .header-bar` in MainLayout scoped compiles to `.top-bar .header-bar[data-v-xxx]` which won't match HeaderBar's root (different scope). So can't style child component root from parent scoped unless using :deep. Use in MainLayout:
```css
.top-bar :deep(.header-bar) { border-bottom: none; }
```

- [ ] **Step 7: Verify build**

Run: `cd front-end && npm run build`
Expected: build succeeds (all imports resolve).

- [ ] **Step 8: Commit**

```bash
git add front-end/src/router/menu.js front-end/src/components/layout front-end/src/views/MainLayout.vue
git commit -m "feat(layout): 3 layout modes (vertical/horizontal/mixed) with header, menus and fixed collapse button"
```

---

### Task 3: Settings drawer

**Files:**
- Create: `front-end/src/components/layout/AppSettingsDrawer.vue`

- [ ] **Step 1: Create `front-end/src/components/layout/AppSettingsDrawer.vue`**

```vue
<template>
  <el-drawer v-model="visible" title="系统设置" :size="280" append-to-body>
    <div class="setting-group">
      <div class="setting-title">布局模式</div>
      <div class="layout-grid">
        <div
          v-for="m in LAYOUT_OPTIONS"
          :key="m.value"
          class="layout-card"
          :class="{ active: store.layout === m.value }"
          @click="store.setLayout(m.value)"
        >
          <component :is="m.icon" :size="26" />
          <span>{{ m.label }}</span>
        </div>
      </div>
    </div>

    <div class="setting-group">
      <div class="setting-title">主题色</div>
      <div class="color-row">
        <span
          v-for="c in PRIMARY_COLORS"
          :key="c"
          class="color-dot"
          :class="{ active: store.primaryColor === c }"
          :style="{ background: c }"
          @click="store.setPrimaryColor(c)"
        />
      </div>
    </div>

    <div class="setting-group">
      <div class="setting-line">
        <span>暗黑模式</span>
        <el-switch v-model="store.dark" @change="store.toggleDark()" />
      </div>
      <div v-if="store.layout === 'vertical'" class="setting-line">
        <span>侧边栏折叠</span>
        <el-switch :model-value="store.collapsed" @change="store.toggleCollapsed()" />
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { computed } from 'vue'
import { Grid, Rank, SetUp } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'

const props = defineProps({ modelValue: { type: Boolean, default: false } })
const emit = defineEmits(['update:modelValue'])
const store = useAppStore()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const LAYOUT_OPTIONS = [
  { value: 'vertical', label: '垂直', icon: Rank },
  { value: 'horizontal', label: '水平', icon: SetUp },
  { value: 'mixed', label: '混合', icon: Grid },
]
const PRIMARY_COLORS = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#9c27b0']
</script>

<style scoped>
.setting-group { margin-bottom: 24px; }
.setting-title {
  font-size: 13px; font-weight: 600; color: var(--app-text-primary); margin-bottom: 10px;
}
.layout-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.layout-card {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  border: 1px solid var(--app-border-light); border-radius: var(--app-radius);
  padding: 14px 4px; cursor: pointer; font-size: 12px; color: var(--app-text-regular);
}
.layout-card:hover { border-color: var(--app-primary); color: var(--app-primary); }
.layout-card.active { border-color: var(--app-primary); background: var(--app-primary-light); color: var(--app-primary); }
.color-row { display: flex; gap: 10px; align-items: center; }
.color-dot {
  width: 24px; height: 24px; border-radius: 50%; cursor: pointer;
  border: 2px solid transparent; transition: all 0.15s;
}
.color-dot.active { border-color: #fff; box-shadow: 0 0 0 2px var(--app-primary); }
.setting-line {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 0; font-size: 13px; color: var(--app-text-regular);
}
</style>
```

- [ ] **Step 2: Verify build**

Run: `cd front-end && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add front-end/src/components/layout/AppSettingsDrawer.vue
git commit -m "feat(settings): add settings drawer for layout mode, primary color and dark mode"
```

---

### Task 4: Backend list pagination

**Files:**
- Create: `backend/src/utils/pagination.js`
- Modify: `backend/src/routes/dataset.routes.js`
- Modify: `backend/src/routes/chart.routes.js`
- Modify: `backend/src/routes/dashboard.routes.js`

- [ ] **Step 1: Create `backend/src/utils/pagination.js`**

```js
function parsePageQuery(req) {
  const hasPage = req.query.page !== undefined && req.query.page !== ''
  const page = Math.max(1, parseInt(req.query.page, 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 10))
  return { hasPage, page, pageSize };
}

function paginate(list, page = 1, pageSize = 10) {
  const total = list.length;
  const start = (page - 1) * pageSize;
  return { list: list.slice(start, start + pageSize), total };
}

module.exports = { parsePageQuery, paginate };
```

- [ ] **Step 2: Modify `backend/src/routes/dataset.routes.js`** — pagination on GET `/`

```js
const { parsePageQuery, paginate } = require('../utils/pagination');
```

Change:
```js
router.get('/', (req, res) => {
  ok(res, datasetService.listDatasets());
});
```
to:
```js
router.get('/', (req, res) => {
  const list = datasetService.listDatasets();
  const { hasPage, page, pageSize } = parsePageQuery(req);
  if (!hasPage) { ok(res, list); return; }
  ok(res, paginate(list, page, pageSize));
});
```

- [ ] **Step 3: Modify `backend/src/routes/chart.routes.js`** — pagination on GET `/`

```js
const { parsePageQuery, paginate } = require('../utils/pagination');
```

Change:
```js
router.get('/', (req, res) => {
  ok(res, chartService.listCharts());
});
```
to:
```js
router.get('/', (req, res) => {
  const list = chartService.listCharts();
  const { hasPage, page, pageSize } = parsePageQuery(req);
  if (!hasPage) { ok(res, list); return; }
  ok(res, paginate(list, page, pageSize));
});
```

- [ ] **Step 4: Modify `backend/src/routes/dashboard.routes.js`** — pagination on GET `/`

```js
const { parsePageQuery, paginate } = require('../utils/pagination');
```

Change:
```js
router.get('/', (req, res) => {
  ok(res, dashboardService.listDashboards());
});
```
to:
```js
router.get('/', (req, res) => {
  const list = dashboardService.listDashboards();
  const { hasPage, page, pageSize } = parsePageQuery(req);
  if (!hasPage) { ok(res, list); return; }
  ok(res, paginate(list, page, pageSize));
});
```

- [ ] **Step 5: Verify backend**

Restart backend, then:
- Unpaged shape unchanged: `GET /api/datasets` → `data` is an array.
- Paged shape: `GET /api/datasets?page=1&pageSize=2` → `data` is `{ list: [...], total: <n> }`.
Run: `node backend/scripts/integration-test.js` → all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/utils/pagination.js backend/src/routes/dataset.routes.js backend/src/routes/chart.routes.js backend/src/routes/dashboard.routes.js
git commit -m "feat(backend): optional page/pageSize on datasets, charts and dashboards list APIs"
```

---

### Task 5: Frontend api + pagination in the three list views

**Files:**
- Modify: `front-end/src/api/index.js`
- Modify: `front-end/src/views/DatasetList.vue`
- Modify: `front-end/src/views/ChartList.vue`
- Modify: `front-end/src/views/DashboardList.vue`
- Modify: `front-end/src/assets/main.css` (add `.page-card__footer`)

- [ ] **Step 1: Add `listPaged` to `front-end/src/api/index.js`**

```js
list: () => http.get('/datasets'),
listPaged: (page, pageSize) => http.get('/datasets', { params: { page, pageSize } }),
```
(same pattern for `chartApi` and `dashboardApi`).

- [ ] **Step 2: Add `.page-card__footer` to `front-end/src/assets/main.css`**

```css
.page-card__footer {
  padding: 12px 16px;
  border-top: 1px solid var(--app-border-light);
  display: flex;
  justify-content: flex-end;
}
```

- [ ] **Step 3: Modify `DatasetList.vue`**

Script: add refs and paged load:
```js
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

async function load() {
  loading.value = true
  try {
    const res = await datasetApi.listPaged(page.value, pageSize.value)
    datasets.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function onPage(p) {
  page.value = p
  load()
}
function onSize(s) {
  pageSize.value = s
  page.value = 1
  load()
}
```
- Replace `datasets.length` in the stat strip with `total`.
- After a successful delete `remove()`, call `load()`; if the deleted row was the last one on the page and `datasets.value.length === 1 && page.value > 1`, decrement page before reload.
- Add pagination at the bottom of `el-table` (inside `.page-card` after the table):
```html
<div class="page-card__footer">
  <el-pagination
    background
    layout="total, sizes, prev, pager, next"
    :total="total"
    :page-size="pageSize"
    :current-page="page"
    :page-sizes="[10, 20, 50]"
    @current-change="onPage"
    @size-change="onSize"
  />
</div>
```
- Adjust `el-table` `height` so pagination fits: reduce from `calc(100vh - 220px)` to `calc(100vh - 280px)`.

- [ ] **Step 4: Modify `ChartList.vue`**

- Same pagination wiring as DatasetList (`chartApi.listPaged`).
- Stat strip `图表总数` uses `total`.
- Keep the separate full `dashboardApi.list()` call for `usedIds` (used-count is board-wide, not paginated).

- [ ] **Step 5: Modify `DashboardList.vue`**

- Same pagination wiring (`dashboardApi.listPaged`); `看板列表` tag shows `total`.
- Adapt the existing `v-loading` table height similarly.

- [ ] **Step 6: Verify build**

Run: `cd front-end && npm run build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add front-end/src/api/index.js front-end/src/views/DatasetList.vue front-end/src/views/ChartList.vue front-end/src/views/DashboardList.vue front-end/src/assets/main.css
git commit -m "feat(ui): paginate dataset, chart and dashboard list pages"
```

---

### Task 6: Dashboard editor — right chart library panel

**Files:**
- Create: `front-end/src/components/dashboard/ChartLibraryPanel.vue`
- Modify: `front-end/src/views/DashboardEditor.vue`
- Modify: `front-end/src/components/dashboard/DashboardCanvas.vue` (remove editable toolbar, expose addChart)

- [ ] **Step 1: Create `front-end/src/components/dashboard/ChartLibraryPanel.vue`**

```vue
<template>
  <aside class="chart-library-panel">
    <div class="lib-header">组件库</div>

    <div class="lib-section-title">图表</div>
    <div class="lib-list">
      <div
        v-for="c in charts"
        :key="c.id"
        class="chart-palette-item"
        :class="{ 'is-used': usedIds.has(c.id) }"
        draggable="!usedIds.has(c.id)"
        @dragstart="onDrag($event, c)"
        @click="!usedIds.has(c.id) && emit('add-chart', c)"
      >
        <el-icon :size="14"><PieChart /></el-icon>
        <span class="lib-item-name">{{ c.name }}</span>
        <el-tag v-if="usedIds.has(c.id)" size="small" type="info" effect="plain">已在看板</el-tag>
      </div>
      <el-empty v-if="!charts.length" description="请先创建图表" :image-size="50" />
    </div>

    <div class="lib-section-title">通用组件</div>
    <div class="lib-actions">
      <el-button style="width: 100%" plain @click="emit('click-text')">
        <el-icon style="margin-right: 4px"><EditPen /></el-icon>添加文本
      </el-button>
      <el-button style="width: 100%" plain @click="emit('click-filter')">
        <el-icon style="margin-right: 4px"><Filter /></el-icon>添加筛选
      </el-button>
    </div>
  </aside>
</template>

<script setup>
import { EditPen, Filter, PieChart } from '@element-plus/icons-vue'

defineProps({
  charts: { type: Array, required: true },
  usedIds: { type: Object, required: true }, // Set
})
const emit = defineEmits(['add-chart', 'click-text', 'click-filter'])

function onDrag(e, chart) {
  e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'chart', chartId: chart.id }))
  e.dataTransfer.effectAllowed = 'copy'
}
</script>

<style scoped>
.chart-library-panel {
  width: 260px;
  flex-shrink: 0;
  background: var(--app-card);
  border: 1px solid var(--app-border-light);
  border-radius: var(--app-radius);
  margin-left: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.lib-header {
  height: 40px;
  line-height: 40px;
  padding: 0 14px;
  font-size: 14px;
  font-weight: 600;
  border-bottom: 1px solid var(--app-border-light);
  color: var(--app-text-primary);
}
.lib-section-title {
  font-size: 12px;
  color: var(--app-text-secondary);
  padding: 10px 14px 6px;
}
.lib-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
}
.chart-palette-item {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--app-primary-light);
  border: 1px solid #d9ecff;
  color: var(--app-primary);
  border-radius: var(--app-radius);
  padding: 7px 10px;
  font-size: 13px;
  cursor: grab;
  user-select: none;
}
.chart-palette-item:hover { border-color: var(--app-primary); }
.chart-palette-item.is-used {
  background: var(--app-hover);
  border-color: var(--app-border-light);
  color: var(--app-text-secondary);
  cursor: not-allowed;
}
.lib-item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lib-actions { padding: 4px 12px 14px; display: flex; flex-direction: column; gap: 8px; }
</style>
```

- [ ] **Step 2: Modify `front-end/src/components/dashboard/DashboardCanvas.vue`**

- Remove the `v-if="editable"` `.canvas-toolbar` block entirely (top palette).
- Change grid empty text to `description="从右侧图表库点击或拖入，或使用顶部「添加文本/筛选」"`.
- Expose `addChart`:
```js
defineExpose({ addText, addFilter, addChart })
```
- Delete now-unused CSS `.canvas-toolbar`, `.tool-group`, `.tool-label`, `.tool-hint`.

- [ ] **Step 3: Modify `front-end/src/views/DashboardEditor.vue`**

- Toolbar: remove the `添加文本` and `添加筛选` `el-button`s (keep back, name input, 编辑中 tag, 预览, 保存).
- Editor body becomes flex row:
```html
<div class="editor-body">
  <DashboardCanvas
    ref="canvasRef"
    class="editor-canvas"
    :items="items"
    :charts="charts"
    editable
    @update:items="items = $event"
    @add-item="onAddItem"
    @remove-item="onRemoveItem"
  />
  <ChartLibraryPanel
    :charts="charts"
    :used-ids="usedIds"
    @add-chart="(c) => canvasRef.value.addChart(c)"
    @click-text="addTextDialog = true"
    @click-filter="openFilterDialog"
  />
</div>
```
- Imports: add `ChartLibraryPanel`; remove unused `EditPen, Filter` icons if now unused elsewhere.
- Add computed used chart ids:
```js
import { computed } from 'vue'
const usedIds = computed(() => new Set(items.value.filter((i) => i.type === 'chart').map((i) => i.chartId)))
```
- CSS: `.editor-body` add `display: flex;`; `.editor-canvas { flex: 1; min-width: 0; }` (keep existing padding/overflow).

- [ ] **Step 4: Verify build**

Run: `cd front-end && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add front-end/src/components/dashboard/ChartLibraryPanel.vue front-end/src/views/DashboardEditor.vue front-end/src/components/dashboard/DashboardCanvas.vue
git commit -m "feat(editor): add right-side chart library panel in dashboard editor"
```

---

### Task 7: Dashboard drag reorder rework + move buttons

**Files:**
- Modify: `front-end/src/components/dashboard/DashboardCanvas.vue`

- [ ] **Step 1: Rework drag-to-reorder (compute-at-drop, no live splice)**

Replace the whole `startReorder` function and related bindings:

Template — header drag binding change:
```html
<div class="item-header" :class="{ editable }" @mousedown="editable && beginDrag($event, item)">
```
Keep the `drag-handle` icon span in the header (it now just signals draggable).

Script — replace `startReorder` with:

```js
/** 编辑态：鼠标拖拽重排 —— 拖动过程只高亮，mouseup 时一次性计算插入位置 */
function beginDrag(e, item) {
  if (!props.editable) return
  if (e.target.closest('.item-actions')) return
  e.preventDefault()
  draggingId.value = item.id
  dragOverIdx.value = null
  let target = null

  const compute = (cx, cy) => {
    const els = gridItems.value || []
    for (let i = 0; i < els.length; i++) {
      const r = els[i].getBoundingClientRect()
      if (cy >= r.top && cy <= r.bottom && cx >= r.left && cx <= r.right) {
        return cx < r.left + r.width / 2 ? i : i + 1
      }
    }
    return els.length // 未命中卡片 → 追加到末尾
  }

  const onMove = (ev) => {
    target = compute(ev.clientX, ev.clientY)
    dragOverIdx.value = target
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    draggingId.value = null
    dragOverIdx.value = null
    if (target === null || !props.items.length) return
    const from = props.items.findIndex((it) => it.id === item.id)
    const to = target > from ? target - 1 : target
    const clamped = Math.max(0, Math.min(props.items.length - 1, to))
    if (clamped === from) return
    const arr = [...props.items]
    const [moved] = arr.splice(from, 1)
    arr.splice(clamped, 0, moved)
    emit('update:items', arr)
    ElMessage.success('已调整位置')
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}
```

Add `dragOverIdx` ref next to `draggingId`:
```js
const dragOverIdx = ref(null)
```

Grid item class binding — add highlight when an item is the drag-over target:
```html
'grid-item--drop-target': dragOverIdx === idx || dragOverIdx === idx + 1,
```
(Single highlight on the item adjacent to insertion point.)

- [ ] **Step 2: Add prev/next move buttons to item header actions**

In the editable `item-actions` span, before the width dropdown:
```html
<el-icon class="act-btn" size="15" title="前移" @click.stop="moveItem(item, -1)"><ArrowUp /></el-icon>
<el-icon class="act-btn" size="15" title="后移" @click.stop="moveItem(item, 1)"><ArrowDown /></el-icon>
```
Add handler:
```js
function moveItem(item, dir) {
  const idx = props.items.findIndex((it) => it.id === item.id)
  const to = idx + dir
  if (to < 0 || to >= props.items.length) return
  const arr = [...props.items]
  const [m] = arr.splice(idx, 1)
  arr.splice(to, 0, m)
  emit('update:items', arr)
}
```
Add imports: `import { Rank, Operation, Delete, PieChart, ArrowUp, ArrowDown } from '@element-plus/icons-vue'`.

- [ ] **Step 3: Add drop-target CSS**

```css
.grid-item--drop-target { border-color: var(--app-primary); box-shadow: 0 0 0 1px var(--app-primary); }
```

- [ ] **Step 4: Verify build**

Run: `cd front-end && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add front-end/src/components/dashboard/DashboardCanvas.vue
git commit -m "fix(editor): reliable compute-at-drop reorder and add front/back move buttons"
```

---

### Task 8: E2E smoke updates + full verification

**Files:**
- Modify: `front-end/scripts/e2e-smoke.cjs`

- [ ] **Step 1: Add lightweight assertions for new features**

Insert after step 1 (datasets page loads) existing `await page.waitForSelector('text=上传数据', ...)`:
```js
await page.waitForSelector('.el-pagination', { timeout: 10000 });
log('1b 数据集列表分页器存在');
// 设置抽屉：布局/暗黑
await page.locator('.header-bar .header-icon').click();
await page.waitForSelector('.el-drawer', { timeout: 10000 });
const darkSwitch = page.locator('.el-drawer .el-switch').nth(0);
if (await darkSwitch.count()) {
  const before = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  await darkSwitch.click();
  const after = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  console.assert(before !== after, 'dark mode should toggle');
  await darkSwitch.click(); // 恢复
}
await page.locator('.el-drawer .el-drawer__close-btn').click();
```
Note the existing flow clicks `text=上传数据` BEFORE header button no longer exists — the DatasetList page's own 上传数据 button remains, so first-match still works. After the drawer assertions the flow continues to upload as before.

In the dashboard editor steps (after step 10), assert right panel:
```js
await page.waitForSelector('.chart-library-panel', { timeout: 10000 });
const libItems = await page.$$('.chart-palette-item').then((a) => a.length);
console.assert(libItems > 0, 'chart library panel should list charts');
```
The existing palette drag step must be updated: the palette item now lives in the right panel; drop target `.grid-body` still valid. Remove `getAttribute`-style drag only if it breaks — it should still work (same classes). Keep as-is.

- [ ] **Step 2: Restart backend + frontend, run full verification**

```bash
# backend already restarted in Task 4; ensure running on :3001
node backend/scripts/integration-test.js   # all pass
cd front-end && npm run build
node scripts/e2e-smoke.cjs                  # SMOKE TEST PASSED
```

- [ ] **Step 3: Commit**

```bash
git add front-end/scripts/e2e-smoke.cjs
git commit -m "test(e2e): assert pagination, settings drawer dark toggle and chart library panel"
```

---

## Self-Review Notes
- Spec §1→Task 1, §2→Task 2, §3→Task 3, §4→Tasks 4+5, §5→Task 6, §6→Task 7, §7→Task 8. All spec sections covered.
- E2E selectors contract preserved: `.chart-palette-item` (now in right panel), `.grid-item`, `.filter-component`, `text=添加筛选`, `text=保存`, `text=预览模式`, `text=编辑中`, `text=上传数据` (DatasetList page button), input placeholders unchanged.