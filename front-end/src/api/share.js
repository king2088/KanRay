import axios from 'axios'
import { ElMessage } from 'element-plus'
import { localizeApiMessage, t } from '@/i18n'
import { markToasted } from './error-toast.js'

export const SHARE_TOKEN_KEY = 'kanban_share_token'

const shareHttp = axios.create({ baseURL: '/api/public/shares', timeout: 60000 })

shareHttp.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(SHARE_TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

shareHttp.interceptors.response.use(
  (res) => {
    const body = res.data
    if (body && body.code === 0) return body.data
    // 公开分享走独立 axios 实例，不经过 http.js 拦截器，所以 messageEn 要在这里自己取；
    // 兜底走 i18n 键而不是硬编码中文，否则英文界面直接弹出「请求失败」。
    return Promise.reject(new Error(localizeApiMessage(body?.message, body?.messageEn) || t('common.http.requestFailed')))
  },
  (err) => {
    const { response } = err
    if (response?.status === 401) sessionStorage.removeItem(SHARE_TOKEN_KEY)
    const msg = localizeApiMessage(response?.data?.message, response?.data?.messageEn) || err?.message || t('common.http.networkError')
    const failure = new Error(msg)
    if (!(response?.status === 401)) {
      ElMessage.error(msg)
      markToasted(failure)
    }
    return Promise.reject(failure)
  },
)

export const shareApi = {
  meta: (token) => shareHttp.get(`/${token}/meta`),
  verify: (token, password) => shareHttp.post(`/${token}/verify`, { password }),
  dashboard: (token) => shareHttp.get(`/${token}/dashboard`),
  chartData: (token, chartId, filters = []) => shareHttp.post(`/${token}/charts/${chartId}/data`, { filters }),
}

export default shareHttp