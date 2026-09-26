// 图表类型定义（9大类 60+ 种）
export const CHART_CATEGORIES = [
  { key: 'bar', labelKey: 'chart.categories.bar' },
  { key: 'horizontalBar', labelKey: 'chart.categories.horizontalBar' },
  { key: 'line', labelKey: 'chart.categories.line' },
  { key: 'pie', labelKey: 'chart.categories.pie' },
  { key: 'scatter', labelKey: 'chart.categories.scatter' },
  { key: 'indicator', labelKey: 'chart.categories.indicator' },
  { key: 'map', labelKey: 'chart.categories.map' },
  { key: 'table', labelKey: 'chart.categories.table' },
  { key: 'other', labelKey: 'chart.categories.other' },
]

export const CHART_TYPES = [
  // 柱形图
  { value: 'bar', labelKey: 'chart.types.bar', icon: 'Histogram', category: 'bar', needsGroup: false },
  { value: 'barClustered', labelKey: 'chart.types.barClustered', icon: 'Histogram', category: 'bar', needsGroup: true },
  { value: 'barStacked', labelKey: 'chart.types.barStacked', icon: 'Histogram', category: 'bar', needsGroup: true },
  { value: 'barLine', labelKey: 'chart.types.barLine', icon: 'Histogram', category: 'bar', needsGroup: true },
  { value: 'barPictorial', labelKey: 'chart.types.barPictorial', icon: 'Histogram', category: 'bar', needsGroup: true },
  { value: 'barPercentStacked', labelKey: 'chart.types.barPercentStacked', icon: 'Histogram', category: 'bar', needsGroup: true },
  { value: 'barGroupStacked', labelKey: 'chart.types.barGroupStacked', icon: 'Histogram', category: 'bar', needsGroup: true },
  { value: 'barStackedLine', labelKey: 'chart.types.barStackedLine', icon: 'Histogram', category: 'bar', needsGroup: true },
  { value: 'barStackedPictorial', labelKey: 'chart.types.barStackedPictorial', icon: 'Histogram', category: 'bar', needsGroup: true },
  { value: 'bullet', labelKey: 'chart.types.bullet', icon: 'Histogram', category: 'bar', needsGroup: false },
  { value: 'waterfall', labelKey: 'chart.types.waterfall', icon: 'Histogram', category: 'bar', needsGroup: false },
  { value: 'pareto', labelKey: 'chart.types.pareto', icon: 'Histogram', category: 'bar', needsGroup: false },

  // 条形图
  { value: 'horizontalBar', labelKey: 'chart.types.horizontalBar', icon: 'Menu', category: 'horizontalBar', needsGroup: false },
  { value: 'horizontalBarClustered', labelKey: 'chart.types.horizontalBarClustered', icon: 'Menu', category: 'horizontalBar', needsGroup: true },
  { value: 'horizontalBarStacked', labelKey: 'chart.types.horizontalBarStacked', icon: 'Menu', category: 'horizontalBar', needsGroup: true },
  { value: 'horizontalBarPercentStacked', labelKey: 'chart.types.horizontalBarPercentStacked', icon: 'Menu', category: 'horizontalBar', needsGroup: true },
  { value: 'horizontalBarGroupStacked', labelKey: 'chart.types.horizontalBarGroupStacked', icon: 'Menu', category: 'horizontalBar', needsGroup: true },
  { value: 'horizontalBullet', labelKey: 'chart.types.horizontalBullet', icon: 'Menu', category: 'horizontalBar', needsGroup: false },
  { value: 'butterfly', labelKey: 'chart.types.butterfly', icon: 'Menu', category: 'horizontalBar', needsGroup: true },

  // 折线图与面积图
  { value: 'line', labelKey: 'chart.types.line', icon: 'TrendCharts', category: 'line', needsGroup: false },
  { value: 'lineMulti', labelKey: 'chart.types.lineMulti', icon: 'TrendCharts', category: 'line', needsGroup: true },
  { value: 'areaStacked', labelKey: 'chart.types.areaStacked', icon: 'TrendCharts', category: 'line', needsGroup: true },
  { value: 'areaPercentStacked', labelKey: 'chart.types.areaPercentStacked', icon: 'TrendCharts', category: 'line', needsGroup: true },

  // 饼图与漏斗图
  { value: 'pie', labelKey: 'chart.types.pie', icon: 'PieChart', category: 'pie', needsGroup: false },
  { value: 'doughnut', labelKey: 'chart.types.doughnut', icon: 'Odometer', category: 'pie', needsGroup: false },
  { value: 'sunburst', labelKey: 'chart.types.sunburst', icon: 'PieChart', category: 'pie', needsGroup: false },
  { value: 'nightingale', labelKey: 'chart.types.nightingale', icon: 'PieChart', category: 'pie', needsGroup: false },
  { value: 'funnel', labelKey: 'chart.types.funnel', icon: 'Filter', category: 'pie', needsGroup: false },
  { value: 'funnelHorizontal', labelKey: 'chart.types.funnelHorizontal', icon: 'Filter', category: 'pie', needsGroup: false },

  // 气泡图与散点图
  { value: 'scatter', labelKey: 'chart.types.scatter', icon: 'Aim', category: 'scatter', needsGroup: false },
  { value: 'bubble', labelKey: 'chart.types.bubble', icon: 'Aim', category: 'scatter', needsGroup: false },

  // 指标与进度
  { value: 'stat', labelKey: 'chart.types.stat', icon: 'DataLine', category: 'indicator', needsGroup: false },
  { value: 'progressBar', labelKey: 'chart.types.progressBar', icon: 'DataLine', category: 'indicator', needsGroup: false },
  { value: 'circularProgress', labelKey: 'chart.types.circularProgress', icon: 'DataLine', category: 'indicator', needsGroup: false },
  { value: 'multiRingProgress', labelKey: 'chart.types.multiRingProgress', icon: 'DataLine', category: 'indicator', needsGroup: false },
  { value: 'fluidProgress', labelKey: 'chart.types.fluidProgress', icon: 'DataLine', category: 'indicator', needsGroup: false },
  { value: 'gauge', labelKey: 'chart.types.gauge', icon: 'Odometer', category: 'indicator', needsGroup: false },
  { value: 'statTrend', labelKey: 'chart.types.statTrend', icon: 'TrendCharts', category: 'indicator', needsGroup: false },

  // 地图
  { value: 'mapChina', labelKey: 'chart.types.mapChina', icon: 'Location', category: 'map', needsGroup: false },
  { value: 'mapChinaBubble', labelKey: 'chart.types.mapChinaBubble', icon: 'Location', category: 'map', needsGroup: false },
  { value: 'mapChinaSymbol', labelKey: 'chart.types.mapChinaSymbol', icon: 'Location', category: 'map', needsGroup: false },
  { value: 'mapWorld', labelKey: 'chart.types.mapWorld', icon: 'Location', category: 'map', needsGroup: false },

  // 表格
  { value: 'table', labelKey: 'chart.types.table', icon: 'Grid', category: 'table', needsGroup: false },

  // 其他
  { value: 'heatmap', labelKey: 'chart.types.heatmap', icon: 'Sunny', category: 'other', needsGroup: false },
  { value: 'boxplot', labelKey: 'chart.types.boxplot', icon: 'Box', category: 'other', needsGroup: false },
  { value: 'radar', labelKey: 'chart.types.radar', icon: 'Odometer', category: 'other', needsGroup: false },
  { value: 'polarBar', labelKey: 'chart.types.polarBar', icon: 'Odometer', category: 'other', needsGroup: false },
  { value: 'barBreakAxis', labelKey: 'chart.types.barBreakAxis', icon: 'Histogram', category: 'other', needsGroup: false },
  { value: 'calendar', labelKey: 'chart.types.calendar', icon: 'Calendar', category: 'other', needsGroup: false },
  { value: 'candlestick', labelKey: 'chart.types.candlestick', icon: 'TrendCharts', category: 'other', needsGroup: false },
  { value: 'treemap', labelKey: 'chart.types.treemap', icon: 'Grid', category: 'other', needsGroup: false },
  { value: 'sankey', labelKey: 'chart.types.sankey', icon: 'Share', category: 'other', needsGroup: false },
  { value: 'chord', labelKey: 'chart.types.chord', icon: 'Share', category: 'other', needsGroup: false },
]

export const getChartType = (v) => CHART_TYPES.find((t) => t.value === v) || CHART_TYPES[0]

export const getChartTypesByCategory = (category) =>
  CHART_TYPES.filter((t) => t.category === category)
