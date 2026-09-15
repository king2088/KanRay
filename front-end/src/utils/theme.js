function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
}

function toHex(n) {
  return Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')
}

/** 把基色与 target(#ffffff/#000000) 按 amount 混合 */
export function mixColor(hex, target, amount) {
  const t = hexToRgb(target === '#000' || target === '#000000' ? '#000000' : '#ffffff')
  const c = hexToRgb(hex || '#409eff')
  return `#${toHex(c.r + (t.r - c.r) * amount)}${toHex(c.g + (t.g - c.g) * amount)}${toHex(c.b + (t.b - c.b) * amount)}`
}

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : false
}

/** 根据主题模式解析是否暗黑：auto 跟随系统 */
export function darkByMode(mode, fallback = false) {
  if (mode === 'dark') return true
  if (mode === 'light') return fallback
  return systemPrefersDark()
}

/** 监听系统外观变化，返回取消监听函数 */
export function watchSystemTheme(onChange) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mql = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => onChange(mql.matches)
  if (typeof mql.addEventListener === 'function') mql.addEventListener('change', handler)
  else mql.addListener(handler)
  return () => {
    if (typeof mql.removeEventListener === 'function') mql.removeEventListener('change', handler)
    else mql.removeListener(handler)
  }
}

/** 根据设置应用暗黑模式 + 主题色（写 CSS 变量到 documentElement） */
export function applyTheme(settings = {}) {
  const root = document.documentElement
  root.classList.toggle('dark', !!settings.dark)
  const p = settings.primaryColor || '#409eff'
  const dark = !!settings.dark
  // 暗黑模式下浅色/选中态应按"掺黑"生成，避免出现白色底色
  const mix = (fraction) => mixColor(p, dark ? '#000' : '#fff', fraction)
  const vars = {
    '--el-color-primary': p,
    '--el-color-primary-light-3': mix(0.3),
    '--el-color-primary-light-5': mix(0.5),
    '--el-color-primary-light-7': mix(0.7),
    '--el-color-primary-light-8': mix(0.8),
    '--el-color-primary-light-9': mix(0.9),
    '--el-color-primary-dark-2': mixColor(p, '#000', 0.2),
    '--app-primary': p,
    '--app-primary-light': dark ? mixColor(p, '#000', 0.85) : mixColor(p, '#fff', 0.9),
    '--app-primary-darker': mixColor(p, '#000', 0.1),
  }
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
}