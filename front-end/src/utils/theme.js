function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
}

function toHex(n) {
  return Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')
}

function rgbToHex({ r, g, b }) {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function rgbaStr(hex, a) {
  const c = hexToRgb(hex)
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`
}

function rgbToHsl({ r, g, b }) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  return { h, s, l }
}

function hslToRgb({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
}

/** 把 hex 的色相偏移 deg 度后再向 base(#fff/#000) 混入 amount */
function shiftHueMix(hex, deg, base, amount) {
  const { h, s, l } = rgbToHsl(hexToRgb(hex))
  const shifted = hslToRgb({ h: (((h + deg) % 360) + 360) % 360, s, l })
  return mixColor(rgbToHex(shifted), base, amount)
}

function radial(hex, alpha, w, h, x, y) {
  return `radial-gradient(${w}px ${h}px at ${x}% ${y}%, ${rgbaStr(hex, alpha)}, transparent 60%)`
}

/** 根据主题色生成玻璃背底：顶部色彩带（透过头部的磨砂） + 四处柔和水彩晕染 */
export function buildBgImage(primary, dark) {
  const base = dark ? '#000' : '#fff'
  const band = [
    shiftHueMix(primary, -3, base, dark ? 0.52 : 0.26),
    shiftHueMix(primary, 14, base, dark ? 0.58 : 0.42),
    shiftHueMix(primary, 34, base, dark ? 0.62 : 0.55),
  ]
  const topBand = dark
    ? `linear-gradient(180deg, ${rgbaStr(band[0], 0.46)} 0, ${rgbaStr(band[1], 0.34)} 46px, ${rgbaStr(band[2], 0.26)} 92px, transparent 140px)`
    : `linear-gradient(180deg, ${rgbaStr(band[0], 0.52)} 0, ${rgbaStr(band[1], 0.4)} 46px, ${rgbaStr(band[2], 0.32)} 92px, transparent 150px)`
  const washes = [
    radial(shiftHueMix(primary, -6, base, dark ? 0.6 : 0.66), dark ? 0.2 : 0.18, 1120, 640, 12, -8),
    radial(shiftHueMix(primary, 30, base, dark ? 0.62 : 0.64), dark ? 0.18 : 0.16, 920, 600, 96, 3),
    radial(shiftHueMix(primary, 155, base, dark ? 0.7 : 0.72), dark ? 0.13 : 0.13, 1000, 700, 78, 108),
    radial(shiftHueMix(primary, 62, base, dark ? 0.66 : 0.68), dark ? 0.12 : 0.14, 720, 480, 8, 96),
  ]
  return [topBand, ...washes].join(',\n    ')
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
    // 玻璃背底跟随主题色：顶部磨砂色彩带 + 水彩晕染
    '--app-bg-image': buildBgImage(p, dark),
    '--app-tint-primary': rgbaStr(p, dark ? 0.16 : 0.14),
  }
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
}