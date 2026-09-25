import axios from 'axios'
import { ElMessage } from 'element-plus'
import { pinia } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import { topLoading } from '@/utils/top-loading'

const http = axios.create({ baseURL: '/api', timeout: 60000 })

http.interceptors.request.use((config) => {
  const store = useAuthStore(pinia)
  if (store.accessToken) config.headers.Authorization = `Bearer ${store.accessToken}`
  topLoading.start()
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
    topLoading.done()
    const body = res.data
    if (body && body.code === 0) return body.data
    const msg = body?.message || '请求失败'
    if (!res.config?.silent) ElMessage.error(msg)
    return Promise.reject(new Error(msg))
  },
  async (err) => {
    topLoading.done()
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

const TTL_DEFAULT = 5000
const inflight = new Map()
const cache = new Map()

function cacheKey(config) {
  let params = ''
  let body = ''
  try { params = JSON.stringify(config.params || {}) } catch { /* ignore */ }
  if (config.data !== undefined) {
    try { body = JSON.stringify(config.data) } catch { /* ignore */ }
  }
  return `${(config.method || 'get').toUpperCase()}|${config.url}|${params}|${body}`
}

async function request(config) {
  const key = cacheKey(config)
  const isGet = (config.method || 'get').toUpperCase() === 'GET'
  const cacheMs = isGet && config.cache ? (config.cache === true ? TTL_DEFAULT : config.cache) : 0

  if (cacheMs) {
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at >= cacheMs) cache.delete(key)
    if (hit && Date.now() - hit.at < cacheMs) return hit.data
  }

  const pending = inflight.get(key)
  if (pending) {
    topLoading.start()
    return pending.finally(() => topLoading.done())
  }

  const p = http.request(config).then((data) => {
    if (cacheMs) cache.set(key, { at: Date.now(), data })
    return data
  })
  const tracked = p.finally(() => inflight.delete(key))
  inflight.set(key, tracked)
  return tracked
}

const proxied = (config) => request(config)
proxied.defaults = http.defaults
proxied.interceptors = http.interceptors
for (const m of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']) {
  proxied[m] = (url, config) => request({ ...config, url, method: m })
}

export default proxied