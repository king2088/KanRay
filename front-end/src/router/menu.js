export const MENU_ITEMS = [
  { path: '/datasets', title: '数据管理', icon: 'FolderOpened' },
  { path: '/charts', title: '图表中心', icon: 'PieChart' },
  { path: '/dashboards', title: '看板中心', icon: 'Odometer' },
]

export function activeMenuOf(path) {
  if (path.startsWith('/dashboards')) return '/dashboards'
  if (path.startsWith('/charts')) return '/charts'
  return '/datasets'
}