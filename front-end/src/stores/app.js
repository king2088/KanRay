import { defineStore } from 'pinia'
import { applyTheme, darkByMode, watchSystemTheme } from '@/utils/theme'
import { configApi } from '@/api'

const KEY = 'kanban-app-settings'
const THEME_MODES = ['light', 'dark', 'auto']
const DEFAULTS = { layout: 'horizontal', collapsed: false, themeMode: 'light', primaryColor: '#409eff', size: 'default', timezone: 'Asia/Shanghai' }

let unwatchAuto = null

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}')
    let themeMode = 'light'
    if (THEME_MODES.includes(s.themeMode)) themeMode = s.themeMode
    else if (s.dark === true) themeMode = 'dark'
    return { ...DEFAULTS, ...s, dark: undefined, themeMode }
  } catch (e) {
    return { ...DEFAULTS }
  }
}

export const useAppStore = defineStore('app', {
  state: () => load(),
  actions: {
    persist() {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          layout: this.layout,
          collapsed: this.collapsed,
          themeMode: this.themeMode,
          primaryColor: this.primaryColor,
          size: this.size,
        }),
      )
    },
    applyCurTheme() {
      applyTheme({ dark: darkByMode(this.themeMode), primaryColor: this.primaryColor })
      this.syncAutoWatch()
    },
    // 自动模式：系统外观变化时实时切换，无需刷新
    syncAutoWatch() {
      if (this.themeMode !== 'auto') {
        if (unwatchAuto) {
          unwatchAuto()
          unwatchAuto = null
        }
        return
      }
      if (unwatchAuto) return
      unwatchAuto = watchSystemTheme((dark) =>
        applyTheme({ dark, primaryColor: this.primaryColor }),
      )
    },
    applyInitial() {
      this.applyCurTheme()
    },
    // 从后端拉取系统配置（时区等），失败时回退默认值，不阻塞渲染
    async loadConfig() {
      try {
        const cfg = await configApi.get()
        if (cfg?.timezone) this.timezone = cfg.timezone
      } catch (e) {
        /* 回退默认值 */
      }
    },
    setLayout(v) {
      this.layout = v
      if (v !== 'vertical') this.collapsed = false
      this.persist()
    },
    toggleCollapsed() {
      this.collapsed = !this.collapsed
      this.persist()
    },
    setThemeMode(v) {
      if (!THEME_MODES.includes(v)) return
      this.themeMode = v
      this.applyCurTheme()
      this.persist()
    },
    setPrimaryColor(v) {
      this.primaryColor = v
      this.applyCurTheme()
      this.persist()
    },
    setSize(v) {
      if (!['large', 'default', 'small'].includes(v)) return
      this.size = v
      this.persist()
    },
  },
})