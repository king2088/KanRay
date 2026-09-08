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

/** 根据设置应用暗黑模式 + 主题色（写 CSS 变量到 documentElement） */
export function applyTheme(settings = {}) {
  const root = document.documentElement
  root.classList.toggle('dark', !!settings.dark)
  const p = settings.primaryColor || '#409eff'
  const vars = {
    '--el-color-primary': p,
    '--el-color-primary-light-3': mixColor(p, '#fff', 0.3),
    '--el-color-primary-light-5': mixColor(p, '#fff', 0.5),
    '--el-color-primary-light-7': mixColor(p, '#fff', 0.7),
    '--el-color-primary-light-8': mixColor(p, '#fff', 0.8),
    '--el-color-primary-light-9': mixColor(p, '#fff', 0.9),
    '--el-color-primary-dark-2': mixColor(p, '#000', 0.2),
    '--app-primary': p,
    '--app-primary-light': mixColor(p, '#fff', 0.9),
    '--app-primary-darker': mixColor(p, '#000', 0.1),
  }
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
}