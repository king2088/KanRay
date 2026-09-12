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

http.interceptors.response.use(
  (res) => {
    const body = res.data
    if (body && body.code === 0) return body.data
    const msg = body?.message || '请求失败'
    ElMessage.error(msg)
    return Promise.reject(new Error(msg))
  },
  async (err) => {
    const { response, config } = err
    if (!response) {
      ElMessage.error(err?.message || '网络错误')
      return Promise.reject(err)
    }
    const body = response.data
    // 401：尝试用 refresh 重放一次（auth 端点除外，避免 /auth/refresh 失败无限重试）
    if (response.status === 401 && !config._retried && !/\/auth\/(login|register|refresh)$/.test(config.url)) {
      const ok = await tryRefreshOnce()
      if (ok) {
        config._retried = true
        const store = useAuthStore(pinia)
        config.headers.Authorization = `Bearer ${store.accessToken}`
        try { return await http(config) } catch (e2) { /* 继续向下 */ }
      } else {
        useAuthStore(pinia).clear()
        if (window.location.pathname !== '/login') window.location.href = '/login'
        return Promise.reject(new Error('登录已失效'))
      }
    }
    ElMessage.error(body?.message || `请求失败 (${response.status})`)
    return Promise.reject(err)
  }
)

export default http