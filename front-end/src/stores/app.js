import { defineStore } from 'pinia'
import { applyTheme, darkByMode, watchSystemTheme } from '@/utils/theme'
import { configApi } from '@/api'
import { applyLocale } from '@/i18n'
import { DEFAULT_LOCALE, SUPPORT_LOCALES } from '@/i18n/constants'
import {
  buildSettingsPayload,
  detectInitialLocale,
  resolveStoredLocale,
} from '@/i18n/locale-detect'

const KEY = 'kanban-app-settings'
const THEME_MODES = ['light', 'dark', 'auto']
const DEFAULTS = { layout: 'horizontal', collapsed: false, themeMode: 'light', primaryColor: '#3fa49a', size: 'default', timezone: 'Asia/Shanghai', locale: DEFAULT_LOCALE }

// 浅色玻璃主题的出厂主色；旧版本默认蓝视为"未做选择"，加载时迁到新主色
const LEGACY_DEFAULT_PRIMARY = '#409eff'
const NEW_DEFAULT_PRIMARY = '#3fa49a'

let unwatchAuto = null

// 当前 locale 是否由用户手动选定。模块级闭包：既不进 Pinia state，也不落盘。
// 落盘策略见 buildSettingsPayload —— 自动检测出的 locale 一律不写，
// 否则用户仅改主题就会把检测结果固化成"用户选择"，自动检测随之永久失效。
let localeExplicit = false

function load() {
  let raw = null
  try {
    raw = localStorage.getItem(KEY)
  } catch (e) {
    /* localStorage 不可用（隐私模式等）：按未保存处理 */
  }
  // 已落盘的合法 locale 视为用户明确选择（含旧版本写入的既有偏好，不予覆盖）
  const stored = resolveStoredLocale(raw)
  localeExplicit = stored !== null
  try {
    const s = JSON.parse(raw || '{}')
    if (s.primaryColor === LEGACY_DEFAULT_PRIMARY) s.primaryColor = NEW_DEFAULT_PRIMARY
    let themeMode = 'light'
    if (THEME_MODES.includes(s.themeMode)) themeMode = s.themeMode
    else if (s.dark === true) themeMode = 'dark'
    if (!SUPPORT_LOCALES.includes(s.locale)) s.locale = DEFAULT_LOCALE
    const merged = { ...DEFAULTS, ...s, dark: undefined, themeMode }
    if (!localeExplicit) merged.locale = detectInitialLocale()
    return merged
  } catch (e) {
    const fallback = { ...DEFAULTS }
    if (!localeExplicit) fallback.locale = detectInitialLocale()
    return fallback
  }
}

export const useAppStore = defineStore('app', {
  state: () => load(),
  actions: {
    persist() {
      localStorage.setItem(KEY, JSON.stringify(buildSettingsPayload(this, localeExplicit)))
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
      applyLocale(this.locale)
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
    setLocale(v) {
      if (!SUPPORT_LOCALES.includes(v)) return
      this.locale = applyLocale(v)
      // 手动选定后才允许落盘，此后浏览器语言变化不再覆盖用户选择
      localeExplicit = true
      this.persist()
    },
  },
})