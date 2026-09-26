import { watch } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { i18n, t } from '@/i18n'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/Login.vue'),
    meta: { titleKey: 'layout.menu.routes.login' },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('../views/Register.vue'),
    meta: { titleKey: 'layout.menu.routes.register' },
  },
  {
    path: '/s/:token',
    name: 'share-view',
    component: () => import('../views/ShareBoardView.vue'),
    meta: { titleKey: 'layout.menu.routes.shareView', public: true },
  },
  {
    path: '/big-screen/share/:token',
    name: 'big-screen-share',
    component: () => import('../screen-designer/views/Share.vue'),
    meta: { titleKey: 'layout.menu.routes.bigScreenShare', public: true },
  },
  {
    path: '/f/:token',
    name: 'form-share-fill',
    component: () => import('../views/FormShareView.vue'),
    meta: { titleKey: 'layout.menu.routes.formShareFill', public: true },
  },
  {
    path: '/big-screen/design/:id',
    name: 'big-screen-design',
    component: () => import('../screen-designer/views/Designer.vue'),
    meta: { titleKey: 'layout.menu.routes.bigScreenDesign' },
  },
  {
    path: '/big-screen/preview/:id',
    name: 'big-screen-preview',
    component: () => import('../screen-designer/views/Preview.vue'),
    meta: { titleKey: 'layout.menu.routes.bigScreenPreview' },
  },
  {
    path: '/big-screen/settings',
    name: 'big-screen-settings',
    component: () => import('../screen-designer/views/Settings.vue'),
    meta: { titleKey: 'layout.menu.routes.bigScreenSettings' },
  },
  {
    path: '/',
    component: () => import('../views/MainLayout.vue'),
    redirect: '/datasources',
    children: [
      { path: 'datasources', name: 'datasources', component: () => import('../views/DataSourceList.vue'), meta: { titleKey: 'layout.menu.routes.datasources' } },
      { path: 'datasources/:id', name: 'datasource-detail', component: () => import('../views/DataSourceDetail.vue'), meta: { titleKey: 'layout.menu.routes.datasourceDetail' } },
      { path: 'datasources/:id/builder', name: 'datasource-builder', component: () => import('../views/DataSourceBuilder.vue'), meta: { titleKey: 'layout.menu.routes.datasourceBuilder' } },
      { path: 'datasets', name: 'datasets', component: () => import('../views/DatasetList.vue'), meta: { titleKey: 'layout.menu.routes.datasets' } },
      { path: 'datasets/:id', name: 'dataset-detail', component: () => import('../views/DatasetDetail.vue'), meta: { titleKey: 'layout.menu.routes.datasetDetail' } },
      { path: 'charts', name: 'charts', component: () => import('../views/ChartList.vue'), meta: { titleKey: 'layout.menu.routes.charts' } },
      { path: 'charts/new', name: 'chart-builder', component: () => import('../views/ChartBuilder.vue'), meta: { titleKey: 'layout.menu.routes.chartBuilder' } },
      { path: 'charts/:id/edit', name: 'chart-edit', component: () => import('../views/ChartBuilder.vue'), meta: { titleKey: 'layout.menu.routes.chartEdit' } },
      { path: 'dashboards', name: 'dashboards', component: () => import('../views/DashboardList.vue'), meta: { titleKey: 'layout.menu.routes.dashboards' } },
      { path: 'dashboards/:id', name: 'dashboard-view', component: () => import('../views/DashboardView.vue'), meta: { titleKey: 'layout.menu.routes.dashboardView' } },
      { path: 'dashboards/:id/edit', name: 'dashboard-edit', component: () => import('../views/DashboardEditor.vue'), meta: { titleKey: 'layout.menu.routes.dashboardEdit' } },
      { path: 'big-screen', name: 'big-screens', component: () => import('../views/BigScreenList.vue'), meta: { titleKey: 'layout.menu.routes.bigScreens' } },
      { path: 'forms', name: 'forms', component: () => import('../views/forms/FormList.vue'), meta: { titleKey: 'layout.menu.routes.forms' } },
      { path: 'forms/:id/design', name: 'form-design', component: () => import('../views/forms/FormDesigner.vue'), meta: { titleKey: 'layout.menu.routes.formDesign' } },
      { path: 'forms/:id/fill', name: 'form-fill', component: () => import('../views/forms/FormFill.vue'), meta: { titleKey: 'layout.menu.routes.formFill' } },
      { path: 'forms/:id/submissions', name: 'form-submissions', component: () => import('../views/forms/FormSubmissions.vue'), meta: { titleKey: 'layout.menu.routes.formSubmissions' } },
      { path: 'admin/users', name: 'admin-users', component: () => import('../views/admin/UserAdmin.vue'), meta: { titleKey: 'layout.menu.routes.adminUsers' } },
      { path: 'admin/roles', name: 'admin-roles', component: () => import('../views/admin/RoleAdmin.vue'), meta: { titleKey: 'layout.menu.routes.adminRoles' } },
      { path: 'admin/audit', name: 'admin-audit', component: () => import('../views/admin/AuditView.vue'), meta: { titleKey: 'layout.menu.routes.adminAudit' } },
      { path: 'admin/open-api', name: 'admin-open-api', component: () => import('../views/admin/OpenApiAdmin.vue'), meta: { titleKey: 'layout.menu.routes.adminOpenApi' } },
      { path: 'open/tokens', name: 'open-tokens', component: () => import('../views/open/OpenTokens.vue'), meta: { titleKey: 'layout.menu.routes.openTokens' } },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  if (to.meta.public) return true
  const { useAuthStore } = await import('@/stores/auth')
  const auth = useAuthStore()
  const publicPages = ['/login', '/register']
  if (publicPages.includes(to.path)) {
    if (auth.isLoggedIn) return '/'
    return true
  }
  if (!auth.isLoggedIn) return `/login?redirect=${encodeURIComponent(to.fullPath)}`
  if (!auth.user?.permissions?.length) {
    try { await auth.me() } catch (e) { /* 拦截器已处理 */ }
  }
  return true
})

// 裸标签（无「· KanRay」后缀），供 MainLayout 面包屑等处复用
export function routeLabel(route) {
  const key = route.meta?.titleKey
  const translated = key ? t(key) : ''
  return translated && translated !== key ? translated : route.meta?.title || ''
}

function routeTitle(route) {
  const label = routeLabel(route)
  return label ? `${label} · KanRay` : 'KanRay'
}

router.afterEach((to) => {
  document.title = routeTitle(to)
})

// 切换语言后重算当前页标题（各路由的 titleKey 在计划 2 补齐）
watch(i18n.global.locale, () => {
  document.title = routeTitle(router.currentRoute.value)
})

export default router