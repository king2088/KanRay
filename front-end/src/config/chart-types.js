// 图表类型定义（9大类 60+ 种）
export const CHART_CATEGORIES = [
  { key: 'bar', label: '柱形图' },
  { key: 'horizontalBar', label: '条形图' },
  { key: 'line', label: '折线图与面积图' },
  { key: 'pie', label: '饼图与漏斗图' },
  { key: 'scatter', label: '气泡图与散点图' },
  { key: 'indicator', label: '指标与进度' },
  { key: 'map', label: '地图' },
  { key: 'table', label: '表格' },
  { key: 'other', label: '其他' },
]

export const CHART_TYPES = [
  // 柱形图
  { value: 'bar', label: '单柱图', icon: 'Histogram', category: 'bar', needsGroup: false },
  { value: 'barClustered', label: '簇状柱形图', icon: 'Histogram', category: 'bar', needsGroup: true },
  { value: 'barStacked', label: '堆积柱形图', icon: 'Histogram', category: 'bar', needsGroup: true },
  { value: 'barLine', label: '簇状+折线', icon: 'Histogram', category: 'bar', needsGroup: true },
  { value: 'barPictorial', label: '簇状+符号', icon: 'Histogram', category: 'bar', needsGroup: true },
  { value: 'barPercentStacked', label: '百分比堆积', icon: 'Histogram', category: 'bar', needsGroup: true },
  { value: 'barGroupStacked', label: '分组堆积', icon: 'Histogram', category: 'bar', needsGroup: true },
  { value: 'barStackedLine', label: '堆积+折线', icon: 'Histogram', category: 'bar', needsGroup: true },
  { value: 'barStackedPictorial', label: '堆积+符号', icon: 'Histogram', category: 'bar', needsGroup: true },
  { value: 'bullet', label: '子弹图', icon: 'Histogram', category: 'bar', needsGroup: false },
  { value: 'waterfall', label: '瀑布图', icon: 'Histogram', category: 'bar', needsGroup: false },
  { value: 'pareto', label: '帕累托图', icon: 'Histogram', category: 'bar', needsGroup: false },

  // 条形图
  { value: 'horizontalBar', label: '单条图', icon: 'Menu', category: 'horizontalBar', needsGroup: false },
  { value: 'horizontalBarClustered', label: '簇状条形图', icon: 'Menu', category: 'horizontalBar', needsGroup: true },
  { value: 'horizontalBarStacked', label: '堆积条形图', icon: 'Menu', category: 'horizontalBar', needsGroup: true },
  { value: 'horizontalBarPercentStacked', label: '百分比堆积', icon: 'Menu', category: 'horizontalBar', needsGroup: true },
  { value: 'horizontalBarGroupStacked', label: '分组堆积', icon: 'Menu', category: 'horizontalBar', needsGroup: true },
  { value: 'horizontalBullet', label: '子弹图', icon: 'Menu', category: 'horizontalBar', needsGroup: false },
  { value: 'butterfly', label: '蝴蝶图', icon: 'Menu', category: 'horizontalBar', needsGroup: true },

  // 折线图与面积图
  { value: 'line', label: '单线图', icon: 'TrendCharts', category: 'line', needsGroup: false },
  { value: 'lineMulti', label: '多线图', icon: 'TrendCharts', category: 'line', needsGroup: true },
  { value: 'areaStacked', label: '堆积面积图', icon: 'TrendCharts', category: 'line', needsGroup: true },
  { value: 'areaPercentStacked', label: '百分比堆积面积', icon: 'TrendCharts', category: 'line', needsGroup: true },

  // 饼图与漏斗图
  { value: 'pie', label: '饼图', icon: 'PieChart', category: 'pie', needsGroup: false },
  { value: 'doughnut', label: '环形图', icon: 'Odometer', category: 'pie', needsGroup: false },
  { value: 'sunburst', label: '旭日图', icon: 'PieChart', category: 'pie', needsGroup: false },
  { value: 'nightingale', label: '南丁格尔玫瑰图', icon: 'PieChart', category: 'pie', needsGroup: false },
  { value: 'funnel', label: '漏斗图', icon: 'Filter', category: 'pie', needsGroup: false },
  { value: 'funnelHorizontal', label: '水平漏斗图', icon: 'Filter', category: 'pie', needsGroup: false },

  // 气泡图与散点图
  { value: 'scatter', label: '散点图', icon: 'Aim', category: 'scatter', needsGroup: false },
  { value: 'bubble', label: '气泡图', icon: 'Aim', category: 'scatter', needsGroup: false },

  // 指标与进度
  { value: 'stat', label: '指标卡', icon: 'DataLine', category: 'indicator', needsGroup: false },
  { value: 'progressBar', label: '进度条', icon: 'DataLine', category: 'indicator', needsGroup: false },
  { value: 'circularProgress', label: '圆形进度条', icon: 'DataLine', category: 'indicator', needsGroup: false },
  { value: 'multiRingProgress', label: '多环进度条', icon: 'DataLine', category: 'indicator', needsGroup: false },
  { value: 'fluidProgress', label: '流体进度条', icon: 'DataLine', category: 'indicator', needsGroup: false },
  { value: 'gauge', label: '填充仪表板', icon: 'Odometer', category: 'indicator', needsGroup: false },
  { value: 'statTrend', label: '指标趋势图', icon: 'TrendCharts', category: 'indicator', needsGroup: false },

  // 地图
  { value: 'mapChina', label: '中国行政区地图', icon: 'Location', category: 'map', needsGroup: false },
  { value: 'mapChinaBubble', label: '气泡行政区地图', icon: 'Location', category: 'map', needsGroup: false },
  { value: 'mapChinaSymbol', label: '符号行政地图', icon: 'Location', category: 'map', needsGroup: false },
  { value: 'mapWorld', label: '世界地图', icon: 'Location', category: 'map', needsGroup: false },

  // 表格
  { value: 'table', label: '表格', icon: 'Grid', category: 'table', needsGroup: false },

  // 其他
  { value: 'heatmap', label: '热力图', icon: 'Sunny', category: 'other', needsGroup: false },
  { value: 'boxplot', label: '箱线图', icon: 'Box', category: 'other', needsGroup: false },
  { value: 'radar', label: '雷达图', icon: 'Odometer', category: 'other', needsGroup: false },
  { value: 'polarBar', label: '极坐标图', icon: 'Odometer', category: 'other', needsGroup: false },
  { value: 'barBreakAxis', label: '断轴柱状图', icon: 'Histogram', category: 'other', needsGroup: false },
  { value: 'calendar', label: '日历图', icon: 'Calendar', category: 'other', needsGroup: false },
  { value: 'candlestick', label: 'K线图', icon: 'TrendCharts', category: 'other', needsGroup: false },
  { value: 'treemap', label: '矩形树图', icon: 'Grid', category: 'other', needsGroup: false },
  { value: 'sankey', label: '桑基图', icon: 'Share', category: 'other', needsGroup: false },
  { value: 'chord', label: '和弦图', icon: 'Share', category: 'other', needsGroup: false },
]

export const getChartType = (v) => CHART_TYPES.find((t) => t.value === v) || CHART_TYPES[0]

export const getChartTypesByCategory = (category) =>
  CHART_TYPES.filter((t) => t.category === category)

// 特殊图表类型需要特殊字段映射
export const SPECIAL_FIELD_NEEDS = {
  // 需要 2 维 3 指标 (X, Y, Z) 的图表
  heatmap: { x: '维度', y: '维度', value: '指标' },
  // 需要 3 指标 (开, 高, 低, 收) 的图表
  candlestick: { time: '维度', open: '指标', high: '指标', low: '指标', close: '指标' },
  // 需要 2 维度 + 1 指标的图表（来源-目标-值）
  sankey: { source: '维度', target: '维度', value: '指标' },
  chord: { source: '维度', target: '维度', value: '指标' },
  // 需要区域名称维度 + 数值指标的图表
  mapChina: { region: '维度', value: '指标' },
  mapChinaBubble: { region: '维度', value: '指标' },
  mapChinaSymbol: { region: '维度', value: '指标' },
  mapWorld: { region: '维度', value: '指标' },
  // 需要时间维度 + 数值指标的图表
  calendar: { date: '维度', value: '指标' },
  statTrend: { date: '维度', value: '指标' },
  // 箱线图需要数值字段（自动计算分位数）
  boxplot: { category: '维度', value: '指标' },
  // 散点图/气泡图需要 X 维度 + Y 数值
  scatter: { x: '维度', y: '指标' },
  bubble: { x: '维度', y: '指标' },
}
