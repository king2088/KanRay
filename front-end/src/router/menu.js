export const MENU_ITEMS = [
  { path: '/datasources', titleKey: 'layout.menu.items.datasources', icon: 'Coin' },
  { path: '/datasets', titleKey: 'layout.menu.items.datasets', icon: 'FolderOpened' },
  { path: '/charts', titleKey: 'layout.menu.items.charts', icon: 'PieChart' },
  { path: '/dashboards', titleKey: 'layout.menu.items.dashboards', icon: 'Odometer' },
  { path: '/big-screen', titleKey: 'layout.menu.items.bigScreens', icon: 'Monitor' },
  { path: '/forms', titleKey: 'layout.menu.items.forms', icon: 'Tickets' },
  { path: '/admin', titleKey: 'layout.menu.items.admin', icon: 'Setting' },
]

export const ADMIN_ITEMS = [
  { path: '/admin/users', titleKey: 'layout.menu.items.users', icon: 'User' },
  { path: '/admin/roles', titleKey: 'layout.menu.items.roles', icon: 'Avatar' },
  { path: '/admin/audit', titleKey: 'layout.menu.items.audit', icon: 'List' },
  { path: '/admin/open-api', titleKey: 'layout.menu.items.openApi', icon: 'Key' },
  { path: '/open/tokens', titleKey: 'layout.menu.items.tokens', icon: 'Lock' },
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
  if (path.startsWith('/big-screen')) return '/big-screen'
  if (path.startsWith('/forms')) return '/forms'
  return '/datasets'
}

export function groupOf(path) {
  return path.startsWith('/admin') || path.startsWith('/open') ? '/admin' : activeMenuOf(path)
}