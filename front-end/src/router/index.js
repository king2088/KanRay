import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    component: () => import('../views/MainLayout.vue'),
    redirect: '/datasets',
    children: [
      { path: 'datasets', name: 'datasets', component: () => import('../views/DatasetList.vue'), meta: { title: '数据管理' } },
      { path: 'datasets/new', name: 'dataset-upload', component: () => import('../views/DatasetUpload.vue'), meta: { title: '上传数据' } },
      { path: 'datasets/:id', name: 'dataset-detail', component: () => import('../views/DatasetDetail.vue'), meta: { title: '数据集详情' } },
      { path: 'charts', name: 'charts', component: () => import('../views/ChartList.vue'), meta: { title: '图表中心' } },
      { path: 'charts/new', name: 'chart-builder', component: () => import('../views/ChartBuilder.vue'), meta: { title: '构建图表' } },
      { path: 'charts/:id/edit', name: 'chart-edit', component: () => import('../views/ChartBuilder.vue'), meta: { title: '编辑图表' } },
      { path: 'dashboards', name: 'dashboards', component: () => import('../views/DashboardList.vue'), meta: { title: '看板中心' } },
      { path: 'dashboards/:id', name: 'dashboard-view', component: () => import('../views/DashboardView.vue'), meta: { title: '看板查看' } },
      { path: 'dashboards/:id/edit', name: 'dashboard-edit', component: () => import('../views/DashboardEditor.vue'), meta: { title: '编辑看板' } },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · 看板低代码平台` : '看板低代码平台'
})

export default router