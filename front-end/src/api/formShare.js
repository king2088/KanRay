import axios from 'axios'
import { ElMessage } from 'element-plus'

export const FORM_SHARE_TOKEN_KEY = 'kanban_form_share_token'

const formShareHttp = axios.create({ baseURL: '/api/public/forms', timeout: 60000 })

formShareHttp.interceptors.request.use((config) => {
  const t = sessionStorage.getItem(FORM_SHARE_TOKEN_KEY)
  if (t) config.headers.Authorization = `Bearer ${t}`
  return config
})

formShareHttp.interceptors.response.use(
  (res) => {
    const body = res.data
    if (body && body.code === 0) return body.data
    return Promise.reject(new Error(body?.message || '请求失败'))
  },
  (err) => {
    const { response } = err
    if (response?.status === 401) sessionStorage.removeItem(FORM_SHARE_TOKEN_KEY)
    const msg = response?.data?.message || err?.message || '网络错误'
    if (!(response?.status === 401)) ElMessage.error(msg)
    return Promise.reject(new Error(msg))
  },
)

export const formShareApi = {
  meta: (token) => formShareHttp.get(`/${token}/meta`),
  verify: (token, password) => formShareHttp.post(`/${token}/verify`, { password }),
  form: (token) => formShareHttp.get(`/${token}/form`),
  submit: (token, values) => formShareHttp.post(`/${token}/submissions`, { values }),
}

export default formShareHttp