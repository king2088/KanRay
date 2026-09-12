import { defineStore } from 'pinia'
import { authApi } from '@/api'

const TOKEN_KEY = 'kanban_access'
const USER_KEY = 'kanban_user'
const REFRESH_KEY = 'kanban_refresh'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: localStorage.getItem(TOKEN_KEY) || '',
    refreshToken: localStorage.getItem(REFRESH_KEY) || '',
    user: JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
  }),
  getters: {
    isLoggedIn: (s) => !!s.accessToken,
    permissions: (s) => s.user?.permissions || [],
  },
  actions: {
    hasPermission(resource, action) {
      return this.user?.permissions?.includes(`${resource}:${action}`) || false
    },
    persist() {
      localStorage.setItem(TOKEN_KEY, this.accessToken)
      localStorage.setItem(REFRESH_KEY, this.refreshToken)
      localStorage.setItem(USER_KEY, JSON.stringify(this.user))
    },
    clear() {
      this.accessToken = ''
      this.refreshToken = ''
      this.user = null
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(REFRESH_KEY)
      localStorage.removeItem(USER_KEY)
    },
    setSession({ accessToken, refreshToken, user }) {
      this.accessToken = accessToken
      this.refreshToken = refreshToken
      user.permissions = user.permissions || []
      this.user = user
      this.persist()
    },
    async login(email, password) {
      const r = await authApi.login({ email, password })
      this.setSession(r)
      return r.user
    },
    async register(payload) {
      return authApi.register(payload)
    },
    async logout() {
      try { await authApi.logout() } catch (e) { /* ignore */ }
      this.clear()
    },
    async refresh() {
      if (!this.refreshToken) return false
      try {
        const r = await authApi.refresh({ refreshToken: this.refreshToken })
        this.setSession(r)
        return true
      } catch (e) {
        this.clear()
        return false
      }
    },
    async me() {
      const u = await authApi.me()
      u.permissions = u.permissions || []
      this.user = u
      localStorage.setItem(USER_KEY, JSON.stringify(u))
      return u
    },
  },
})