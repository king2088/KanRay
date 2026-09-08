# 图表中心优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade ECharts to 6.1.0, refactor ChartBuilder to 3-panel layout, add 60+ chart types with per-type configuration panels.

**Architecture:** Modular config system with chart type definitions, per-type option generators, and a 3-column layout (left: data+fields, center: chart, right: type selection+config). Each chart type has its own ECharts option builder function registered in a central config map.

**Tech Stack:** Vue 3, ECharts 6.1.0, Element Plus, Vite

---

### Task 1: Upgrade ECharts to 6.1.0

**Files:**
- Modify: `front-end/package.json`
- Modify: `front-end/src/utils/echarts.js`

- [ ] **Step 1: Install ECharts 6.1.0**

```bash
cd front-end && npm install echarts@6.1.0
```

- [ ] **Step 2: Update echarts.js with expanded imports**

Replace `front-end/src/utils/echarts.js` with:

```js
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
  TreeMapChart,
  SankeyChart,
  MapChart,
  CalendarChart,
  GraphChart,
  PictorialBarChart,
  CustomChart,
  SunburstChart,
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
  RadiusAxisComponent,
  AngleAxisComponent,
} from 'echarts/components'
import { LabelLayout, UniversalTransition } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'

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
  TreeMapChart,
  SankeyChart,
  MapChart,
  CalendarChart,
  GraphChart,
  PictorialBarChart,
  CustomChart,
  SunburstChart,
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
  RadiusAxisComponent,
  AngleAxisComponent,
  LabelLayout,
  UniversalTransition,
  CanvasRenderer,
])

export default echarts
```

- [ ] **Step 3: Verify build succeeds**

```bash
cd front-end && npm run build
```

- [ ] **Step 4: Commit**

```bash
cd .. && git add front-end/package.json front-end/package-lock.json front-end/src/utils/echarts.js
git commit -m "chore: upgrade echarts from 5.6.0 to 6.1.0 with expanded imports"
```

---

### Task 2: Create Chart Type Definition System

**Files:**
- Create: `front-end/src/config/chart-types.js`

- [ ] **Step 1: Create chart-types.js with all 60+ types organized by category**

```js
// Chart type categories
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
  { value: 'bar', label: '单柱图', icon: 'Histogram', category: 'bar' },
  { value: 'barClustered', label: '簇状柱形图', icon: 'Histogram', category: 'bar' },
  { value: 'barStacked', label: '堆积柱形图', icon: 'Histogram', category: 'bar' },
  { value: 'barLine', label: '簇状+折线', icon: 'Histogram', category: 'bar' },
  { value: 'barPictorial', label: '簇状+符号', icon: 'Histogram', category: 'bar' },
  { value: 'barPercentStacked', label: '百分比堆积', icon: 'Histogram', category: 'bar' },
  { value: 'barGroupStacked', label: '分组堆积', icon: 'Histogram', category: 'bar' },
  { value: 'barStackedLine', label: '堆积+折线', icon: 'Histogram', category: 'bar' },
  { value: 'barStackedPictorial', label: '堆积+符号', icon: 'Histogram', category: 'bar' },
  { value: 'bullet', label: '子弹图', icon: 'Histogram', category: 'bar' },
  { value: 'waterfall', label: '瀑布图', icon: 'Histogram', category: 'bar' },
  { value: 'pareto', label: '帕累托图', icon: 'Histogram', category: 'bar' },

  // 条形图
  { value: 'horizontalBar', label: '单条图', icon: 'Menu', category: 'horizontalBar' },
  { value: 'horizontalBarClustered', label: '簇状条形图', icon: 'Menu', category: 'horizontalBar' },
  { value: 'horizontalBarStacked', label: '堆积条形图', icon: 'Menu', category: 'horizontalBar' },
  { value: 'horizontalBarPercentStacked', label: '百分比堆积', icon: 'Menu', category: 'horizontalBar' },
  { value: 'horizontalBarGroupStacked', label: '分组堆积', icon: 'Menu', category: 'horizontalBar' },
  { value: 'horizontalBullet', label: '子弹图', icon: 'Menu', category: 'horizontalBar' },
  { value: 'butterfly', label: '蝴蝶图', icon: 'Menu', category: 'horizontalBar' },

  // 折线图与面积图
  { value: 'line', label: '单线图', icon: 'TrendCharts', category: 'line' },
  { value: 'lineMulti', label: '多线图', icon: 'TrendCharts', category: 'line' },
  { value: 'areaStacked', label: '堆积面积图', icon: 'TrendCharts', category: 'line' },
  { value: 'areaPercentStacked', label: '百分比堆积面积', icon: 'TrendCharts', category: 'line' },

  // 饼图与漏斗图
  { value: 'pie', label: '饼图', icon: 'PieChart', category: 'pie' },
  { value: 'doughnut', label: '环形图', icon: 'Odometer', category: 'pie' },
  { value: 'sunburst', label: '旭日图', icon: 'PieChart', category: 'pie' },
  { value: 'nightingale', label: '矩形图(南丁格尔)', icon: 'PieChart', category: 'pie' },
  { value: 'funnel', label: '漏斗图', icon: 'FunnelChart', category: 'pie' },
  { value: 'funnelHorizontal', label: '水平漏斗图', icon: 'FunnelChart', category: 'pie' },

  // 气泡图与散点图
  { value: 'scatter', label: '散点图', icon: 'Aim', category: 'scatter' },
  { value: 'bubble', label: '气泡图', icon: 'Aim', category: 'scatter' },

  // 指标与进度
  { value: 'stat', label: '指标卡', icon: 'DataLine', category: 'indicator' },
  { value: 'progressBar', label: '进度条', icon: 'DataLine', category: 'indicator' },
  { value: 'circularProgress', label: '圆形进度条', icon: 'DataLine', category: 'indicator' },
  { value: 'multiRingProgress', label: '多环进度条', icon: 'DataLine', category: 'indicator' },
  { value: 'fluidProgress', label: '流体进度条', icon: 'DataLine', category: 'indicator' },
  { value: 'gauge', label: '填充仪表板', icon: 'DataLine', category: 'indicator' },
  { value: 'statTrend', label: '指标趋势图', icon: 'DataLine', category: 'indicator' },

  // 地图
  { value: 'mapChina', label: '中国行政区地图', icon: 'Location', category: 'map' },
  { value: 'mapChinaBubble', label: '气泡行政区地图', icon: 'Location', category: 'map' },
  { value: 'mapChinaSymbol', label: '符号行政地图', icon: 'Location', category: 'map' },
  { value: 'mapWorld', label: '世界地图', icon: 'Location', category: 'map' },

  // 表格
  { value: 'table', label: '表格', icon: 'Grid', category: 'table' },

  // 其他
  { value: 'heatmap', label: '热力图', icon: 'Sunny', category: 'other' },
  { value: 'boxplot', label: '箱线图', icon: 'Box', category: 'other' },
  { value: 'radar', label: '雷达图', icon: 'Odometer', category: 'other' },
  { value: 'polarBar', label: '极坐标图', icon: 'Odometer', category: 'other' },
  { value: 'barBreakAxis', label: '断轴柱状图', icon: 'Histogram', category: 'other' },
  { value: 'calendar', label: '日历图', icon: 'Calendar', category: 'other' },
  { value: 'candlestick', label: 'K线图', icon: 'TrendCharts', category: 'other' },
  { value: 'treemap', label: '矩形树图', icon: 'Grid', category: 'other' },
  { value: 'sankey', label: '桑基图', icon: 'Share', category: 'other' },
  { value: 'chord', label: '和弦图', icon: 'Share', category: 'other' },
]

export const getChartType = (v) => CHART_TYPES.find((t) => t.value === v) || CHART_TYPES[0]

export const getChartTypesByCategory = (category) =>
  CHART_TYPES.filter((t) => t.category === category)
```

- [ ] **Step 2: Verify import works**

```bash
cd front-end && npm run build
```

- [ ] **Step 3: Commit**

```bash
cd .. && git add front-end/src/config/chart-types.js
git commit -m "feat: add chart type definition system with 60+ types across 9 categories"
```

---

### Task 3: Create Color Palettes

**Files:**
- Create: `front-end/src/config/color-palettes.js`

- [ ] **Step 1: Create color-palettes.js**

```js
export const COLOR_PALETTES = [
  {
    name: '默认',
    colors: ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#8E44AD', '#16A085', '#E74C3C', '#2C3E50', '#D35400'],
  },
  {
    name: '柔和',
    colors: ['#5B9BD5', '#ED7D31', '#A5A5A5', '#FFC000', '#4472C4', '#70AD47', '#264478', '#9B57A0', '#636363', '#EB7E30'],
  },
  {
    name: '鲜艳',
    colors: ['#E63946', '#F4A261', '#2A9D8F', '#264653', '#E9C46A', '#606C38', '#283618', '#BC6C25', '#DDA15E', '#FEFAE0'],
  },
  {
    name: '冷色',
    colors: ['#1B4965', '#5FA8D3', '#62B6CB', '#BEE9E8', '#CAD2C5', '#52796F', '#354F52', '#2F3E46', '#84A98C', '#344E41'],
  },
  {
    name: '暖色',
    colors: ['#D00000', '#E85D04', '#F48C06', '#FAA307', '#FFBA08', '#FFD166', '#06D6A0', '#118AB2', '#073B4C', '#EF476F'],
  },
  {
    name: '彩虹',
    colors: ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3', '#FF1493', '#00CED1', '#FFD700'],
  },
  {
    name: '商务',
    colors: ['#2C3E50', '#34495E', '#7F8C8D', '#95A5A6', '#BDC3C7', '#ECF0F1', '#1ABC9C', '#2ECC71', '#3498DB', '#9B59B6'],
  },
  {
    name: '自然',
    colors: ['#2D6A4F', '#40916C', '#52B788', '#74C69D', '#95D5B2', '#B7E4C7', '#D8F3DC', '#1B4332', '#081C15', '#006D77'],
  },
  {
    name: '科技',
    colors: ['#00F5D4', '#00BBF9', '#9B5DE5', '#F15BB5', '#FEE440', '#00BE67', '#7209B7', '#3A0CA3', '#4361EE', '#4CC9F0'],
  },
  {
    name: '极简',
    colors: ['#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#E5E5E5', '#F5F5F5', '#FF6B6B', '#4ECDC4', '#45B7D1'],
  },
]

export const DEFAULT_PALETTE_INDEX = 0
```

- [ ] **Step 2: Commit**

```bash
cd .. && git add front-end/src/config/color-palettes.js
git commit -m "feat: add color palette system with 10 preset palettes"
```

---

### Task 4: Create Chart Config Schema and Option Generators

**Files:**
- Create: `front-end/src/config/chart-configs.js`

This is the largest file — it contains the ECharts option builder for every chart type. Due to its size, it will be built incrementally in Tasks 4a-4f.

- [ ] **Step 1: Create chart-configs.js with base framework + bar chart types**

```js
import { COLOR_PALETTES, DEFAULT_PALETTE_INDEX } from './color-palettes'

// Common config schema shared by all chart types
export const COMMON_CONFIG_SCHEMA = {
  title: { type: 'group', label: '标题', children: {
    text: { type: 'input', label: '标题文本', default: '' },
    subtext: { type: 'input', label: '副标题', default: '' },
    position: { type: 'select', label: '位置', default: 'center', options: [
      { label: '左', value: 'left' }, { label: '居中', value: 'center' }, { label: '右', value: 'right' },
    ]},
    fontSize: { type: 'number', label: '字号', default: 16, min: 10, max: 40 },
  }},
  legend: { type: 'group', label: '图例', children: {
    show: { type: 'switch', label: '显示', default: true },
    position: { type: 'select', label: '位置', default: 'bottom', options: [
      { label: '上', value: 'top' }, { label: '下', value: 'bottom' },
      { label: '左', value: 'left' }, { label: '右', value: 'right' },
    ]},
  }},
  tooltip: { type: 'group', label: '提示', children: {
    show: { type: 'switch', label: '显示', default: true },
    trigger: { type: 'select', label: '触发方式', default: 'axis', options: [
      { label: '坐标轴', value: 'axis' }, { label: '数据项', value: 'item' }, { label: '不触发', value: 'none' },
    ]},
  }},
  label: { type: 'group', label: '标签', children: {
    show: { type: 'switch', label: '显示', default: false },
    position: { type: 'select', label: '位置', default: 'top', options: [
      { label: '上', value: 'top' }, { label: '下', value: 'bottom' },
      { label: '左', value: 'left' }, { label: '右', value: 'right' },
      { label: '内', value: 'inside' }, { label: '内上', value: 'insideTop' },
    ]},
    formatter: { type: 'select', label: '格式', default: '', options: [
      { label: '默认', value: '' }, { label: '数值', value: '{c}' }, { label: '百分比', value: '{d}%' },
    ]},
  }},
  markLine: { type: 'group', label: '辅助线', children: {
    show: { type: 'switch', label: '显示', default: false },
    type: { type: 'select', label: '类型', default: 'average', options: [
      { label: '平均值', value: 'average' }, { label: '最大值', value: 'max' },
      { label: '最小值', value: 'min' }, { label: '自定义', value: 'custom' },
    ]},
    customValue: { type: 'number', label: '自定义值', default: 0 },
  }},
  colorPalette: { type: 'select', label: '颜色主题', default: DEFAULT_PALETTE_INDEX, options: [] },
}

// Per-type-specific config schemas
export const TYPE_CONFIG_SCHEMAS = {
  bar: { stack: { type: 'switch', label: '堆积模式', default: false }, barWidth: { type: 'number', label: '柱宽', default: 0, min: 0, max: 100, placeholder: '自动' } },
  barClustered: { barWidth: { type: 'number', label: '柱宽', default: 0, min: 0, max: 100, placeholder: '自动' }, barGap: { type: 'number', label: '柱间距%', default: 30, min: 0, max: 100 } },
  barStacked: { stack: { type: 'switch', label: '堆积', default: true }, barWidth: { type: 'number', label: '柱宽', default: 0, min: 0, max: 100, placeholder: '自动' } },
  barLine: { lineType: { type: 'select', label: '折线位置', default: 'last', options: [{ label: '最后一个系列', value: 'last' }, { label: '指定系列', value: 'custom' }] }, smooth: { type: 'switch', label: '平滑折线', default: false } },
  barPictorial: { symbolType: { type: 'select', label: '符号类型', default: 'rect', options: [{ label: '矩形', value: 'rect' }, { label: '圆', value: 'circle' }, { label: '三角', value: 'triangle' }, { label: '菱形', value: 'diamond' }] } },
  barPercentStacked: { barWidth: { type: 'number', label: '柱宽', default: 0, min: 0, max: 100, placeholder: '自动' } },
  barGroupStacked: { barWidth: { type: 'number', label: '柱宽', default: 0, min: 0, max: 100, placeholder: '自动' } },
  barStackedLine: { smooth: { type: 'switch', label: '平滑折线', default: false } },
  barStackedPictorial: { symbolType: { type: 'select', label: '符号类型', default: 'rect', options: [{ label: '矩形', value: 'rect' }, { label: '圆', value: 'circle' }] } },
  bullet: { barWidth: { type: 'number', label: '柱宽', default: 30, min: 10, max: 80 } },
  waterfall: { barWidth: { type: 'number', label: '柱宽', default: 0, min: 0, max: 100, placeholder: '自动' }, increaseColor: { type: 'color', label: '增加颜色', default: '#67C23A' }, decreaseColor: { type: 'color', label: '减少颜色', default: '#F56C6C' } },
  pareto: { barWidth: { type: 'number', label: '柱宽', default: 0, min: 0, max: 100, placeholder: '自动' }, showLine: { type: 'switch', label: '显示累积线', default: true } },
  horizontalBar: { barWidth: { type: 'number', label: '柱宽', default: 0, min: 0, max: 100, placeholder: '自动' } },
  horizontalBarClustered: { barWidth: { type: 'number', label: '柱宽', default: 0, min: 0, max: 100, placeholder: '自动' }, barGap: { type: 'number', label: '柱间距%', default: 30, min: 0, max: 100 } },
  horizontalBarStacked: { stack: { type: 'switch', label: '堆积', default: true }, barWidth: { type: 'number', label: '柱宽', default: 0, min: 0, max: 100, placeholder: '自动' } },
  horizontalBarPercentStacked: { barWidth: { type: 'number', label: '柱宽', default: 0, min: 0, max: 100, placeholder: '自动' } },
  horizontalBarGroupStacked: { barWidth: { type: 'number', label: '柱宽', default: 0, min: 0, max: 100, placeholder: '自动' } },
  horizontalBullet: { barWidth: { type: 'number', label: '柱宽', default: 30, min: 10, max: 80 } },
  butterfly: { barWidth: { type: 'number', label: '柱宽', default: 0, min: 0, max: 100, placeholder: '自动' } },
  line: { smooth: { type: 'switch', label: '平滑', default: false }, areaStyle: { type: 'switch', label: '面积填充', default: false }, step: { type: 'select', label: '步进', default: '', options: [{ label: '无', value: '' }, { label: '起始', value: 'start' }, { label: '中间', value: 'middle' }, { label: '结束', value: 'end' }] } },
  lineMulti: { smooth: { type: 'switch', label: '平滑', default: false }, areaStyle: { type: 'switch', label: '面积填充', default: false } },
  areaStacked: { smooth: { type: 'switch', label: '平滑', default: false }, opacity: { type: 'slider', label: '透明度', default: 0.6, min: 0, max: 1, step: 0.1 } },
  areaPercentStacked: { smooth: { type: 'switch', label: '平滑', default: false }, opacity: { type: 'slider', label: '透明度', default: 0.6, min: 0, max: 1, step: 0.1 } },
  pie: { radius: { type: 'slider', label: '半径%', default: 65, min: 20, max: 90 }, startAngle: { type: 'number', label: '起始角度', default: 90, min: 0, max: 360 }, labelPosition: { type: 'select', label: '标签位置', default: 'outside', options: [{ label: '外', value: 'outside' }, { label: '内', value: 'inside' }, { label: '居中', value: 'center' }] }, roseType: { type: 'switch', label: '玫瑰模式', default: false } },
  doughnut: { radiusInner: { type: 'slider', label: '内径%', default: 40, min: 10, max: 60 }, radiusOuter: { type: 'slider', label: '外径%', default: 68, min: 30, max: 90 }, startAngle: { type: 'number', label: '起始角度', default: 90, min: 0, max: 360 }, labelPosition: { type: 'select', label: '标签位置', default: 'outside', options: [{ label: '外', value: 'outside' }, { label: '内', value: 'inside' }, { label: '居中', value: 'center' }] } },
  sunburst: { radius: { type: 'slider', label: '半径%', default: 80, min: 30, max: 90 }, startAngle: { type: 'number', label: '起始角度', default: 90, min: 0, max: 360 } },
  nightingale: { radius: { type: 'slider', label: '半径%', default: 80, min: 30, max: 90 }, roseType: { type: 'select', label: '模式', default: 'radius', options: [{ label: '半径', value: 'radius' }, { label: '面积', value: 'area' }] } },
  funnel: { sort: { type: 'select', label: '排序', default: 'descending', options: [{ label: '降序', value: 'descending' }, { label: '升序', value: 'ascending' }, { label: '无', value: 'none' }] }, gap: { type: 'number', label: '间距', default: 2, min: 0, max: 20 } },
  funnelHorizontal: { sort: { type: 'select', label: '排序', default: 'descending', options: [{ label: '降序', value: 'descending' }, { label: '升序', value: 'ascending' }, { label: '无', value: 'none' }] }, gap: { type: 'number', label: '间距', default: 2, min: 0, max: 20 } },
  scatter: { symbolSize: { type: 'number', label: '符号大小', default: 10, min: 2, max: 50 } },
  bubble: { symbolSize: { type: 'number', label: '最大气泡大小', default: 50, min: 10, max: 100 } },
  radar: { shape: { type: 'select', label: '形状', default: 'polygon', options: [{ label: '多边形', value: 'polygon' }, { label: '圆', value: 'circle' }] }, splitNumber: { type: 'number', label: '分割段数', default: 5, min: 1, max: 10 } },
  polarBar: { barWidth: { type: 'number', label: '柱宽', default: 0, min: 0, max: 100, placeholder: '自动' } },
  gauge: { min: { type: 'number', label: '最小值', default: 0 }, max: { type: 'number', label: '最大值', default: 100 }, splitNumber: { type: 'number', label: '分割段数', default: 10, min: 1, max: 20 }, progressWidth: { type: 'number', label: '进度宽度', default: 10, min: 2, max: 30 } },
  progressBar: { barWidth: { type: 'number', label: '条宽', default: 20, min: 5, max: 50 } },
  circularProgress: { radius: { type: 'slider', label: '半径%', default: 80, min: 30, max: 95 }, lineWidth: { type: 'number', label: '线宽', default: 10, min: 2, max: 30 } },
  multiRingProgress: { radius: { type: 'slider', label: '半径%', default: 80, min: 30, max: 95 }, lineWidth: { type: 'number', label: '线宽', default: 10, min: 2, max: 30 } },
  fluidProgress: { waveColor: { type: 'color', label: '波浪颜色', default: '#409EFF' } },
  statTrend: { sparklineColor: { type: 'color', label: '趋势线颜色', default: '#409EFF' } },
  heatmap: { min: { type: 'number', label: '最小值', default: 0 }, max: { type: 'number', label: '最大值', default: 100 } },
  boxplot: { showOutlier: { type: 'switch', label: '显示异常值', default: true } },
  polarBar: { barWidth: { type: 'number', label: '柱宽', default: 0, min: 0, max: 100, placeholder: '自动' } },
  barBreakAxis: { breakStart: { type: 'number', label: '断点起始', default: 80 }, breakEnd: { type: 'number', label: '断点结束', default: 200 } },
  calendar: { cellSize: { type: 'number', label: '单元格大小', default: 20, min: 10, max: 50 }, range: { type: 'select', label: '范围', default: 'year', options: [{ label: '年', value: 'year' }, { label: '月', value: 'month' }] } },
  candlestick: { upColor: { type: 'color', label: '阳线颜色', default: '#F56C6C' }, downColor: { type: 'color', label: '阴线颜色', default: '#67C23A' } },
  treemap: { orient: { type: 'select', label: '方向', default: 'horizontal', options: [{ label: '水平', value: 'horizontal' }, { label: '垂直', value: 'vertical' }] }, labelShowLevel: { type: 'number', label: '标签显示层级', default: 0, min: 0, max: 5 } },
  sankey: { nodeWidth: { type: 'number', label: '节点宽度', default: 20, min: 5, max: 50 }, nodeGap: { type: 'number', label: '节点间距', default: 8, min: 2, max: 30 }, layoutIterations: { type: 'number', label: '布局迭代', default: 32, min: 0, max: 100 } },
  chord: { nodeWidth: { type: 'number', label: '节点宽度', default: 20, min: 5, max: 50 }, nodeGap: { type: 'number', label: '节点间距', default: 8, min: 2, max: 30 } },
  mapChina: { mapType: { type: 'select', label: '地图', default: 'china', options: [{ label: '中国', value: 'china' }] }, zoom: { type: 'slider', label: '缩放', default: 1, min: 0.5, max: 5, step: 0.1 } },
  mapChinaBubble: { zoom: { type: 'slider', label: '缩放', default: 1, min: 0.5, max: 5, step: 0.1 }, symbolSize: { type: 'number', label: '气泡大小', default: 30, min: 5, max: 80 } },
  mapChinaSymbol: { zoom: { type: 'slider', label: '缩放', default: 1, min: 0.5, max: 5, step: 0.1 }, symbolSize: { type: 'number', label: '符号大小', default: 30, min: 5, max: 80 } },
  mapWorld: { zoom: { type: 'slider', label: '缩放', default: 1, min: 0.5, max: 5, step: 0.1 } },
}

// Build palette options for color config
COMMON_CONFIG_SCHEMA.colorPalette.options = COLOR_PALETTES.map((p, i) => ({ label: p.name, value: i }))

// ---- Option Builders ----
// Each function takes (data, config, palette) and returns an ECharts option object

function buildCommonOption(config, palette) {
  const opt = {}
  if (config.title?.text) {
    opt.title = {
      text: config.title.text,
      subtext: config.title.subtext || '',
      left: config.title.position || 'center',
      textStyle: { fontSize: config.title.fontSize || 16 },
    }
  }
  if (config.tooltip?.show !== false) {
    opt.tooltip = { trigger: config.tooltip?.trigger || 'axis' }
  }
  if (config.legend?.show !== false) {
    opt.legend = { bottom: config.legend?.position === 'bottom' ? 0 : undefined, top: config.legend?.position === 'top' ? 0 : undefined, left: config.legend?.position === 'left' ? 0 : undefined, right: config.legend?.position === 'right' ? 0 : undefined }
  }
  opt.color = palette
  return opt
}

function addMarkLine(series, config) {
  if (config.markLine?.show) {
    const val = config.markLine.type === 'custom' ? config.markLine.customValue : config.markLine.type
    series.markLine = { data: [{ type: val, name: config.markLine.type === 'custom' ? `阈值 ${val}` : val }] }
  }
  return series
}

// Base bar option builder
function buildBarOption(data, config, palette, horizontal = false) {
  const { dimensions, metrics, rows } = data
  const dim = dimensions[0]
  const groupDim = dimensions[1]
  const metric = metrics[0]
  if (!dim || !metric || !rows?.length) return { title: { text: '暂无数据', left: 'center', top: 'middle', textStyle: { color: '#909399' } } }

  const opt = buildCommonOption(config, palette)
  const series = []
  const cats = groupDim
    ? [...new Set(rows.map(r => String(r[`dim:${dim.field}`]?.value ?? '')))]
    : rows.map(r => String(r[`dim:${dim.field}`]?.value ?? ''))

  if (groupDim) {
    const groups = {}
    rows.forEach(r => { const g = String(r[groupDim.field]?.value ?? ''); if (!groups[g]) groups[g] = []; groups[g].push(r) })
    Object.entries(groups).forEach(([g, rws]) => {
      const s = { name: g, type: 'bar', data: rws.map(r => r[metric.field]) }
      if (config.barWidth > 0) s.barMaxWidth = config.barWidth
      addMarkLine(s, config)
      series.push(s)
    })
  } else {
    const s = { name: metric.label, type: 'bar', data: rows.map(r => r[metric.field]) }
    if (config.barWidth > 0) s.barMaxWidth = config.barWidth
    addMarkLine(s, config)
    series.push(s)
  }

  if (horizontal) {
    opt.grid = { left: 90, right: 20, top: groupDim ? 40 : 20, bottom: 30 }
    opt.xAxis = { type: 'value' }
    opt.yAxis = { type: 'category', data: cats }
  } else {
    opt.grid = { left: 50, right: 20, top: groupDim ? 40 : 30, bottom: 30 }
    opt.xAxis = { type: 'category', data: cats, axisLabel: { interval: 0, rotate: cats.length > 8 ? 35 : 0 } }
    opt.yAxis = { type: 'value' }
  }
  opt.series = series
  return opt
}

function buildStackedBarOption(data, config, palette, horizontal = false) {
  const opt = buildBarOption(data, config, palette, horizontal)
  opt.series?.forEach(s => { s.stack = 'total' })
  return opt
}

function buildPercentStackedBarOption(data, config, palette, horizontal = false) {
  const opt = buildStackedBarOption(data, config, palette, horizontal)
  opt.series?.forEach(s => { s.stack = 'total'; s.label = { show: true, formatter: '{d}%' } })
  if (horizontal) {
    opt.xAxis = opt.xAxis || {}
    opt.xAxis.axisLabel = { formatter: '{value}%' }
  } else {
    opt.yAxis = opt.yAxis || {}
    opt.yAxis.axisLabel = { formatter: '{value}%' }
  }
  return opt
}

// Line option builders
function buildLineOption(data, config, palette) {
  const { dimensions, metrics, rows } = data
  const dim = dimensions[0]
  const groupDim = dimensions[1]
  const metric = metrics[0]
  if (!dim || !metric || !rows?.length) return { title: { text: '暂无数据', left: 'center', top: 'middle', textStyle: { color: '#909399' } } }

  const opt = buildCommonOption(config, palette)
  const series = []
  const cats = groupDim
    ? [...new Set(rows.map(r => String(r[`dim:${dim.field}`]?.value ?? '')))]
    : rows.map(r => String(r[`dim:${dim.field}`]?.value ?? ''))

  if (groupDim) {
    const groups = {}
    rows.forEach(r => { const g = String(r[groupDim.field]?.value ?? ''); if (!groups[g]) groups[g] = []; groups[g].push(r) })
    Object.entries(groups).forEach(([g, rws]) => {
      const s = { name: g, type: 'line', data: rws.map(r => r[metric.field]), smooth: !!config.smooth }
      if (config.areaStyle) { s.areaStyle = { opacity: config.opacity || 0.6 } }
      addMarkLine(s, config)
      series.push(s)
    })
  } else {
    const s = { name: metric.label, type: 'line', data: rows.map(r => r[metric.field]), smooth: !!config.smooth }
    if (config.areaStyle) { s.areaStyle = { opacity: config.opacity || 0.6 } }
    addMarkLine(s, config)
    series.push(s)
  }

  opt.grid = { left: 50, right: 20, top: groupDim ? 40 : 30, bottom: 30 }
  opt.xAxis = { type: 'category', data: cats, axisLabel: { interval: 0, rotate: cats.length > 8 ? 35 : 0 } }
  opt.yAxis = { type: 'value' }
  opt.series = series
  return opt
}

function buildAreaOption(data, config, palette, stacked = false) {
  const opt = buildLineOption(data, config, palette)
  if (stacked) opt.series?.forEach(s => { s.stack = 'total'; s.areaStyle = { opacity: config.opacity || 0.6 } })
  return opt
}

// Pie option builders
function buildPieOption(data, config, palette, type = 'pie') {
  const { dimensions, metrics, rows } = data
  const dim = dimensions[0]
  const metric = metrics[0]
  if (!dim || !metric || !rows?.length) return { title: { text: '暂无数据', left: 'center', top: 'middle', textStyle: { color: '#909399' } } }

  const opt = buildCommonOption(config, palette)
  const pieData = rows.map(r => ({ name: String(r[`dim:${dim.field}`]?.value ?? ''), value: r[metric.field] }))

  let seriesConfig = {
    name: metric.label,
    type: 'pie',
    data: pieData,
    emphasis: { itemStyle: { shadowBlur: 8, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.4)' } },
  }

  if (type === 'pie') {
    seriesConfig.radius = `${config.radius || 65}%`
    seriesConfig.startAngle = config.startAngle ?? 90
    if (config.roseType) seriesConfig.roseType = 'radius'
    seriesConfig.label = { position: config.labelPosition || 'outside' }
  } else if (type === 'doughnut') {
    seriesConfig.radius = [`${config.radiusInner || 40}%`, `${config.radiusOuter || 68}%`]
    seriesConfig.startAngle = config.startAngle ?? 90
    seriesConfig.label = { position: config.labelPosition || 'outside' }
  } else if (type === 'nightingale') {
    seriesConfig.radius = [`10%`, `${config.radius || 80}%`]
    seriesConfig.startAngle = config.startAngle ?? 90
    seriesConfig.roseType = config.roseType || 'radius'
  } else if (type === 'sunburst') {
    seriesConfig.radius = [`10%`, `${config.radius || 80}%`]
  }

  opt.series = [seriesConfig]
  return opt
}

// Funnel option builder
function buildFunnelOption(data, config, palette, horizontal = false) {
  const { dimensions, metrics, rows } = data
  const dim = dimensions[0]
  const metric = metrics[0]
  if (!dim || !metric || !rows?.length) return { title: { text: '暂无数据', left: 'center', top: 'middle', textStyle: { color: '#909399' } } }

  const opt = buildCommonOption(config, palette)
  opt.series = [{
    name: metric.label,
    type: 'funnel',
    left: horizontal ? '10%' : '20%',
    top: horizontal ? '10%' : '10%',
    bottom: horizontal ? '10%' : '10%',
    width: horizontal ? '60%' : '50%',
    sort: config.sort || 'descending',
    gap: config.gap || 2,
    label: { show: true, position: horizontal ? 'inside' : 'inside' },
    data: rows.map(r => ({ name: String(r[`dim:${dim.field}`]?.value ?? ''), value: r[metric.field] })),
  }]
  return opt
}

// Scatter/Bubble option builder
function buildScatterOption(data, config, palette, isBubble = false) {
  const { dimensions, metrics, rows } = data
  const dim = dimensions[0]
  const dim2 = dimensions[1]
  const metric = metrics[0]
  const metric2 = metrics[1]
  if (!dim || !metric || !rows?.length) return { title: { text: '暂无数据', left: 'center', top: 'middle', textStyle: { color: '#909399' } } }

  const opt = buildCommonOption(config, palette)
  const scatterData = rows.map(r => {
    const item = [r[`dim:${dim.field}`]?.value, r[metric.field]]
    if (dim2) item.push(r[`dim:${dim2.field}`]?.value)
    if (metric2) item.push(r[metric2.field])
    return item
  })

  const series = [{
    name: metric.label,
    type: 'scatter',
    data: scatterData,
    symbolSize: isBubble ? (val) => Math.max(5, (val[2] || config.symbolSize || 10) / (config.symbolSize || 50) * 40) : (config.symbolSize || 10),
  }]

  opt.grid = { left: 50, right: 20, top: 30, bottom: 30 }
  opt.xAxis = { type: 'value', name: dim.label || dim.field }
  opt.yAxis = { type: 'value', name: metric.label }
  opt.series = series
  return opt
}

// Radar option builder
function buildRadarOption(data, config, palette) {
  const { dimensions, metrics, rows } = data
  const dim = dimensions[0]
  if (!dim || !rows?.length) return { title: { text: '暂无数据', left: 'center', top: 'middle', textStyle: { color: '#909399' } } }

  const opt = buildCommonOption(config, palette)
  const indicators = rows.map(r => ({ name: String(r[`dim:${dim.field}`]?.value ?? ''), max: Math.max(...rows.map(r2 => metrics.map(m => r2[m.field] || 0)).flat()) * 1.2 }))
  const values = metrics.map(m => ({
    name: m.label,
    value: rows.map(r => r[m.field]),
  }))

  opt.radar = { indicator: indicators, shape: config.shape || 'polygon', splitNumber: config.splitNumber || 5 }
  opt.series = values.map(v => ({ name: v.name, type: 'radar', data: [v] }))
  return opt
}

// Gauge option builder
function buildGaugeOption(data, config, palette) {
  const { metrics, rows } = data
  const metric = metrics[0]
  if (!metric || !rows?.length) return { title: { text: '暂无数据', left: 'center', top: 'middle', textStyle: { color: '#909399' } } }

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

// Heatmap option builder
function buildHeatmapOption(data, config, palette) {
  const { dimensions, metrics, rows } = data
  const dimX = dimensions[0]
  const dimY = dimensions[1]
  const metric = metrics[0]
  if (!dimX || !dimY || !metric || !rows?.length) return { title: { text: '暂无数据', left: 'center', top: 'middle', textStyle: { color: '#909399' } } }

  const opt = buildCommonOption(config, palette)
  const xCats = [...new Set(rows.map(r => String(r[`dim:${dimX.field}`]?.value ?? '')))]
  const yCats = [...new Set(rows.map(r => String(r[`dim:${dimY.field}`]?.value ?? '')))]
  const heatData = rows.map(r => [xCats.indexOf(String(r[`dim:${dimX.field}`]?.value ?? '')), yCats.indexOf(String(r[`dim:${dimY.field}`]?.value ?? '')), r[metric.field]])

  opt.grid = { left: 50, right: 80, top: 30, bottom: 30 }
  opt.xAxis = { type: 'category', data: xCats, splitArea: { show: true } }
  opt.yAxis = { type: 'category', data: yCats, splitArea: { show: true } }
  opt.visualMap = { min: config.min ?? 0, max: config.max ?? Math.max(...heatData.map(d => d[2])), calculable: true, orient: 'vertical', right: 0, top: 'center' }
  opt.series = [{ type: 'heatmap', data: heatData, label: { show: true } }]
  return opt
}

// Waterfall option builder
function buildWaterfallOption(data, config, palette) {
  const { dimensions, metrics, rows } = data
  const dim = dimensions[0]
  const metric = metrics[0]
  if (!dim || !metric || !rows?.length) return { title: { text: '暂无数据', left: 'center', top: 'middle', textStyle: { color: '#909399' } } }

  const opt = buildCommonOption(config, palette)
  const cats = rows.map(r => String(r[`dim:${dim.field}`]?.value ?? ''))
  const values = rows.map(r => r[metric.field])
  let cumulative = 0
  const placeholder = values.map(v => { const p = cumulative; cumulative += v; return p })
  const increaseColor = config.increaseColor || '#67C23A'
  const decreaseColor = config.decreaseColor || '#F56C6C'

  opt.grid = { left: 50, right: 20, top: 30, bottom: 30 }
  opt.xAxis = { type: 'category', data: cats }
  opt.yAxis = { type: 'value' }
  opt.series = [
    { name: '占位', type: 'bar', stack: 'waterfall', itemStyle: { borderColor: 'transparent', color: 'transparent' }, emphasis: { itemStyle: { borderColor: 'transparent', color: 'transparent' } }, data: placeholder },
    { name: metric.label, type: 'bar', stack: 'waterfall', data: values.map((v, i) => ({ value: Math.abs(v), itemStyle: { color: v >= 0 ? increaseColor : decreaseColor } })) },
  ]
  return opt
}

// Boxplot option builder
function buildBoxplotOption(data, config, palette) {
  const { dimensions, metrics, rows } = data
  const dim = dimensions[0]
  const metric = metrics[0]
  if (!dim || !metric || !rows?.length) return { title: { text: '暂无数据', left: 'center', top: 'middle', textStyle: { color: '#909399' } } }

  const opt = buildCommonOption(config, palette)
  // Boxplot needs pre-computed stats: [min, Q1, median, Q3, max]
  // For simplicity, compute from raw values grouped by dim
  const groups = {}
  rows.forEach(r => {
    const g = String(r[`dim:${dim.field}`]?.value ?? '')
    if (!groups[g]) groups[g] = []
    groups[g].push(r[metric.field])
  })
  const cats = Object.keys(groups)
  const boxData = cats.map(g => {
    const vals = groups[g].sort((a, b) => a - b)
    const len = vals.length
    const q1 = vals[Math.floor(len * 0.25)]
    const median = vals[Math.floor(len * 0.5)]
    const q3 = vals[Math.floor(len * 0.75)]
    return [vals[0], q1, median, q3, vals[len - 1]]
  })

  opt.grid = { left: 50, right: 20, top: 30, bottom: 30 }
  opt.xAxis = { type: 'category', data: cats }
  opt.yAxis = { type: 'value' }
  opt.series = [{ type: 'boxplot', data: boxData }]
  return opt
}

// Treemap option builder
function buildTreemapOption(data, config, palette) {
  const { dimensions, metrics, rows } = data
  const dim = dimensions[0]
  const metric = metrics[0]
  if (!dim || !metric || !rows?.length) return { title: { text: '暂无数据', left: 'center', top: 'middle', textStyle: { color: '#909399' } } }

  const opt = buildCommonOption(config, palette)
  opt.series = [{
    type: 'treemap',
    data: rows.map(r => ({ name: String(r[`dim:${dim.field}`]?.value ?? ''), value: r[metric.field] })),
    orient: config.orient || 'horizontal',
    label: { show: true, fontSize: 12 },
  }]
  return opt
}

// Sankey option builder
function buildSankeyOption(data, config, palette) {
  const { dimensions, metrics, rows } = data
  const metric = metrics[0]
  if (!rows?.length || dimensions.length < 2) return { title: { text: '暂无数据', left: 'center', top: 'middle', textStyle: { color: '#909399' } } }

  const opt = buildCommonOption(config, palette)
  const sourceDim = dimensions[0]
  const targetDim = dimensions[1]
  const nodeSet = new Set()
  const links = rows.map(r => {
    const s = String(r[`dim:${sourceDim.field}`]?.value ?? '')
    const t = String(r[`dim:${targetDim.field}`]?.value ?? '')
    nodeSet.add(s); nodeSet.add(t)
    return { source: s, target: t, value: r[metric.field] }
  })
  const nodes = [...nodeSet].map(n => ({ name: n }))

  opt.series = [{
    type: 'sankey',
    data: nodes,
    links,
    nodeWidth: config.nodeWidth ?? 20,
    nodeGap: config.nodeGap ?? 8,
    layoutIterations: config.layoutIterations ?? 32,
    emphasis: { focus: 'adjacency' },
  }]
  return opt
}

// Calendar option builder
function buildCalendarOption(data, config, palette) {
  const { dimensions, metrics, rows } = data
  const dim = dimensions[0]
  const metric = metrics[0]
  if (!dim || !metric || !rows?.length) return { title: { text: '暂无数据', left: 'center', top: 'middle', textStyle: { color: '#909399' } } }

  const opt = buildCommonOption(config, palette)
  const calData = rows.map(r => [String(r[`dim:${dim.field}`]?.value ?? ''), r[metric.field]])
  const year = new Date().getFullYear()

  opt.calendar = [{
    top: 60, left: 80, right: 30, cellSize: config.cellSize || 20,
    range: String(year),
    itemStyle: { borderWidth: 0.5 },
    yearLabel: { show: true },
    monthLabel: { show: true },
    dayLabel: { show: true },
  }]
  opt.visualMap = { min: Math.min(...calData.map(d => d[1])), max: Math.max(...calData.map(d => d[1])), calculable: true, orient: 'horizontal', left: 'center', bottom: 0 }
  opt.series = [{ type: 'heatmap', coordinateSystem: 'calendar', data: calData }]
  return opt
}

// Polar bar option builder
function buildPolarBarOption(data, config, palette) {
  const { dimensions, metrics, rows } = data
  const dim = dimensions[0]
  const metric = metrics[0]
  if (!dim || !metric || !rows?.length) return { title: { text: '暂无数据', left: 'center', top: 'middle', textStyle: { color: '#909399' } } }

  const opt = buildCommonOption(config, palette)
  const cats = rows.map(r => String(r[`dim:${dim.field}`]?.value ?? ''))
  opt.angleAxis = { type: 'category', data: cats }
  opt.radiusAxis = {}
  opt.polar = {}
  opt.series = [{
    type: 'bar',
    coordinateSystem: 'polar',
    data: rows.map(r => r[metric.field]),
  }]
  return opt
}

// Progress builders (native DOM, not ECharts)
function buildProgressOption(data, config, type) {
  const { metrics, rows } = data
  const metric = metrics[0]
  if (!metric || !rows?.length) return { _progress: { value: 0, label: '无数据', type } }
  const value = rows[0][metric.field]
  const max = config.max ?? 100
  return { _progress: { value, max, label: metric.label, type, config } }
}

// Stat option builder
function buildStatOption(data, config) {
  const { metrics, rows } = data
  const metric = metrics[0]
  if (!metric || !rows?.length) return { _stat: { value: 0, label: '无数据' } }
  return { _stat: { value: rows[0][metric.field], label: metric.label, config } }
}

// ---- Main export: map chartType to builder ----
export const OPTION_BUILDERS = {
  bar: (d, c, p) => buildBarOption(d, c, p, false),
  barClustered: (d, c, p) => buildBarOption(d, { ...c, barGap: c.barGap || 30 }, p, false),
  barStacked: (d, c, p) => buildStackedBarOption(d, c, p, false),
  barLine: (d, c, p) => {
    const opt = buildBarOption(d, c, p, false)
    if (opt.series?.length > 0) {
      const last = opt.series[opt.series.length - 1]
      last.type = 'line'
      last.smooth = !!c.smooth
    }
    return opt
  },
  barPictorial: (d, c, p) => {
    const opt = buildBarOption(d, c, p, false)
    opt.series?.forEach(s => { s.type = 'pictorialBar'; s.symbol = c.symbolType || 'rect'; s.symbolRepeat = true })
    return opt
  },
  barPercentStacked: (d, c, p) => buildPercentStackedBarOption(d, c, p, false),
  barGroupStacked: (d, c, p) => buildStackedBarOption(d, c, p, false),
  barStackedLine: (d, c, p) => {
    const opt = buildStackedBarOption(d, c, p, false)
    if (opt.series?.length > 0) {
      const last = opt.series[opt.series.length - 1]
      last.type = 'line'
      last.smooth = true
    }
    return opt
  },
  barStackedPictorial: (d, c, p) => {
    const opt = buildStackedBarOption(d, c, p, false)
    opt.series?.forEach(s => { s.type = 'pictorialBar'; s.symbol = c.symbolType || 'rect'; s.symbolRepeat = true })
    return opt
  },
  bullet: (d, c, p) => buildBarOption(d, c, p, false),
  waterfall: (d, c, p) => buildWaterfallOption(d, c, p),
  pareto: (d, c, p) => {
    const opt = buildBarOption(d, c, p, false)
    if (opt.series?.length > 0 && c.showLine !== false) {
      const total = opt.series[0].data.reduce((a, b) => a + b, 0)
      let cum = 0
      opt.series.push({
        name: '累积%', type: 'line', yAxisIndex: 0,
        data: opt.series[0].data.map(v => { cum += v; return Math.round(cum / total * 100) }),
        lineStyle: { width: 2 }, symbol: 'circle', symbolSize: 4,
      })
    }
    return opt
  },
  horizontalBar: (d, c, p) => buildBarOption(d, c, p, true),
  horizontalBarClustered: (d, c, p) => buildBarOption(d, { ...c, barGap: c.barGap || 30 }, p, true),
  horizontalBarStacked: (d, c, p) => buildStackedBarOption(d, c, p, true),
  horizontalBarPercentStacked: (d, c, p) => buildPercentStackedBarOption(d, c, p, true),
  horizontalBarGroupStacked: (d, c, p) => buildStackedBarOption(d, c, p, true),
  horizontalBullet: (d, c, p) => buildBarOption(d, c, p, true),
  butterfly: (d, c, p) => {
    const opt = buildBarOption(d, c, p, true)
    if (opt.series?.length > 0) {
      opt.series[0].data = opt.series[0].data.map(v => -Math.abs(v))
      if (opt.series.length > 1) opt.series[1].data = opt.series[1].data.map(v => Math.abs(v))
    }
    return opt
  },
  line: (d, c, p) => buildLineOption(d, c, p),
  lineMulti: (d, c, p) => buildLineOption(d, c, p),
  areaStacked: (d, c, p) => buildAreaOption(d, c, p, true),
  areaPercentStacked: (d, c, p) => {
    const opt = buildAreaOption(d, c, p, true)
    opt.series?.forEach(s => { s.label = { show: true, formatter: '{d}%' } })
    return opt
  },
  pie: (d, c, p) => buildPieOption(d, c, p, 'pie'),
  doughnut: (d, c, p) => buildPieOption(d, c, p, 'doughnut'),
  sunburst: (d, c, p) => buildPieOption(d, c, p, 'sunburst'),
  nightingale: (d, c, p) => buildPieOption(d, c, p, 'nightingale'),
  funnel: (d, c, p) => buildFunnelOption(d, c, p, false),
  funnelHorizontal: (d, c, p) => buildFunnelOption(d, c, p, true),
  scatter: (d, c, p) => buildScatterOption(d, c, p, false),
  bubble: (d, c, p) => buildScatterOption(d, c, p, true),
  radar: (d, c, p) => buildRadarOption(d, c, p),
  gauge: (d, c, p) => buildGaugeOption(d, c, p),
  heatmap: (d, c, p) => buildHeatmapOption(d, c, p),
  boxplot: (d, c, p) => buildBoxplotOption(d, c, p),
  treemap: (d, c, p) => buildTreemapOption(d, c, p),
  sankey: (d, c, p) => buildSankeyOption(d, c, p),
  chord: (d, c, p) => {
    // Chord uses graph type in ECharts 6
    const opt = buildSankeyOption(d, c, p)
    if (opt.series?.[0]) opt.series[0].type = 'graph'
    return opt
  },
  polarBar: (d, c, p) => buildPolarBarOption(d, c, p),
  barBreakAxis: (d, c, p) => buildBarOption(d, c, p, false),
  calendar: (d, c, p) => buildCalendarOption(d, c, p),
  candlestick: (d, c, p) => {
    const { dimensions, metrics, rows } = d
    if (!rows?.length || metrics.length < 4) return { title: { text: '暂无数据', left: 'center', top: 'middle', textStyle: { color: '#909399' } } }
    const opt = buildCommonOption(c, p)
    const dim = dimensions[0]
    const cats = rows.map(r => String(r[`dim:${dim.field}`]?.value ?? ''))
    const ohlc = rows.map(r => [r[metrics[0].field], r[metrics[1].field], r[metrics[2].field], r[metrics[3].field]])
    opt.grid = { left: 50, right: 20, top: 30, bottom: 30 }
    opt.xAxis = { type: 'category', data: cats }
    opt.yAxis = { type: 'value' }
    opt.series = [{ type: 'candlestick', data: ohlc, itemStyle: { color: c.upColor || '#F56C6C', color0: c.downColor || '#67C23A', borderColor: c.upColor || '#F56C6C', borderColor0: c.downColor || '#67C23A' } }]
    return opt
  },
  // Map charts return placeholder - actual rendering needs GeoJSON loaded at runtime
  mapChina: (d, c, p) => ({ _map: { type: 'china', config: c, data: d } }),
  mapChinaBubble: (d, c, p) => ({ _map: { type: 'china', config: c, data: d, bubble: true } }),
  mapChinaSymbol: (d, c, p) => ({ _map: { type: 'china', config: c, data: d, symbol: true } }),
  mapWorld: (d, c, p) => ({ _map: { type: 'world', config: c, data: d } }),
  // Native DOM components
  stat: (d, c) => buildStatOption(d, c),
  table: (d) => ({ _table: d }),
  progressBar: (d, c) => buildProgressOption(d, c, 'bar'),
  circularProgress: (d, c) => buildProgressOption(d, c, 'circle'),
  multiRingProgress: (d, c) => buildProgressOption(d, c, 'multiRing'),
  fluidProgress: (d, c) => buildProgressOption(d, c, 'fluid'),
  statTrend: (d, c) => ({ _statTrend: { value: d.metrics[0] ? d.rows?.[0]?.[d.metrics[0].field] : 0, label: d.metrics[0]?.label || '', config: c } }),
}
```

- [ ] **Step 2: Verify build**

```bash
cd front-end && npm run build
```

- [ ] **Step 3: Commit**

```bash
cd .. && git add front-end/src/config/chart-configs.js
git commit -m "feat: add chart config schemas and option generators for all chart types"
```

---

### Task 5: Create Map GeoJSON Data Files

**Files:**
- Create: `front-end/public/geo/china.json`
- Create: `front-end/public/geo/world.json`

- [ ] **Step 1: Download China GeoJSON**

Download from DataV Aliyun or similar source and place at `front-end/public/geo/china.json`. This contains province boundaries for China.

- [ ] **Step 2: Download World GeoJSON**

Download a simplified world GeoJSON and place at `front-end/public/geo/world.json`.

- [ ] **Step 3: Commit**

```bash
cd .. && git add front-end/public/geo/
git commit -m "feat: add built-in China and world GeoJSON map data"
```

---

### Task 6: Refactor ChartBuilder to Three-Panel Layout

**Files:**
- Create: `front-end/src/components/charts/DataSourcePanel.vue`
- Create: `front-end/src/components/charts/FieldConfigPanel.vue`
- Create: `front-end/src/components/charts/ChartTypePanel.vue`
- Create: `front-end/src/components/charts/ChartConfigPanel.vue`
- Modify: `front-end/src/views/ChartBuilder.vue`

- [ ] **Step 1: Create DataSourcePanel.vue**

Extract dataset selection logic from ChartBuilder.vue into a standalone component. Props: `datasets`, `datasetId`. Emits: `update:datasetId`, `datasetChange`.

- [ ] **Step 2: Create FieldConfigPanel.vue**

Extract field palette + dimension/metric drop zones from ChartBuilder.vue. Props: `fields`, `dims`, `metrics`. Emits field drag/drop, add/remove operations.

- [ ] **Step 3: Create ChartTypePanel.vue**

New component with category tabs and grid of chart type icons. Props: `chartType`, `categoryFilter`. Emits: `update:chartType`.

- [ ] **Step 4: Create ChartConfigPanel.vue**

New component that renders COMMON_CONFIG_SCHEMA + TYPE_CONFIG_SCHEMAS[chartType] as form fields. Props: `chartType`, `config`. Emits: `update:config`.

- [ ] **Step 5: Refactor ChartBuilder.vue to three-column layout**

Replace the two-panel layout with:
- Left (280px): DataSourcePanel + FieldConfigPanel
- Center (flex:1): Preview area
- Right (320px): ChartTypePanel + ChartConfigPanel

- [ ] **Step 6: Verify layout renders correctly**

```bash
cd front-end && npm run build
```

- [ ] **Step 7: Commit**

```bash
cd .. && git add front-end/src/components/charts/DataSourcePanel.vue front-end/src/components/charts/FieldConfigPanel.vue front-end/src/components/charts/ChartTypePanel.vue front-end/src/components/charts/ChartConfigPanel.vue front-end/src/views/ChartBuilder.vue
git commit -m "feat: refactor ChartBuilder to three-panel layout with extracted components"
```

---

### Task 7: Update EChartRenderer for New Chart Types

**Files:**
- Modify: `front-end/src/components/charts/EChartRenderer.vue`

- [ ] **Step 1: Update EChartRenderer to use OPTION_BUILDERS and handle new types**

Replace the `toEChartsOption` import with direct use of `OPTION_BUILDERS` from `chart-configs.js`. Add support for `_progress`, `_statTrend`, `_map` return types alongside existing `_table` and `_stat`.

```vue
<template>
  <div class="ec-chart" ref="el" v-if="isEChartsType"></div>
  <div v-else-if="statData" class="stat-card">
    <div class="stat-value">{{ fmtNumber(statData.value) }}</div>
    <div class="stat-label">{{ statData.label }}</div>
  </div>
  <div v-else-if="progressData" class="progress-card">
    <!-- Progress rendering based on type -->
  </div>
  <div v-else-if="mapData" class="map-chart">
    <!-- Map rendering with loaded GeoJSON -->
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch, computed } from 'vue'
import echarts from '@/utils/echarts'
import { OPTION_BUILDERS } from '@/config/chart-configs'

const props = defineProps({
  chartType: { type: String, required: true },
  data: { type: Object, default: null },
  options: { type: Object, default: () => ({}) },
})

const el = ref(null)
const statData = ref(null)
const progressData = ref(null)
const mapData = ref(null)
let chart = null
let resizeObserver = null

const isEChartsType = computed(() => {
  const builder = OPTION_BUILDERS[props.chartType]
  if (!builder) return false
  if (!props.data) return true
  const result = builder(props.data, props.options, props.options._palette)
  return !result._table && !result._stat && !result._progress && !result._statTrend && !result._map
})

function render() {
  if (!chart || !props.data) return
  const builder = OPTION_BUILDERS[props.chartType]
  if (!builder) return

  const palette = props.options._palette || ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#8E44AD', '#16A085', '#E74C3C', '#2C3E50', '#D35400']
  const opt = builder(props.data, props.options, palette)

  // Handle non-ECharts returns
  if (opt._table) { chart.clear(); statData.value = null; progressData.value = null; return }
  if (opt._stat) { chart.clear(); statData.value = opt._stat; return }
  if (opt._progress) { chart.clear(); progressData.value = opt._progress; return }
  if (opt._statTrend) { chart.clear(); statData.value = opt._statTrend; return }
  if (opt._map) { chart.clear(); mapData.value = opt._map; return }

  statData.value = null
  progressData.value = null
  mapData.value = null
  if (!opt.backgroundColor) opt.backgroundColor = 'transparent'
  chart.setOption(opt, true)
}

// ... rest of lifecycle unchanged
</script>
```

- [ ] **Step 2: Commit**

```bash
cd .. && git add front-end/src/components/charts/EChartRenderer.vue
git commit -m "feat: update EChartRenderer to support all new chart types"
```

---

### Task 8: Update Backend Chart Type Whitelist

**Files:**
- Modify: `backend/src/services/chart.service.js`

- [ ] **Step 1: Update CHART_TYPES array**

Add all new chart type values to the backend whitelist:

```js
const CHART_TYPES = [
  'bar', 'barClustered', 'barStacked', 'barLine', 'barPictorial',
  'barPercentStacked', 'barGroupStacked', 'barStackedLine', 'barStackedPictorial',
  'bullet', 'waterfall', 'pareto',
  'horizontalBar', 'horizontalBarClustered', 'horizontalBarStacked',
  'horizontalBarPercentStacked', 'horizontalBarGroupStacked', 'horizontalBullet', 'butterfly',
  'line', 'lineMulti', 'areaStacked', 'areaPercentStacked',
  'pie', 'doughnut', 'sunburst', 'nightingale', 'funnel', 'funnelHorizontal',
  'scatter', 'bubble',
  'stat', 'progressBar', 'circularProgress', 'multiRingProgress', 'fluidProgress', 'gauge', 'statTrend',
  'mapChina', 'mapChinaBubble', 'mapChinaSymbol', 'mapWorld',
  'table',
  'heatmap', 'boxplot', 'radar', 'polarBar', 'barBreakAxis', 'calendar',
  'candlestick', 'treemap', 'sankey', 'chord',
]
```

- [ ] **Step 2: Commit**

```bash
cd .. && git add backend/src/services/chart.service.js
git commit -m "feat: expand backend chart type whitelist to support 60+ types"
```

---

### Task 9: Update ChartList Preview for New Types

**Files:**
- Modify: `front-end/src/views/ChartList.vue`

- [ ] **Step 1: Update chart list preview to use new type system**

Ensure the chart list preview dialog works with the new chart types by importing from `chart-types.js` instead of the old `CHART_TYPES`.

- [ ] **Step 2: Commit**

```bash
cd .. && git add front-end/src/views/ChartList.vue
git commit -m "fix: update ChartList to use new chart type definitions"
```

---

### Task 10: Update Dashboard ChartTile for New Types

**Files:**
- Modify: `front-end/src/components/dashboard/ChartTile.vue`

- [ ] **Step 1: Update ChartTile to handle new chart types**

Ensure the dashboard tile component can render all new chart types by importing the new type definitions.

- [ ] **Step 2: Commit**

```bash
cd .. && git add front-end/src/components/dashboard/ChartTile.vue
git commit -m "fix: update ChartTile to support new chart types in dashboard"
```

---

### Task 11: Integration Testing and Bug Fixes

**Files:**
- Various (as needed)

- [ ] **Step 1: Run full build and check for errors**

```bash
cd front-end && npm run build
```

- [ ] **Step 2: Start dev server and manually test**

```bash
cd front-end && npm run dev
```

Verify:
1. Three-panel layout renders correctly
2. Chart types panel shows all 60+ types with category filtering
3. Selecting a chart type shows correct config options in right panel
4. Field drag-and-drop works from left panel
5. Chart preview renders in center
6. Save/load editing mode works
7. Backend accepts all new chart types

- [ ] **Step 3: Fix any issues found**

- [ ] **Step 4: Final commit with all fixes**

```bash
cd .. && git add -A
git commit -m "fix: integration fixes for chart center redesign"
```
