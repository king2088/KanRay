import { defineAsyncComponent } from 'vue'

export const componentRegistry: Record<string, any> = {
  // === Charts - Bar (竖排柱形图) ===
  'bar-single': defineAsyncComponent(() => import('../../widgets/charts/BarChart.vue')),
  'bar-group': defineAsyncComponent(() => import('../../widgets/charts/BarChart.vue')),
  'bar-stack': defineAsyncComponent(() => import('../../widgets/charts/BarStackedChart.vue')),
  'bar-line': defineAsyncComponent(() => import('../../widgets/charts/BarLineMixChart.vue')),
  'bar-group-stacked': defineAsyncComponent(() => import('../../widgets/charts/BarStackedChart.vue')),
  'bar-percent': defineAsyncComponent(() => import('../../widgets/charts/BarStackedChart.vue')),
  'bar-waterfall': defineAsyncComponent(() => import('../../widgets/charts/WaterfallChart.vue')),

  // === Charts - Horizontal Bar (横排条形图) ===
  'bar-horizontal': defineAsyncComponent(() => import('../../widgets/charts/HorizontalBarChart.vue')),
  'bar-horizontal-group': defineAsyncComponent(() => import('../../widgets/charts/HorizontalBarGroupChart.vue')),
  'bar-horizontal-stack': defineAsyncComponent(() => import('../../widgets/charts/HorizontalBarStackChart.vue')),
  'bar-horizontal-percent': defineAsyncComponent(() => import('../../widgets/charts/HorizontalBarStackChart.vue')),
  'bar-horizontal-mixed': defineAsyncComponent(() => import('../../widgets/charts/HorizontalBarChart.vue')),

  // === Charts - Line (折线图与面积图) ===
  'line-single': defineAsyncComponent(() => import('../../widgets/charts/LineChart.vue')),
  'line-multi': defineAsyncComponent(() => import('../../widgets/charts/LineChart.vue')),
  'line-area': defineAsyncComponent(() => import('../../widgets/charts/LineChart.vue')),
  'line-smooth': defineAsyncComponent(() => import('../../widgets/charts/LineChart.vue')),
  'line-percent-area': defineAsyncComponent(() => import('../../widgets/charts/PercentAreaChart.vue')),
  'line-step': defineAsyncComponent(() => import('../../widgets/charts/LineStepChart.vue')),

  // === Charts - Pie (饼图) ===
  'pie': defineAsyncComponent(() => import('../../widgets/charts/PieChart.vue')),
  'pie-doughnut': defineAsyncComponent(() => import('../../widgets/charts/PieChart.vue')),
  'pie-rose': defineAsyncComponent(() => import('../../widgets/charts/PieChart.vue')),
  'pie-sunburst': defineAsyncComponent(() => import('../../widgets/charts/PieSunburstChart.vue')),
  'pie-treemap': defineAsyncComponent(() => import('../../widgets/charts/TreemapChart.vue')),
  'funnel': defineAsyncComponent(() => import('../../widgets/charts/FunnelChart.vue')),
  'funnel-horizontal': defineAsyncComponent(() => import('../../widgets/charts/FunnelHorizontalChart.vue')),

  // === Charts - Other (其他图表) ===
  'radar': defineAsyncComponent(() => import('../../widgets/charts/RadarChart.vue')),
  'scatter': defineAsyncComponent(() => import('../../widgets/charts/ScatterChart.vue')),
  'bubble': defineAsyncComponent(() => import('../../widgets/charts/ScatterChart.vue')),
  'progress': defineAsyncComponent(() => import('../../widgets/charts/ProgressBar.vue')),
  'number-flip': defineAsyncComponent(() => import('../../widgets/text/NumberFlip.vue')),
  'heatmap': defineAsyncComponent(() => import('../../widgets/charts/HeatmapChart.vue')),
  'wordcloud': defineAsyncComponent(() => import('../../widgets/charts/WordCloudChart.vue')),
  'boxplot': defineAsyncComponent(() => import('../../widgets/charts/BoxplotChart.vue')),
  'sankey': defineAsyncComponent(() => import('../../widgets/charts/SankeyChart.vue')),
  'calendar': defineAsyncComponent(() => import('../../widgets/charts/CalendarChart.vue')),
  'candlestick': defineAsyncComponent(() => import('../../widgets/charts/CandlestickChart.vue')),
  'stacked-area': defineAsyncComponent(() => import('../../widgets/charts/StackedAreaChart.vue')),
  'mixed-positive-negative': defineAsyncComponent(() => import('../../widgets/charts/MixedPositiveNegativeChart.vue')),
  'polar-bar': defineAsyncComponent(() => import('../../widgets/charts/PolarBarChart.vue')),
  'positive-negative-bar': defineAsyncComponent(() => import('../../widgets/charts/PositiveNegativeBarChart.vue')),
  'dynamic-bar-race': defineAsyncComponent(() => import('../../widgets/charts/DynamicBarRaceChart.vue')),
  'geo-map': defineAsyncComponent(() => import('../../widgets/charts/GeographicMapChart.vue')),

  // === Charts - Gauge (仪表盘，10种) ===
  'gauge': defineAsyncComponent(() => import('../../widgets/charts/GaugeChart.vue')),
  'gauge-speed': defineAsyncComponent(() => import('../../widgets/charts/GaugeChart.vue')),
  'gauge-stage': defineAsyncComponent(() => import('../../widgets/charts/GaugeChart.vue')),
  'gauge-level': defineAsyncComponent(() => import('../../widgets/charts/GaugeChart.vue')),
  'gauge-multi-title': defineAsyncComponent(() => import('../../widgets/charts/GaugeChart.vue')),
  'gauge-temp': defineAsyncComponent(() => import('../../widgets/charts/GaugeChart.vue')),
  'gauge-score': defineAsyncComponent(() => import('../../widgets/charts/GaugeChart.vue')),
  'gauge-pressure': defineAsyncComponent(() => import('../../widgets/charts/GaugeChart.vue')),
  'gauge-clock': defineAsyncComponent(() => import('../../widgets/charts/GaugeChart.vue')),
  'gauge-car': defineAsyncComponent(() => import('../../widgets/charts/GaugeChart.vue')),
  'gauge-multi': defineAsyncComponent(() => import('../../widgets/charts/GaugeChart.vue')),
  'liquid-fill': defineAsyncComponent(() => import('../../widgets/charts/GaugeChart.vue')),

  // === Tables (表格组件) ===
  'table-normal': defineAsyncComponent(() => import('../../widgets/charts/TableChart.vue')),
  'carousel-list': defineAsyncComponent(() => import('../../widgets/charts/CarouselListChart.vue')),
  'rank-list': defineAsyncComponent(() => import('../../widgets/charts/RankListChart.vue')),

  // === Text (文本组件) ===
  'static-text': defineAsyncComponent(() => import('../../widgets/text/StaticText.vue')),
  'data-text': defineAsyncComponent(() => import('../../widgets/text/DataText.vue')),
  'time-text': defineAsyncComponent(() => import('../../widgets/text/TimeText.vue')),
  'marquee-text': defineAsyncComponent(() => import('../../widgets/text/MarqueeText.vue')),

  // === Media (媒体组件) ===
  'static-image': defineAsyncComponent(() => import('../../widgets/media/StaticImage.vue')),
  'carousel-image': defineAsyncComponent(() => import('../../widgets/media/CarouselImage.vue')),
  'video': defineAsyncComponent(() => import('../../widgets/media/VideoWidget.vue')),

  // === iframe ===
  'iframe': defineAsyncComponent(() => import('../../widgets/iframe/IframeWidget.vue')),

  // === DataV边框 (13种，匹配官方@jiaminghi/data-view) ===
  'dv-border-1': defineAsyncComponent(() => import('../../widgets/datav-border/DvBorder1.vue')),
  'dv-border-2': defineAsyncComponent(() => import('../../widgets/datav-border/DvBorder2.vue')),
  'dv-border-3': defineAsyncComponent(() => import('../../widgets/datav-border/DvBorder3.vue')),
  'dv-border-4': defineAsyncComponent(() => import('../../widgets/datav-border/DvBorder4.vue')),
  'dv-border-5': defineAsyncComponent(() => import('../../widgets/datav-border/DvBorder5.vue')),
  'dv-border-6': defineAsyncComponent(() => import('../../widgets/datav-border/DvBorder6.vue')),
  'dv-border-7': defineAsyncComponent(() => import('../../widgets/datav-border/DvBorder7.vue')),
  'dv-border-8': defineAsyncComponent(() => import('../../widgets/datav-border/DvBorder8.vue')),
  'dv-border-9': defineAsyncComponent(() => import('../../widgets/datav-border/DvBorder9.vue')),
  'dv-border-10': defineAsyncComponent(() => import('../../widgets/datav-border/DvBorder10.vue')),
  'dv-border-11': defineAsyncComponent(() => import('../../widgets/datav-border/DvBorder11.vue')),
  'dv-border-12': defineAsyncComponent(() => import('../../widgets/datav-border/DvBorder12.vue')),
  'dv-border-13': defineAsyncComponent(() => import('../../widgets/datav-border/DvBorder13.vue')),

  // === DataV装饰 (12种，匹配官方@jiaminghi/data-view) ===
  'dv-decoration-1': defineAsyncComponent(() => import('../../widgets/datav-decoration/DvDecoration1.vue')),
  'dv-decoration-2': defineAsyncComponent(() => import('../../widgets/datav-decoration/DvDecoration2.vue')),
  'dv-decoration-3': defineAsyncComponent(() => import('../../widgets/datav-decoration/DvDecoration3.vue')),
  'dv-decoration-4': defineAsyncComponent(() => import('../../widgets/datav-decoration/DvDecoration4.vue')),
  'dv-decoration-5': defineAsyncComponent(() => import('../../widgets/datav-decoration/DvDecoration5.vue')),
  'dv-decoration-6': defineAsyncComponent(() => import('../../widgets/datav-decoration/DvDecoration6.vue')),
  'dv-decoration-7': defineAsyncComponent(() => import('../../widgets/datav-decoration/DvDecoration7.vue')),
  'dv-decoration-8': defineAsyncComponent(() => import('../../widgets/datav-decoration/DvDecoration8.vue')),
  'dv-decoration-9': defineAsyncComponent(() => import('../../widgets/datav-decoration/DvDecoration9.vue')),
  'dv-decoration-10': defineAsyncComponent(() => import('../../widgets/datav-decoration/DvDecoration10.vue')),
  'dv-decoration-11': defineAsyncComponent(() => import('../../widgets/datav-decoration/DvDecoration11.vue')),
  'dv-decoration-12': defineAsyncComponent(() => import('../../widgets/datav-decoration/DvDecoration12.vue')),

  // === Small Widgets (小组件) ===
  'countdown': defineAsyncComponent(() => import('../../widgets/small/CountdownWidget.vue')),
  'clock': defineAsyncComponent(() => import('../../widgets/small/ClockWidget.vue')),
  'steps': defineAsyncComponent(() => import('../../widgets/small/StepsWidget.vue')),

  // === Custom (自定义) ===
  'custom-chart': defineAsyncComponent(() => import('../../widgets/custom/CustomChart.vue')),

  // === Maps (地图) ===
  'map-china': defineAsyncComponent(() => import('../../widgets/charts/ChinaMap.vue')),
  'map-bubble': defineAsyncComponent(() => import('../../widgets/charts/BubbleMap.vue')),

  // === 3D (三维组件) ===
  'globe-3d': defineAsyncComponent(() => import('../../widgets/basic/Globe3D.vue')),
}

export const getComponent = (type: string) => {
  return componentRegistry[type] || null
}
