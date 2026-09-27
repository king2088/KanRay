import { createI18n } from 'vue-i18n'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import elEn from 'element-plus/es/locale/lang/en'
import { DEFAULT_LOCALE, SUPPORT_LOCALES } from './constants.js'
import { pickLocaleText } from './locale-util.js'
import { setTranslator } from './translate.js'
import zhCNMessages from './locales/zh-CN/index.js'
import enUSMessages from './locales/en-US/index.js'

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  // 保持缺失键告警：i18n-keys-test 与浏览器控制台检查依赖它暴露漏译
  missingWarn: true,
  fallbackWarn: true,
  messages: {
    'zh-CN': zhCNMessages,
    'en-US': enUSMessages,
  },
})

// Element Plus 组件语言包映射
const EL_LOCALES = { 'zh-CN': zhCn, 'en-US': elEn }

// Monaco 编辑器语言 id 映射
const MONACO_LOCALES = { 'zh-CN': 'zh-cn', 'en-US': 'en' }

export function elLocaleOf(locale) {
  return EL_LOCALES[locale] || EL_LOCALES[DEFAULT_LOCALE]
}

export function monacoLocaleOf(locale) {
  return MONACO_LOCALES[locale] || MONACO_LOCALES[DEFAULT_LOCALE]
}

export function t(key, named) {
  return named === undefined ? i18n.global.t(key) : i18n.global.t(key, named)
}

// 键存在性判断，与 t 成对使用：先 te() 再 t()，未收录的键回退原值而不显示裸键名
export function te(key) {
  return i18n.global.te(key)
}

// 后端接口文案双字段取值，供 axios 拦截器集中使用
export function localizeApiMessage(textZh, textEn) {
  return pickLocaleText(i18n.global.locale.value, textZh, textEn)
}

// 语言切换的唯一副作用入口：vue-i18n locale + <html lang>。
// 组件库与页面标题各自 watch i18n.global.locale，不在此处耦合。
// 把真实翻译器注入纯模块：默认（未初始化）时它们读 zh-CN 词典
setTranslator(t)

export function applyLocale(locale) {
  const target = SUPPORT_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE
  i18n.global.locale.value = target
  if (typeof document !== 'undefined') document.documentElement.setAttribute('lang', target)
  return target
}
