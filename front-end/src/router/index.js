import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/Login.vue'),
    meta: { title: '登录' },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('../views/Register.vue'),
    meta: { title: '注册' },
  },
  {
    path: '/',
    component: () => import('../views/MainLayout.vue'),
    redirect: '/datasets',
    children: [
      { path: 'datasources', name: 'datasources', component: () => import('../views/DataSourceList.vue'), meta: { title: '数据源' } },
      { path: 'datasources/:id', name: 'datasource-detail', component: () => import('../views/DataSourceDetail.vue'), meta: { title: '数据源详情' } },
      { path: 'datasources/:id/builder', name: 'datasource-builder', component: () => import('../views/DataSourceBuilder.vue'), meta: { title: '数据集构建器' } },
      { path: 'datasets', name: 'datasets', component: () => import('../views/DatasetList.vue'), meta: { title: '数据管理' } },
      { path: 'datasets/new', name: 'dataset-upload', component: () => import('../views/DatasetUpload.vue'), meta: { title: '上传数据' } },
      { path: 'datasets/:id', name: 'dataset-detail', component: () => import('../views/DatasetDetail.vue'), meta: { title: '数据集详情' } },
      { path: 'charts', name: 'charts', component: () => import('../views/ChartList.vue'), meta: { title: '图表中心' } },
      { path: 'charts/new', name: 'chart-builder', component: () => import('../views/ChartBuilder.vue'), meta: { title: '构建图表' } },
      { path: 'charts/:id/edit', name: 'chart-edit', component: () => import('../views/ChartBuilder.vue'), meta: { title: '编辑图表' } },
      { path: 'dashboards', name: 'dashboards', component: () => import('../views/DashboardList.vue'), meta: { title: '看板中心' } },
      { path: 'dashboards/:id', name: 'dashboard-view', component: () => import('../views/DashboardView.vue'), meta: { title: '看板查看' } },
      { path: 'dashboards/:id/edit', name: 'dashboard-edit', component: () => import('../views/DashboardEditor.vue'), meta: { title: '编辑看板' } },
      { path: 'admin/users', name: 'admin-users', component: () => import('../views/admin/UserAdmin.vue'), meta: { title: '用户管理' } },
      { path: 'admin/roles', name: 'admin-roles', component: () => import('../views/admin/RoleAdmin.vue'), meta: { title: '角色管理' } },
      { path: 'admin/audit', name: 'admin-audit', component: () => import('../views/admin/AuditView.vue'), meta: { title: '操作审计' } },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
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

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · 看板低代码平台` : '看板低代码平台'
})

export default router