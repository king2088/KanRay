import axios from 'axios'
import { ElMessage } from 'element-plus'

export const SHARE_TOKEN_KEY = 'kanban_share_token'

const shareHttp = axios.create({ baseURL: '/api/public/shares', timeout: 60000 })

shareHttp.interceptors.request.use((config) => {
  const t = sessionStorage.getItem(SHARE_TOKEN_KEY)
  if (t) config.headers.Authorization = `Bearer ${t}`
  return config
})

shareHttp.interceptors.response.use(
  (res) => {
    const body = res.data
    if (body && body.code === 0) return body.data
    return Promise.reject(new Error(body?.message || '请求失败'))
  },
  (err) => {
    const { response } = err
    if (response?.status === 401) sessionStorage.removeItem(SHARE_TOKEN_KEY)
    const msg = response?.data?.message || err?.message || '网络错误'
    if (!(response?.status === 401)) ElMessage.error(msg)
    return Promise.reject(new Error(msg))
  },
)

export const shareApi = {
  meta: (token) => shareHttp.get(`/${token}/meta`),
  verify: (token, password) => shareHttp.post(`/${token}/verify`, { password }),
  dashboard: (token) => shareHttp.get(`/${token}/dashboard`),
  chartData: (token, chartId, filters = []) => shareHttp.post(`/${token}/charts/${chartId}/data`, { filters }),
}

export default shareHttp