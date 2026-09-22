/**
 * 图表工具函数集
 * 提供图表配置的通用生成函数，减少各组件重复代码
 */

/** 图例位置映射 - 将位置字符串转换为ECharts定位属性 */
export const getLegendPosition = (pos: string) => {
  const map: Record<string, any> = {
    'top': { top: 5, left: 'center' },
    'bottom': { bottom: 5, left: 'center' },
    'left': { left: 5, top: 'middle' },
    'right': { right: 5, top: 'middle' },
    'top-left': { top: 5, left: 5 },
    'top-right': { top: 5, right: 5 },
    'bottom-left': { bottom: 5, left: 5 },
    'bottom-right': { bottom: 5, right: 5 },
    'center': { top: 'middle', left: 'center' }
  }
  return map[pos] || map['bottom']
}

/** 默认调色板 */
export const defaultColors = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399']

/** 生成通用标题配置 */
export const getCommonTitle = (p: any) => {
  return p.titleShow !== false ? {
    text: p.titleText || '',
    left: p.titlePosition || 'center',
    top: p.titlePadding ?? 10,
    textStyle: { color: p.titleColor || '#fff', fontSize: p.titleSize || 16 }
  } : {}
}

/** 生成通用图例配置 */
export const getCommonLegend = (p: any) => {
  return p.legendShow !== false ? {
    show: true,
    ...getLegendPosition(p.legendPosition || 'bottom'),
    orient: p.legendDirection || 'horizontal',
    icon: p.legendShape || 'roundRect',
    itemWidth: p.legendItemWidth || 14,
    itemHeight: p.legendItemHeight || 14,
    textStyle: { color: p.legendColor || '#fff', fontSize: p.legendFontSize || 12 }
  } : { show: false }
}

/**
 * 生成通用Grid配置
 * 根据图例位置、标签大小、轴名称等自动计算边距，避免元素重叠
 * 说明：开启 containLabel 后，坐标轴刻度标签会绘制在 grid 区域内并被自适应容纳，
 * 因此这里的 left/right 只需保留较小的留白即可，无需再为常规刻度标签额外计算宽度。
 */
export const getCommonGrid = (p: any) => {
  const legendPadding = p.legendPadding ?? 0
  const legendPosition = p.legendPosition || 'bottom'

  let top = p.gridTop ?? 20
  let bottom = p.gridBottom ?? 20
  let left = p.gridLeft ?? 15
  let right = p.gridRight ?? 20

  // 根据图例位置增加对应方向的边距
  if (p.legendShow !== false) {
    if (legendPosition === 'top' || legendPosition === 'top-left' || legendPosition === 'top-right' || legendPosition === 'center') {
      top = Math.max(top, 40 + legendPadding)
    }
    if (legendPosition === 'bottom' || legendPosition === 'bottom-left' || legendPosition === 'bottom-right') {
      bottom = Math.max(bottom, 40 + legendPadding)
    }
    if (legendPosition === 'left') {
      left = Math.max(left, 40 + legendPadding)
    }
    if (legendPosition === 'right') {
      right = Math.max(right, 50 + legendPadding)
    }
  }

  // 标题占位高度
  if (p.titleShow !== false && p.titleText) {
    top = Math.max(top, (p.titleSize || 16) + (p.titlePadding ?? 10) + 25)
  }

  // X轴名称占位高度（X轴常规刻度标签已由 containLabel 容纳）
  if (p.xAxisShow !== false && (p.xAxisName || p.xAxisLabelRotate)) {
    const rotate = p.xAxisLabelRotate ?? 0
    const nameSize = p.xAxisNameSize || 12
    if (p.xAxisName) {
      bottom = Math.max(bottom, nameSize + 25)
    }
    if (rotate && rotate !== 0) {
      const labelSize = p.xAxisLabelSize || 12
      const maxLen = p.xAxisLabelMaxLen || 10
      const textW = maxLen * labelSize * 0.6
      const labelH = Math.abs(Math.sin(rotate * Math.PI / 180)) * textW + labelSize + 12
      bottom = Math.max(bottom, labelH + 10)
    }
  }

  // Y轴名称额外占位（Y轴常规刻度标签已由 containLabel 容纳）
  if (p.yAxisShow !== false) {
    const rotate = p.yAxisLabelRotate ?? 0
    const nameSize = p.yAxisNameSize || 12
    if (p.yAxisName || p.yAxisUnit) {
      left = Math.max(left, nameSize + 30)
    }
    if (rotate && rotate !== 0) {
      const labelSize = p.yAxisLabelSize || 12
      const maxLen = p.yAxisLabelMaxLen || 6
      const textW = maxLen * labelSize * 0.6
      const labelW = Math.abs(Math.cos(rotate * Math.PI / 180)) * textW + labelSize + 12
      left = Math.max(left, labelW + 10)
    }
  }

  return p.gridShow !== false ? {
    top,
    bottom,
    left,
    right,
    containLabel: true
  } : {}
}

/** 生成通用Tooltip配置 */
export const getCommonTooltip = (p: any) => {
  return p.tooltipShow !== false ? {
    show: true,
    trigger: p.tooltipTrigger || 'axis',
    backgroundColor: p.tooltipBgColor || '#333',
    textStyle: { color: p.tooltipTextColor || '#fff' }
  } : { show: false }
}

/** 获取轴标签文本样式（颜色、大小、粗体、斜体、下划线） */
function getLabelTextStyle(p: any, prefix: string) {
  const style: any = {}
  const color = p[`${prefix}LabelColor`]
  const size = p[`${prefix}LabelSize`]
  const bold = p[`${prefix}LabelBold`]
  const italic = p[`${prefix}LabelItalic`]
  const underline = p[`${prefix}LabelUnderline`]
  if (color) style.color = color
  if (size) style.fontSize = size
  if (bold) style.fontWeight = 'bold'
  if (italic) style.fontStyle = 'italic'
  if (underline) style.textDecoration = 'underline'
  return style
}

/** 获取轴标签截断格式化函数 - 超过指定字符数时显示省略号 */
function getLabelFormatter(p: any, prefix: string) {
  const maxLen = p[`${prefix}LabelMaxLen`]
  if (!maxLen) return undefined
  return (value: string) => {
    const str = String(value)
    return str.length > maxLen ? str.slice(0, maxLen) + '...' : str
  }
}

/** 生成通用X轴配置 */
export const getCommonXAxis = (p: any): any => {
  if (p.xAxisShow === false) return { show: false }
  const labelStyle = getLabelTextStyle(p, 'x')
  const formatter = getLabelFormatter(p, 'x')
  return {
    show: true,
    type: 'category',
    axisLine: {
      show: p.xAxisLineShow === true,
      lineStyle: { color: p.xAxisLineColor || '#666' }
    },
    axisTick: { show: p.xAxisLineShow === true, lineStyle: { color: p.xAxisLineColor || '#666' } },
    name: p.xAxisName || undefined,
    nameLocation: 'center',
    nameGap: 35,
    nameTextStyle: {
      color: p.xAxisNameColor || '#999',
      fontSize: p.xAxisNameSize || 12
    },
    axisLabel: {
      color: p.xAxisLabelColor || '#999',
      fontSize: p.xAxisLabelSize || 12,
      interval: p.xAxisLabelInterval,
      rotate: p.xAxisLabelRotate ?? 0,
      formatter,
      ...labelStyle
    },
    splitLine: { show: false }
  }
}

/** 生成通用数值X轴配置 - 用于水平条形图 */
export const getCommonValueXAxis = (p: any): any => {
  if (p.xAxisShow === false) return { show: false }
  return {
    show: true,
    type: 'value',
    name: p.xAxisName || undefined,
    nameLocation: 'center',
    nameGap: 35,
    nameTextStyle: {
      color: p.xAxisNameColor || '#999',
      fontSize: p.xAxisNameSize || 12
    },
    axisLine: {
      show: p.xAxisLineShow === true,
      lineStyle: { color: p.xAxisLineColor || '#666' }
    },
    axisTick: { show: p.xAxisLineShow === true },
    axisLabel: {
      color: p.xAxisLabelColor || '#999',
      fontSize: p.xAxisLabelSize || 12,
      ...getLabelTextStyle(p, 'x')
    },
    splitLine: {
      show: p.yAxisGridShow !== false,
      lineStyle: {
        color: p.yAxisGridColor || '#333',
        type: p.yAxisGridType || 'solid',
        width: p.yAxisGridWidth ?? 1
      }
    },
    min: p.xAxisMin,
    max: p.xAxisMax,
    splitNumber: p.xAxisSplitNumber
  }
}

/** 生成通用分类Y轴配置 - 用于水平条形图 */
export const getCommonCategoryYAxis = (p: any, categories: any[] = []): any => {
  if (p.yAxisShow === false) return { show: false }
  const labelStyle = getLabelTextStyle(p, 'y')
  const formatter = getLabelFormatter(p, 'y')
  return {
    show: true,
    type: 'category',
    data: categories,
    name: p.yAxisName || undefined,
    nameLocation: 'center',
    nameGap: 45,
    nameTextStyle: {
      color: p.yAxisNameColor || '#999',
      fontSize: p.yAxisNameSize || 12
    },
    axisLine: {
      show: p.yAxisLineShow === true,
      lineStyle: { color: p.yAxisLineColor || '#666' }
    },
    axisTick: { show: p.yAxisLineShow === true },
    axisLabel: {
      color: p.yAxisLabelColor || '#999',
      fontSize: p.yAxisLabelSize || 12,
      interval: p.yAxisLabelInterval,
      rotate: p.yAxisLabelRotate ?? 0,
      formatter,
      ...labelStyle
    },
    splitLine: { show: false }
  }
}

/** 生成通用Y轴配置 - 支持单位、范围、分隔线等 */
export const getCommonYAxis = (p: any): any => {
  if (p.yAxisShow === false) return { show: false }
  const labelStyle = getLabelTextStyle(p, 'y')
  const formatter = getLabelFormatter(p, 'y')
  const unit = p.yAxisUnit || ''
  const nameTextStyle: any = {
    color: p.yAxisNameColor || '#999',
    fontSize: p.yAxisNameSize || 12
  }
  return {
    show: true,
    type: 'value',
    position: p.yAxisNamePosition || 'end',
    name: p.yAxisName ? (unit ? `${p.yAxisName}(${unit})` : p.yAxisName) : (unit ? unit : undefined),
    nameLocation: 'center',
    nameGap: 45,
    nameTextStyle,
    min: p.yAxisMin,
    max: p.yAxisMax,
    splitNumber: p.yAxisSplitNumber,
    axisLine: {
      show: p.yAxisLineShow === true,
      lineStyle: { color: p.yAxisLineColor || '#666' }
    },
    axisTick: { show: p.yAxisLineShow === true },
    axisLabel: {
      color: p.yAxisLabelColor || '#999',
      fontSize: p.yAxisLabelSize || 12,
      interval: p.yAxisLabelInterval,
      rotate: p.yAxisLabelRotate ?? 0,
      formatter,
      ...labelStyle
    },
    splitLine: {
      show: p.yAxisGridShow !== false,
      lineStyle: {
        color: p.yAxisGridColor || '#333',
        type: p.yAxisGridType || 'solid',
        width: p.yAxisGridWidth ?? 1
      }
    }
  }
}

/** 生成DataZoom滚动条配置 - 用于数据量大的图表 */
export const getCommonDataZoom = (p: any) => {
  if (!p.dataZoomShow) return []
  return [{
    type: 'slider',
    show: true,
    start: 0,
    end: 100,
    height: 20,
    bottom: 5,
    borderColor: '#555',
    fillerColor: 'rgba(64,158,255,0.2)',
    handleStyle: { color: '#409eff' },
    textStyle: { color: '#999' }
  }]
}

/**
 * 生成系列标签配置
 * 支持自定义显示内容（系列名/分类名/数值）和分隔符
 */
export const getSeriesLabel = (p: any) => {
  if (p.labelShow !== true) return { show: false }
  const content = p.labelContent || ['value']
  const sep = p.labelSeparator || ' '
  const position = p.labelPosition || 'top'
  const formatter = (params: any) => {
    const parts: string[] = []
    if (content.includes('seriesName') && params.seriesName) parts.push(params.seriesName)
    if (content.includes('categoryName') && params.name) parts.push(params.name)
    if (content.includes('value')) parts.push(String(params.value))
    return parts.join(sep)
  }
  return {
    show: true,
    position,
    formatter,
    fontSize: p.labelFontSize || 12,
    color: p.labelColor || '#fff',
    fontWeight: p.labelBold ? 'bold' : 'normal',
    fontStyle: p.labelItalic ? 'italic' : 'normal',
    textDecoration: p.labelUnderline ? 'underline' : 'none'
  }
}
