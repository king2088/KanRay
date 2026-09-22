import axios from 'axios'
import { ElMessage } from 'element-plus'

export const BIG_SCREEN_SHARE_TOKEN_KEY = 'kanray_big_screen_share_token'

const bigScreenShareHttp = axios.create({ baseURL: '/api/public/big-screens', timeout: 60000 })

bigScreenShareHttp.interceptors.request.use((config) => {
  const t = localStorage.getItem(BIG_SCREEN_SHARE_TOKEN_KEY)
  if (t) config.headers.Authorization = `Bearer ${t}`
  return config
})

bigScreenShareHttp.interceptors.response.use(
  (res) => {
    const body = res.data
    if (body && body.code === 0) return body.data
    return Promise.reject(new Error(body?.message || '请求失败'))
  },
  (err) => {
    const { response } = err
    if (response?.status === 401) localStorage.removeItem(BIG_SCREEN_SHARE_TOKEN_KEY)
    const msg = response?.data?.message || err?.message || '网络错误'
    if (!(response?.status === 401)) ElMessage.error(msg)
    return Promise.reject(new Error(msg))
  },
)

export const bigScreenShareApi = {
  meta: (token) => bigScreenShareHttp.get(`/${token}/meta`),
  verify: (token, password) => bigScreenShareHttp.post(`/${token}/verify`, { password }),
  screen: (token) => bigScreenShareHttp.get(`/${token}/screen`),
}

export function saveBigScreenShareToken(token) {
  if (typeof window === 'undefined') return
  localStorage.setItem(BIG_SCREEN_SHARE_TOKEN_KEY, token)
}

export function clearBigScreenShareToken() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(BIG_SCREEN_SHARE_TOKEN_KEY)
}

export default bigScreenShareHttp