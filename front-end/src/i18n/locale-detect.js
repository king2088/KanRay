// 浏览器语言检测与设置持久化决策。纯函数，无副作用、无 Vue/Pinia 依赖，
// 以便 front-end/scripts/i18n-locale-detect-test.mjs 在 node 下直接验证。
//
// 之所以把决策从 stores/app.js 抽出来：app.js 依赖 `@/utils/theme`、`@/api`、`@/i18n`，
// 仓库现有测试脚本全部用相对路径 import 且只测零 `@/` 依赖的纯叶子模块，
// app.js 在纯 node 脚本里无法 import。抽成纯函数后，「locale 不落盘」这一
// 最隐蔽的行为可被自动断言，而非只能手点浏览器验证。

import { SUPPORT_LOCALES, DEFAULT_LOCALE, UNKNOWN_LOCALE_FALLBACK } from './constants.js'

// 主语言标签 → 受支持 locale。由 SUPPORT_LOCALES 自动派生，新增语言无需改本文件。
// 同一主标签出现多个受支持 locale 时取声明顺序靠前者，保证结果确定。
const BY_PRIMARY = (() => {
  const map = new Map()
  for (const locale of SUPPORT_LOCALES) {
    const primary = locale.split('-')[0].toLowerCase()
    if (!map.has(primary)) map.set(primary, locale)
  }
  return map
})()

function primaryOf(tag) {
  return String(tag).split('-')[0].toLowerCase()
}

/**
 * 标签列表 → 受支持的 locale，全不命中返回 null（不擅自兜底，兜底交给调用方）。
 * 按列表顺序尝试，第一个命中的即返回，保证用户首选语言优先。
 * 逐项规则：完整标签精确匹配（大小写不敏感）→ 主语言标签匹配。
 */
export function matchLocale(tags) {
  if (!Array.isArray(tags)) return null
  for (const raw of tags) {
    if (typeof raw !== 'string') continue
    const tag = raw.trim().toLowerCase()
    if (!tag) continue
    const exact = SUPPORT_LOCALES.find((l) => l.toLowerCase() === tag)
    if (exact) return exact
    const byPrimary = BY_PRIMARY.get(primaryOf(tag))
    if (byPrimary) return byPrimary
  }
  return null
}

/**
 * 浏览器语言 → 最终 locale。两级兜底刻意不同：
 * - 有语言但不命中受支持项 → UNKNOWN_LOCALE_FALLBACK（英文）
 * - 完全拿不到语言信息 → DEFAULT_LOCALE（中文）
 * nav 可注入，便于测试；未注入时读取全局 navigator。
 */
export function detectInitialLocale(nav) {
  const source =
    nav !== undefined ? nav : typeof navigator !== 'undefined' ? navigator : null
  const tags = []
  if (source) {
    // languages 为有序数组且不含 q 权重，优先于单个 language
    if (Array.isArray(source.languages)) tags.push(...source.languages)
    if (typeof source.language === 'string') tags.push(source.language)
  }
  // 空串/空白不是"一种语言"：必须在判断兜底前剔除，
  // 否则 language: '' 会被误判为"检测到但不支持"而落到英文，而不是中文。
  const usable = tags.filter((t) => typeof t === 'string' && t.trim())
  const hit = matchLocale(usable)
  if (hit) return hit
  return usable.length ? UNKNOWN_LOCALE_FALLBACK : DEFAULT_LOCALE
}

/**
 * localStorage 原始字符串 → 合法 locale，无则 null（null 表示"用户未明确选择过"）。
 */
export function resolveStoredLocale(raw) {
  if (typeof raw !== 'string' || !raw) return null
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const locale = parsed.locale
  return SUPPORT_LOCALES.includes(locale) ? locale : null
}

/**
 * 组装落盘对象。locale 仅在用户明确手选过（includeLocale）时携带，
 * 否则自动检测的结果会在下一次访问被误当成"用户选择"而永久冻结检测。
 */
export function buildSettingsPayload(state, includeLocale) {
  const payload = {
    layout: state.layout,
    collapsed: state.collapsed,
    themeMode: state.themeMode,
    primaryColor: state.primaryColor,
    size: state.size,
  }
  if (includeLocale) payload.locale = state.locale
  return payload
}
