// ECharts 内置文案（tooltip 的「无数据」、图例、数据视图等）不受 vue-i18n 影响，
// 只能在 init 时通过 opts.locale 指定，且切换语言必须 dispose 后重建。
//
// 本模块只做「应用 locale -> ECharts 语言包 id」的纯映射，不 import echarts：
// screen-designer/widgets 下的 widget 用的是完整包 `import * as echarts from 'echarts'`
// （不走 utils/echarts.js 的按需引入 shim），若从 shim 取该函数会把 core 的注册
// 副作用带进每个 widget。纯函数单独成模块，两边共用同一份映射。
import { DEFAULT_LOCALE } from '@/i18n/constants'

// 完整包已内置 ZH / EN 语言包，无需 registerLocale。
export const CHART_LOCALES = { 'zh-CN': 'ZH', 'en-US': 'EN' }

export function echartsLocaleOf(locale) {
  return CHART_LOCALES[locale] || CHART_LOCALES[DEFAULT_LOCALE]
}
