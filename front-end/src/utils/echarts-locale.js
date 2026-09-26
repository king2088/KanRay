import { DEFAULT_LOCALE } from '../i18n/constants.js'

// 完整包已内置 ZH / EN 语言包，无需 registerLocale。
// 这里只用相对导入，保持本模块可被 node 测试直接引入（不依赖 @/ 别名与 Vue）。
export const CHART_LOCALES = { 'zh-CN': 'ZH', 'en-US': 'EN' }

export function echartsLocaleOf(locale) {
  return CHART_LOCALES[locale] || CHART_LOCALES[DEFAULT_LOCALE]
}
