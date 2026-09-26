// ECharts locale 映射守卫。locale 传错或漏传时 ECharts 不会报错，只会静默用中文，
// 所以这里把映射表钉死，并要求每个使用完整包 echarts 的图表都显式传 locale。
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_LOCALE, SUPPORT_LOCALES } from '../src/i18n/constants.js'
import { CHART_LOCALES, echartsLocaleOf } from '../src/utils/echarts-locale.js'

const SRC = fileURLToPath(new URL('../src/', import.meta.url))
const CHARTS = join(SRC, 'screen-designer/widgets/charts')

let failed = 0
function t(name, fn) {
  try {
    fn()
    console.log('  ok - ' + name)
  } catch (err) {
    failed++
    console.log('  FAIL - ' + name + ': ' + err.message)
  }
}
function eq(actual, expected, msg) {
  if (actual !== expected) throw new Error((msg || '') + ` 期望 ${expected}，实际 ${actual}`)
}

t('SUPPORT_LOCALES 每个语言都有 ECharts locale 映射', () => {
  for (const l of SUPPORT_LOCALES) {
    if (!CHART_LOCALES[l]) throw new Error(`缺少 ${l} 的映射`)
  }
})

t('echartsLocaleOf 按语言返回 ECharts 内置语言码', () => {
  eq(echartsLocaleOf('zh-CN'), 'ZH')
  eq(echartsLocaleOf('en-US'), 'EN')
})

t('未知语言回退到默认语言而不是 undefined', () => {
  eq(echartsLocaleOf('xx-XX'), CHART_LOCALES[DEFAULT_LOCALE])
  eq(echartsLocaleOf(undefined), CHART_LOCALES[DEFAULT_LOCALE])
  eq(echartsLocaleOf(''), CHART_LOCALES[DEFAULT_LOCALE])
})

t('useChartLocale 同时导出 currentEchartsLocale 与 useChartLocale', () => {
  const body = readFileSync(join(SRC, 'utils/useChartLocale.js'), 'utf8')
  if (!body.includes('export function currentEchartsLocale')) throw new Error('缺少 currentEchartsLocale')
  if (!body.includes('export function useChartLocale')) throw new Error('缺少 useChartLocale')
})

// 漏传 locale 是这套机制唯一会静默失效的方式，所以逐文件断言。
const files = readdirSync(CHARTS).filter((f) => f.endsWith('.vue'))
t('所有用完整包 echarts 的图表都显式传 locale', () => {
  const missing = []
  for (const f of files) {
    const body = readFileSync(join(CHARTS, f), 'utf8')
    if (!/import \* as echarts from 'echarts'/.test(body)) continue
    if (!/echarts\.init\([^)]*locale:\s*currentEchartsLocale\(\)/s.test(body)) {
      missing.push(f)
    }
  }
  if (missing.length) throw new Error('这些图表的 echarts.init 没传 locale: ' + missing.join(', '))
})

t('所有用完整包 echarts 的图表都注册了语言切换重建', () => {
  const missing = []
  for (const f of files) {
    const body = readFileSync(join(CHARTS, f), 'utf8')
    if (!/import \* as echarts from 'echarts'/.test(body)) continue
    if (!body.includes('useChartLocale(rebuildChart)')) missing.push(f)
  }
  if (missing.length) throw new Error('这些图表没有调用 useChartLocale: ' + missing.join(', '))
})

if (failed) {
  console.error(`echarts locale 测试：${failed} 项失败`)
  process.exit(1)
}
console.log('echarts locale 测试：全部通过')
