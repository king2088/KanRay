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
  rows: (id, page, pageSize) => http.get(`/datasets/${id}/rows`, { params: { page, pageSize } }),
  updateFieldLabel: (id, fieldId, label) => http.patch(`/datasets/${id}/fields/${fieldId}`, { label }),
  query: (id, payload) => http.post(`/datasets/${id}/query`, payload),
}

export const chartApi = {
  list: () => http.get('/charts'),
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
}