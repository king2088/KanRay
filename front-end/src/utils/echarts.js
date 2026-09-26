import { i18n } from '@/i18n'

// 按需引入 ECharts 6.x，减小打包体积
import * as echarts from 'echarts/core'
import {
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  GaugeChart,
  FunnelChart,
  RadarChart,
  BoxplotChart,
  CandlestickChart,
  HeatmapChart,
  TreemapChart,
  SankeyChart,
  MapChart,
  GraphChart,
  PictorialBarChart,
  CustomChart,
  SunburstChart,
  ChordChart,
} from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  VisualMapComponent,
  GeoComponent,
  DatasetComponent,
  TransformComponent,
  ToolboxComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkPointComponent,
  MarkAreaComponent,
  GraphicComponent,
  CalendarComponent,
  PolarComponent,
  AriaComponent,
} from 'echarts/components'
import { LabelLayout, UniversalTransition } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import 'echarts/i18n/langZH'
import 'echarts/i18n/langEN'

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  GaugeChart,
  FunnelChart,
  RadarChart,
  BoxplotChart,
  CandlestickChart,
  HeatmapChart,
  TreemapChart,
  SankeyChart,
  MapChart,
  GraphChart,
  PictorialBarChart,
  CustomChart,
  SunburstChart,
  ChordChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  VisualMapComponent,
  GeoComponent,
  DatasetComponent,
  TransformComponent,
  ToolboxComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkPointComponent,
  MarkAreaComponent,
  GraphicComponent,
  CalendarComponent,
  PolarComponent,
  AriaComponent,
  LabelLayout,
  UniversalTransition,
  CanvasRenderer,
])

// ECharts 语言在 init 时按注册 id 确定，切换语言需重建实例。
// 不传 locale 时 ECharts 默认使用 ZH，与改造前行为一致。
// 映射表与 widget 共用同一份，见 echarts-locale.js。
// 注意：这里必须先 import 再单独 export。`export { x } from '...'`
// 只是转发，不会把 x 引入本模块作用域，createChart 里用不到。
import { echartsLocaleOf } from '@/utils/echarts-locale'

export { echartsLocaleOf }

export function createChart(el, theme) {
  return echarts.init(el, theme, { locale: echartsLocaleOf(i18n.global.locale.value) })
}

export default echarts
