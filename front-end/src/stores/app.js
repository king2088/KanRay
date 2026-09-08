import { defineStore } from 'pinia'
import { applyTheme } from '@/utils/theme'

const KEY = 'kanban-app-settings'
const DEFAULTS = { layout: 'vertical', collapsed: false, dark: false, primaryColor: '#409eff' }

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
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
          dark: this.dark,
          primaryColor: this.primaryColor,
        }),
      )
    },
    applyInitial() {
      applyTheme({ dark: this.dark, primaryColor: this.primaryColor })
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
    toggleDark() {
      this.dark = !this.dark
      applyTheme({ dark: this.dark, primaryColor: this.primaryColor })
      this.persist()
    },
    setPrimaryColor(v) {
      this.primaryColor = v
      applyTheme({ dark: this.dark, primaryColor: v })
      this.persist()
    },
  },
})