import http from './http'

export const OPEN_SCOPES = ['chart:read', 'dataset:read', 'dashboard:read']

export const openApiAdminApi = {
  list: (params) => http.get('/admin/api-keys', { params }),
  create: (payload) => http.post('/admin/api-keys', payload),
  update: (id, payload) => http.patch(`/admin/api-keys/${id}`, payload),
  rotate: (id) => http.post(`/admin/api-keys/${id}/rotate`),
  remove: (id) => http.delete(`/admin/api-keys/${id}`),
}

export const tokenApi = {
  list: () => http.get('/auth/tokens'),
  create: (payload) => http.post('/auth/tokens', payload),
  update: (id, payload) => http.patch(`/auth/tokens/${id}`, payload),
  rotate: (id) => http.post(`/auth/tokens/${id}/rotate`),
  remove: (id) => http.delete(`/auth/tokens/${id}`),
}