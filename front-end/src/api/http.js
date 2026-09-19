import axios from 'axios'
import { ElMessage } from 'element-plus'
import { pinia } from '@/stores'
import { useAuthStore } from '@/stores/auth'

const http = axios.create({ baseURL: '/api', timeout: 60000 })

http.interceptors.request.use((config) => {
  const store = useAuthStore(pinia)
  if (store.accessToken) config.headers.Authorization = `Bearer ${store.accessToken}`
  return config
})

let refreshing = null
async function tryRefreshOnce() {
  if (!refreshing) {
    refreshing = (async () => {
      const store = useAuthStore(pinia)
      const ok = await store.refresh()
      return ok
    })().finally(() => { refreshing = null })
  }
  return refreshing
}

const AUTH_ENDPOINT = /\/auth\/(login|register|refresh)$/

function forceLogout() {
  const store = useAuthStore(pinia)
  store.clear()
  if (window.location.pathname !== '/login') {
    window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`
  }
}

http.interceptors.response.use(
  (res) => {
    const body = res.data
    if (body && body.code === 0) return body.data
    const msg = body?.message || '请求失败'
    if (!res.config?.silent) ElMessage.error(msg)
    return Promise.reject(new Error(msg))
  },
  async (err) => {
    const { response, config } = err
    if (!response) {
      if (!config?.silent) ElMessage.error(err?.message || '网络错误')
      return Promise.reject(err)
    }
    const body = response.data
    // 401：先尝试用 refresh 重放一次（login/register/refresh 端点除外，避免失败时自循环）
    if (response.status === 401 && !AUTH_ENDPOINT.test(config?.url || '')) {
      if (!config._retried) {
        config._retried = true
        const ok = await tryRefreshOnce()
        if (ok) {
          const store = useAuthStore(pinia)
          config.headers.Authorization = `Bearer ${store.accessToken}`
          try {
            return await http(config)
          } catch (e2) {
            if (e2?.response?.status === 401) {
              forceLogout()
              return Promise.reject(new Error('登录已失效'))
            }
            throw e2
          }
        }
      }
      // 走到这里 = refresh 不可用/失败，或重放后仍 401：会话不可恢复
      forceLogout()
      return Promise.reject(new Error('登录已失效'))
    }
    if (!config?.silent) ElMessage.error(body?.message || `请求失败 (${response.status})`)
    return Promise.reject(err)
  }
)

export default http