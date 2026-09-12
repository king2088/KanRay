export const MENU_ITEMS = [
  { path: '/datasets', title: '数据管理', icon: 'FolderOpened' },
  { path: '/charts', title: '图表中心', icon: 'PieChart' },
  { path: '/dashboards', title: '看板中心', icon: 'Odometer' },
]

export const ADMIN_ITEMS = [
  { path: '/admin/users', title: '用户管理', icon: 'User' },
  { path: '/admin/roles', title: '角色管理', icon: 'Avatar' },
  { path: '/admin/audit', title: '操作审计', icon: 'List' },
]

export const ADMIN_PERMISSION_OF = {
  '/admin/users': 'user:read',
  '/admin/roles': 'role:read',
  '/admin/audit': 'audit:read',
}

export function visibleAdminMenus(auth) {
  return ADMIN_ITEMS.filter((m) => (auth.user?.permissions || []).includes(ADMIN_PERMISSION_OF[m.path]))
}

export function activeMenuOf(path) {
  if (path.startsWith('/admin')) return path
  if (path.startsWith('/dashboards')) return '/dashboards'
  if (path.startsWith('/charts')) return '/charts'
  return '/datasets'
}