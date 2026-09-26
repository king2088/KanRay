import { watch } from 'vue'
import { i18n } from '@/i18n'

// 语言切换时让 ECharts 图表重建。locale 在 init 时确定，setOption 改不了，
// 所以回调里必须 dispose 旧实例再 init（widget 自己的 initChart 里做）。
export function useChartLocale(rebuild) {
  watch(
    () => i18n.global.locale.value,
    () => {
      try {
        rebuild()
      } catch (err) {
        console.error('[i18n] 图表语言切换重建失败', err)
      }
    },
  )
}
