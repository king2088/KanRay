import http from './http'

function listPaged(url, page, pageSize) {
  return http.get(url, { params: { page, pageSize } })
}

export const datasetApi = {
  list: () => http.get('/datasets'),
  listPaged: (page, pageSize) => listPaged('/datasets', page, pageSize),
  get: (id) => http.get(`/datasets/${id}`),
  preview: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return http.post('/datasets/preview', fd, { timeout: 120000 })
  },
  create: (file, name) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('name', name)
    return http.post('/datasets', fd, { timeout: 120000 })
  },
  remove: (id) => http.delete(`/datasets/${id}`),
  rename: (id, name) => http.patch(`/datasets/${id}`, { name }),
  rows: (id, page, pageSize) => http.get(`/datasets/${id}/rows`, { params: { page, pageSize }, silent: true }),
  rowCounts: (ids) => http.post('/datasets/row-counts', { ids }, { silent: true }),
  updateFieldLabel: (id, fieldId, label) => http.patch(`/datasets/${id}/fields/${fieldId}`, { label }),
  query: (id, payload) => http.post(`/datasets/${id}/query`, payload),
}

export const metricApi = {
  list: (datasetId) => http.get(`/datasets/${datasetId}/metrics`),
  create: (datasetId, payload) => http.post(`/datasets/${datasetId}/metrics`, payload),
  update: (datasetId, id, payload) => http.put(`/datasets/${datasetId}/metrics/${id}`, payload),
  remove: (datasetId, id) => http.delete(`/datasets/${datasetId}/metrics/${id}`),
}

export const chartApi = {
  list: (params) => http.get('/charts', { params }),
  listPaged: (page, pageSize) => listPaged('/charts', page, pageSize),
  get: (id) => http.get(`/charts/${id}`),
  create: (payload) => http.post('/charts', payload),
  update: (id, payload) => http.patch(`/charts/${id}`, payload),
  remove: (id) => http.delete(`/charts/${id}`),
  data: (id, filters) => http.post(`/charts/${id}/data`, { filters }),
}

export const dashboardApi = {
  list: () => http.get('/dashboards'),
  listPaged: (page, pageSize) => listPaged('/dashboards', page, pageSize),
  get: (id) => http.get(`/dashboards/${id}`),
  create: (name) => http.post('/dashboards', { name }),
  update: (id, payload) => http.patch(`/dashboards/${id}`, payload),
  remove: (id) => http.delete(`/dashboards/${id}`),
  shares: (id) => http.get(`/dashboards/${id}/shares`),
  createShare: (id, payload) => http.post(`/dashboards/${id}/shares`, payload),
  updateShare: (shareId, payload) => http.patch(`/shares/${shareId}`, payload),
  deleteShare: (shareId) => http.delete(`/shares/${shareId}`),
}

export const authApi = {
  register: (payload) => http.post('/auth/register', payload),
  login: (payload) => http.post('/auth/login', payload),
  refresh: (payload) => http.post('/auth/refresh', payload),
  logout: () => http.post('/auth/logout'),
  me: () => http.get('/auth/me'),
  updateProfile: (payload) => http.patch('/auth/me', payload),
  changePassword: (payload) => http.put('/auth/password', payload),
}

export const adminApi = {
  users: (params) => http.get('/admin/users', { params }),
  createUser: (payload) => http.post('/admin/users', payload),
  updateUser: (id, payload) => http.patch(`/admin/users/${id}`, payload),
  deleteUser: (id) => http.delete(`/admin/users/${id}`),
  roles: () => http.get('/admin/roles'),
  createRole: (payload) => http.post('/admin/roles', payload),
  updateRole: (id, payload) => http.patch(`/admin/roles/${id}`, payload),
  deleteRole: (id) => http.delete(`/admin/roles/${id}`),
  permissions: () => http.get('/admin/permissions'),
  audit: (params) => http.get('/admin/audit', { params }),
}

export const datasourceApi = {
  drivers: () => http.get('/datasources/drivers'),
  list: () => http.get('/datasources'),
  listPaged: (page, pageSize) => listPaged('/datasources', page, pageSize),
  get: (id) => http.get(`/datasources/${id}`),
  create: (payload) => http.post('/datasources', payload),
  update: (id, payload) => http.patch(`/datasources/${id}`, payload),
  remove: (id) => http.delete(`/datasources/${id}`),
  test: (payload) => http.post('/datasources/test', payload),
  testSaved: (id) => http.post(`/datasources/${id}/test`),
  schemas: (id, params) => http.get(`/datasources/${id}/schemas`, { params }),
  tables: (id, schema, params) => http.get(`/datasources/${id}/schemas/${schema}/tables`, { params }),
  columns: (id, schema, table, params) => http.get(`/datasources/${id}/schemas/${schema}/tables/${table}/columns`, { params }),
  rows: (id, schema, table, params) => http.get(`/datasources/${id}/schemas/${schema}/tables/${table}/rows`, { params }),
  registerTable: (id, payload) => http.post(`/datasources/${id}/register-table`, payload),
}

export const syncApi = {
  list: (id) => http.get(`/datasources/${id}/sync-configs`),
  create: (id, body) => http.post(`/datasources/${id}/sync-configs`, body),
  update: (id, cid, body) => http.patch(`/datasources/${id}/sync-configs/${cid}`, body),
  remove: (id, cid) => http.delete(`/datasources/${id}/sync-configs/${cid}`),
  run: (id, cid) => http.post(`/datasources/${id}/sync-configs/${cid}/run`),
  logs: (id, cid) => http.get(`/datasources/${id}/sync-configs/${cid}/logs`),
}

export const buildApi = {
  sqlAssist: (dsId) => http.get(`/datasources/${dsId}/sql-assist`),
  previewDetail: (dsId, definition, limit = 200) => http.post(`/datasources/${dsId}/build/preview-detail`, { definition, limit }),
  previewAggregate: (dsId, definition, aggregation, limit = 1000) => http.post(`/datasources/${dsId}/build/preview-aggregate`, { definition, aggregation, limit }),
  previewNode: (dsId, definition, nodeId, limit = 200) => http.post(`/datasources/${dsId}/build/preview-node`, { definition, nodeId, limit }),
  save: (dsId, name, definition, datasetId) => http.post(`/datasources/${dsId}/build/save`, { name, definition, datasetId }),
  validate: (dsId, definition) => http.post(`/datasources/${dsId}/build/validate`, { definition }),
}

export const configApi = {
  get: () => http.get('/config'),
}
