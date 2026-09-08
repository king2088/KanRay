// 图表类型定义（第一阶段支持）
export const CHART_TYPES = [
  { value: 'bar', label: '柱状图', icon: 'Histogram' },
  { value: 'line', label: '折线图', icon: 'TrendCharts' },
  { value: 'pie', label: '饼图', icon: 'PieChart' },
  { value: 'doughnut', label: '环形图', icon: 'Odometer' },
  { value: 'horizontalBar', label: '条形图', icon: 'Menu' },
  { value: 'table', label: '表格', icon: 'Grid' },
  { value: 'stat', label: '数值统计卡', icon: 'DataLine' },
]

export const AGG_OPTIONS = [
  { value: 'sum', label: '求和' },
  { value: 'avg', label: '平均值' },
  { value: 'count', label: '计数' },
  { value: 'count_distinct', label: '去重计数' },
  { value: 'max', label: '最大值' },
  { value: 'min', label: '最小值' },
]

export const PALETTE = [
  '#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399',
  '#8E44AD', '#16A085', '#E74C3C', '#2C3E50', '#D35400',
]

export const getChartType = (v) => CHART_TYPES.find((t) => t.value === v) || CHART_TYPES[0]

// 将聚合结果渲染为 ECharts option
export function toEChartsOption(chartType, data, options = {}) {
  const { dimensions, metrics, rows } = data
  const dim = dimensions[0] // 第一维度作为分类轴
  const groupDim = dimensions[1] // 第二维度作为系列（可选）
  const metric = metrics[0]

  if (!dim || !metric || !rows || rows.length === 0) {
    return { title: { text: '暂无数据', left: 'center', top: 'middle', textStyle: { color: '#909399' } } }
  }

  const title = options.title ? { text: options.title, left: 'center' } : undefined

  // 系列维度分组
  const groups = {}
  if (groupDim) {
    rows.forEach((r) => {
      const g = r[groupDim.field]
      if (!groups[g]) groups[g] = []
      groups[g].push(r)
    })
  } else {
    groups['__all__'] = rows
  }

  const catValues = groupDim
    ? Object.keys(groups).map((g) => groups[g].map((r) => r[`dim:${dim.field}`].value)).flat() // x 轴分类（可能有重复）
    : rows.map((r) => r[`dim:${dim.field}`].value)

  const series = []

  switch (chartType) {
    case 'pie':
    case 'doughnut': {
      const data = rows.map((r) => ({ name: String(r[`dim:${dim.field}`].value), value: r[metric.field] }))
      return {
        title,
        tooltip: { trigger: 'item' },
        legend: { bottom: 0 },
        series: [{
          name: metric.label,
          type: 'pie',
          radius: chartType === 'doughnut' ? ['40%', '68%'] : '65%',
          center: ['50%', '50%'],
          data,
          emphasis: { itemStyle: { shadowBlur: 8, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.4)' } },
        }],
      }
    }
    case 'table': {
      // 表格用自定义 render，这里返回数据占位
      return { _table: { dim, metric, rows }, rows }
    }
    case 'stat': {
      const first = rows[0] || {}
      return { _stat: { label: metric.label, value: first[metric.field] } }
    }
    case 'horizontalBar': {
      const cats = groupDim ? Object.keys(groups) : rows.map((r) => r[`dim:${dim.field}`].value)
      if (groupDim) {
        Object.entries(groups).forEach(([g, rws]) => {
          series.push({
            name: g, type: 'bar', barMaxWidth: 30,
            data: rws.map((r) => r[metric.field]),
          })
        })
      } else {
        series.push({ name: metric.label, type: 'bar', barMaxWidth: 30, data: rows.map((r) => r[metric.field]) })
      }
      return {
        title,
        tooltip: { trigger: 'axis' },
        legend: groupDim ? { top: 0, right: 0 } : undefined,
        grid: { left: 90, right: 20, top: groupDim ? 40 : 20, bottom: 30 },
        xAxis: { type: 'value' },
        yAxis: { type: 'category', data: cats },
        series,
      }
    }
    default: {
      // bar / line
      const cats = groupDim ? Object.keys(groups) : catValues
      if (groupDim) {
        Object.entries(groups).forEach(([g, rws]) => {
          series.push({ name: g, type: chartType, data: rws.map((r) => r[metric.field]) })
        })
      } else {
        series.push({ name: metric.label, type: chartType, data: rows.map((r) => r[metric.field]) })
      }
      return {
        title,
        tooltip: { trigger: 'axis' },
        legend: groupDim ? { top: 0, right: 0 } : undefined,
        grid: { left: 50, right: 20, top: groupDim ? 40 : 30, bottom: 30 },
        xAxis: { type: 'category', data: cats, axisLabel: { interval: 0, rotate: cats.length > 8 ? 35 : 0 } },
        yAxis: { type: 'value' },
        series,
      }
    }
  }
}