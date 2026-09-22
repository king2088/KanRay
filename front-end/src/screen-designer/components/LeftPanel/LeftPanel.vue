<script setup lang="ts">
import { ref, computed } from 'vue'
import { useComponentsStore } from '../../stores/components'

const componentsStore = useComponentsStore()
const activeTab = ref('components')
const expandedCategories = ref(['charts', 'tables', 'text', 'custom'])
const searchQuery = ref('')

const componentCategories = [
  {
    key: 'charts',
    name: '可视化图表',
    icon: 'TrendCharts',
    children: [
      {
        group: '柱形图',
        items: [
          { name: '单柱图', type: 'bar-single', icon: 'chart-bar' },
          { name: '簇状柱形图', type: 'bar-group', icon: 'chart-bar' },
          { name: '堆积柱形图', type: 'bar-stack', icon: 'chart-bar' },
          { name: '折线混合图', type: 'bar-line', icon: 'chart-bar' },
          { name: '分组堆积图', type: 'bar-group-stacked', icon: 'chart-bar' },
          { name: '百分比堆积图', type: 'bar-percent', icon: 'chart-bar' },
          { name: '瀑布图', type: 'bar-waterfall', icon: 'chart-bar' }
        ]
      },
      {
        group: '条形图',
        items: [
          { name: '单条图', type: 'bar-horizontal', icon: 'chart-bar' },
          { name: '簇状条形图', type: 'bar-horizontal-group', icon: 'chart-bar' },
          { name: '堆积条形图', type: 'bar-horizontal-stack', icon: 'chart-bar' },
          { name: '百分比条形图', type: 'bar-horizontal-percent', icon: 'chart-bar' },
          { name: '混合条形图', type: 'bar-horizontal-mixed', icon: 'chart-bar' },
          { name: '正负条形图', type: 'positive-negative-bar', icon: 'chart-bar' },
          { name: '动态排序条形图', type: 'dynamic-bar-race', icon: 'chart-bar' }
        ]
      },
      {
        group: '折线图与面积图',
        items: [
          { name: '单线图', type: 'line-single', icon: 'chart-line' },
          { name: '多线图', type: 'line-multi', icon: 'chart-line' },
          { name: '面积图', type: 'line-area', icon: 'chart-line' },
          { name: '平滑折线图', type: 'line-smooth', icon: 'chart-line' },
          { name: '堆叠面积图', type: 'stacked-area', icon: 'chart-line' },
          { name: '百分比面积图', type: 'line-percent-area', icon: 'chart-line' },
          { name: '阶梯折线图', type: 'line-step', icon: 'chart-line' }
        ]
      },
      {
        group: '饼图',
        items: [
          { name: '饼图', type: 'pie', icon: 'chart-pie' },
          { name: '环形图', type: 'pie-doughnut', icon: 'chart-pie' },
          { name: '南丁格尔玫瑰图', type: 'pie-rose', icon: 'chart-pie' },
          { name: '旭日图', type: 'pie-sunburst', icon: 'chart-pie' },
          { name: '矩形树图', type: 'pie-treemap', icon: 'chart-pie' }
        ]
      },
      {
        group: '漏斗图',
        items: [
          { name: '漏斗图', type: 'funnel', icon: 'chart-pie' },
          { name: '水平漏斗图', type: 'funnel-horizontal', icon: 'chart-pie' }
        ]
      },
      {
        group: '散点图与气泡图',
        items: [
          { name: '散点图', type: 'scatter', icon: 'chart-scatter' },
          { name: '气泡图', type: 'bubble', icon: 'chart-scatter' }
        ]
      },
      {
        group: '仪表盘',
        items: [
          { name: '基础仪表盘', type: 'gauge', icon: 'chart-gauge' },
          { name: '速度仪表盘', type: 'gauge-speed', icon: 'chart-gauge' },
          { name: '阶段仪表盘', type: 'gauge-stage', icon: 'chart-gauge' },
          { name: '等级仪表盘', type: 'gauge-level', icon: 'chart-gauge' },
          { name: '多标题仪表盘', type: 'gauge-multi-title', icon: 'chart-gauge' },
          { name: '气温仪表盘', type: 'gauge-temp', icon: 'chart-gauge' },
          { name: '得分环', type: 'gauge-score', icon: 'chart-gauge' },
          { name: '气压表', type: 'gauge-pressure', icon: 'chart-gauge' },
          { name: '时钟仪表盘', type: 'gauge-clock', icon: 'chart-gauge' },
          { name: '汽车仪表盘', type: 'gauge-car', icon: 'chart-gauge' },
          { name: '多环进度', type: 'gauge-multi', icon: 'chart-gauge' },
          { name: '水球图', type: 'liquid-fill', icon: 'chart-gauge' },
          { name: '进度条', type: 'progress', icon: 'chart-gauge' }
        ]
      },
      {
        group: '雷达图',
        items: [
          { name: '雷达图', type: 'radar', icon: 'chart-radar' },
          { name: '极坐标柱状图', type: 'polar-bar', icon: 'chart-radar' }
        ]
      },
      {
        group: '其他图表',
        items: [
          { name: '热力图', type: 'heatmap', icon: 'chart-bar' },
          { name: '词云', type: 'wordcloud', icon: 'chart-bar' },
          { name: '箱线图', type: 'boxplot', icon: 'chart-bar' },
          { name: '桑基图', type: 'sankey', icon: 'chart-bar' },
          { name: '日历视图', type: 'calendar', icon: 'chart-bar' },
          { name: 'K线图', type: 'candlestick', icon: 'chart-bar' },
          { name: '交错正负标签图', type: 'mixed-positive-negative', icon: 'chart-bar' }
        ]
      },
      {
        group: '地图',
        items: [
          { name: '中国地图', type: 'map-china', icon: 'chart-bar' },
          { name: '气泡地图', type: 'map-bubble', icon: 'chart-bar' },
          { name: '地理坐标图', type: 'geo-map', icon: 'chart-bar' }
        ]
      },
      {
        group: '三维',
        items: [
          { name: '3D地球', type: 'globe-3d', icon: 'monitor' }
        ]
      }
    ]
  },
  {
    key: 'tables',
    name: '表格',
    icon: 'Grid',
    children: [
      {
        group: '数据表格',
        items: [
          { name: '普通表格', type: 'table-normal', icon: 'document' },
          { name: '轮播列表', type: 'carousel-list', icon: 'document' },
          { name: '排名列表', type: 'rank-list', icon: 'document' }
        ]
      }
    ]
  },
  {
    key: 'text',
    name: '文本',
    icon: 'Document',
    children: [
      {
        group: '文本组件',
        items: [
          { name: '静态文本', type: 'static-text', icon: 'text-static' },
          { name: '数据文本', type: 'data-text', icon: 'text-data' },
          { name: '数字翻牌器', type: 'number-flip', icon: 'chart-gauge' },
          { name: '时间文本', type: 'time-text', icon: 'text-time' },
          { name: '跑马灯', type: 'marquee-text', icon: 'text-marquee' }
        ]
      }
    ]
  },
  {
    key: 'media',
    name: '媒体',
    icon: 'Picture',
    children: [
      {
        group: '媒体组件',
        items: [
          { name: '静态图片', type: 'static-image', icon: 'image' },
          { name: '轮播图片', type: 'carousel-image', icon: 'image' },
          { name: '视频', type: 'video', icon: 'video-camera' },
          { name: 'iframe', type: 'iframe', icon: 'monitor' }
        ]
      }
    ]
  },
  {
    key: 'datav',
    name: 'DataV装饰',
    icon: 'MagicStick',
    children: [
      {
        group: '边框',
        items: [
          { name: '边框1', type: 'dv-border-1', icon: 'document' },
          { name: '边框2', type: 'dv-border-2', icon: 'document' },
          { name: '边框3', type: 'dv-border-3', icon: 'document' },
          { name: '边框4', type: 'dv-border-4', icon: 'document' },
          { name: '边框5', type: 'dv-border-5', icon: 'document' },
          { name: '边框6', type: 'dv-border-6', icon: 'document' },
          { name: '边框7', type: 'dv-border-7', icon: 'document' },
          { name: '边框8', type: 'dv-border-8', icon: 'document' },
          { name: '边框9', type: 'dv-border-9', icon: 'document' },
          { name: '边框10', type: 'dv-border-10', icon: 'document' },
          { name: '边框11', type: 'dv-border-11', icon: 'document' },
          { name: '边框12', type: 'dv-border-12', icon: 'document' },
          { name: '边框13', type: 'dv-border-13', icon: 'document' }
        ]
      },
      {
        group: '装饰',
        items: [
          { name: '装饰1', type: 'dv-decoration-1', icon: 'document' },
          { name: '装饰2', type: 'dv-decoration-2', icon: 'document' },
          { name: '装饰3', type: 'dv-decoration-3', icon: 'document' },
          { name: '装饰4', type: 'dv-decoration-4', icon: 'document' },
          { name: '装饰5', type: 'dv-decoration-5', icon: 'document' },
          { name: '装饰6', type: 'dv-decoration-6', icon: 'document' },
          { name: '装饰7', type: 'dv-decoration-7', icon: 'document' },
          { name: '装饰8', type: 'dv-decoration-8', icon: 'document' },
          { name: '装饰9', type: 'dv-decoration-9', icon: 'document' },
          { name: '装饰10', type: 'dv-decoration-10', icon: 'document' },
          { name: '装饰11', type: 'dv-decoration-11', icon: 'document' },
          { name: '装饰12', type: 'dv-decoration-12', icon: 'document' }
        ]
      }
    ]
  },
  {
    key: 'small',
    name: '小组件',
    icon: 'MoreFilled',
    children: [
      {
        group: '实用组件',
        items: [
          { name: '倒计时', type: 'countdown', icon: 'timer' },
          { name: '时钟', type: 'clock', icon: 'timer' },
          { name: '步骤条', type: 'steps', icon: 'document' }
        ]
      }
    ]
  },
  {
    key: 'custom',
    name: '自定义组件',
    icon: 'Cpu',
    children: [
      {
        group: '自定义组件',
        items: [
          { name: '自定义HTML', type: 'custom-chart', icon: 'document' }
        ]
      }
    ]
  }
]

const filteredCategories = computed(() => {
  if (!searchQuery.value) return componentCategories
  const query = searchQuery.value.toLowerCase()
  return componentCategories.map(cat => ({
    ...cat,
    children: cat.children.map(group => ({
      ...group,
      items: group.items.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.type.toLowerCase().includes(query)
      )
    })).filter(group => group.items.length > 0)
  })).filter(cat => cat.children.length > 0)
})

const onDragStart = (event: DragEvent, component: any) => {
  event.dataTransfer?.setData('component', JSON.stringify(component))
  event.dataTransfer!.effectAllowed = 'copy'
}

const sortedComponents = computed(() => {
  return [...componentsStore.components].sort((a, b) => b.zIndex - a.zIndex)
})

const componentIcons: Record<string, string> = {
  'bar-single': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="28" width="10" height="24" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/></svg>`,
  'bar-group': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="20" width="7" height="32" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/><rect x="17" y="28" width="7" height="24" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5" rx="1"/><rect x="26" y="14" width="7" height="38" fill="#E6A23C" fill-opacity="0.3" stroke="#E6A23C" stroke-width="1.5" rx="1"/></svg>`,
  'bar-stack': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="8" width="12" height="14" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/><rect x="10" y="22" width="12" height="10" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5" rx="1"/><rect x="10" y="32" width="12" height="20" fill="#E6A23C" fill-opacity="0.3" stroke="#E6A23C" stroke-width="1.5" rx="1"/><rect x="30" y="16" width="12" height="10" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/><rect x="30" y="26" width="12" height="6" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5" rx="1"/><rect x="30" y="32" width="12" height="20" fill="#E6A23C" fill-opacity="0.3" stroke="#E6A23C" stroke-width="1.5" rx="1"/></svg>`,
  'bar-line': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="28" width="8" height="24" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/><rect x="22" y="20" width="8" height="32" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/><rect x="34" y="32" width="8" height="20" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/><polyline points="14,24 26,16 38,28" stroke="#F56C6C" stroke-width="2" fill="none" stroke-linejoin="round"/></svg>`,
  'bar-group-stacked': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="16" width="9" height="16" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/><rect x="8" y="32" width="9" height="20" fill="#E6A23C" fill-opacity="0.3" stroke="#E6A23C" stroke-width="1.5" rx="1"/><rect x="20" y="22" width="9" height="10" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/><rect x="20" y="32" width="9" height="20" fill="#E6A23C" fill-opacity="0.3" stroke="#E6A23C" stroke-width="1.5" rx="1"/><rect x="32" y="10" width="9" height="22" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/><rect x="32" y="32" width="9" height="20" fill="#E6A23C" fill-opacity="0.3" stroke="#E6A23C" stroke-width="1.5" rx="1"/><line x1="4" y1="52" x2="56" y2="52" stroke="#DCDFE6" stroke-width="1"/></svg>`,
  'bar-percent': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="8" width="12" height="44" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/><rect x="10" y="28" width="12" height="24" fill="#67C23A" fill-opacity="0.5" stroke="#67C23A" stroke-width="1.5" rx="1"/><rect x="34" y="8" width="12" height="44" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/><rect x="34" y="18" width="12" height="34" fill="#E6A23C" fill-opacity="0.5" stroke="#E6A23C" stroke-width="1.5" rx="1"/><line x1="6" y1="28" x2="54" y2="28" stroke="#DCDFE6" stroke-width="1" stroke-dasharray="3 2"/></svg>`,
  'bar-waterfall': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="28" width="9" height="24" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/><rect x="17" y="16" width="9" height="12" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5" rx="1"/><rect x="28" y="8" width="9" height="8" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5" rx="1"/><rect x="39" y="20" width="9" height="12" fill="#F56C6C" fill-opacity="0.3" stroke="#F56C6C" stroke-width="1.5" rx="1"/><rect x="39" y="32" width="9" height="20" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/><line x1="6" y1="52" x2="54" y2="52" stroke="#DCDFE6" stroke-width="1"/></svg>`,
  'bar-horizontal': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="38" width="40" height="8" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/></svg>`,
  'bar-horizontal-group': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="40" height="6" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/><rect x="8" y="16" width="30" height="6" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5" rx="1"/><rect x="8" y="24" width="36" height="6" fill="#E6A23C" fill-opacity="0.3" stroke="#E6A23C" stroke-width="1.5" rx="1"/></svg>`,
  'bar-horizontal-stack': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="24" height="8" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/><rect x="32" y="8" width="16" height="8" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5" rx="1"/><rect x="8" y="20" width="18" height="8" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/><rect x="26" y="20" width="24" height="8" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5" rx="1"/></svg>`,
  'bar-horizontal-percent': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="44" height="8" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/><rect x="8" y="8" width="30" height="8" fill="#67C23A" fill-opacity="0.5" stroke="#67C23A" stroke-width="1.5" rx="1"/><rect x="8" y="20" width="44" height="8" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/><rect x="8" y="20" width="22" height="8" fill="#E6A23C" fill-opacity="0.5" stroke="#E6A23C" stroke-width="1.5" rx="1"/></svg>`,
  'bar-horizontal-mixed': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="40" height="6" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/><rect x="8" y="16" width="30" height="6" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5" rx="1"/><rect x="8" y="24" width="36" height="6" fill="#E6A23C" fill-opacity="0.3" stroke="#E6A23C" stroke-width="1.5" rx="1"/><rect x="8" y="36" width="24" height="6" fill="#F56C6C" fill-opacity="0.3" stroke="#F56C6C" stroke-width="1.5" rx="1"/><rect x="8" y="44" width="32" height="6" fill="#909399" fill-opacity="0.3" stroke="#909399" stroke-width="1.5" rx="1"/></svg>`,
  'line-single': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><polyline points="8,40 16,30 24,35 32,20 40,25 48,15 52,18" stroke="#409EFF" stroke-width="2" fill="none" stroke-linejoin="round"/><circle cx="8" cy="40" r="2.5" fill="#409EFF"/><circle cx="16" cy="30" r="2.5" fill="#409EFF"/><circle cx="24" cy="35" r="2.5" fill="#409EFF"/><circle cx="32" cy="20" r="2.5" fill="#409EFF"/><circle cx="40" cy="25" r="2.5" fill="#409EFF"/><circle cx="48" cy="15" r="2.5" fill="#409EFF"/><circle cx="52" cy="18" r="2.5" fill="#409EFF"/></svg>`,
  'line-multi': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><polyline points="8,36 16,28 24,32 32,18 40,24 48,12 52,16" stroke="#409EFF" stroke-width="2" fill="none" stroke-linejoin="round"/><polyline points="8,44 16,38 24,42 32,30 40,36 48,28 52,32" stroke="#67C23A" stroke-width="2" fill="none" stroke-linejoin="round"/></svg>`,
  'line-area': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8,44 L16,32 L24,36 L32,20 L40,26 L48,14 L52,18 L52,52 L8,52 Z" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="2" stroke-linejoin="round"/></svg>`,
  'line-smooth': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8,40 Q16,28 24,35 T40,25 T52,18" stroke="#409EFF" stroke-width="2" fill="none"/><circle cx="8" cy="40" r="2" fill="#409EFF"/><circle cx="16" cy="32" r="2" fill="#409EFF"/><circle cx="24" cy="35" r="2" fill="#409EFF"/><circle cx="32" cy="28" r="2" fill="#409EFF"/><circle cx="40" cy="25" r="2" fill="#409EFF"/><circle cx="48" cy="18" r="2" fill="#409EFF"/><circle cx="52" cy="18" r="2" fill="#409EFF"/></svg>`,
  'line-percent-area': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8,44 L16,36 L24,40 L32,28 L40,32 L48,24 L52,20 L52,52 L8,52 Z" fill="#409EFF" fill-opacity="0.2" stroke="#409EFF" stroke-width="1.5"/><path d="M8,48 L16,42 L24,46 L32,36 L40,40 L48,34 L52,30 L52,52 L8,52 Z" fill="#67C23A" fill-opacity="0.2" stroke="#67C23A" stroke-width="1.5"/></svg>`,
  'line-step': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8,36 L16,36 L16,28 L24,28 L24,32 L32,32 L32,20 L40,20 L40,24 L48,24 L48,16 L52,16" stroke="#409EFF" stroke-width="2" fill="none" stroke-linejoin="round"/></svg>`,
  'stacked-area': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8,48 L8,36 L16,32 L24,28 L32,30 L40,24 L48,20 L56,16 L56,48 Z" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5"/><path d="M8,48 L8,40 L16,38 L24,34 L32,36 L40,30 L48,28 L56,24 L56,48 Z" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5"/><path d="M8,48 L8,44 L16,42 L24,40 L32,42 L40,38 L48,36 L56,32 L56,48 Z" fill="#E6A23C" fill-opacity="0.3" stroke="#E6A23C" stroke-width="1.5"/></svg>`,
  'pie': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M30,8 A22,22 0 0,1 52,30 L30,30 Z" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5"/><path d="M52,30 A22,22 0 0,1 30,52 L30,30 Z" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5"/><path d="M30,52 A22,22 0 0,1 12,18 L30,30 Z" fill="#E6A23C" fill-opacity="0.3" stroke="#E6A23C" stroke-width="1.5"/><path d="M12,18 A22,22 0 0,1 30,8 L30,30 Z" fill="#F56C6C" fill-opacity="0.3" stroke="#F56C6C" stroke-width="1.5"/></svg>`,
  'pie-doughnut': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="30" cy="30" r="22" fill="none" stroke="#409EFF" stroke-width="8" stroke-dasharray="20 80" stroke-dashoffset="0" transform="rotate(-90 30 30)"/><circle cx="30" cy="30" r="22" fill="none" stroke="#67C23A" stroke-width="8" stroke-dasharray="30 70" stroke-dashoffset="-20" transform="rotate(-90 30 30)"/><circle cx="30" cy="30" r="22" fill="none" stroke="#E6A23C" stroke-width="8" stroke-dasharray="25 75" stroke-dashoffset="-50" transform="rotate(-90 30 30)"/></svg>`,
  'pie-rose': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M30,8 A22,22 0 0,1 52,30 L30,30 Z" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5"/><path d="M52,30 A22,22 0 0,1 30,52 L30,30 Z" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5"/><path d="M30,52 A22,22 0 0,1 12,18 L30,30 Z" fill="#E6A23C" fill-opacity="0.3" stroke="#E6A23C" stroke-width="1.5"/><path d="M12,18 A22,22 0 0,1 30,8 L30,30 Z" fill="#F56C6C" fill-opacity="0.3" stroke="#F56C6C" stroke-width="1.5"/></svg>`,
  'pie-sunburst': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="30" cy="30" r="22" fill="none" stroke="#409EFF" stroke-width="6" stroke-dasharray="15 95" stroke-dashoffset="0" transform="rotate(-90 30 30)"/><circle cx="30" cy="30" r="22" fill="none" stroke="#67C23A" stroke-width="6" stroke-dasharray="20 90" stroke-dashoffset="-15" transform="rotate(-90 30 30)"/><circle cx="30" cy="30" r="22" fill="none" stroke="#E6A23C" stroke-width="6" stroke-dasharray="25 85" stroke-dashoffset="-35" transform="rotate(-90 30 30)"/><circle cx="30" cy="30" r="14" fill="none" stroke="#F56C6C" stroke-width="4" stroke-dasharray="10 90" stroke-dashoffset="0" transform="rotate(-90 30 30)"/></svg>`,
  'pie-treemap': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="24" height="24" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/><rect x="32" y="6" width="22" height="12" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5" rx="1"/><rect x="32" y="20" width="22" height="10" fill="#E6A23C" fill-opacity="0.3" stroke="#E6A23C" stroke-width="1.5" rx="1"/><rect x="6" y="32" width="12" height="22" fill="#F56C6C" fill-opacity="0.3" stroke="#F56C6C" stroke-width="1.5" rx="1"/><rect x="20" y="32" width="34" height="22" fill="#909399" fill-opacity="0.3" stroke="#909399" stroke-width="1.5" rx="1"/></svg>`,
  'funnel': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="44" height="8" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/><rect x="12" y="20" width="36" height="8" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5" rx="1"/><rect x="16" y="32" width="28" height="8" fill="#E6A23C" fill-opacity="0.3" stroke="#E6A23C" stroke-width="1.5" rx="1"/><rect x="20" y="44" width="20" height="8" fill="#F56C6C" fill-opacity="0.3" stroke="#F56C6C" stroke-width="1.5" rx="1"/></svg>`,
  'funnel-horizontal': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="8" height="44" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/><rect x="20" y="12" width="8" height="36" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5" rx="1"/><rect x="32" y="16" width="8" height="28" fill="#E6A23C" fill-opacity="0.3" stroke="#E6A23C" stroke-width="1.5" rx="1"/><rect x="44" y="20" width="8" height="20" fill="#F56C6C" fill-opacity="0.3" stroke="#F56C6C" stroke-width="1.5" rx="1"/></svg>`,
  'scatter': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="18" r="4" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5"/><circle cx="24" cy="36" r="3" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5"/><circle cx="36" cy="24" r="5" fill="#E6A23C" fill-opacity="0.3" stroke="#E6A23C" stroke-width="1.5"/><circle cx="48" cy="40" r="3.5" fill="#F56C6C" fill-opacity="0.3" stroke="#F56C6C" stroke-width="1.5"/><circle cx="20" cy="48" r="4" fill="#909399" fill-opacity="0.3" stroke="#909399" stroke-width="1.5"/></svg>`,
  'bubble': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="20" r="8" fill="#409EFF" fill-opacity="0.2" stroke="#409EFF" stroke-width="1.5"/><circle cx="36" cy="32" r="10" fill="#67C23A" fill-opacity="0.2" stroke="#67C23A" stroke-width="1.5"/><circle cx="48" cy="44" r="6" fill="#E6A23C" fill-opacity="0.2" stroke="#E6A23C" stroke-width="1.5"/></svg>`,
  'gauge': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12,42 A18,18 0 1,1 48,42" fill="none" stroke="#DCDFE6" stroke-width="4" stroke-linecap="round"/><path d="M12,42 A18,18 0 0,1 36,16" fill="none" stroke="#409EFF" stroke-width="4" stroke-linecap="round"/><line x1="30" y1="42" x2="36" y2="18" stroke="#303133" stroke-width="2" stroke-linecap="round"/><circle cx="30" cy="42" r="3" fill="#409EFF"/></svg>`,
  'gauge-speed': `<svg viewBox="0 0 60 60" fill="none"><path d="M10,44 A20,20 0 1,1 50,44" fill="none" stroke="#DCDFE6" stroke-width="4" stroke-linecap="round"/><path d="M10,44 A20,20 0 0,1 26,12" fill="none" stroke="#67C23A" stroke-width="4" stroke-linecap="round"/><path d="M26,12 A20,20 0 0,1 42,14" fill="none" stroke="#E6A23C" stroke-width="4" stroke-linecap="round"/><path d="M42,14 A20,20 0 0,1 50,44" fill="none" stroke="#F56C6C" stroke-width="4" stroke-linecap="round"/><line x1="30" y1="44" x2="38" y2="18" stroke="#303133" stroke-width="2" stroke-linecap="round"/><circle cx="30" cy="44" r="3" fill="#303133"/></svg>`,
  'gauge-stage': `<svg viewBox="0 0 60 60" fill="none"><path d="M12,42 A18,18 0 1,1 48,42" fill="none" stroke="#DCDFE6" stroke-width="6" stroke-linecap="round"/><path d="M12,42 A18,18 0 0,1 24,20" fill="none" stroke="#67C23A" stroke-width="6" stroke-linecap="round"/><path d="M24,20 A18,18 0 0,1 48,42" fill="none" stroke="#E6A23C" stroke-width="6" stroke-linecap="round"/><circle cx="30" cy="42" r="3" fill="#E6A23C"/></svg>`,
  'gauge-level': `<svg viewBox="0 0 60 60" fill="none"><path d="M10,44 A20,20 0 1,1 50,44" fill="none" stroke="#DCDFE6" stroke-width="3" stroke-linecap="round"/><path d="M10,44 A20,20 0 0,1 18,24" fill="none" stroke="#F56C6C" stroke-width="3" stroke-linecap="round"/><path d="M18,24 A20,20 0 0,1 30,14" fill="none" stroke="#E6A23C" stroke-width="3" stroke-linecap="round"/><path d="M30,14 A20,20 0 0,1 42,24" fill="none" stroke="#67C23A" stroke-width="3" stroke-linecap="round"/><path d="M42,24 A20,20 0 0,1 50,44" fill="none" stroke="#409EFF" stroke-width="3" stroke-linecap="round"/><text x="30" y="38" font-size="10" fill="#409EFF" text-anchor="middle" font-weight="bold">A+</text></svg>`,
  'gauge-multi-title': `<svg viewBox="0 0 60 60" fill="none"><path d="M12,42 A18,18 0 1,1 48,42" fill="none" stroke="#DCDFE6" stroke-width="3" stroke-linecap="round"/><path d="M12,42 A18,18 0 0,1 30,14" fill="none" stroke="#409EFF" stroke-width="3" stroke-linecap="round"/><path d="M30,14 A18,18 0 0,1 48,42" fill="none" stroke="#67C23A" stroke-width="3" stroke-linecap="round"/><text x="30" y="36" font-size="8" fill="#409EFF" text-anchor="middle">75%</text><text x="30" y="48" font-size="5" fill="#909399" text-anchor="middle">负载率</text></svg>`,
  'gauge-temp': `<svg viewBox="0 0 60 60" fill="none"><path d="M12,42 A18,18 0 1,1 48,42" fill="none" stroke="#DCDFE6" stroke-width="4" stroke-linecap="round"/><path d="M12,42 A18,18 0 0,1 40,18" fill="none" stroke="#F56C6C" stroke-width="4" stroke-linecap="round"/><circle cx="30" cy="42" r="4" fill="#F56C6C"/><text x="30" y="36" font-size="10" fill="#F56C6C" text-anchor="middle" font-weight="bold">36.5°</text></svg>`,
  'gauge-score': `<svg viewBox="0 0 60 60" fill="none"><circle cx="30" cy="30" r="22" fill="none" stroke="#DCDFE6" stroke-width="4"/><circle cx="30" cy="30" r="22" fill="none" stroke="#409EFF" stroke-width="4" stroke-dasharray="100 40" stroke-dashoffset="0" transform="rotate(-90 30 30)"/><circle cx="30" cy="30" r="16" fill="none" stroke="#67C23A" stroke-width="3" stroke-dasharray="70 50" stroke-dashoffset="0" transform="rotate(-90 30 30)"/><text x="30" y="34" font-size="12" fill="#409EFF" text-anchor="middle" font-weight="bold">86</text></svg>`,
  'gauge-pressure': `<svg viewBox="0 0 60 60" fill="none"><circle cx="30" cy="30" r="22" fill="white" stroke="#DCDFE6" stroke-width="1.5"/><circle cx="30" cy="30" r="18" fill="none" stroke="#DCDFE6" stroke-width="1"/><path d="M30,12 L30,14" stroke="#303133" stroke-width="2"/><path d="M12,30 L14,30" stroke="#303133" stroke-width="2"/><path d="M48,30 L46,30" stroke="#303133" stroke-width="2"/><path d="M30,48 L30,46" stroke="#303133" stroke-width="2"/><line x1="30" y1="30" x2="42" y2="18" stroke="#F56C6C" stroke-width="2" stroke-linecap="round"/><circle cx="30" cy="30" r="3" fill="#303133"/></svg>`,
  'gauge-clock': `<svg viewBox="0 0 60 60" fill="none"><circle cx="30" cy="30" r="22" fill="white" stroke="#303133" stroke-width="2"/><line x1="30" y1="30" x2="30" y2="14" stroke="#303133" stroke-width="2.5" stroke-linecap="round"/><line x1="30" y1="30" x2="42" y2="30" stroke="#409EFF" stroke-width="1.5" stroke-linecap="round"/><line x1="30" y1="30" x2="22" y2="42" stroke="#F56C6C" stroke-width="1" stroke-linecap="round"/><circle cx="30" cy="30" r="2.5" fill="#303133"/><circle cx="30" cy="10" r="1" fill="#303133"/><circle cx="50" cy="30" r="1" fill="#303133"/><circle cx="30" cy="50" r="1" fill="#303133"/><circle cx="10" cy="30" r="1" fill="#303133"/></svg>`,
  'gauge-car': `<svg viewBox="0 0 60 60" fill="none"><path d="M8,44 A22,22 0 1,1 52,44" fill="none" stroke="#DCDFE6" stroke-width="4" stroke-linecap="round"/><path d="M8,44 A22,22 0 0,1 16,22" fill="none" stroke="#67C23A" stroke-width="4" stroke-linecap="round"/><path d="M16,22 A22,22 0 0,1 30,10" fill="none" stroke="#67C23A" stroke-width="4" stroke-linecap="round"/><path d="M30,10 A22,22 0 0,1 44,22" fill="none" stroke="#E6A23C" stroke-width="4" stroke-linecap="round"/><path d="M44,22 A22,22 0 0,1 52,44" fill="none" stroke="#F56C6C" stroke-width="4" stroke-linecap="round"/><line x1="30" y1="44" x2="36" y2="16" stroke="#303133" stroke-width="2" stroke-linecap="round"/><circle cx="30" cy="44" r="3" fill="#303133"/><text x="30" y="40" font-size="6" fill="#303133" text-anchor="middle">km/h</text></svg>`,
  'gauge-multi': `<svg viewBox="0 0 60 60" fill="none"><circle cx="30" cy="30" r="24" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="5"/><circle cx="30" cy="30" r="24" fill="none" stroke="#409EFF" stroke-width="5" stroke-dasharray="120 40" stroke-dashoffset="30" transform="rotate(-90 30 30)" stroke-linecap="round"/><circle cx="30" cy="30" r="18" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="5"/><circle cx="30" cy="30" r="18" fill="none" stroke="#67C23A" stroke-width="5" stroke-dasharray="90 30" stroke-dashoffset="20" transform="rotate(-90 30 30)" stroke-linecap="round"/><circle cx="30" cy="30" r="12" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="5"/><circle cx="30" cy="30" r="12" fill="none" stroke="#E6A23C" stroke-width="5" stroke-dasharray="60 20" stroke-dashoffset="15" transform="rotate(-90 30 30)" stroke-linecap="round"/><circle cx="30" cy="30" r="6" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="5"/><circle cx="30" cy="30" r="6" fill="none" stroke="#F56C6C" stroke-width="5" stroke-dasharray="30 10" stroke-dashoffset="8" transform="rotate(-90 30 30)" stroke-linecap="round"/></svg>`,
  'progress': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="24" width="44" height="12" fill="#EBEEF5" stroke="#DCDFE6" stroke-width="1.5" rx="6"/><rect x="8" y="24" width="32" height="12" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="6"/><text x="30" y="33" font-size="8" fill="#409EFF" text-anchor="middle" font-weight="bold">72%</text></svg>`,
  'liquid-fill': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="30" cy="30" r="22" fill="#EBEEF5" stroke="#DCDFE6" stroke-width="1.5"/><circle cx="30" cy="30" r="22" fill="#409EFF" fill-opacity="0.2"/><path d="M8,35 Q20,28 30,35 T52,35 L52,52 L8,52 Z" fill="#409EFF" fill-opacity="0.4"/><text x="30" y="36" font-size="12" fill="#409EFF" text-anchor="middle" font-weight="bold">72%</text></svg>`,
  'radar': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><polygon points="30,8 52,22 46,46 14,46 8,22" fill="none" stroke="#DCDFE6" stroke-width="1.5"/><polygon points="30,18 42,26 38,40 22,40 18,26" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5"/></svg>`,
  'polar-bar': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="30" cy="30" r="20" fill="none" stroke="#DCDFE6" stroke-width="1"/><circle cx="30" cy="30" r="14" fill="none" stroke="#DCDFE6" stroke-width="1" opacity="0.5"/><circle cx="30" cy="30" r="8" fill="none" stroke="#DCDFE6" stroke-width="1" opacity="0.3"/><path d="M30,10 L30,30 L44,20" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5"/><path d="M44,20 L30,30 L48,34" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5"/><path d="M48,34 L30,30 L40,46" fill="#E6A23C" fill-opacity="0.3" stroke="#E6A23C" stroke-width="1.5"/></svg>`,
  'heatmap': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="10" height="10" fill="#409EFF" fill-opacity="0.2" rx="1"/><rect x="18" y="6" width="10" height="10" fill="#67C23A" fill-opacity="0.4" rx="1"/><rect x="30" y="6" width="10" height="10" fill="#E6A23C" fill-opacity="0.6" rx="1"/><rect x="42" y="6" width="10" height="10" fill="#F56C6C" fill-opacity="0.8" rx="1"/><rect x="6" y="18" width="10" height="10" fill="#67C23A" fill-opacity="0.3" rx="1"/><rect x="18" y="18" width="10" height="10" fill="#E6A23C" fill-opacity="0.5" rx="1"/><rect x="30" y="18" width="10" height="10" fill="#F56C6C" fill-opacity="0.7" rx="1"/><rect x="42" y="18" width="10" height="10" fill="#409EFF" fill-opacity="0.4" rx="1"/><rect x="6" y="30" width="10" height="10" fill="#E6A23C" fill-opacity="0.4" rx="1"/><rect x="18" y="30" width="10" height="10" fill="#F56C6C" fill-opacity="0.6" rx="1"/><rect x="30" y="30" width="10" height="10" fill="#409EFF" fill-opacity="0.5" rx="1"/><rect x="42" y="30" width="10" height="10" fill="#67C23A" fill-opacity="0.3" rx="1"/><rect x="6" y="42" width="10" height="10" fill="#F56C6C" fill-opacity="0.5" rx="1"/><rect x="18" y="42" width="10" height="10" fill="#409EFF" fill-opacity="0.6" rx="1"/><rect x="30" y="42" width="10" height="10" fill="#67C23A" fill-opacity="0.4" rx="1"/><rect x="42" y="42" width="10" height="10" fill="#E6A23C" fill-opacity="0.3" rx="1"/></svg>`,
  'wordcloud': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><text x="16" y="20" font-size="8" fill="#409EFF" font-weight="bold">Data</text><text x="36" y="16" font-size="6" fill="#67C23A">Screen</text><text x="10" y="32" font-size="10" fill="#E6A23C" font-weight="bold">Vue</text><text x="32" y="30" font-size="7" fill="#F56C6C">Chart</text><text x="8" y="44" font-size="5" fill="#909399">TypeScript</text><text x="34" y="42" font-size="9" fill="#409EFF" font-weight="bold">ECharts</text></svg>`,
  'boxplot': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="18" width="14" height="16" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/><line x1="17" y1="10" x2="17" y2="18" stroke="#409EFF" stroke-width="1.5"/><line x1="17" y1="34" x2="17" y2="42" stroke="#409EFF" stroke-width="1.5"/><line x1="10" y1="10" x2="24" y2="10" stroke="#409EFF" stroke-width="1.5"/><line x1="10" y1="42" x2="24" y2="42" stroke="#409EFF" stroke-width="1.5"/><rect x="32" y="14" width="14" height="18" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5" rx="1"/><line x1="39" y1="8" x2="39" y2="14" stroke="#67C23A" stroke-width="1.5"/><line x1="39" y1="32" x2="39" y2="44" stroke="#67C23A" stroke-width="1.5"/><line x1="32" y1="8" x2="46" y2="8" stroke="#67C23A" stroke-width="1.5"/><line x1="32" y1="44" x2="46" y2="44" stroke="#67C23A" stroke-width="1.5"/></svg>`,
  'sankey': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="8" width="8" height="18" fill="#409EFF" fill-opacity="0.4" stroke="#409EFF" stroke-width="1.5" rx="1"/><rect x="4" y="30" width="8" height="12" fill="#67C23A" fill-opacity="0.4" stroke="#67C23A" stroke-width="1.5" rx="1"/><rect x="4" y="46" width="8" height="8" fill="#E6A23C" fill-opacity="0.4" stroke="#E6A23C" stroke-width="1.5" rx="1"/><rect x="48" y="6" width="8" height="12" fill="#409EFF" fill-opacity="0.4" stroke="#409EFF" stroke-width="1.5" rx="1"/><rect x="48" y="22" width="8" height="16" fill="#67C23A" fill-opacity="0.4" stroke="#67C23A" stroke-width="1.5" rx="1"/><rect x="48" y="42" width="8" height="12" fill="#F56C6C" fill-opacity="0.4" stroke="#F56C6C" stroke-width="1.5" rx="1"/><path d="M12,12 Q30,10 48,10" stroke="#409EFF" stroke-width="3" fill="none" opacity="0.4"/><path d="M12,18 Q30,20 48,24" stroke="#67C23A" stroke-width="3" fill="none" opacity="0.4"/><path d="M12,32 Q30,36 48,34" stroke="#E6A23C" stroke-width="3" fill="none" opacity="0.4"/><path d="M12,38 Q30,42 48,46" stroke="#F56C6C" stroke-width="3" fill="none" opacity="0.4"/></svg>`,
  'calendar': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="12" width="44" height="40" fill="white" stroke="#DCDFE6" stroke-width="1.5" rx="2"/><rect x="8" y="12" width="44" height="10" fill="#409EFF" fill-opacity="0.15" rx="2"/><line x1="8" y1="22" x2="52" y2="22" stroke="#DCDFE6" stroke-width="1"/><line x1="18" y1="8" x2="18" y2="16" stroke="#409EFF" stroke-width="2" stroke-linecap="round"/><line x1="42" y1="8" x2="42" y2="16" stroke="#409EFF" stroke-width="2" stroke-linecap="round"/><text x="16" y="32" font-size="5" fill="#909399" text-anchor="middle">1</text><text x="24" y="32" font-size="5" fill="#909399" text-anchor="middle">2</text><text x="32" y="32" font-size="5" fill="#909399" text-anchor="middle">3</text><text x="40" y="32" font-size="5" fill="#409EFF" text-anchor="middle" font-weight="bold">4</text><text x="48" y="32" font-size="5" fill="#909399" text-anchor="middle">5</text><text x="16" y="40" font-size="5" fill="#909399" text-anchor="middle">6</text><text x="24" y="40" font-size="5" fill="#909399" text-anchor="middle">7</text><text x="32" y="40" font-size="5" fill="#909399" text-anchor="middle">8</text><text x="40" y="40" font-size="5" fill="#909399" text-anchor="middle">9</text><text x="48" y="40" font-size="5" fill="#909399" text-anchor="middle">10</text><text x="16" y="48" font-size="5" fill="#909399" text-anchor="middle">11</text><text x="24" y="48" font-size="5" fill="#909399" text-anchor="middle">12</text></svg>`,
  'candlestick': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="12" y1="10" x2="12" y2="50" stroke="#67C23A" stroke-width="1.5"/><rect x="8" y="18" width="8" height="14" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5" rx="1"/><line x1="24" y1="14" x2="24" y2="46" stroke="#F56C6C" stroke-width="1.5"/><rect x="20" y="22" width="8" height="12" fill="#F56C6C" fill-opacity="0.3" stroke="#F56C6C" stroke-width="1.5" rx="1"/><line x1="36" y1="8" x2="36" y2="42" stroke="#67C23A" stroke-width="1.5"/><rect x="32" y="16" width="8" height="16" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5" rx="1"/><line x1="48" y1="12" x2="48" y2="48" stroke="#F56C6C" stroke-width="1.5"/><rect x="44" y="20" width="8" height="10" fill="#F56C6C" fill-opacity="0.3" stroke="#F56C6C" stroke-width="1.5" rx="1"/></svg>`,
  'mixed-positive-negative': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="8" y1="30" x2="52" y2="30" stroke="#DCDFE6" stroke-width="1"/><rect x="10" y="14" width="8" height="16" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5" rx="1"/><rect x="22" y="34" width="8" height="12" fill="#F56C6C" fill-opacity="0.3" stroke="#F56C6C" stroke-width="1.5" rx="1"/><rect x="34" y="10" width="8" height="20" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5" rx="1"/><rect x="46" y="36" width="8" height="8" fill="#F56C6C" fill-opacity="0.3" stroke="#F56C6C" stroke-width="1.5" rx="1"/><text x="14" y="12" font-size="5" fill="#67C23A" text-anchor="middle">+8</text><text x="26" y="50" font-size="5" fill="#F56C6C" text-anchor="middle">-6</text></svg>`,
  'positive-negative-bar': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="10" height="20" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5" rx="1"/><rect x="22" y="32" width="10" height="14" fill="#F56C6C" fill-opacity="0.3" stroke="#F56C6C" stroke-width="1.5" rx="1"/><rect x="36" y="12" width="10" height="16" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5" rx="1"/><rect x="8" y="32" width="10" height="8" fill="#F56C6C" fill-opacity="0.3" stroke="#F56C6C" stroke-width="1.5" rx="1"/><rect x="36" y="34" width="10" height="10" fill="#F56C6C" fill-opacity="0.3" stroke="#F56C6C" stroke-width="1.5" rx="1"/><line x1="4" y1="30" x2="56" y2="30" stroke="#DCDFE6" stroke-width="1" stroke-dasharray="3 2"/></svg>`,
  'dynamic-bar-race': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="18" y="8" width="34" height="8" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/><rect x="18" y="20" width="28" height="8" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5" rx="1"/><rect x="18" y="32" width="22" height="8" fill="#E6A23C" fill-opacity="0.3" stroke="#E6A23C" stroke-width="1.5" rx="1"/><rect x="18" y="44" width="16" height="8" fill="#F56C6C" fill-opacity="0.3" stroke="#F56C6C" stroke-width="1.5" rx="1"/><text x="14" y="14" font-size="5" fill="#909399" text-anchor="end">A</text><text x="14" y="26" font-size="5" fill="#909399" text-anchor="end">B</text><text x="14" y="38" font-size="5" fill="#909399" text-anchor="end">C</text><text x="14" y="50" font-size="5" fill="#909399" text-anchor="end">D</text><text x="54" y="14" font-size="5" fill="#409EFF" text-anchor="start">1st</text><text x="54" y="26" font-size="5" fill="#67C23A" text-anchor="start">2nd</text><path d="M50,12 L56,8 L56,16 Z" fill="#409EFF" fill-opacity="0.5"/></svg>`,
  'geo-map': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20,10 L30,8 L40,12 L48,10 L50,18 L46,24 L50,30 L48,38 L42,42 L38,48 L30,52 L22,48 L16,42 L12,34 L10,26 L14,18 Z" fill="#409EFF" fill-opacity="0.15" stroke="#409EFF" stroke-width="1.5" stroke-linejoin="round"/><circle cx="36" cy="18" r="3" fill="#F56C6C" stroke="#F56C6C" stroke-width="1"/><circle cx="24" cy="28" r="2.5" fill="#67C23A" stroke="#67C23A" stroke-width="1"/><circle cx="40" cy="32" r="4" fill="#E6A23C" stroke="#E6A23C" stroke-width="1"/><circle cx="18" cy="38" r="2" fill="#409EFF" stroke="#409EFF" stroke-width="1"/><circle cx="32" cy="42" r="3" fill="#F56C6C" stroke="#F56C6C" stroke-width="1"/><path d="M36,18 L24,28" stroke="#409EFF" stroke-width="1" stroke-dasharray="2 2" opacity="0.5"/></svg>`,
  'map-china': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20,10 L30,8 L40,12 L48,10 L50,18 L46,24 L50,30 L48,38 L42,42 L38,48 L30,52 L22,48 L16,42 L12,34 L10,26 L14,18 Z" fill="#409EFF" fill-opacity="0.15" stroke="#409EFF" stroke-width="1.5" stroke-linejoin="round"/><circle cx="38" cy="22" r="2" fill="#F56C6C"/><circle cx="28" cy="34" r="2" fill="#67C23A"/><circle cx="34" cy="40" r="2" fill="#E6A23C"/></svg>`,
  'map-bubble': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20,10 L30,8 L40,12 L48,10 L50,18 L46,24 L50,30 L48,38 L42,42 L38,48 L30,52 L22,48 L16,42 L12,34 L10,26 L14,18 Z" fill="#409EFF" fill-opacity="0.1" stroke="#409EFF" stroke-width="1.5" stroke-linejoin="round"/><circle cx="36" cy="20" r="5" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5"/><circle cx="26" cy="32" r="4" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5"/><circle cx="40" cy="38" r="6" fill="#E6A23C" fill-opacity="0.3" stroke="#E6A23C" stroke-width="1.5"/><circle cx="18" cy="22" r="3" fill="#F56C6C" fill-opacity="0.3" stroke="#F56C6C" stroke-width="1.5"/></svg>`,
  'table-normal': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="8" width="48" height="44" fill="white" stroke="#DCDFE6" stroke-width="1.5" rx="2"/><line x1="6" y1="20" x2="54" y2="20" stroke="#DCDFE6" stroke-width="1.5"/><line x1="6" y1="32" x2="54" y2="32" stroke="#DCDFE6" stroke-width="1"/><line x1="6" y1="44" x2="54" y2="44" stroke="#DCDFE6" stroke-width="1"/><line x1="22" y1="8" x2="22" y2="52" stroke="#DCDFE6" stroke-width="1"/><line x1="38" y1="8" x2="38" y2="52" stroke="#DCDFE6" stroke-width="1"/><rect x="6" y="8" width="48" height="12" fill="#409EFF" fill-opacity="0.1" rx="2"/></svg>`,
  'rank-list': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="10" height="8" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1.5" rx="1"/><text x="11" y="12" font-size="6" fill="#409EFF" text-anchor="middle" font-weight="bold">1</text><rect x="20" y="6" width="34" height="8" fill="#EBEEF5" rx="1"/><rect x="20" y="6" width="30" height="8" fill="#409EFF" fill-opacity="0.15" rx="1"/><rect x="6" y="18" width="10" height="8" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5" rx="1"/><text x="11" y="24" font-size="6" fill="#67C23A" text-anchor="middle" font-weight="bold">2</text><rect x="20" y="18" width="34" height="8" fill="#EBEEF5" rx="1"/><rect x="20" y="18" width="24" height="8" fill="#67C23A" fill-opacity="0.15" rx="1"/><rect x="6" y="30" width="10" height="8" fill="#E6A23C" fill-opacity="0.3" stroke="#E6A23C" stroke-width="1.5" rx="1"/><text x="11" y="36" font-size="6" fill="#E6A23C" text-anchor="middle" font-weight="bold">3</text><rect x="20" y="30" width="34" height="8" fill="#EBEEF5" rx="1"/><rect x="20" y="30" width="18" height="8" fill="#E6A23C" fill-opacity="0.15" rx="1"/><rect x="6" y="42" width="10" height="8" fill="#F56C6C" fill-opacity="0.2" stroke="#DCDFE6" stroke-width="1" rx="1"/><text x="11" y="48" font-size="6" fill="#909399" text-anchor="middle">4</text><rect x="20" y="42" width="34" height="8" fill="#EBEEF5" rx="1"/><rect x="20" y="42" width="12" height="8" fill="#F56C6C" fill-opacity="0.1" rx="1"/></svg>`,
  'carousel-list': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="40" height="32" fill="white" stroke="#DCDFE6" stroke-width="1.5" rx="2"/><rect x="14" y="14" width="32" height="24" fill="#409EFF" fill-opacity="0.1" rx="1"/><text x="30" y="30" font-size="8" fill="#409EFF" text-anchor="middle" dominant-baseline="middle">1 / 5</text><circle cx="20" cy="50" r="2" fill="#409EFF"/><circle cx="28" cy="50" r="2" fill="#DCDFE6"/><circle cx="36" cy="50" r="2" fill="#DCDFE6"/><circle cx="44" cy="50" r="2" fill="#DCDFE6"/></svg>`,
  'static-text': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><text x="30" y="24" font-size="11" fill="#303133" text-anchor="middle" font-weight="bold">Aa</text><line x1="12" y1="34" x2="48" y2="34" stroke="#DCDFE6" stroke-width="1.5"/><line x1="12" y1="40" x2="40" y2="40" stroke="#DCDFE6" stroke-width="1.5"/><line x1="12" y1="46" x2="36" y2="46" stroke="#DCDFE6" stroke-width="1.5"/></svg>`,
  'time-text': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="14" width="48" height="32" fill="white" stroke="#DCDFE6" stroke-width="1.5" rx="2"/><text x="30" y="30" font-size="11" fill="#409EFF" text-anchor="middle" dominant-baseline="middle" font-weight="bold" font-family="monospace">12:34</text><text x="30" y="40" font-size="6" fill="#909399" text-anchor="middle">2024-01-15</text></svg>`,
  'marquee-text': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="18" width="52" height="24" fill="#409EFF" fill-opacity="0.05" stroke="#DCDFE6" stroke-width="1.5" rx="2"/><text x="30" y="33" font-size="8" fill="#409EFF" text-anchor="middle">Scrolling Text →</text><path d="M8,22 L8,38" stroke="#409EFF" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/><path d="M6,26 L8,22 L10,26" stroke="#409EFF" stroke-width="1" fill="none" opacity="0.5"/><path d="M52,22 L52,38" stroke="#409EFF" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/><path d="M50,34 L52,38 L54,34" stroke="#409EFF" stroke-width="1" fill="none" opacity="0.5"/></svg>`,
  'number-flip': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="10" width="12" height="40" fill="#409EFF" fill-opacity="0.1" stroke="#409EFF" stroke-width="1.5" rx="2"/><text x="12" y="36" font-size="18" fill="#409EFF" text-anchor="middle" font-weight="bold" font-family="monospace">8</text><rect x="22" y="10" width="12" height="40" fill="#67C23A" fill-opacity="0.1" stroke="#67C23A" stroke-width="1.5" rx="2"/><text x="28" y="36" font-size="18" fill="#67C23A" text-anchor="middle" font-weight="bold" font-family="monospace">5</text><rect x="38" y="10" width="12" height="40" fill="#E6A23C" fill-opacity="0.1" stroke="#E6A23C" stroke-width="1.5" rx="2"/><text x="44" y="36" font-size="18" fill="#E6A23C" text-anchor="middle" font-weight="bold" font-family="monospace">2</text></svg>`,
  'static-image': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="44" height="44" fill="#EBEEF5" stroke="#DCDFE6" stroke-width="1.5" rx="2"/><circle cx="22" cy="22" r="5" fill="#E6A23C" fill-opacity="0.4" stroke="#E6A23C" stroke-width="1.5"/><path d="M8,44 L22,32 L32,40 L40,34 L52,44 L52,52 L8,52 Z" fill="#67C23A" fill-opacity="0.3" stroke="#67C23A" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
  'video': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="12" width="48" height="36" fill="#303133" stroke="#606266" stroke-width="1.5" rx="2"/><polygon points="26,22 26,42 42,32" fill="white" fill-opacity="0.8"/></svg>`,
  'iframe': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="48" height="48" fill="white" stroke="#DCDFE6" stroke-width="1.5" rx="2"/><rect x="6" y="6" width="48" height="8" fill="#EBEEF5" rx="2"/><circle cx="12" cy="10" r="2" fill="#F56C6C"/><circle cx="18" cy="10" r="2" fill="#E6A23C"/><circle cx="24" cy="10" r="2" fill="#67C23A"/><rect x="10" y="18" width="40" height="32" fill="#EBEEF5" rx="1"/><text x="30" y="37" font-size="7" fill="#909399" text-anchor="middle">iframe</text></svg>`,
  'carousel-image': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="8" width="40" height="34" fill="#EBEEF5" stroke="#DCDFE6" stroke-width="1.5" rx="2"/><circle cx="22" cy="20" r="4" fill="#E6A23C" fill-opacity="0.4" stroke="#E6A23C" stroke-width="1"/><path d="M10,36 L22,28 L30,34 L36,30 L50,38 L50,42 L10,42 Z" fill="#67C23A" fill-opacity="0.3"/><path d="M2,25 L10,18 L10,32 Z" fill="#409EFF" fill-opacity="0.4" stroke="#409EFF" stroke-width="1"/><path d="M58,25 L50,18 L50,32 Z" fill="#409EFF" fill-opacity="0.4" stroke="#409EFF" stroke-width="1"/><circle cx="18" cy="50" r="2" fill="#409EFF"/><circle cx="26" cy="50" r="2" fill="#DCDFE6"/><circle cx="34" cy="50" r="2" fill="#DCDFE6"/></svg>`,
  'globe-3d': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="30" cy="30" r="22" fill="#409EFF" fill-opacity="0.1" stroke="#409EFF" stroke-width="1.5"/><ellipse cx="30" cy="30" rx="22" ry="8" fill="none" stroke="#409EFF" stroke-width="1" opacity="0.5"/><ellipse cx="30" cy="30" rx="8" ry="22" fill="none" stroke="#409EFF" stroke-width="1" opacity="0.5"/><ellipse cx="30" cy="30" rx="16" ry="22" fill="none" stroke="#409EFF" stroke-width="1" opacity="0.3"/><path d="M14,20 Q30,16 46,20" fill="none" stroke="#67C23A" stroke-width="1" opacity="0.5"/><path d="M10,32 Q30,28 50,32" fill="none" stroke="#67C23A" stroke-width="1" opacity="0.5"/><path d="M14,44 Q30,40 46,44" fill="none" stroke="#67C23A" stroke-width="1" opacity="0.5"/></svg>`,
  'custom-chart': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="44" height="44" fill="#409EFF" fill-opacity="0.05" stroke="#409EFF" stroke-width="1.5" stroke-dasharray="4 3" rx="2"/><text x="30" y="28" font-size="10" fill="#409EFF" text-anchor="middle" font-family="monospace">&lt;/&gt;</text><text x="30" y="42" font-size="7" fill="#909399" text-anchor="middle">Custom</text></svg>`,
  'data-text': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><text x="30" y="22" font-size="14" fill="#409EFF" text-anchor="middle" font-weight="bold" font-family="monospace">12,580</text><line x1="12" y1="32" x2="48" y2="32" stroke="#DCDFE6" stroke-width="1"/><text x="30" y="42" font-size="7" fill="#67C23A" text-anchor="middle">↑ 12.5%</text></svg>`,
  'countdown': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="12" width="48" height="36" fill="#F56C6C" fill-opacity="0.05" stroke="#F56C6C" stroke-width="1.5" rx="3"/><text x="30" y="35" font-size="16" fill="#F56C6C" text-anchor="middle" font-weight="bold" font-family="monospace">03:25</text></svg>`,
  'clock': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="30" cy="30" r="22" fill="white" stroke="#409EFF" stroke-width="1.5"/><line x1="30" y1="30" x2="30" y2="16" stroke="#303133" stroke-width="2" stroke-linecap="round"/><line x1="30" y1="30" x2="40" y2="34" stroke="#409EFF" stroke-width="1.5" stroke-linecap="round"/><circle cx="30" cy="30" r="2" fill="#409EFF"/><circle cx="30" cy="10" r="1.5" fill="#409EFF"/><circle cx="50" cy="30" r="1.5" fill="#409EFF"/><circle cx="30" cy="50" r="1.5" fill="#409EFF"/><circle cx="10" cy="30" r="1.5" fill="#409EFF"/></svg>`,
  'steps': `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="12" y1="30" x2="48" y2="30" stroke="#DCDFE6" stroke-width="2"/><line x1="12" y1="30" x2="30" y2="30" stroke="#409EFF" stroke-width="2"/><circle cx="12" cy="30" r="4" fill="#409EFF" stroke="white" stroke-width="2"/><circle cx="30" cy="30" r="4" fill="#409EFF" stroke="white" stroke-width="2"/><circle cx="48" cy="30" r="4" fill="#DCDFE6" stroke="white" stroke-width="2"/><text x="12" y="44" font-size="6" fill="#409EFF" text-anchor="middle">Done</text><text x="30" y="44" font-size="6" fill="#409EFF" text-anchor="middle">Active</text><text x="48" y="44" font-size="6" fill="#909399" text-anchor="middle">Pending</text></svg>`,
  'dv-border-1': `<svg viewBox="0 0 60 60" fill="none"><path d="M4,4 L4,20" stroke="#409EFF" stroke-width="2" stroke-linecap="round"/><path d="M4,4 L20,4" stroke="#409EFF" stroke-width="2" stroke-linecap="round"/><path d="M56,4 L40,4" stroke="#409EFF" stroke-width="2" stroke-linecap="round"/><path d="M56,4 L56,20" stroke="#409EFF" stroke-width="2" stroke-linecap="round"/><path d="M4,56 L4,40" stroke="#409EFF" stroke-width="2" stroke-linecap="round"/><path d="M4,56 L20,56" stroke="#409EFF" stroke-width="2" stroke-linecap="round"/><path d="M56,56 L56,40" stroke="#409EFF" stroke-width="2" stroke-linecap="round"/><path d="M56,56 L40,56" stroke="#409EFF" stroke-width="2" stroke-linecap="round"/><rect x="6" y="6" width="8" height="8" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1"/><rect x="46" y="6" width="8" height="8" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1"/><rect x="6" y="46" width="8" height="8" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1"/><rect x="46" y="46" width="8" height="8" fill="#409EFF" fill-opacity="0.3" stroke="#409EFF" stroke-width="1"/></svg>`,
  'dv-border-2': `<svg viewBox="0 0 60 60" fill="none"><rect x="4" y="4" width="52" height="52" fill="none" stroke="#409EFF" stroke-width="1.5"/><rect x="8" y="8" width="44" height="44" fill="none" stroke="#409EFF" stroke-width="1" opacity="0.5"/><circle cx="4" cy="4" r="2.5" fill="#409EFF"/><circle cx="56" cy="4" r="2.5" fill="#409EFF"/><circle cx="4" cy="56" r="2.5" fill="#409EFF"/><circle cx="56" cy="56" r="2.5" fill="#409EFF"/></svg>`,
  'dv-border-3': `<svg viewBox="0 0 60 60" fill="none"><rect x="2" y="2" width="56" height="56" fill="none" stroke="#409EFF" stroke-width="2"/><rect x="6" y="6" width="48" height="48" fill="none" stroke="#409EFF" stroke-width="1" opacity="0.6"/><rect x="10" y="10" width="40" height="40" fill="none" stroke="#409EFF" stroke-width="1" opacity="0.4"/><rect x="14" y="14" width="32" height="32" fill="none" stroke="#409EFF" stroke-width="1" opacity="0.3"/></svg>`,
  'dv-border-4': `<svg viewBox="0 0 60 60" fill="none"><path d="M12,4 L56,4 L56,56 L4,56 L4,12 Z" fill="none" stroke="#409EFF" stroke-width="1.5"/><line x1="4" y1="4" x2="12" y2="4" stroke="#F56C6C" stroke-width="2.5"/><line x1="8" y1="8" x2="16" y2="8" stroke="#F56C6C" stroke-width="1.5" opacity="0.6"/><line x1="20" y1="4" x2="40" y2="4" stroke="#409EFF" stroke-width="1" stroke-dasharray="3 2" opacity="0.5"/></svg>`,
  'dv-border-5': `<svg viewBox="0 0 60 60" fill="none"><path d="M4,4 L56,4 L56,48 L48,56 L4,56 Z" fill="none" stroke="#409EFF" stroke-width="1.5"/><line x1="8" y1="4" x2="24" y2="4" stroke="#67C23A" stroke-width="2.5" opacity="0.6"/><line x1="36" y1="4" x2="52" y2="4" stroke="#67C23A" stroke-width="2.5" opacity="0.6"/><line x1="8" y1="56" x2="24" y2="56" stroke="#67C23A" stroke-width="2.5" opacity="0.6"/></svg>`,
  'dv-border-6': `<svg viewBox="0 0 60 60" fill="none"><rect x="4" y="4" width="52" height="52" fill="none" stroke="#409EFF" stroke-width="1.5"/><circle cx="4" cy="4" r="3" fill="#409EFF" fill-opacity="0.5"/><circle cx="56" cy="4" r="3" fill="#409EFF" fill-opacity="0.5"/><circle cx="4" cy="56" r="3" fill="#409EFF" fill-opacity="0.5"/><circle cx="56" cy="56" r="3" fill="#409EFF" fill-opacity="0.5"/><line x1="16" y1="4" x2="16" y2="10" stroke="#409EFF" stroke-width="1.5"/><line x1="30" y1="4" x2="30" y2="10" stroke="#409EFF" stroke-width="1.5"/><line x1="44" y1="4" x2="44" y2="10" stroke="#409EFF" stroke-width="1.5"/><line x1="4" y1="16" x2="10" y2="16" stroke="#409EFF" stroke-width="1.5"/><line x1="4" y1="30" x2="10" y2="30" stroke="#409EFF" stroke-width="1.5"/><line x1="4" y1="44" x2="10" y2="44" stroke="#409EFF" stroke-width="1.5"/></svg>`,
  'dv-border-7': `<svg viewBox="0 0 60 60" fill="none"><path d="M4,4 L4,24" stroke="#409EFF" stroke-width="2.5"/><path d="M4,4 L24,4" stroke="#409EFF" stroke-width="2.5"/><path d="M6,6 L6,18" stroke="#409EFF" stroke-width="1" opacity="0.4"/><path d="M6,6 L18,6" stroke="#409EFF" stroke-width="1" opacity="0.4"/><path d="M56,4 L36,4" stroke="#409EFF" stroke-width="2.5"/><path d="M56,4 L56,24" stroke="#409EFF" stroke-width="2.5"/><path d="M54,6 L54,18" stroke="#409EFF" stroke-width="1" opacity="0.4"/><path d="M54,6 L42,6" stroke="#409EFF" stroke-width="1" opacity="0.4"/><path d="M4,56 L4,36" stroke="#409EFF" stroke-width="2.5"/><path d="M4,56 L24,56" stroke="#409EFF" stroke-width="2.5"/><path d="M6,54 L6,42" stroke="#409EFF" stroke-width="1" opacity="0.4"/><path d="M6,54 L18,54" stroke="#409EFF" stroke-width="1" opacity="0.4"/><path d="M56,56 L56,36" stroke="#409EFF" stroke-width="2.5"/><path d="M56,56 L36,56" stroke="#409EFF" stroke-width="2.5"/><path d="M54,54 L54,42" stroke="#409EFF" stroke-width="1" opacity="0.4"/><path d="M54,54 L42,54" stroke="#409EFF" stroke-width="1" opacity="0.4"/></svg>`,
  'dv-border-8': `<svg viewBox="0 0 60 60" fill="none"><rect x="4" y="4" width="52" height="52" fill="none" stroke="#409EFF" stroke-width="1.5"/><circle cx="4" cy="30" r="3" fill="#409EFF" fill-opacity="0.7" stroke="#409EFF" stroke-width="1"/><line x1="7" y1="4" x2="56" y2="4" stroke="#409EFF" stroke-width="1" opacity="0.3"/></svg>`,
  'dv-border-9': `<svg viewBox="0 0 60 60" fill="none"><rect x="4" y="4" width="52" height="52" fill="none" stroke="#409EFF" stroke-width="1.5"/><rect x="8" y="8" width="44" height="44" fill="none" stroke="#409EFF" stroke-width="1" stroke-dasharray="4 3" opacity="0.5"/></svg>`,
  'dv-border-10': `<svg viewBox="0 0 60 60" fill="none"><path d="M4,4 L4,24 L8,20 L12,24 L16,20 L20,24 L24,20 L28,24 L32,20 L36,24 L40,20 L44,24 L48,20 L52,24 L56,20 L56,4 Z" fill="none" stroke="#409EFF" stroke-width="1.5"/><path d="M4,56 L4,36 L8,40 L12,36 L16,40 L20,36 L24,40 L28,36 L32,40 L36,36 L40,40 L44,36 L48,40 L52,36 L56,40 L56,56 Z" fill="none" stroke="#409EFF" stroke-width="1.5"/></svg>`,
  'dv-border-11': `<svg viewBox="0 0 60 60" fill="none"><rect x="4" y="4" width="52" height="52" fill="none" stroke="#409EFF" stroke-width="1.5"/><circle cx="4" cy="4" r="3" fill="#409EFF"/><circle cx="56" cy="4" r="3" fill="#409EFF"/><circle cx="4" cy="56" r="3" fill="#409EFF"/><circle cx="56" cy="56" r="3" fill="#409EFF"/><circle cx="30" cy="4" r="3" fill="#409EFF" fill-opacity="0.5"/><circle cx="30" cy="56" r="3" fill="#409EFF" fill-opacity="0.5"/><circle cx="4" cy="30" r="3" fill="#409EFF" fill-opacity="0.5"/><circle cx="56" cy="30" r="3" fill="#409EFF" fill-opacity="0.5"/></svg>`,
  'dv-border-12': `<svg viewBox="0 0 60 60" fill="none"><rect x="4" y="4" width="52" height="52" fill="none" stroke="#409EFF" stroke-width="1.5"/><path d="M4,4 L12,4 L8,8 Z" fill="#409EFF" fill-opacity="0.5"/><path d="M56,4 L48,4 L52,8 Z" fill="#409EFF" fill-opacity="0.5"/><path d="M4,56 L12,56 L8,52 Z" fill="#409EFF" fill-opacity="0.5"/><path d="M56,56 L48,56 L52,52 Z" fill="#409EFF" fill-opacity="0.5"/></svg>`,
  'dv-border-13': `<svg viewBox="0 0 60 60" fill="none"><rect x="4" y="4" width="52" height="52" fill="none" stroke="#409EFF" stroke-width="1.5" stroke-dasharray="8 4"/><circle cx="4" cy="4" r="4" fill="#409EFF" fill-opacity="0.5"/><circle cx="56" cy="4" r="4" fill="#409EFF" fill-opacity="0.5"/><circle cx="4" cy="56" r="4" fill="#409EFF" fill-opacity="0.5"/><circle cx="56" cy="56" r="4" fill="#409EFF" fill-opacity="0.5"/></svg>`,
  'dv-decoration-1': `<svg viewBox="0 0 60 60" fill="none"><rect x="6" y="22" width="4" height="4" fill="#0de7c2"/><rect x="14" y="22" width="4" height="4" fill="#0de7c2" opacity="0.5"/><rect x="22" y="22" width="4" height="4" fill="#0de7c2"/><rect x="30" y="22" width="4" height="4" fill="#0de7c2" opacity="0.3"/><rect x="38" y="22" width="4" height="4" fill="#0de7c2"/><rect x="46" y="22" width="4" height="4" fill="#0de7c2" opacity="0.5"/><rect x="6" y="30" width="4" height="4" fill="#0de7c2" opacity="0.3"/><rect x="14" y="30" width="4" height="4" fill="#0de7c2"/><rect x="22" y="30" width="4" height="4" fill="#0de7c2" opacity="0.5"/><rect x="30" y="30" width="4" height="4" fill="#0de7c2"/><rect x="38" y="30" width="4" height="4" fill="#0de7c2" opacity="0.3"/><rect x="46" y="30" width="4" height="4" fill="#0de7c2"/><rect x="6" y="38" width="4" height="4" fill="#0de7c2"/><rect x="14" y="38" width="4" height="4" fill="#0de7c2" opacity="0.5"/><rect x="22" y="38" width="4" height="4" fill="#0de7c2"/><rect x="30" y="38" width="4" height="4" fill="#0de7c2" opacity="0.3"/><rect x="38" y="38" width="4" height="4" fill="#0de7c2"/><rect x="46" y="38" width="4" height="4" fill="#0de7c2" opacity="0.5"/></svg>`,
  'dv-decoration-2': `<svg viewBox="0 0 60 60" fill="none"><line x1="4" y1="30" x2="56" y2="30" stroke="#3faacb" stroke-width="1" opacity="0.3"/><line x1="20" y1="30" x2="40" y2="30" stroke="#3faacb" stroke-width="2"/><circle cx="30" cy="30" r="2" fill="#fff"/></svg>`,
  'dv-decoration-3': `<svg viewBox="0 0 60 60" fill="none"><rect x="6" y="24" width="6" height="6" fill="#7acaec"/><rect x="16" y="24" width="6" height="6" fill="#7acaec" opacity="0.5"/><rect x="26" y="24" width="6" height="6" fill="#7acaec"/><rect x="36" y="24" width="6" height="6" fill="#7acaec" opacity="0.3"/><rect x="46" y="24" width="6" height="6" fill="#7acaec"/><rect x="6" y="34" width="6" height="6" fill="#7acaec" opacity="0.3"/><rect x="16" y="34" width="6" height="6" fill="#7acaec"/><rect x="26" y="34" width="6" height="6" fill="#7acaec" opacity="0.5"/><rect x="36" y="34" width="6" height="6" fill="#7acaec"/><rect x="46" y="34" width="6" height="6" fill="#7acaec" opacity="0.3"/></svg>`,
  'dv-decoration-4': `<svg viewBox="0 0 60 60" fill="none"><rect x="6" y="6" width="48" height="48" fill="rgba(255,255,255,0.05)"/><line x1="30" y1="6" x2="30" y2="54" stroke="rgba(255,255,255,0.2)" stroke-width="3"/><line x1="30" y1="6" x2="30" y2="54" stroke="#00d4ff" stroke-width="1.5" stroke-dasharray="8,16"/><circle cx="30" cy="12" r="2.5" fill="#00d4ff" fill-opacity="0.8"/><circle cx="30" cy="30" r="2.5" fill="#00d4ff"/><circle cx="30" cy="48" r="2.5" fill="#00d4ff" fill-opacity="0.6"/><rect x="12" y="8" width="36" height="44" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1" stroke-dasharray="4,3" rx="2"/></svg>`,
  'dv-decoration-5': `<svg viewBox="0 0 60 60" fill="none"><polyline points="4,30 14,18 24,30 34,18 44,30 54,18" stroke="#3f96a5" stroke-width="2" fill="none"/><line x1="18" y1="42" x2="42" y2="42" stroke="#3f96a5" stroke-width="1.5" opacity="0.6"/></svg>`,
  'dv-decoration-6': `<svg viewBox="0 0 60 60" fill="none"><rect x="4" y="4" width="52" height="52" fill="none" stroke="#7acaec" stroke-width="1" opacity="0.3"/><line x1="4" y1="16" x2="56" y2="16" stroke="#7acaec" stroke-width="1" opacity="0.2"/><line x1="4" y1="30" x2="56" y2="30" stroke="#7acaec" stroke-width="1" opacity="0.2"/><line x1="4" y1="44" x2="56" y2="44" stroke="#7acaec" stroke-width="1" opacity="0.2"/><line x1="16" y1="4" x2="16" y2="56" stroke="#7acaec" stroke-width="1" opacity="0.2"/><line x1="30" y1="4" x2="30" y2="56" stroke="#7acaec" stroke-width="1" opacity="0.2"/><line x1="44" y1="4" x2="44" y2="56" stroke="#7acaec" stroke-width="1" opacity="0.2"/><rect x="8" y="8" width="10" height="10" fill="#7acaec" fill-opacity="0.3" rx="1"/><rect x="22" y="22" width="10" height="10" fill="#7acaec" fill-opacity="0.5" rx="1"/><rect x="42" y="8" width="10" height="10" fill="#7acaec" fill-opacity="0.2" rx="1"/><rect x="8" y="42" width="10" height="10" fill="#7acaec" fill-opacity="0.4" rx="1"/><rect x="42" y="42" width="10" height="10" fill="#7acaec" fill-opacity="0.3" rx="1"/><circle cx="30" cy="30" r="3" fill="#7acaec" fill-opacity="0.6"/></svg>`,
  'dv-decoration-7': `<svg viewBox="0 0 60 60" fill="none"><polyline points="18,18 10,30 18,42" stroke="#1dc1f5" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="16,20 10,30 16,40" stroke="#1dc1f5" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/><polyline points="42,18 50,30 42,42" stroke="#1dc1f5" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="44,20 50,30 44,40" stroke="#1dc1f5" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/></svg>`,
  'dv-decoration-8': `<svg viewBox="0 0 60 60" fill="none"><polyline points="4,28 20,28 24,18 40,18 44,28 56,28" stroke="#3f96a5" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><line x1="4" y1="42" x2="56" y2="42" stroke="#3f96a5" stroke-width="1.5" opacity="0.6"/></svg>`,
  'dv-decoration-9': `<svg viewBox="0 0 60 60" fill="none"><circle cx="30" cy="30" r="24" fill="none" stroke="rgba(3,166,224,0.6)" stroke-width="3" stroke-dasharray="12,8,4,8"/><circle cx="30" cy="30" r="18" fill="none" stroke="rgba(3,166,224,0.4)" stroke-width="2" stroke-dasharray="6,4,2,4"/><circle cx="30" cy="30" r="12" fill="none" stroke="rgba(3,166,224,0.3)" stroke-width="1" stroke-dasharray="3,2"/><circle cx="30" cy="30" r="2" fill="#03a6e0"/></svg>`,
  'dv-decoration-10': `<svg viewBox="0 0 60 60" fill="none"><circle cx="8" cy="30" r="3" fill="none" stroke="#00c2ff" stroke-width="1.5"/><circle cx="22" cy="30" r="3" fill="none" stroke="#00c2ff" stroke-width="1.5"/><circle cx="38" cy="30" r="3" fill="none" stroke="#00c2ff" stroke-width="1.5"/><circle cx="52" cy="30" r="3" fill="none" stroke="#00c2ff" stroke-width="1.5"/><line x1="11" y1="30" x2="19" y2="30" stroke="#00c2ff" stroke-width="1.5" stroke-dasharray="4,3"/><line x1="25" y1="30" x2="35" y2="30" stroke="#00c2ff" stroke-width="2" stroke-dasharray="6,4"/><line x1="41" y1="30" x2="49" y2="30" stroke="#00c2ff" stroke-width="1.5" stroke-dasharray="4,3"/></svg>`,
  'dv-decoration-11': `<svg viewBox="0 0 60 60" fill="none"><polygon points="30,6 52,18 52,42 30,54 8,42 8,18" fill="#1a98fc" fill-opacity="0.15" stroke="#1a98fc" stroke-width="1.5"/><polygon points="30,6 52,18 52,42 30,54 8,42 8,18" fill="none" stroke="#2cf7fe" stroke-width="1" stroke-dasharray="4,3" opacity="0.6"/><polygon points="8,6 14,6 11,10" fill="#1a98fc" fill-opacity="0.6"/><polygon points="52,6 46,6 49,10" fill="#1a98fc" fill-opacity="0.6"/><polygon points="8,54 14,54 11,50" fill="#1a98fc" fill-opacity="0.6"/><polygon points="52,54 46,54 49,50" fill="#1a98fc" fill-opacity="0.6"/></svg>`,
  'dv-decoration-12': `<svg viewBox="0 0 60 60" fill="none"><circle cx="30" cy="30" r="26" fill="none" stroke="#2783ce" stroke-width="1" stroke-dasharray="3,3"/><circle cx="30" cy="30" r="20" fill="none" stroke="#2783ce" stroke-width="1" stroke-dasharray="2,4" opacity="0.7"/><circle cx="30" cy="30" r="14" fill="none" stroke="#2783ce" stroke-width="1" stroke-dasharray="1,3" opacity="0.5"/><circle cx="30" cy="30" r="3" fill="#2cf7fe"/><line x1="30" y1="30" x2="30" y2="4" stroke="#2cf7fe" stroke-width="1.5"/><path d="M30,30 L30,4 A26,26 0 0,1 48,14 Z" fill="#2cf7fe" fill-opacity="0.15"/></svg>`,
}

defineExpose({ sortedComponents, componentIcons })
</script>

<template>
  <div class="left-panel">
    <div class="panel-tabs">
      <div
        v-for="tab in [{ key: 'components', label: '组件' }, { key: 'layers', label: '图层' }]"
        :key="tab.key"
        class="tab-item"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </div>
    </div>

    <template v-if="activeTab === 'components'">
      <div class="search-box">
        <el-input v-model="searchQuery" placeholder="搜索组件..." clearable size="small" prefix-icon="Search" />
      </div>
      <div class="component-list">
        <div v-for="category in filteredCategories" :key="category.key" class="category">
          <div class="category-header" @click="expandedCategories.includes(category.key) ? expandedCategories.splice(expandedCategories.indexOf(category.key), 1) : expandedCategories.push(category.key)">
            <el-icon><component :is="category.icon" /></el-icon>
            <span>{{ category.name }}</span>
            <el-icon class="expand-icon" :class="{ expanded: expandedCategories.includes(category.key) }">
              <ArrowDown />
            </el-icon>
          </div>
          <div v-show="expandedCategories.includes(category.key)" class="category-content">
            <div v-for="group in category.children" :key="group.group" class="group">
              <div class="group-title">{{ group.group }}</div>
              <div class="group-items">
                <div
                  v-for="item in group.items"
                  :key="item.type"
                  class="component-item"
                  draggable="true"
                  @dragstart="onDragStart($event, item)"
                >
                  <div class="item-icon" v-html="componentIcons[item.type] || '<div class=default-icon/>'"></div>
                  <span class="item-name">{{ item.name }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-if="activeTab === 'layers'">
      <div class="layer-list">
        <div
          v-for="comp in sortedComponents"
          :key="comp.id"
          class="layer-item"
          :class="{ selected: componentsStore.selectedIds.includes(comp.id) }"
          @click="componentsStore.selectComponent(comp.id)"
        >
          <span class="layer-name">{{ comp.name }}</span>
          <span class="layer-type">{{ comp.type }}</span>
        </div>
        <div v-if="!sortedComponents.length" class="empty-layers">
          暂无组件
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.left-panel {
  width: 240px;
  height: 100%;
  background: white;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-tabs {
  display: flex;
  border-bottom: 1px solid #e4e7ed;
}

.tab-item {
  flex: 1;
  padding: 10px;
  text-align: center;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  color: #606266;
}

.tab-item:hover {
  color: #409eff;
}

.tab-item.active {
  color: #409eff;
  border-bottom: 2px solid #409eff;
}

.search-box {
  padding: 10px;
  position: sticky;
  top: 0;
  background: white;
  z-index: 10;
  border-bottom: 1px solid #f0f0f0;
}

.component-list {
  flex: 1;
  overflow-y: auto;
}

.category {
  border-bottom: 1px solid #f0f0f0;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #303133;
  transition: background 0.2s;
}

.category-header:hover {
  background: #f5f7fa;
}

.expand-icon {
  margin-left: auto;
  transition: transform 0.2s;
}

.expand-icon.expanded {
  transform: rotate(180deg);
}

.category-content {
  padding: 0 8px 8px;
}

.group {
  margin-bottom: 8px;
}

.group-title {
  font-size: 11px;
  color: #909399;
  padding: 4px 8px;
  text-transform: uppercase;
}

.group-items {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.component-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 2px;
  border-radius: 4px;
  cursor: grab;
  transition: all 0.2s;
}

.component-item:hover {
  background: #ecf5ff;
}

.component-item:active {
  cursor: grabbing;
}

.item-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2px;
}

.item-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.item-name {
  font-size: 10px;
  color: #606266;
  text-align: center;
  line-height: 1.2;
}

.layer-list {
  flex: 1;
  overflow-y: auto;
}

.layer-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid #f0f0f0;
}

.layer-item:hover {
  background: #f5f7fa;
}

.layer-item.selected {
  background: #ecf5ff;
  color: #409eff;
}

.layer-name {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layer-type {
  font-size: 11px;
  color: #909399;
}

.empty-layers {
  padding: 20px;
  text-align: center;
  color: #909399;
  font-size: 13px;
}
</style>
