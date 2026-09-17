export const MENU_ITEMS = [
  { path: '/datasources', title: '数据源', icon: 'Coin' },
  { path: '/datasets', title: '数据集', icon: 'FolderOpened' },
  { path: '/charts', title: '图表中心', icon: 'PieChart' },
  { path: '/dashboards', title: '看板中心', icon: 'Odometer' },
  { path: '/admin', title: '系统管理', icon: 'Setting' },
]

export const ADMIN_ITEMS = [
  { path: '/admin/users', title: '用户管理', icon: 'User' },
  { path: '/admin/roles', title: '角色管理', icon: 'Avatar' },
  { path: '/admin/audit', title: '操作审计', icon: 'List' },
  { path: '/admin/open-api', title: '开放 API', icon: 'Key' },
  { path: '/open/tokens', title: '访问令牌', icon: 'Lock' },
]

export const ADMIN_PERMISSION_OF = {
  '/admin/users': 'user:read',
  '/admin/roles': 'role:read',
  '/admin/audit': 'audit:read',
  '/admin/open-api': 'apikey:manage',
}

export const OPEN_SETTINGS = ['/open/tokens']

export function visibleAdminMenus(auth) {
  return ADMIN_ITEMS.filter((m) =>
    OPEN_SETTINGS.includes(m.path) ? !!auth.user : (auth.user?.permissions || []).includes(ADMIN_PERMISSION_OF[m.path])
  )
}

export function visibleMenus(auth) {
  return MENU_ITEMS.filter((m) => m.path !== '/admin' || visibleAdminMenus(auth).length).map((m) =>
    m.path === '/admin' ? { ...m, children: visibleAdminMenus(auth) } : { ...m, children: [] }
  )
}

export function activeMenuOf(path) {
  if (path.startsWith('/admin') || path.startsWith('/open')) return path
  if (path.startsWith('/datasources')) return '/datasources'
  if (path.startsWith('/dashboards')) return '/dashboards'
  if (path.startsWith('/charts')) return '/charts'
  return '/datasets'
}

export function groupOf(path) {
  return path.startsWith('/admin') || path.startsWith('/open') ? '/admin' : activeMenuOf(path)
}