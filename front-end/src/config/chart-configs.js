import { COLOR_PALETTES, DEFAULT_PALETTE, DEFAULT_PALETTE_INDEX } from './color-palettes'

// ---- 公共配置schema（所有图表共享，精简版） ----

// 通用文字样式（标题/图例/提示框等文本的样式工具条）
const STYLE_TEXT = {
  color: { type: 'color', label: '颜色', default: '#333333' },
  fontSize: { type: 'number', label: '字号', default: 12, min: 8, max: 40 },
  fontWeight: { type: 'toggle', label: '加粗', default: 'normal', activeValue: 'bold', inactiveValue: 'normal', icon: 'B' },
  fontStyle: { type: 'toggle', label: '斜体', default: 'normal', activeValue: 'italic', inactiveValue: 'normal', icon: 'I' },
}

export const COMMON_CONFIG_SCHEMA = {
  title: {
    type: 'group', label: '标题', children: {
      show: { type: 'switch', label: '显示', default: true },
      text: { type: 'input', label: '标题文字', default: '', placeholder: '输入图表标题' },
      subtext: { type: 'input', label: '副标题', default: '', placeholder: '副标题(可选)' },
      left: {
        type: 'select', label: '水平位置', default: 'center', options: [
          { label: '左', value: 'left' }, { label: '居中', value: 'center' }, { label: '右', value: 'right' },
        ],
      },
      top: {
        type: 'select', label: '垂直位置', default: 'top', options: [
          { label: '顶部', value: 'top' }, { label: '中部', value: 'middle' }, { label: '底部', value: 'bottom' },
        ],
      },
      textStyle: { type: 'group', label: '文字样式', inline: true, children: STYLE_TEXT },
    },
  },
  legend: {
    type: 'group', label: '图例', children: {
      show: { type: 'switch', label: '显示', default: true },
      orient: {
        type: 'select', label: '布局方向', default: 'horizontal', options: [
          { label: '水平', value: 'horizontal' }, { label: '垂直', value: 'vertical' },
        ],
      },
      left: {
        type: 'select', label: '水平位置', default: 'center', options: [
          { label: '左', value: 'left' }, { label: '居中', value: 'center' }, { label: '右', value: 'right' },
        ],
      },
      top: {
        type: 'select', label: '垂直位置', default: 'bottom', options: [
          { label: '顶部', value: 'top' }, { label: '中部', value: 'middle' }, { label: '底部', value: 'bottom' },
        ],
      },
      align: {
        type: 'buttonGroup', label: '对齐', default: 'auto',
        options: [
          { label: '自动', value: 'auto' },
          { label: '左', value: 'left', icon: '⇤' },
          { label: '中', value: 'center', icon: '≡' },
          { label: '右', value: 'right', icon: '⇥' },
        ],
      },
      textStyle: { type: 'group', label: '文字样式', inline: true, children: STYLE_TEXT },
    },
  },
  tooltip: {
    type: 'group', label: '提示框', children: {
      show: { type: 'switch', label: '显示', default: true },
      trigger: {
        type: 'select', label: '触发方式', default: 'axis', options: [
          { label: '坐标轴', value: 'axis' }, { label: '数据项', value: 'item' }, { label: '不触发', value: 'none' },
        ],
      },
      formatter: { type: 'input', label: '内容格式', default: '', placeholder: '如 {a}{b}: {c}，留空自动' },
      backgroundColor: { type: 'color', label: '背景色', default: 'rgba(50,50,50,0.9)' },
      textStyle: { type: 'group', label: '文字样式', inline: true, children: STYLE_TEXT },
    },
  },
  label: {
    type: 'group', label: '数据标签', children: {
      show: { type: 'switch', label: '显示', default: false },
      position: {
        type: 'select', label: '位置', default: 'top', options: [
          { label: '上', value: 'top' }, { label: '下', value: 'bottom' },
          { label: '左', value: 'left' }, { label: '右', value: 'right' }, { label: '内', value: 'inside' },
        ],
      },
      formatter: {
        type: 'select', label: '内容格式', default: '', options: [
          { label: '默认', value: '' }, { label: '数值', value: '{c}' }, { label: '名称', value: '{b}' },
          { label: '百分比', value: '{d}%' }, { label: '系列名', value: '{a}' },
        ],
      },
      color: { type: 'color', label: '文字颜色', default: 'inherit' },
      fontSize: { type: 'number', label: '字号', default: 12, min: 8, max: 30 },
      fontWeight: { type: 'toggle', label: '加粗', default: 'normal', activeValue: 'bold', inactiveValue: 'normal', icon: 'B' },
      fontStyle: { type: 'toggle', label: '斜体', default: 'normal', activeValue: 'italic', inactiveValue: 'normal', icon: 'I' },
    },
  },
  markLine: {
    type: 'group', label: '标记线', children: {
      show: { type: 'switch', label: '显示', default: false },
      type: {
        type: 'select', label: '类型', default: 'average', options: [
          { label: '平均值', value: 'average' }, { label: '最大值', value: 'max' },
          { label: '最小值', value: 'min' }, { label: '中位数', value: 'median' }, { label: '自定义', value: 'custom' },
        ],
      },
      customValue: { type: 'number', label: '自定义值', default: 0 },
      color: { type: 'color', label: '线条颜色', default: '#E63946' },
      width: { type: 'number', label: '线宽', default: 1.5, min: 0.5, max: 10, step: 0.5 },
      lineType: {
        type: 'select', label: '线型', default: 'dashed', options: [
          { label: '实线', value: 'solid' }, { label: '虚线', value: 'dashed' }, { label: '点线', value: 'dotted' },
        ],
      },
      showLabel: { type: 'switch', label: '显示标签', default: true },
    },
  },
  grid: {
    type: 'group', label: '绘图区域', children: {
      left: { type: 'number', label: '左边距', default: 60, min: 0, max: 200 },
      right: { type: 'number', label: '右边距', default: 30, min: 0, max: 200 },
      top: { type: 'number', label: '上边距', default: 40, min: 0, max: 200 },
      bottom: { type: 'number', label: '下边距', default: 40, min: 0, max: 200 },
    },
  },
  xAxis: {
    type: 'group', label: 'X轴', children: {
      show: { type: 'switch', label: '显示', default: true },
      name: { type: 'input', label: '轴名称', default: '' },
      nameRotate: { type: 'number', label: '名称旋转', default: 0, min: -90, max: 90 },
      labelRotate: { type: 'number', label: '标签旋转', default: 0, min: -90, max: 90 },
    },
  },
  yAxis: {
    type: 'group', label: 'Y轴', children: {
      show: { type: 'switch', label: '显示', default: true },
      name: { type: 'input', label: '轴名称', default: '' },
      splitLine: { type: 'switch', label: '网格线', default: true },
      min: { type: 'input', label: '最小值', default: '', placeholder: '自动或数值' },
      max: { type: 'input', label: '最大值', default: '', placeholder: '自动或数值' },
    },
  },
}

// ---- 类型专属配置schema ----
export const TYPE_CONFIG_SCHEMAS = {
  // 柱形图
  bar: {
    barWidth: { type: 'number', label: '柱宽', default: 0, min: 0, max: 100, placeholder: '自动' },
    barGap: { type: 'number', label: '柱间距%', default: 20, min: 0, max: 100 },
    rounded: { type: 'switch', label: '圆角柱', default: false },
  },
  barClustered: {
    barWidth: { type: 'number', label: '柱宽', default: 0, min: 0, max: 100, placeholder: '自动' },
    barGap: { type: 'number', label: '柱间距%', default: 30, min: 0, max: 100 },
    rounded: { type: 'switch', label: '圆角柱', default: false },
  },
  barStacked: {
    barWidth: { type: 'number', label: '柱宽', default: 0, min: 0, max: 100, placeholder: '自动' },
    rounded: { type: 'switch', label: '圆角柱', default: false },
  },
  barLine: {
    lineSeries: { type: 'number', label: '折线指定系列', default: 0, min: 0, max: 10 },
    smooth: { type: 'switch', label: '平滑折线', default: false },
  },
  barPictorial: {
    symbolType: {
      type: 'select', label: '符号类型', default: 'rect', options: [
        { label: '圆', value: 'circle' }, { label: '矩形', value: 'rect' },
        { label: '三角', value: 'triangle' }, { label: '菱形', value: 'diamond' },
      ],
    },
  },
  barPercentStacked: {
    barWidth: { type: 'number', label: '柱宽', default: 0, min: 0, max: 100, placeholder: '自动' },
    showPercentLabel: { type: 'switch', label: '显示百分比标签', default: true },
  },
  barGroupStacked: {
    barWidth: { type: 'number', label: '柱宽', default: 0, min: 0, max: 100, placeholder: '自动' },
  },
  barStackedLine: {
    smooth: { type: 'switch', label: '平滑折线', default: false },
  },
  barStackedPictorial: {
    symbolType: {
      type: 'select', label: '符号类型', default: 'rect', options: [
        { label: '圆', value: 'circle' }, { label: '矩形', value: 'rect' },
      ],
    },
  },
  bullet: {
    barWidth: { type: 'number', label: '柱宽', default: 30, min: 10, max: 80 },
    targetValue: { type: 'number', label: '目标值', default: undefined },
  },
  waterfall: {
    increaseColor: { type: 'color', label: '增加颜色', default: '#67C23A' },
    decreaseColor: { type: 'color', label: '减少颜色', default: '#F56C6C' },
  },
  pareto: {
    showLine: { type: 'switch', label: '显示累积线', default: true },
  },

  // 条形图
  horizontalBar: {
    barWidth: { type: 'number', label: '条宽', default: 0, min: 0, max: 100, placeholder: '自动' },
  },
  horizontalBarClustered: {
    barWidth: { type: 'number', label: '条宽', default: 0, min: 0, max: 100, placeholder: '自动' },
    barGap: { type: 'number', label: '条间距%', default: 30, min: 0, max: 100 },
  },
  horizontalBarStacked: {
    barWidth: { type: 'number', label: '条宽', default: 0, min: 0, max: 100, placeholder: '自动' },
  },
  horizontalBarPercentStacked: {
    barWidth: { type: 'number', label: '条宽', default: 0, min: 0, max: 100, placeholder: '自动' },
    showPercentLabel: { type: 'switch', label: '显示百分比标签', default: true },
  },
  horizontalBarGroupStacked: {
    barWidth: { type: 'number', label: '条宽', default: 0, min: 0, max: 100, placeholder: '自动' },
  },
  horizontalBullet: {
    barWidth: { type: 'number', label: '条宽', default: 30, min: 10, max: 80 },
    targetValue: { type: 'number', label: '目标值', default: undefined },
  },
  butterfly: {
    barWidth: { type: 'number', label: '条宽', default: 0, min: 0, max: 100, placeholder: '自动' },
  },

  // 折线图与面积图
  line: {
    smooth: { type: 'switch', label: '平滑', default: false },
    areaStyle: { type: 'switch', label: '面积填充', default: false },
    step: {
      type: 'select', label: '步进', default: '', options: [
        { label: '无', value: '' }, { label: '起始', value: 'start' },
        { label: '中间', value: 'middle' }, { label: '结束', value: 'end' },
      ],
    },
  },
  lineMulti: {
    smooth: { type: 'switch', label: '平滑', default: false },
  },
  areaStacked: {
    smooth: { type: 'switch', label: '平滑', default: false },
    opacity: { type: 'slider', label: '透明度', default: 0.6, min: 0, max: 1, step: 0.1 },
  },
  areaPercentStacked: {
    smooth: { type: 'switch', label: '平滑', default: false },
    opacity: { type: 'slider', label: '透明度', default: 0.6, min: 0, max: 1, step: 0.1 },
  },

  // 饼图与漏斗图
  pie: {
    radius: { type: 'slider', label: '半径%', default: 65, min: 20, max: 90 },
    startAngle: { type: 'number', label: '起始角度', default: 90, min: 0, max: 360 },
    labelPosition: {
      type: 'select', label: '标签位置', default: 'outside', options: [
        { label: '外', value: 'outside' }, { label: '内', value: 'inside' }, { label: '居中', value: 'center' },
      ],
    },
    roseType: { type: 'switch', label: '玫瑰模式', default: false },
  },
  doughnut: {
    radiusInner: { type: 'slider', label: '内径%', default: 40, min: 10, max: 60 },
    radiusOuter: { type: 'slider', label: '外径%', default: 68, min: 30, max: 90 },
    startAngle: { type: 'number', label: '起始角度', default: 90, min: 0, max: 360 },
    labelPosition: {
      type: 'select', label: '标签位置', default: 'outside', options: [
        { label: '外', value: 'outside' }, { label: '内', value: 'inside' }, { label: '居中', value: 'center' },
      ],
    },
  },
  sunburst: {
    radius: { type: 'slider', label: '半径%', default: 80, min: 30, max: 90 },
    startAngle: { type: 'number', label: '起始角度', default: 90, min: 0, max: 360 },
  },
  nightingale: {
    radius: { type: 'slider', label: '半径%', default: 80, min: 30, max: 90 },
    roseType: {
      type: 'select', label: '模式', default: 'radius', options: [
        { label: '半径', value: 'radius' }, { label: '面积', value: 'area' },
      ],
    },
  },
  funnel: {
    sort: {
      type: 'select', label: '排序', default: 'descending', options: [
        { label: '降序', value: 'descending' }, { label: '升序', value: 'ascending' }, { label: '无', value: 'none' },
      ],
    },
    gap: { type: 'number', label: '间距', default: 2, min: 0, max: 20 },
  },
  funnelHorizontal: {
    sort: {
      type: 'select', label: '排序', default: 'descending', options: [
        { label: '降序', value: 'descending' }, { label: '升序', value: 'ascending' }, { label: '无', value: 'none' },
      ],
    },
    gap: { type: 'number', label: '间距', default: 2, min: 0, max: 20 },
  },

  // 散点图与气泡图
  scatter: {
    symbolSize: { type: 'number', label: '符号大小', default: 10, min: 2, max: 50 },
  },
  bubble: {
    symbolSize: { type: 'number', label: '最大气泡大小', default: 50, min: 10, max: 100 },
  },

  // 指标与进度
  progressBar: {
    max: { type: 'number', label: '最大值', default: 100, min: 1 },
    showTarget: { type: 'switch', label: '显示目标', default: true },
  },
  circularProgress: {
    max: { type: 'number', label: '最大值', default: 100, min: 1 },
    lineWidth: { type: 'number', label: '线宽', default: 10, min: 2, max: 30 },
  },
  multiRingProgress: {
    max: { type: 'number', label: '最大值', default: 100, min: 1 },
    lineWidth: { type: 'number', label: '线宽', default: 10, min: 2, max: 30 },
  },
  fluidProgress: {
    max: { type: 'number', label: '最大值', default: 100, min: 1 },
  },
  gauge: {
    min: { type: 'number', label: '最小值', default: 0 },
    max: { type: 'number', label: '最大值', default: 100 },
    splitNumber: { type: 'number', label: '分割段数', default: 10, min: 1, max: 20 },
    progressWidth: { type: 'number', label: '进度宽度', default: 10, min: 2, max: 30 },
  },
  statTrend: {
    showSparkline: { type: 'switch', label: '显示趋势线', default: true },
    sparklineColor: { type: 'color', label: '趋势线颜色', default: '#409EFF' },
  },

  // 地图
  mapChina: {
    zoom: { type: 'slider', label: '缩放', default: 1, min: 0.5, max: 5, step: 0.1 },
    showLabels: { type: 'switch', label: '显示地区名', default: true },
  },
  mapChinaBubble: {
    zoom: { type: 'slider', label: '缩放', default: 1, min: 0.5, max: 5, step: 0.1 },
    symbolSize: { type: 'number', label: '气泡大小', default: 12, min: 5, max: 50 },
    showLabels: { type: 'switch', label: '显示地区名', default: false },
  },
  mapChinaSymbol: {
    zoom: { type: 'slider', label: '缩放', default: 1, min: 0.5, max: 5, step: 0.1 },
    symbolSize: { type: 'number', label: '符号大小', default: 14, min: 5, max: 50 },
  },
  mapWorld: {
    zoom: { type: 'slider', label: '缩放', default: 1, min: 0.5, max: 5, step: 0.1 },
  },

  // 其他
  heatmap: {
    showValues: { type: 'switch', label: '显示数值', default: true },
  },
  polarBar: {
    barWidth: { type: 'number', label: '柱宽', default: 0, min: 0, max: 100, placeholder: '自动' },
  },
  barBreakAxis: {
    breakStart: { type: 'number', label: '断点起始', default: 80 },
    breakEnd: { type: 'number', label: '断点结束', default: 200 },
  },
  calendar: {
    cellSize: { type: 'number', label: '单元格大小', default: 20, min: 10, max: 50 },
  },
  candlestick: {
    upColor: { type: 'color', label: '阳线颜色', default: '#F56C6C' },
    downColor: { type: 'color', label: '阴线颜色', default: '#67C23A' },
  },
  treemap: {
    orient: {
      type: 'select', label: '方向', default: 'horizontal', options: [
        { label: '水平', value: 'horizontal' }, { label: '垂直', value: 'vertical' },
      ],
    },
  },
  sankey: {
    nodeWidth: { type: 'number', label: '节点宽度', default: 20, min: 5, max: 50 },
    nodeGap: { type: 'number', label: '节点间距', default: 8, min: 2, max: 30 },
    layoutIterations: { type: 'number', label: '布局迭代', default: 32, min: 0, max: 100 },
  },
  chord: {
    nodeWidth: { type: 'number', label: '节点宽度', default: 20, min: 5, max: 50 },
    nodeGap: { type: 'number', label: '节点间距', default: 8, min: 2, max: 30 },
  },
}

// Extract default config object from a schema
function getDefaultsFromSchema(schema) {
  const result = {}
  for (const [key, field] of Object.entries(schema || {})) {
    if (field.type === 'group' && field.children) {
      result[key] = getDefaultsFromSchema(field.children)
    } else if ('default' in field) {
      result[key] = field.default
    }
  }
  return result
}

export function getDefaultConfig(chartType) {
  const commonDefaults = getDefaultsFromSchema(COMMON_CONFIG_SCHEMA)
  const typeDefaults = getDefaultsFromSchema(TYPE_CONFIG_SCHEMAS[chartType] || {})
  return {
    ...commonDefaults,
    colorPalette: DEFAULT_PALETTE_INDEX,
    ...(Object.keys(typeDefaults).length ? { typeSpecific: typeDefaults } : {}),
  }
}

// ---- 辅助函数 ----
// Deep merge helper - merges source into target, preserving target's objects unless source has values
function mergeConfig(target, source) {
  if (!source || typeof source !== 'object') return target
  if (Array.isArray(source)) return source // arrays: replace entirely
  
  const result = { ...target }
  for (const key of Object.keys(source)) {
    const sourceVal = source[key]
    const targetVal = target[key]
    
    if (sourceVal === undefined || sourceVal === null || sourceVal === '') {
      continue // skip empty values
    }
    
    if (sourceVal && typeof sourceVal === 'object' && !Array.isArray(sourceVal) && targetVal && typeof targetVal === 'object') {
      // Both are objects: deep merge
      result[key] = mergeConfig(targetVal, sourceVal)
    } else {
      // Primitive or array: use source value
      result[key] = sourceVal
    }
  }
  return result
}

function buildTextStyle(cfg, prefix = '') {
  if (!cfg) return {}
  const style = {}
  if (cfg.color) style.color = cfg.color
  if (cfg.fontSize) style.fontSize = cfg.fontSize
  if (cfg.fontWeight) style.fontWeight = cfg.fontWeight
  if (cfg.fontStyle) style.fontStyle = cfg.fontStyle
  if (cfg.fontFamily && cfg.fontFamily !== 'inherit') style.fontFamily = cfg.fontFamily
  if (cfg.textDecoration && cfg.textDecoration !== 'none') style.textDecoration = cfg.textDecoration
  if (cfg.lineHeight) style.lineHeight = cfg.lineHeight
  if (cfg.textAlign && cfg.textAlign !== 'auto') style.align = cfg.textAlign
  if (cfg.rich) style.rich = {}
  return style
}

function buildCommonOption(config, palette) {
  const opt = {}

  // Title
  if (config.title?.show !== false && config.title?.text) {
    const t = config.title
    opt.title = {
      text: t.text,
      subtext: t.subtext || '',
      left: t.left || 'center',
      top: t.top || 'top',
      textAlign: t.textAlign || 'auto',
      padding: t.padding || 0,
      itemGap: t.itemGap || 10,
      backgroundColor: t.backgroundColor || 'transparent',
      borderColor: t.borderColor || 'transparent',
      borderWidth: t.borderWidth || 0,
      borderRadius: t.borderRadius || 0,
      shadowColor: t.shadowColor || 'transparent',
      shadowBlur: t.shadowBlur || 0,
      shadowOffsetX: t.shadowOffsetX || 0,
      shadowOffsetY: t.shadowOffsetY || 0,
      textStyle: buildTextStyle(t.textStyle, 'title'),
      subtextStyle: buildTextStyle(t.subtextStyle, 'subtext'),
    }
  }

  // Legend
  if (config.legend && config.legend.show !== false) {
    const l = config.legend
    const legCfg = {
      show: true,
      orient: l.orient || 'horizontal',
      left: l.left || 'center',
      top: l.top || 'bottom',
      align: l.align || 'auto',
      itemWidth: l.itemWidth || 25,
      itemHeight: l.itemHeight || 14,
      itemGap: l.itemGap || 10,
      padding: l.padding || 5,
      selectedMode: l.selectedMode !== false,
      inactiveColor: l.inactiveColor || '#ccc',
      backgroundColor: l.backgroundColor || 'transparent',
      borderColor: l.borderColor || 'transparent',
      borderWidth: l.borderWidth || 0,
      borderRadius: l.borderRadius || 0,
      shadowColor: l.shadowColor || 'transparent',
      shadowBlur: l.shadowBlur || 0,
      shadowOffsetX: l.shadowOffsetX || 0,
      shadowOffsetY: l.shadowOffsetY || 0,
      pageButtonItemGap: l.pageButtonItemGap || 5,
      pageButtonPosition: l.pageButtonPosition || 'end',
      pageTextStyle: buildTextStyle(l.pageTextStyle, 'pageText'),
      pageIconColor: l.pageIconColor || '#333333',
      pageIconInactiveColor: l.pageIconInactiveColor || '#aaa',
      pageIconSize: l.pageIconSize || 15,
      textStyle: buildTextStyle(l.textStyle, 'legend'),
    }
    opt.legend = legCfg
  }

  // Tooltip
  if (config.tooltip && config.tooltip.show !== false) {
    const tt = config.tooltip
    const trigger = tt.trigger || 'axis'
    if (trigger === 'none') {
      opt.tooltip = { show: false }
    } else {
      opt.tooltip = {
        trigger,
        triggerOn: tt.triggerOn || 'mousemove|click',
        axisPointer: {
          type: tt.axisPointer?.type || 'line',
          lineStyle: tt.axisPointer?.lineStyle ? {
            color: tt.axisPointer.lineStyle.color || '#aaa',
            width: tt.axisPointer.lineStyle.width || 1,
            type: tt.axisPointer.lineStyle.type || 'solid',
          } : {},
          shadowStyle: tt.axisPointer?.shadowStyle ? {
            color: tt.axisPointer.shadowStyle.color || 'rgba(150,150,150,0.3)',
          } : {},
          crossStyle: tt.axisPointer?.crossStyle ? {
            color: tt.axisPointer.crossStyle.color || '#aaa',
            width: tt.axisPointer.crossStyle.width || 1,
            type: tt.axisPointer.crossStyle.type || 'dashed',
          } : {},
          label: tt.axisPointer?.label ? {
            show: tt.axisPointer.label.show || false,
            backgroundColor: tt.axisPointer.label.backgroundColor || '#6a7985',
            textStyle: buildTextStyle(tt.axisPointer.label.textStyle, 'axisLabel'),
          } : {},
        },
        textStyle: buildTextStyle(tt.textStyle, 'tooltip'),
        backgroundColor: tt.backgroundColor || 'rgba(50,50,50,0.9)',
        borderColor: tt.borderColor || 'transparent',
        borderWidth: tt.borderWidth || 0,
        borderRadius: tt.borderRadius || 4,
        padding: tt.padding || 10,
        extraCssText: tt.extraCssText || '',
        formatter: tt.formatter || undefined,
        valueFormatter: tt.valueFormatter || undefined,
        position: tt.position || 'auto',
        confine: tt.confine || false,
        transitionDuration: tt.transitionDuration || 0.4,
        displayTransition: tt.displayTransition !== false,
        enterable: tt.enterable !== false,
      }
    }
  }

  // Grid
  if (config.grid) {
    const g = config.grid
    opt.grid = {
      show: g.show || false,
      left: g.left || '60',
      right: g.right || '30',
      top: g.top || '40',
      bottom: g.bottom || '40',
      width: g.width || 'auto',
      height: g.height || 'auto',
      backgroundColor: g.backgroundColor || 'transparent',
      borderColor: g.borderColor || '#eee',
      borderWidth: g.borderWidth || 1,
    }
  }

  // X Axis
  if (config.xAxis) {
    const xa = config.xAxis
    const axisCfg = {
      show: xa.show !== false,
      type: xa.type || 'category',
      position: xa.position || 'bottom',
      name: xa.name || '',
      nameLocation: xa.nameLocation || 'middle',
      nameGap: xa.nameGap || 15,
      nameRotate: xa.nameRotate || 0,
      inverse: xa.inverse || false,
      boundaryGap: xa.boundaryGap !== false,
      min: xa.min || undefined,
      max: xa.max || undefined,
      scale: xa.scale || false,
      splitNumber: xa.splitNumber || 5,
      interval: xa.interval || undefined,
      axisLine: {
        show: xa.axisLine?.show !== false,
        onZero: xa.axisLine?.onZero !== false,
        lineStyle: {
          color: xa.axisLine?.lineStyle?.color || '#ddd',
          width: xa.axisLine?.lineStyle?.width || 1,
          type: xa.axisLine?.lineStyle?.type || 'solid',
        },
      },
      axisTick: {
        show: xa.axisTick?.show !== false,
        inside: xa.axisTick?.inside || false,
        length: xa.axisTick?.length || 5,
        lineStyle: {
          color: xa.axisTick?.lineStyle?.color || '#ddd',
          width: xa.axisTick?.lineStyle?.width || 1,
        },
      },
      axisLabel: {
        show: xa.axisLabel?.show !== false,
        inside: xa.axisLabel?.inside || false,
        rotate: xa.labelRotate ?? xa.axisLabel?.rotate ?? 0,
        margin: xa.axisLabel?.margin || 8,
        formatter: xa.axisLabel?.formatter || undefined,
        ...buildTextStyle(xa.axisLabel?.textStyle, 'xAxisLabel'),
      },
      splitLine: {
        show: typeof xa.splitLine === 'boolean' ? xa.splitLine : xa.splitLine?.show || false,
        lineStyle: {
          color: xa.splitLine?.lineStyle?.color || '#eee',
          width: xa.splitLine?.lineStyle?.width || 1,
          type: xa.splitLine?.lineStyle?.type || 'solid',
        },
      },
      splitArea: {
        show: xa.splitArea?.show || false,
        areaStyle: {
          color: xa.splitArea?.areaStyle?.color || 'rgba(250,250,250,0.3)',
        },
      },
      data: xa.data ? JSON.parse(xa.data) : undefined,
      z: xa.z || 0,
      zlevel: xa.zlevel || 0,
    }
    opt.xAxis = axisCfg
  }

  // Y Axis
  if (config.yAxis) {
    const ya = config.yAxis
    const axisCfg = {
      show: ya.show !== false,
      type: ya.type || 'value',
      position: ya.position || 'left',
      name: ya.name || '',
      nameLocation: ya.nameLocation || 'middle',
      nameGap: ya.nameGap || 15,
      nameRotate: ya.nameRotate || 0,
      inverse: ya.inverse || false,
      boundaryGap: ya.boundaryGap || false,
      min: ya.min || undefined,
      max: ya.max || undefined,
      scale: ya.scale || false,
      splitNumber: ya.splitNumber || 5,
      interval: ya.interval || undefined,
      axisLine: {
        show: ya.axisLine?.show !== false,
        onZero: ya.axisLine?.onZero !== false,
        lineStyle: {
          color: ya.axisLine?.lineStyle?.color || '#ddd',
          width: ya.axisLine?.lineStyle?.width || 1,
          type: ya.axisLine?.lineStyle?.type || 'solid',
        },
      },
      axisTick: {
        show: ya.axisTick?.show !== false,
        inside: ya.axisTick?.inside || false,
        length: ya.axisTick?.length || 5,
        lineStyle: {
          color: ya.axisTick?.lineStyle?.color || '#ddd',
          width: ya.axisTick?.lineStyle?.width || 1,
        },
      },
      axisLabel: {
        show: ya.axisLabel?.show !== false,
        inside: ya.axisLabel?.inside || false,
        rotate: ya.axisLabel?.rotate || 0,
        margin: ya.axisLabel?.margin || 8,
        formatter: ya.axisLabel?.formatter || undefined,
        ...buildTextStyle(ya.axisLabel?.textStyle, 'yAxisLabel'),
      },
      splitLine: {
        show: typeof ya.splitLine === 'boolean' ? ya.splitLine : ya.splitLine?.show !== false,
        lineStyle: {
          color: ya.splitLine?.lineStyle?.color || '#eee',
          width: ya.splitLine?.lineStyle?.width || 1,
          type: ya.splitLine?.lineStyle?.type || 'solid',
        },
      },
      splitArea: {
        show: ya.splitArea?.show || false,
        areaStyle: {
          color: ya.splitArea?.areaStyle?.color || 'rgba(250,250,250,0.3)',
        },
      },
      data: ya.data ? JSON.parse(ya.data) : undefined,
      z: ya.z || 0,
      zlevel: ya.zlevel || 0,
    }
    opt.yAxis = axisCfg
  }

  opt.color = palette
  return opt
}

function addMarkLine(series, config) {
  if (config.markLine?.show) {
    const data = []
    const mlType = config.markLine.type || 'average'
    if (mlType === 'custom') {
      data.push({ yAxis: config.markLine.customValue ?? 0, name: `阈值 ${config.markLine.customValue ?? 0}` })
    } else {
      data.push({ type: mlType, name: mlType })
    }
    const mL = config.markLine
    series.markLine = {
      symbol: mL.symbol || 'none',
      data,
      lineStyle: {
        color: mL.color ?? mL.lineStyle?.color ?? '#E63946',
        width: mL.width ?? mL.lineStyle?.width ?? 1.5,
        type: mL.lineType ?? mL.lineStyle?.type ?? 'dashed',
      },
      label: {
        show: mL.showLabel !== false && mL.label?.show !== false,
        position: mL.label?.position || 'end',
        formatter: mL.label?.formatter || '{b}',
        ...buildTextStyle(mL.label?.textStyle, 'markLineLabel'),
      },
    }
  }
  return series
}

function buildLegendPosition(opt, config) {
  // legend positioning already handled in buildCommonOption
  return opt
}

function getGroups(rows, groupDim) {
  const groups = {}
  rows.forEach((r) => {
    const g = String(r[groupDim.field]?.value ?? '无')
    if (!groups[g]) groups[g] = []
    groups[g].push(r)
  })
  return groups
}

function getCats(dim, rows) {
  return [...new Set(rows.map((r) => String(r[`dim:${dim.field}`]?.value ?? '')))]
}

function assertChartData(data) {
  const { dimensions, metrics, rows } = data || {}
  const dim = dimensions?.[0]
  const metric = metrics?.[0]
  if (!dim || !metric || !rows?.length) {
    return { ok: false, msg: '请配置维度与指标后展示' }
  }
  return { ok: true, dim, metric }
}

// ---- 柱形图 ----
function buildBar(data, config, palette, horizontal = false) {
  const check = assertChartData(data)
  if (!check.ok) return emptyOption(check.msg)
  const { dimensions, metrics, rows } = data
  const dim = check.dim
  const groupDim = dimensions[1]
  const metric = check.metric

  const opt = buildCommonOption(config, palette)
  const series = []
  const cats = getCats(dim, rows)
  const barStyle = {}
  if (config.barWidth > 0) barStyle.barMaxWidth = config.barWidth
  if (config.rounded) {
    barStyle.itemStyle = { borderRadius: 4 }
  }
  if (config.barGap && config.barGap !== 20) barStyle.barGap = `${config.barGap}%`

  if (groupDim) {
    const groups = getGroups(rows, groupDim)
    Object.entries(groups).forEach(([g, rws]) => {
      const s = { name: g, type: 'bar', data: rws.map((r) => r[metric.field]), ...barStyle }
      addMarkLine(s, config)
      applyLabelConfig(s, config)
      series.push(s)
    })
  } else {
    const s = { name: metric.label, type: 'bar', data: rows.map((r) => r[metric.field]), ...barStyle }
    addMarkLine(s, config)
    applyLabelConfig(s, config)
    series.push(s)
  }

  // Merge common grid/xAxis/yAxis config with chart-specific defaults
  const defaultGrid = horizontal
    ? { left: 100, right: 30, top: groupDim ? 44 : 20, bottom: 30 }
    : { left: 60, right: 30, top: groupDim ? 44 : 30, bottom: 36 }
  const defaultXAxis = horizontal
    ? { type: 'value' }
    : { type: 'category', data: cats, axisLabel: { interval: 0, rotate: cats.length > 8 ? 35 : 0, width: cats.length > 8 ? 80 : undefined, overflow: 'truncate' } }
  const defaultYAxis = horizontal
    ? { type: 'category', data: cats, axisLabel: { interval: 0 } }
    : { type: 'value' }

  opt.grid = mergeConfig(defaultGrid, opt.grid)
  opt.xAxis = mergeConfig(defaultXAxis, opt.xAxis)
  opt.yAxis = mergeConfig(defaultYAxis, opt.yAxis)
  opt.series = series
  return opt
}

function applyLabelConfig(series, config) {
  if (config.label?.show) {
    const l = config.label
    series.label = {
      show: true,
      position: l.position || 'top',
      formatter: l.formatter || undefined,
      color: l.color || 'inherit',
      fontSize: l.fontSize || 12,
      fontWeight: l.fontWeight || 'normal',
      fontStyle: l.fontStyle || 'normal',
      fontFamily: l.fontFamily !== 'inherit' ? l.fontFamily : undefined,
      textDecoration: l.textDecoration !== 'none' ? l.textDecoration : undefined,
      align: l.align || 'auto',
      verticalAlign: l.verticalAlign || 'auto',
      lineHeight: l.lineHeight || 1.2,
      rich: l.rich ? {} : undefined,
      rotate: l.rotate || 0,
      overflow: l.overflow || 'none',
      width: l.width || undefined,
      height: l.height || undefined,
      borderColor: l.borderColor || 'transparent',
      borderWidth: l.borderWidth || 0,
      borderRadius: l.borderRadius || 0,
      backgroundColor: l.backgroundColor || 'transparent',
      padding: l.padding || 0,
      shadowColor: l.shadowColor || 'transparent',
      shadowBlur: l.shadowBlur || 0,
      shadowOffsetX: l.shadowOffsetX || 0,
      shadowOffsetY: l.shadowOffsetY || 0,
      distance: l.distance || 5,
      offset: l.offset ? JSON.parse(l.offset) : undefined,
      bleedMargin: l.bleedMargin || 10,
    }
  }
  return series
}

function buildStackedBar(data, config, palette, horizontal = false) {
  const opt = buildBar(data, config, palette, horizontal)
  if (opt.series) opt.series.forEach((s) => { s.stack = 'total' })
  return opt
}

function buildPercentStackedBar(data, config, palette, horizontal = false) {
  const opt = buildStackedBar(data, config, palette, horizontal)
  if (config.showPercentLabel !== false) {
    opt.series.forEach((s) => applyLabelConfig(s, { ...config, label: { show: true, formatter: '{d}%' } }))
  }
  if (horizontal) {
    opt.xAxis.max = 100
    opt.xAxis.axisLabel = { formatter: '{value}%' }
  } else {
    opt.yAxis.max = 100
    opt.yAxis.axisLabel = { formatter: '{value}%' }
  }
  return opt
}

// ---- 折线图 ----
function buildLineChart(data, config, palette) {
  const check = assertChartData(data)
  if (!check.ok) return emptyOption(check.msg)
  const { dimensions, metrics, rows } = data
  const dim = check.dim
  const groupDim = dimensions[1]
  const metric = check.metric

  const opt = buildCommonOption(config, palette)
  const series = []
  const cats = getCats(dim, rows)

  const lineStyle = {
    type: 'line',
    smooth: !!config.smooth,
    symbol: 'circle',
    symbolSize: 6,
  }
  if (config.step) lineStyle.step = config.step
  if (config.areaStyle) lineStyle.areaStyle = { opacity: config.opacity || 0.4 }

  if (groupDim) {
    const groups = getGroups(rows, groupDim)
    Object.entries(groups).forEach(([g, rws]) => {
      const s = { name: g, data: rws.map((r) => r[metric.field]), ...lineStyle }
      addMarkLine(s, config)
      series.push(s)
    })
  } else {
    const s = { name: metric.label, data: rows.map((r) => r[metric.field]), ...lineStyle }
    addMarkLine(s, config)
    series.push(s)
  }

  const defaultGrid = { left: 60, right: 30, top: groupDim ? 44 : 30, bottom: 36 }
  const defaultXAxis = { type: 'category', data: cats, axisLabel: { interval: 0, rotate: cats.length > 8 ? 35 : 0, width: cats.length > 8 ? 80 : undefined, overflow: 'truncate' } }
  const defaultYAxis = { type: 'value' }

  opt.grid = mergeConfig(defaultGrid, opt.grid)
  opt.xAxis = mergeConfig(defaultXAxis, opt.xAxis)
  opt.yAxis = mergeConfig(defaultYAxis, opt.yAxis)
  opt.series = series
  return opt
}

function buildAreaChart(data, config, palette, stacked = false) {
  const opt = buildLineChart(data, config, palette)
  if (stacked) {
    opt.series.forEach((s) => {
      s.stack = 'total'
      s.areaStyle = { opacity: config.opacity ?? 0.6 }
    })
  } else if (config.areaStyle) {
    opt.series.forEach((s) => { s.areaStyle = { opacity: config.opacity || 0.4 } })
  }
  return opt
}

// ---- 饼图 ----
function buildPie(data, config, palette, type = 'pie') {
  const check = assertChartData(data)
  if (!check.ok) return emptyOption(check.msg)
  const { dimensions, metrics, rows } = data
  const dim = check.dim
  const metric = check.metric

  const opt = buildCommonOption(config, palette)
  const pieData = rows.map((r) => ({ name: String(r[`dim:${dim.field}`]?.value ?? ''), value: r[metric.field] }))

  let seriesCfg = {
    name: metric.label,
    type: 'pie',
    data: pieData,
    emphasis: { itemStyle: { shadowBlur: 8, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.4)' } },
  }

  switch (type) {
    case 'pie':
      seriesCfg.radius = `${config.radius ?? 65}%`
      seriesCfg.startAngle = config.startAngle ?? 90
      if (config.roseType) seriesCfg.roseType = 'radius'
      seriesCfg.label = { position: config.labelPosition || 'outside' }
      break
    case 'doughnut':
      seriesCfg.radius = [`${config.radiusInner ?? 40}%`, `${config.radiusOuter ?? 68}%`]
      seriesCfg.startAngle = config.startAngle ?? 90
      seriesCfg.label = { position: config.labelPosition || 'outside' }
      break
    case 'nightingale':
      seriesCfg.radius = ['10%', `${config.radius ?? 80}%`]
      seriesCfg.roseType = config.roseType || 'radius'
      break
    case 'sunburst':
      seriesCfg.radius = ['10%', `${config.radius ?? 80}%`]
      seriesCfg.startAngle = config.startAngle ?? 90
      break
  }

  opt.series = [seriesCfg]
  return opt
}

// ---- 漏斗图 ----
function buildFunnel(data, config, palette, horizontal = false) {
  const check = assertChartData(data)
  if (!check.ok) return emptyOption(check.msg)
  const { dimensions, metrics, rows } = data
  const dim = check.dim
  const metric = check.metric

  const opt = buildCommonOption(config, palette)
  opt.series = [{
    name: metric.label,
    type: 'funnel',
    left: horizontal ? '10%' : '20%',
    top: horizontal ? '10%' : '10%',
    bottom: horizontal ? '10%' : '10%',
    width: horizontal ? '80%' : '60%',
    sort: config.sort || 'descending',
    gap: config.gap ?? 2,
    label: { show: true, position: 'inside', formatter: '{b}: {c}' },
    data: rows.map((r) => ({ name: String(r[`dim:${dim.field}`]?.value ?? ''), value: r[metric.field] })),
  }]
  return opt
}

// ---- 散点图/气泡图 ----
function buildScatter(data, config, palette, isBubble = false) {
  const check = assertChartData(data)
  if (!check.ok) return emptyOption(check.msg)
  const { dimensions, metrics, rows } = data
  const dim = check.dim
  const metric = check.metric

  const opt = buildCommonOption(config, palette)
  const scatterData = rows.map((r) => {
    const x = r[`dim:${dim.field}`]?.value
    const y = r[metric.field]
    return isBubble ? [x, y, Math.abs(y) || 10] : [x, y]
  })

  opt.grid = mergeConfig({ left: 60, right: 30, top: 40, bottom: 40 }, opt.grid)
  opt.xAxis = mergeConfig(opt.xAxis, { type: 'value', name: dim.label || dim.field, boundaryGap: '0%' })
  opt.yAxis = mergeConfig(opt.yAxis, { type: 'value', name: metric.label, boundaryGap: '0%' })
  opt.series = [{
    name: metric.label,
    type: 'scatter',
    data: scatterData,
    symbolSize: isBubble
      ? (val) => Math.max(5, (val[2] / 100) * (config.symbolSize || 50))
      : (config.symbolSize || 10),
  }]
  return opt
}

// ---- 雷达图 ----
function buildRadar(data, config, palette) {
  const check = assertChartData(data)
  if (!check.ok) return emptyOption(check.msg)
  const { dimensions, metrics, rows } = data
  const dim = check.dim
  return buildCommonOption(config, palette)
  // Radar uses multiple metrics as axes; a simpler implementation:
  // Use each row as an indicator, each metric as a series
  // We'll build radar from multiple metrics
  // eslint-disable-next-line no-unreachable
  const indicators = rows.map((r) => {
    const maxVal = Math.max(...metrics.map((m) => r[m.field] || 0))
    return { name: String(r[`dim:${dim.field}`]?.value ?? ''), max: maxVal * 1.2 || 100 }
  })
  const opt = {
    ...buildCommonOption(config, palette),
    radar: { indicator: indicators, shape: config.shape || 'polygon', splitNumber: config.splitNumber || 5 },
    series: metrics.map((m) => ({
      name: m.label, type: 'radar',
      areaStyle: { opacity: config.areaOpacity ?? 0.2 },
      data: [{ value: rows.map((r) => r[m.field]), name: m.label }],
    })),
  }
  return opt
}

// ---- 仪表盘 ----
function buildGauge(data, config, palette) {
  const { metrics, rows } = data || {}
  const metric = metrics?.[0]
  if (!metric || !rows?.length) return emptyOption('请配置指标')
  const opt = buildCommonOption(config, palette)
  opt.series = [{
    type: 'gauge',
    min: config.min ?? 0,
    max: config.max ?? 100,
    splitNumber: config.splitNumber ?? 10,
    progress: { show: true, width: config.progressWidth ?? 10 },
    axisLine: { lineStyle: { width: config.progressWidth ?? 10 } },
    axisTick: { show: true },
    splitLine: { show: true, length: 10, lineStyle: { width: 2 } },
    axisLabel: { distance: 20, fontSize: 10 },
    pointer: { show: true },
    detail: { valueAnimation: true, formatter: '{value}', fontSize: 24, offsetCenter: [0, '70%'] },
    data: [{ value: rows[0][metric.field], name: metric.label }],
  }]
  return opt
}

// ---- 热力图 ----
function buildHeatmap(data, config, palette) {
  const { dimensions, metrics, rows } = data || {}
  const dimX = dimensions?.[0]
  const dimY = dimensions?.[1]
  const metric = metrics?.[0]
  if (!dimX || !dimY || !metric || !rows?.length) return emptyOption('请配置 X/Y 维度与指标')
  const opt = buildCommonOption(config, palette)
  const xCats = getCats(dimX, rows)
  const yCats = getCats(dimY, rows)
  const heatData = rows.map((r) => [
    xCats.indexOf(String(r[`dim:${dimX.field}`]?.value ?? '')),
    yCats.indexOf(String(r[`dim:${dimY.field}`]?.value ?? '')),
    r[metric.field],
  ])
  opt.grid = mergeConfig({ left: 80, right: 80, top: 40, bottom: 60 }, opt.grid)
  opt.xAxis = mergeConfig(opt.xAxis, { type: 'category', data: xCats, boundaryGap: true, splitArea: { show: true } })
  opt.yAxis = mergeConfig(opt.yAxis, { type: 'category', data: yCats, boundaryGap: true, splitArea: { show: true } })
  opt.visualMap = {
    min: Math.min(...heatData.map((d) => d[2])),
    max: Math.max(...heatData.map((d) => d[2])),
    calculable: true, orient: 'vertical', right: 0, top: 'center',
  }
  opt.series = [{ type: 'heatmap', data: heatData, label: config.showValues ? { show: true } : undefined }]
  return opt
}

// ---- 瀑布图 ----
function buildWaterfall(data, config, palette) {
  const check = assertChartData(data)
  if (!check.ok) return emptyOption(check.msg)
  const { dimensions, rows } = data
  const dim = check.dim
  const metric = check.metric
  const cats = getCats(dim, rows)
  const values = rows.map((r) => r[metric.field])
  let cumulative = 0
  const placeholder = values.map((v) => { const p = cumulative; cumulative += v; return p })
  const increaseColor = config.increaseColor || '#67C23A'
  const decreaseColor = config.decreaseColor || '#F56C6C'

  const opt = buildCommonOption(config, palette)
  opt.grid = mergeConfig({ left: 60, right: 30, top: 30, bottom: 36 }, opt.grid)
  opt.xAxis = mergeConfig({ type: 'category', data: cats }, opt.xAxis)
  opt.yAxis = mergeConfig({ type: 'value' }, opt.yAxis)
  opt.series = [
    { name: '占位', type: 'bar', stack: 'waterfall', itemStyle: { borderColor: 'transparent', color: 'transparent' }, emphasis: { itemStyle: { borderColor: 'transparent', color: 'transparent' } }, data: placeholder },
    { name: metric.label, type: 'bar', stack: 'waterfall', data: values.map((v, i) => ({ value: Math.abs(v), itemStyle: { color: v >= 0 ? increaseColor : decreaseColor } })) },
  ]
  return opt
}

// ---- 箱线图 ----
function buildBoxplot(data, config, palette) {
  const check = assertChartData(data)
  if (!check.ok) return emptyOption(check.msg)
  const { dimensions, rows } = data
  const dim = check.dim
  const metric = check.metric
  const groups = {}
  rows.forEach((r) => {
    const g = String(r[`dim:${dim.field}`]?.value ?? '无')
    if (!groups[g]) groups[g] = []
    groups[g].push(r[metric.field])
  })
  const cats = Object.keys(groups)
  const boxData = cats.map((g) => {
    const vals = [...groups[g]].sort((a, b) => a - b)
    const len = vals.length
    const q = (p) => vals[Math.min(len - 1, Math.floor(len * p))]
    return [q(0), q(0.25), q(0.5), q(0.75), q(1)]
  })

  const opt = buildCommonOption(config, palette)
  opt.grid = mergeConfig({ left: 60, right: 30, top: 40, bottom: 36 }, opt.grid)
  opt.xAxis = mergeConfig({ type: 'category', data: cats }, opt.xAxis)
  opt.yAxis = mergeConfig({ type: 'value' }, opt.yAxis)
  opt.series = [{ type: 'boxplot', data: boxData }]
  return opt
}

// ---- 矩形树图 ----
function buildTreemap(data, config, palette) {
  const check = assertChartData(data)
  if (!check.ok) return emptyOption(check.msg)
  const { dimensions, rows } = data
  const dim = check.dim
  const metric = check.metric
  const opt = buildCommonOption(config, palette)
  opt.series = [{
    type: 'treemap',
    data: rows.map((r) => ({ name: String(r[`dim:${dim.field}`]?.value ?? ''), value: r[metric.field] })),
    orient: config.orient || 'horizontal',
  }]
  return opt
}

// ---- 桑基图 ----
function buildSankey(data, config, palette) {
  const { dimensions, metrics, rows } = data || {}
  const metric = metrics?.[0]
  if (!rows?.length || dimensions.length < 2 || !metric) return emptyOption('请配置 来源节点/目标节点/数值')
  const sourceDim = dimensions[0]
  const targetDim = dimensions[1]
  const nodeSet = new Set()
  const links = rows.map((r) => {
    const s = String(r[`dim:${sourceDim.field}`]?.value ?? '无')
    const t = String(r[`dim:${targetDim.field}`]?.value ?? '无')
    nodeSet.add(s)
    nodeSet.add(t)
    return { source: s, target: t, value: r[metric.field] }
  })
  const opt = buildCommonOption(config, palette)
  opt.series = [{
    type: 'sankey',
    data: [...nodeSet].map((n) => ({ name: n })),
    links,
    nodeWidth: config.nodeWidth ?? 20,
    nodeGap: config.nodeGap ?? 8,
    layoutIterations: config.layoutIterations ?? 32,
    emphasis: { focus: 'adjacency' },
  }]
  return opt
}

// ---- 日历图 ----
function buildCalendar(data, config, palette) {
  const check = assertChartData(data)
  if (!check.ok) return emptyOption(check.msg)
  const { dimensions, rows } = data
  const dim = check.dim
  const metric = check.metric
  const calData = rows.map((r) => [String(r[`dim:${dim.field}`]?.value ?? ''), r[metric.field]])
  const values = calData.map((d) => d[1])
  const opt = buildCommonOption(config, palette)
  const year = new Date().getFullYear()
  opt.calendar = [{
    top: 60, left: 80, right: 30, cellSize: config.cellSize || 20,
    range: String(year),
    itemStyle: { borderWidth: 0.5 },
    yearLabel: { show: true }, monthLabel: { show: true }, dayLabel: { show: true },
  }]
  opt.visualMap = { min: Math.min(...values), max: Math.max(...values), calculable: true, orient: 'horizontal', left: 'center', bottom: 0 }
  opt.series = [{ type: 'heatmap', coordinateSystem: 'calendar', data: calData }]
  return opt
}

// ---- 极坐标图 ----
function buildPolarBar(data, config, palette) {
  const check = assertChartData(data)
  if (!check.ok) return emptyOption(check.msg)
  const { rows } = data
  const dim = check.dim
  const metric = check.metric
  const opt = buildCommonOption(config, palette)
  const barCfg = {}
  if (config.barWidth > 0) barCfg.barMaxWidth = config.barWidth
  opt.angleAxis = { type: 'category', data: rows.map((r) => String(r[`dim:${dim.field}`]?.value ?? '')) }
  opt.radiusAxis = {}
  opt.polar = {}
  opt.series = [{ type: 'bar', coordinateSystem: 'polar', data: rows.map((r) => r[metric.field]), ...barCfg }]
  return opt
}

// ---- K线图 ----
function buildCandlestick(data, config, palette) {
  const { dimensions, metrics, rows } = data || {}
  if (!rows?.length || metrics.length < 4) return emptyOption('K线图需要 日期维度 + 开/高/低/收 4个指标')
  const dim = dimensions?.[0]
  const opt = buildCommonOption(config, palette)
  const cats = rows.map((r) => String(r[`dim:${dim.field}`]?.value ?? ''))
  const ohlc = rows.map((r) => [r[metrics[0].field], r[metrics[1].field], r[metrics[2].field], r[metrics[3].field]])
  opt.grid = mergeConfig({ left: 60, right: 30, top: 30, bottom: 36 }, opt.grid)
  opt.xAxis = mergeConfig({ type: 'category', data: cats }, opt.xAxis)
  opt.yAxis = mergeConfig({ type: 'value' }, opt.yAxis)
  opt.series = [{
    type: 'candlestick', data: ohlc,
    itemStyle: {
      color: config.upColor || '#F56C6C', color0: config.downColor || '#67C23A',
      borderColor: config.upColor || '#F56C6C', borderColor0: config.downColor || '#67C23A',
    },
  }]
  return opt
}

// ---- 进度的原生DOM渲染配置 ----
function buildProgress(data, config, type) {
  const { metrics, rows } = data || {}
  const metric = metrics?.[0]
  const value = rows?.[0]?.[metric?.field]
  return { _progress: { value: value ?? 0, max: config.max ?? 100, label: metric?.label || '', type, config } }
}

// ---- 指标卡 ----
function buildStat(data, config) {
  const { metrics, rows } = data || {}
  const metric = metrics?.[0]
  return { _stat: { value: rows?.[0]?.[metric?.field] ?? 0, label: metric?.label || '指标', config } }
}

// ---- 指标趋势图 ----
function buildStatTrend(data, config) {
  const { metrics, rows } = data || {}
  const metric = metrics?.[0]
  const dim = data?.dimensions?.[0]
  const trend = rows?.map((r) => ({ label: String(r[`dim:${dim?.field}`]?.value ?? ''), value: r[metric?.field] })) || []
  return { _statTrend: { value: trend[trend.length - 1]?.value ?? rows?.[0]?.[metric?.field] ?? 0, label: metric?.label || '指标', trend, config } }
}

// ---- 地图返回占位 ----
function buildMap(data, config, type, mode) {
  return { _map: { type, data: data || {}, config, mode } }
}

function emptyOption(msg) {
  return { title: { text: msg || '请配置数据', left: 'center', top: 'middle', textStyle: { color: '#909399', fontSize: 14 } } }
}

// ---- 主导出：chartType → option生成器 ----
export const OPTION_BUILDERS = {
  // 柱形图
  bar: (d, c, p) => buildBar(d, c, p),
  barClustered: (d, c, p) => buildBar(d, c, p),
  barStacked: (d, c, p) => buildStackedBar(d, c, p),
  barLine: (d, c, p) => {
    const opt = buildBar(d, c, p)
    if (opt.series?.length > 0 && opt.series[0]?.type === 'bar') {
      // 将最后一个系列转为折线
      const last = opt.series[opt.series.length - 1]
      last.type = 'line'
      last.smooth = !!c.smooth
    } else if (opt.series?.length > 0) {
      opt.series[opt.series.length - 1].type = 'line'
      opt.series[opt.series.length - 1].smooth = !!c.smooth
    }
    return opt
  },
  barPictorial: (d, c, p) => {
    const opt = buildBar(d, c, p)
    opt.series?.forEach((s) => {
      s.type = 'pictorialBar'
      s.symbol = c.symbolType || 'rect'
      s.symbolRepeat = true
      s.symbolMargin = 1
    })
    return opt
  },
  barPercentStacked: (d, c, p) => buildPercentStackedBar(d, c, p),
  barGroupStacked: (d, c, p) => buildStackedBar(d, c, p),
  barStackedLine: (d, c, p) => {
    const opt = buildStackedBar(d, c, p)
    if (opt.series?.length > 0) {
      const last = opt.series[opt.series.length - 1]
      last.type = 'line'
      last.smooth = true
    }
    return opt
  },
  barStackedPictorial: (d, c, p) => {
    const opt = buildStackedBar(d, c, p)
    opt.series?.forEach((s) => {
      s.type = 'pictorialBar'
      s.symbol = c.symbolType || 'rect'
      s.symbolRepeat = true
      s.symbolMargin = 1
    })
    return opt
  },
  bullet: (d, c, p) => buildBar(d, c, p),
  waterfall: (d, c, p) => buildWaterfall(d, c, p),
  pareto: (d, c, p) => {
    const opt = buildBar(d, c, p)
    if (opt.series?.length > 0 && c.showLine !== false) {
      const s0 = opt.series[0]
      const total = s0.data.reduce((a, b) => a + b, 0)
      let cum = 0
      opt.series.push({
        name: '累积占比%', type: 'line', yAxisIndex: 0,
        data: s0.data.map((v) => { cum += v; return Math.round((cum / total) * 100) }),
        lineStyle: { width: 2 }, symbol: 'circle', symbolSize: 5,
      })
    }
    return opt
  },

  // 条形图
  horizontalBar: (d, c, p) => buildBar(d, c, p, true),
  horizontalBarClustered: (d, c, p) => buildBar(d, c, p, true),
  horizontalBarStacked: (d, c, p) => buildStackedBar(d, c, p, true),
  horizontalBarPercentStacked: (d, c, p) => buildPercentStackedBar(d, c, p, true),
  horizontalBarGroupStacked: (d, c, p) => buildStackedBar(d, c, p, true),
  horizontalBullet: (d, c, p) => buildBar(d, c, p, true),
  butterfly: (d, c, p) => {
    const opt = buildBar(d, c, p, true)
    const cats = opt.yAxis?.data || []
    opt.series = opt.series.map((s, i) => {
      const isFirst = i === 0
      return { ...s, data: s.data.map((v, j) => {
        const val = Math.abs(v)
        return isFirst ? -val : val
      }) }
    })
    opt.yAxis.axisLabel = { formatter: (v) => {
      const idx = cats.indexOf(v)
      if (idx < 0) return v
      return Math.abs(Number(v)) || v
    } }
    opt.xAxis.axisLabel = { formatter: (v) => Math.abs(v) }
    return opt
  },

  // 折线图与面积图
  line: (d, c, p) => buildLineChart(d, c, p),
  lineMulti: (d, c, p) => buildLineChart(d, c, p),
  areaStacked: (d, c, p) => buildAreaChart(d, c, p, true),
  areaPercentStacked: (d, c, p) => {
    const opt = buildAreaChart(d, c, p, true)
    opt.series.forEach((s) => { s.label = { show: true, formatter: '{d}%' } })
    opt.yAxis.max = 100
    opt.yAxis.axisLabel = { formatter: '{value}%' }
    return opt
  },

  // 饼图与漏斗图
  pie: (d, c, p) => buildPie(d, c, p, 'pie'),
  doughnut: (d, c, p) => buildPie(d, c, p, 'doughnut'),
  sunburst: (d, c, p) => buildPie(d, c, p, 'sunburst'),
  nightingale: (d, c, p) => buildPie(d, c, p, 'nightingale'),
  funnel: (d, c, p) => buildFunnel(d, c, p, false),
  funnelHorizontal: (d, c, p) => buildFunnel(d, c, p, true),

  // 散点图与气泡图
  scatter: (d, c, p) => buildScatter(d, c, p, false),
  bubble: (d, c, p) => buildScatter(d, c, p, true),

  // 指标与进度
  stat: (d, c) => buildStat(d, c),
  progressBar: (d, c, p) => buildProgress(d, c, 'bar'),
  circularProgress: (d, c, p) => buildProgress(d, c, 'circle'),
  multiRingProgress: (d, c, p) => buildProgress(d, c, 'multiRing'),
  fluidProgress: (d, c, p) => buildProgress(d, c, 'fluid'),
  gauge: (d, c, p) => buildGauge(d, c, p),
  statTrend: (d, c) => buildStatTrend(d, c),

  // 地图
  mapChina: (d, c, p) => buildMap(d, c, 'china', 'heat'),
  mapChinaBubble: (d, c, p) => buildMap(d, c, 'china', 'bubble'),
  mapChinaSymbol: (d, c, p) => buildMap(d, c, 'china', 'symbol'),
  mapWorld: (d, c, p) => buildMap(d, c, 'world', 'heat'),

  // 表格
  table: (d) => ({ _table: d }),

  // 其他
  heatmap: (d, c, p) => buildHeatmap(d, c, p),
  boxplot: (d, c, p) => buildBoxplot(d, c, p),
  radar: (d, c, p) => buildRadar(d, c, p),
  polarBar: (d, c, p) => buildPolarBar(d, c, p),
  barBreakAxis: (d, c, p) => {
    // 断轴柱状图：用 markArea 表示断裂区域
    const opt = buildBar(d, c, p)
    if (opt.series?.length > 0 && c.breakEnd > c.breakStart) {
      // 将超过断点的值替换为间隙指示
      const bs = c.breakStart
      const be = c.breakEnd
      opt.series.forEach((s) => {
        s.data = s.data.map((v) => (v > bs && v < be) ? bs : v)
      })
      if (opt.yAxis) {
        opt.yAxis.axisLabel = { formatter: (v) => (v >= bs && v <= be) ? '~' : v }
      }
    }
    return opt
  },
  calendar: (d, c, p) => buildCalendar(d, c, p),
  candlestick: (d, c, p) => buildCandlestick(d, c, p),
  treemap: (d, c, p) => buildTreemap(d, c, p),
  sankey: (d, c, p) => buildSankey(d, c, p),
  chord: (d, c, p) => {
    const opt = buildSankey(d, c, p)
    if (opt.series?.[0]) opt.series[0].type = 'graph'
    return opt
  },
}
