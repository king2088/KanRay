import axios from 'axios'
import { ElMessage } from 'element-plus'
import { localizeApiMessage, t } from '@/i18n'
import { markToasted } from './error-toast.js'

export const FORM_SHARE_TOKEN_KEY = 'kanban_form_share_token'

const formShareHttp = axios.create({ baseURL: '/api/public/forms', timeout: 60000 })

formShareHttp.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(FORM_SHARE_TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

formShareHttp.interceptors.response.use(
  (res) => {
    const body = res.data
    if (body && body.code === 0) return body.data
    // 公开分享走独立 axios 实例，不经过 http.js 拦截器，所以 messageEn 要在这里自己取；
    // 兜底走 i18n 键而不是硬编码中文，否则英文界面直接弹出「请求失败」。
    return Promise.reject(new Error(localizeApiMessage(body?.message, body?.messageEn) || t('common.http.requestFailed')))
  },
  (err) => {
    const { response } = err
    if (response?.status === 401) sessionStorage.removeItem(FORM_SHARE_TOKEN_KEY)
    const msg = localizeApiMessage(response?.data?.message, response?.data?.messageEn) || err?.message || t('common.http.networkError')
    const failure = new Error(msg)
    if (!(response?.status === 401)) {
      ElMessage.error(msg)
      markToasted(failure)
    }
    return Promise.reject(failure)
  },
)

export const formShareApi = {
  meta: (token) => formShareHttp.get(`/${token}/meta`),
  verify: (token, password) => formShareHttp.post(`/${token}/verify`, { password }),
  form: (token) => formShareHttp.get(`/${token}/form`),
  submit: (token, values) => formShareHttp.post(`/${token}/submissions`, { values }),
}

export default formShareHttp