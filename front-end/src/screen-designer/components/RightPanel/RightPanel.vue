<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useComponentsStore } from '../../stores/components'
import { useCanvasStore } from '../../stores/canvas'
import { useDataFetch } from '../../composables/useDataFetch'
import { datasetApi } from '@/api'
import './configs/config-common.css'
import CodeEditor from '../CodeEditor/CodeEditor.vue'
import Globe3DConfig from './configs/Globe3DConfig.vue'
import DoughnutCenterConfig from './configs/DoughnutCenterConfig.vue'
import RadarConfig from './configs/RadarConfig.vue'
import GaugeConfig from './configs/GaugeConfig.vue'
import GaugeMultiConfig from './configs/GaugeMultiConfig.vue'
import FunnelConfig from './configs/FunnelConfig.vue'
import StackedAreaConfig from './configs/StackedAreaConfig.vue'
import MixedPositiveNegativeConfig from './configs/MixedPositiveNegativeConfig.vue'
import PolarBarConfig from './configs/PolarBarConfig.vue'
import PositiveNegativeBarConfig from './configs/PositiveNegativeBarConfig.vue'
import DynamicBarRaceConfig from './configs/DynamicBarRaceConfig.vue'
import GeoMapConfig from './configs/GeoMapConfig.vue'
import IframeConfig from './configs/IframeConfig.vue'
import StaticImageConfig from './configs/StaticImageConfig.vue'
import CarouselConfig from './configs/CarouselConfig.vue'
import VideoConfig from './configs/VideoConfig.vue'
import CustomChartConfig from './configs/CustomChartConfig.vue'
import CustomChartDataHint from './configs/CustomChartDataHint.vue'
import DatasetQueryDialog from './DatasetQueryDialog.vue'
import ScreenIcon from '../ScreenIcon.vue'

const componentsStore = useComponentsStore()
const canvasStore = useCanvasStore()
const { refreshComponent } = useDataFetch()

// 右侧面板可折叠
const rightPanelCollapsed = ref(false)
const togglePanel = () => { rightPanelCollapsed.value = !rightPanelCollapsed.value }

const expandedSections = ref<string[]>(['canvas'])
const showDataEditor = ref(false)
const showQueryDialog = ref(false)

const selectedComponent = computed(() => {
  if (componentsStore.selectedIds.length === 1) {
    return componentsStore.components.find(c => c.id === componentsStore.selectedIds[0])
  }
  return null
})

const isMobilePreview = computed(() => canvasStore.previewDevice !== 'pc')

const querySummary = computed(() => {
  const q = selectedComponent.value?.data?.query
  if (!q || !q.metrics?.length) return '未配置'
  return `${(q.dimensions || []).length} 个维度 / ${q.metrics.length} 个指标`
})

function onQueryConfirm(payload: { datasetId: number | null; query: any }) {
  if (!selectedComponent.value) return
  const data = { ...selectedComponent.value.data, datasetId: payload.datasetId, query: payload.query }
  selectedComponent.value.data = data
}

// 数据集数据源
const datasetList = ref<{ id: number; name: string }[]>([])

async function loadDatasetList() {
  if (datasetList.value.length) return
  try {
    datasetList.value = (await datasetApi.list()) || []
  } catch { datasetList.value = [] }
}

watch(() => selectedComponent.value?.data?.type, (t) => {
  if (t === 'dataset') {
    loadDatasetList()
  }
}, { immediate: true })

function onDataTypeChange(t: string) {
  if (!selectedComponent.value) return
  const data = { ...selectedComponent.value.data, type: t }
  if (t === 'dataset' && data.datasetId === undefined) {
    data.datasetId = null
    data.categoryField = ''
    data.valueFields = []
  }
  selectedComponent.value.data = data
}

function onDatasetSelect(id: number | null) {
  if (!selectedComponent.value) return
  const data = { ...selectedComponent.value.data, datasetId: id }
  delete data.query
  selectedComponent.value.data = data
}

// Auto-expand data+props when component selected, collapse canvas
watch(() => componentsStore.selectedIds, (ids) => {
  if (ids.length === 1) {
    expandedSections.value = ['data', 'props']
  } else if (ids.length === 0) {
    expandedSections.value = ['canvas']
  }
})

const compX = computed({
  get: () => {
    if (!selectedComponent.value) return 0
    if (isMobilePreview.value && selectedComponent.value.mobileLayout) return selectedComponent.value.mobileLayout.x
    return selectedComponent.value.x
  },
  set: (v: number) => {
    if (!selectedComponent.value) return
    if (isMobilePreview.value) {
      const ml = selectedComponent.value.mobileLayout || { x: 0, y: 0, width: 200, height: 100 }
      componentsStore.updateComponent(selectedComponent.value.id, { mobileLayout: { ...ml, x: v } })
    } else {
      selectedComponent.value.x = v
    }
  }
})

const compY = computed({
  get: () => {
    if (!selectedComponent.value) return 0
    if (isMobilePreview.value && selectedComponent.value.mobileLayout) return selectedComponent.value.mobileLayout.y
    return selectedComponent.value.y
  },
  set: (v: number) => {
    if (!selectedComponent.value) return
    if (isMobilePreview.value) {
      const ml = selectedComponent.value.mobileLayout || { x: 0, y: 0, width: 200, height: 100 }
      componentsStore.updateComponent(selectedComponent.value.id, { mobileLayout: { ...ml, y: v } })
    } else {
      selectedComponent.value.y = v
    }
  }
})

const compW = computed({
  get: () => {
    if (!selectedComponent.value) return 200
    if (isMobilePreview.value && selectedComponent.value.mobileLayout) return selectedComponent.value.mobileLayout.width
    return selectedComponent.value.width
  },
  set: (v: number) => {
    if (!selectedComponent.value) return
    if (isMobilePreview.value) {
      const ml = selectedComponent.value.mobileLayout || { x: 0, y: 0, width: 200, height: 100 }
      componentsStore.updateComponent(selectedComponent.value.id, { mobileLayout: { ...ml, width: v } })
    } else {
      selectedComponent.value.width = v
    }
  }
})

const compH = computed({
  get: () => {
    if (!selectedComponent.value) return 100
    if (isMobilePreview.value && selectedComponent.value.mobileLayout) return selectedComponent.value.mobileLayout.height
    return selectedComponent.value.height
  },
  set: (v: number) => {
    if (!selectedComponent.value) return
    if (isMobilePreview.value) {
      const ml = selectedComponent.value.mobileLayout || { x: 0, y: 0, width: 200, height: 100 }
      componentsStore.updateComponent(selectedComponent.value.id, { mobileLayout: { ...ml, height: v } })
    } else {
      selectedComponent.value.height = v
    }
  }
})

const isChartComponent = computed(() => {
  if (!selectedComponent.value) return false
  const type = selectedComponent.value.type
  const chartTypes = [
    'bar-single', 'bar-group', 'bar-stack', 'bar-line', 'bar-group-stacked', 'bar-percent', 'bar-waterfall',
    'bar-horizontal', 'bar-horizontal-group', 'bar-horizontal-stack', 'bar-horizontal-percent', 'bar-horizontal-mixed',
    'line-single', 'line-multi', 'line-area', 'line-smooth', 'line-percent-area', 'line-step', 'stacked-area',
    'pie', 'pie-doughnut', 'pie-rose', 'pie-sunburst', 'pie-treemap',
    'funnel', 'funnel-horizontal',
    'radar', 'scatter', 'bubble', 'progress',
    'heatmap', 'wordcloud', 'boxplot', 'sankey', 'calendar', 'candlestick',
    'mixed-positive-negative', 'polar-bar', 'positive-negative-bar', 'dynamic-bar-race',
    'globe-3d', 'geo-map',
    'gauge', 'gauge-speed', 'gauge-stage', 'gauge-level', 'gauge-multi-title',
    'gauge-temp', 'gauge-score', 'gauge-pressure', 'gauge-clock', 'gauge-car', 'gauge-multi', 'liquid-fill'
  ]
  return chartTypes.includes(type)
})

const isTextComponent = computed(() => {
  if (!selectedComponent.value) return false
  const type = selectedComponent.value.type
  return ['static-text', 'data-text'].includes(type)
})

const hasAxis = computed(() => {
  if (!selectedComponent.value) return false
  const type = selectedComponent.value.type
  const noAxisTypes = [
    'pie', 'pie-doughnut', 'pie-rose', 'pie-sunburst', 'pie-treemap', 'funnel', 'funnel-horizontal',
    'radar', 'sankey', 'calendar', 'carousel-list', 'rank-list', 'table-normal',
    'gauge', 'gauge-speed', 'gauge-stage', 'gauge-level', 'gauge-multi-title',
    'gauge-temp', 'gauge-score', 'gauge-pressure', 'gauge-clock', 'gauge-car', 'gauge-multi',
    'progress', 'liquid-fill',
    'wordcloud', 'polar-bar', 'geo-map', 'globe-3d', 'map-china', 'map-bubble'
  ]
  return !noAxisTypes.includes(type)
})

const hasLegend = computed(() => {
  if (!selectedComponent.value) return false
  const type = selectedComponent.value.type
  const noLegendTypes = [
    'gauge', 'gauge-speed', 'gauge-stage', 'gauge-level', 'gauge-multi-title',
    'gauge-temp', 'gauge-score', 'gauge-pressure', 'gauge-clock', 'gauge-car', 'gauge-multi',
    'progress', 'liquid-fill'
  ]
  return !noLegendTypes.includes(type)
})

const hasTooltip = computed(() => {
  if (!selectedComponent.value) return false
  const type = selectedComponent.value.type
  const noTooltipTypes = [
    'gauge', 'gauge-speed', 'gauge-stage', 'gauge-level', 'gauge-multi-title',
    'gauge-temp', 'gauge-score', 'gauge-pressure', 'gauge-clock', 'gauge-car', 'gauge-multi',
    'progress', 'liquid-fill'
  ]
  return !noTooltipTypes.includes(type)
})

const hasDataLabel = computed(() => {
  if (!selectedComponent.value) return false
  const type = selectedComponent.value.type
  // Only show data label config for charts that use getSeriesLabel with full options
  const supportedTypes = [
    'bar-single', 'bar-group', 'bar-stack', 'bar-line', 'bar-group-stacked', 'bar-percent', 'bar-waterfall',
    'bar-horizontal', 'bar-horizontal-group', 'bar-horizontal-stack', 'bar-horizontal-percent', 'bar-horizontal-mixed',
    'line-single', 'line-multi', 'line-area', 'line-smooth', 'line-percent-area', 'line-step', 'stacked-area',
    'pie', 'pie-doughnut', 'pie-rose',
    'mixed-positive-negative', 'positive-negative-bar', 'wordcloud'
  ]
  return supportedTypes.includes(type)
})

const hasSeriesStyle = computed(() => {
  if (!selectedComponent.value) return false
  const type = selectedComponent.value.type
  const showTypes = [
    'bar-single', 'bar-group', 'bar-stack', 'bar-line', 'bar-group-stacked', 'bar-percent', 'bar-waterfall',
    'bar-horizontal', 'bar-horizontal-group', 'bar-horizontal-stack', 'bar-horizontal-percent', 'bar-horizontal-mixed',
    'line-single', 'line-multi', 'line-area', 'line-smooth', 'line-percent-area', 'line-step', 'stacked-area',
    'pie', 'pie-doughnut', 'pie-rose', 'scatter'
  ]
  return showTypes.includes(type)
})

const hasMobilePosition = computed({
  get: () => selectedComponent.value?.mobileLayout !== null && selectedComponent.value?.mobileLayout !== undefined,
  set: (val: boolean) => {
    if (!selectedComponent.value) return
    if (!val) {
      componentsStore.updateComponent(selectedComponent.value.id, { mobileLayout: null })
    } else {
      const c = selectedComponent.value
      const vp = canvasStore.viewportSize
      const scale = vp.width / c.width
      componentsStore.updateComponent(c.id, {
        mobileLayout: { x: 0, y: 0, width: vp.width, height: Math.round(c.height * scale) }
      })
    }
  }
})

const updateProps = (key: string, value: any) => {
  if (!selectedComponent.value) return
  const props = { ...selectedComponent.value.props, [key]: value }
  componentsStore.updateComponent(selectedComponent.value.id, { props })
}

const toggleTextProp = (key: string, onValue: string, offValue: string) => {
  if (!selectedComponent.value) return
  const current = selectedComponent.value.props?.[key] || offValue
  updateProps(key, current === onValue ? offValue : onValue)
}

function applyTheme(themeName: string) {
  if (!selectedComponent.value) return
  updateProps('theme', themeName)
  if (themeName === '自定义') return
  const preset = colorPresets.find(p => p.name === themeName)
  if (preset) {
    updateProps('colors', [...preset.colors])
  }
}

function updateColor(index: number, color: string) {
  if (!selectedComponent.value) return
  const colors = [...(selectedComponent.value.props.colors || [])]
  colors[index] = color
  updateProps('colors', colors)
}

function addCustomColor() {
  if (!selectedComponent.value) return
  const colors = [...(selectedComponent.value.props.colors || ['#ffffff'])]
  colors.push('#ffffff')
  updateProps('colors', colors)
}

function clearData() {
  if (!selectedComponent.value) return
  selectedComponent.value.data.value = ''
}

const colorPresets = [
  { name: '科技蓝', colors: ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399', '#0098d9', '#e5243b', '#f6ab45', '#7ac143', '#3399ff'] },
  { name: '自然绿', colors: ['#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#48b8d0', '#a1d66b', '#f7a541', '#54a0ff', '#c44569', '#5f27cd'] },
  { name: '暖阳橙', colors: ['#ff6b35', '#f7c948', '#2ec4b6', '#e71d36', '#011627', '#fdffb6', '#9b5de5', '#00bbf9', '#f15bb5', '#fee440'] },
  { name: '星空紫', colors: ['#7c3aed', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb923c', '#facc15', '#34d399', '#22d3ee', '#60a5fa'] },
  { name: '海洋蓝', colors: ['#0077b6', '#00b4d8', '#90e0ef', '#caf0f8', '#023e8a', '#0096c7', '#48cae4', '#ade8f4', '#ade8f4', '#caf0f8'] },
  { name: '大地棕', colors: ['#8b5e3c', '#c9a96e', '#e6c9a8', '#4a6741', '#7c9473', '#d4a373', '#ccd5ae', '#e9edc9', '#fefae0', '#faedcd'] },
  { name: '糖果粉', colors: ['#ff006e', '#fb5607', '#ffbe0b', '#8338ec', '#3a86ff', '#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'] },
  { name: '暗夜灰', colors: ['#495057', '#6c757d', '#adb5bd', '#ced4da', '#dee2e6', '#212529', '#343a40', '#0dcaf0', '#198754', '#ffc107'] },
  { name: '彩虹', colors: ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#e91e63', '#ff9800', '#00bcd4'] },
  { name: '莫兰迪', colors: ['#b5c4b1', '#e8d5b7', '#c9a87c', '#a1b5c1', '#d4a5a5', '#967e76', '#b0c4de', '#dbb7a4', '#c3b1e1', '#a8d8ea'] }
]

const chartThemes = ['默认', '科技蓝', '自然绿', '暖阳橙', '星空紫', '海洋蓝', '大地棕', '糖果粉', '暗夜灰', '彩虹', '莫兰迪', '自定义']

const positionLabels: Record<string, string> = {
  'top-left': '左上', 'top': '上中', 'top-right': '右上',
  'left': '左中', 'center': '居中', 'right': '右中',
  'bottom-left': '左下', 'bottom': '下中', 'bottom-right': '右下'
}

function getColorPreset(name: string) {
  return colorPresets.find(p => p.name === name)?.colors
}

// 从canvasStore.config.background解析背景状态
function parseBackground(bg: string) {
  if (!bg) return { type: 'solid', color: '#0a1929', gradientStart: '#0a1929', gradientEnd: '#1a3a5c', direction: 'to right' }
  const gradientMatch = bg.match(/linear-gradient\((.+?),\s*(.+?),\s*(.+?)\)/)
  if (gradientMatch) {
    return {
      type: 'gradient',
      color: '#0a1929',
      gradientStart: gradientMatch[2],
      gradientEnd: gradientMatch[3],
      direction: gradientMatch[1]
    }
  }
  return { type: 'solid', color: bg, gradientStart: '#0a1929', gradientEnd: '#1a3a5c', direction: 'to right' }
}

const bgState = parseBackground(canvasStore.config.background)
const backgroundType = ref(bgState.type)
const bgColor = ref(bgState.color)
const gradientStart = ref(bgState.gradientStart)
const gradientEnd = ref(bgState.gradientEnd)
const gradientDirection = ref(bgState.direction)
const bgImageInput = ref<HTMLInputElement>()

function handleBgImageUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    canvasStore.setConfig({ bgImage: reader.result as string })
  }
  reader.readAsDataURL(file)
  ;(e.target as HTMLInputElement).value = ''
}

function removeBgImage() {
  canvasStore.setConfig({ bgImage: '' })
}

watch([bgColor, gradientStart, gradientEnd, gradientDirection, backgroundType], () => {
  if (backgroundType.value === 'solid') {
    canvasStore.setConfig({ background: bgColor.value })
  } else {
    canvasStore.setConfig({ background: `linear-gradient(${gradientDirection.value}, ${gradientStart.value}, ${gradientEnd.value})` })
  }
})

watch(() => [canvasStore.config.width, canvasStore.config.height], ([w, h]) => {
  canvasStore.setDesignSize(w, h)
})

const presetResolutions = [
  { label: '1920×1080', width: 1920, height: 1080 },
  { label: '3840×2160', width: 3840, height: 2160 },
  { label: '1366×768', width: 1366, height: 768 },
  { label: '1536×864', width: 1536, height: 864 },
  { label: '1280×720', width: 1280, height: 720 },
  { label: '自定义', width: 0, height: 0 }
]
</script>

<template>
  <div class="right-panel" :class="{ collapsed: rightPanelCollapsed }">
    <!-- 左缘中部的折叠手柄(始终可见，不占面板宽度) -->
    <button
      class="rp-float-btn"
      :title="rightPanelCollapsed ? '展开面板' : '收起面板'"
      @click="togglePanel"
    >
      <span>{{ rightPanelCollapsed ? '‹' : '›' }}</span>
    </button>

    <!-- 展开状态 -->
    <template v-if="!rightPanelCollapsed">
      <el-collapse v-model="expandedSections" class="panel-collapse">
      <el-collapse-item name="canvas">
        <template #title>
          <div class="collapse-title"><ScreenIcon name="canvas" :size="15" /><span>画布</span></div>
        </template>
        <div v-if="!isMobilePreview" class="section">
          <div class="section-title">画布尺寸</div>
          <el-form label-width="70px" size="default">
            <el-form-item label="预设">
              <el-select v-model="canvasStore.config.width" class="rc-w100" @change="(val: any) => {
                const preset = presetResolutions.find(p => p.width === val)
                if (preset && preset.height > 0) canvasStore.setConfig({ height: preset.height })
              }">
                <el-option v-for="p in presetResolutions" :key="p.label" :label="p.label" :value="p.width" />
              </el-select>
            </el-form-item>
            <el-form-item label="宽高">
              <div class="rc-row">
                <el-input-number v-model="canvasStore.config.width" :min="100" :max="7680" :step="10" class="rc-flex-1" />
                <el-input-number v-model="canvasStore.config.height" :min="100" :max="4320" :step="10" class="rc-flex-1" />
              </div>
            </el-form-item>
          </el-form>
        </div>
        <div class="section">
          <div class="section-title">画布背景</div>
          <el-form label-width="70px" size="default">
            <el-form-item label="类型">
              <el-radio-group v-model="backgroundType">
                <el-radio value="solid">纯色</el-radio>
                <el-radio value="gradient">渐变</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item v-if="backgroundType === 'solid'" label="颜色">
              <el-color-picker v-model="bgColor" />
            </el-form-item>
            <template v-else>
              <el-form-item label="方向">
                <el-select v-model="gradientDirection" class="rc-w100">
                  <el-option label="从左到右" value="to right" />
                  <el-option label="从右到左" value="to left" />
                  <el-option label="从上到下" value="to bottom" />
                  <el-option label="从下到上" value="to top" />
                  <el-option label="左上到右下" value="to bottom right" />
                  <el-option label="右上到左下" value="to bottom left" />
                </el-select>
              </el-form-item>
              <el-form-item label="起始色">
                <el-color-picker v-model="gradientStart" />
              </el-form-item>
              <el-form-item label="结束色">
                <el-color-picker v-model="gradientEnd" />
              </el-form-item>
            </template>
          </el-form>
        </div>
        <div class="section">
          <div class="section-title">背景图</div>
          <el-form label-width="70px" size="default">
            <el-form-item label="图片">
              <div class="bg-image-upload">
                <input type="file" accept="image/*" ref="bgImageInput" class="rc-hidden-input" @change="handleBgImageUpload" />
                <el-button v-if="!canvasStore.config.bgImage" size="default" @click="bgImageInput?.click()">上传图片</el-button>
                <template v-else>
                  <div class="bg-image-preview">
                    <img :src="canvasStore.config.bgImage" alt="背景图" />
                    <el-button size="default" type="danger" link @click="removeBgImage">移除</el-button>
                  </div>
                </template>
              </div>
            </el-form-item>
            <template v-if="canvasStore.config.bgImage">
              <el-form-item label="大小">
                <el-select v-model="canvasStore.config.bgImageSize" class="rc-w100">
                  <el-option label="覆盖 (cover)" value="cover" />
                  <el-option label="包含 (contain)" value="contain" />
                  <el-option label="拉伸 (stretch)" value="stretch" />
                  <el-option label="平铺 (repeat)" value="repeat" />
                  <el-option label="原始 (auto)" value="auto" />
                </el-select>
              </el-form-item>
              <el-form-item label="位置">
                <el-select v-model="canvasStore.config.bgImagePosition" class="rc-w100">
                  <el-option label="居中" value="center" />
                  <el-option label="顶部" value="top" />
                  <el-option label="底部" value="bottom" />
                  <el-option label="左侧" value="left" />
                  <el-option label="右侧" value="right" />
                  <el-option label="左上" value="top-left" />
                  <el-option label="右上" value="top-right" />
                  <el-option label="左下" value="bottom-left" />
                  <el-option label="右下" value="bottom-right" />
                </el-select>
              </el-form-item>
              <el-form-item label="重复">
                <el-select v-model="canvasStore.config.bgImageRepeat" class="rc-w100">
                  <el-option label="不重复" value="no-repeat" />
                  <el-option label="平铺" value="repeat" />
                  <el-option label="水平重复" value="repeat-x" />
                  <el-option label="垂直重复" value="repeat-y" />
                </el-select>
              </el-form-item>
              <el-form-item label="透明度">
                <el-slider v-model="canvasStore.config.bgImageOpacity" :min="0" :max="100" :step="1" show-input input-size="default" />
              </el-form-item>
            </template>
          </el-form>
        </div>
      </el-collapse-item>

      <template v-if="selectedComponent">
        <el-collapse-item v-if="isMobilePreview" name="mobile">
          <template #title>
            <div class="collapse-title"><ScreenIcon name="mobile" :size="15" /><span>移动端</span></div>
          </template>
          <div class="section">
            <div class="section-title">移动端配置</div>
            <el-alert type="info" :closable="false" class="rc-mb">
              切换到移动端预览查看效果。未配置的组件将按顺序垂直排列。
            </el-alert>
            <el-form label-width="80px" size="default">
              <el-form-item label="隐藏">
                <el-switch v-model="selectedComponent.mobile.hideOnMobile" />
              </el-form-item>
              <el-form-item label="排列顺序">
                <el-input-number v-model="selectedComponent.mobile.mobileOrder" :min="0" :max="999" controls-position="right" class="rc-w100" />
              </el-form-item>
              <el-form-item label="自定义位置">
                <el-switch v-model="hasMobilePosition" />
              </el-form-item>
              <template v-if="hasMobilePosition && selectedComponent.mobileLayout">
                <el-form-item label="X">
                  <el-input-number v-model="selectedComponent.mobileLayout!.x" :step="1" controls-position="right" class="rc-w100" />
                </el-form-item>
                <el-form-item label="Y">
                  <el-input-number v-model="selectedComponent.mobileLayout!.y" :step="1" controls-position="right" class="rc-w100" />
                </el-form-item>
                <el-form-item label="宽度">
                  <el-input-number v-model="selectedComponent.mobileLayout!.width" :min="10" :step="1" controls-position="right" class="rc-w100" />
                </el-form-item>
                <el-form-item label="高度">
                  <el-input-number v-model="selectedComponent.mobileLayout!.height" :min="10" :step="1" controls-position="right" class="rc-w100" />
                </el-form-item>
              </template>
            </el-form>
          </div>
        </el-collapse-item>

        <el-collapse-item name="data">
          <template #title>
            <div class="collapse-title"><ScreenIcon name="data" :size="15" /><span>数据</span></div>
          </template>
          <CustomChartDataHint v-if="selectedComponent.type === 'custom-chart'" />
          <div class="section">
            <div class="section-title">数据源</div>
            <el-form label-width="70px" size="default">
              <el-form-item label="类型">
                <el-select v-model="selectedComponent.data.type" class="rc-w100" @change="onDataTypeChange">
                  <el-option label="静态数据" value="static" />
                  <el-option label="API请求" value="api" />
                  <el-option label="数据集" value="dataset" />
                </el-select>
              </el-form-item>
              <el-form-item v-if="selectedComponent.data.type === 'static'" label="数据">
                <div class="rc-row-mb">
                  <el-button size="default" @click="clearData">清空</el-button>
                  <el-button size="default" type="primary" @click="showDataEditor = true">编辑数据</el-button>
                </div>
                <div class="data-preview" @click="showDataEditor = true">
                  {{ selectedComponent.data.value ? '已配置数据，点击编辑...' : '暂无数据，请点击编辑' }}
                </div>
              </el-form-item>
              <el-form-item v-if="selectedComponent.data.type === 'api'" label="URL">
                <el-input v-model="selectedComponent.data.url" placeholder="https://api.example.com/data" />
              </el-form-item>
              <el-form-item v-if="selectedComponent.data.type === 'api'" label="方法">
                <el-select v-model="selectedComponent.data.method" class="rc-w100">
                  <el-option label="GET" value="GET" />
                  <el-option label="POST" value="POST" />
                  <el-option label="PUT" value="PUT" />
                  <el-option label="DELETE" value="DELETE" />
                </el-select>
              </el-form-item>
              <el-form-item v-if="selectedComponent.data.type === 'api'" label="Headers">
                <el-input
                  v-model="selectedComponent.data.headers"
                  type="textarea"
                  :rows="3"
                  placeholder='{"Content-Type": "application/json"}'
                />
              </el-form-item>
              <el-form-item v-if="selectedComponent.data.type === 'api' && selectedComponent.data.method !== 'GET'" label="Body">
                <el-input
                  v-model="selectedComponent.data.body"
                  type="textarea"
                  :rows="3"
                  placeholder='{"key": "value"}'
                />
              </el-form-item>
              <el-form-item v-if="selectedComponent.data.type === 'api'" label="响应路径">
                <el-input v-model="selectedComponent.data.responsePath" placeholder="data.list (点号路径)" />
              </el-form-item>
              <el-form-item v-if="selectedComponent.data.type === 'api'" label="字段映射">
                <el-input
                  v-model="selectedComponent.data.fieldMapping"
                  type="textarea"
                  :rows="2"
                  placeholder='{"name": "label", "value": "amount"}'
                />
              </el-form-item>
              <el-form-item v-if="selectedComponent.data.type === 'api'" label="刷新(秒)">
                <el-input-number v-model="selectedComponent.data.refreshInterval" :min="0" :step="1" controls-position="right" class="rc-w100" />
              </el-form-item>
              <el-form-item v-if="selectedComponent.data.type === 'api'">
                <el-button type="primary" size="default" @click="refreshComponent(selectedComponent.id)">
                  手动刷新
                </el-button>
              </el-form-item>
              <el-form-item v-if="selectedComponent.data.type === 'dataset'" label="数据集">
                <el-select v-model="selectedComponent.data.datasetId" class="rc-w100" @change="onDatasetSelect($event)">
                  <el-option v-for="d in datasetList" :key="d.id" :label="d.name" :value="d.id" />
                </el-select>
              </el-form-item>
              <el-form-item v-if="selectedComponent.data.type === 'dataset' && selectedComponent.data.datasetId" label="维度指标">
                <div class="rc-row-mb">
                  <span class="query-summary">{{ querySummary }}</span>
                  <el-button size="default" type="primary" @click="showQueryDialog = true">配置维度/指标</el-button>
                </div>
              </el-form-item>
            </el-form>
          </div>
        </el-collapse-item>

        <el-collapse-item name="props">
          <template #title>
            <div class="collapse-title"><ScreenIcon name="props" :size="15" /><span>属性</span></div>
          </template>
          <div class="section">
            <div class="section-title">基本信息</div>
            <el-form label-width="70px" size="default">
              <el-form-item label="名称">
                <el-input v-model="selectedComponent.name" />
              </el-form-item>
              <el-form-item label="XY坐标">
                <div class="rc-row">
                  <span class="rc-coord">X</span>
                  <el-input-number v-model="compX" :step="1" controls-position="right" class="rc-flex-1" />
                  <span class="rc-coord">Y</span>
                  <el-input-number v-model="compY" :step="1" controls-position="right" class="rc-flex-1" />
                </div>
              </el-form-item>
              <el-form-item label="宽高">
                <div class="rc-row">
                  <el-input-number v-model="compW" :min="10" :step="1" controls-position="right" class="rc-flex-1" />
                  <el-input-number v-model="compH" :min="10" :step="1" controls-position="right" class="rc-flex-1" />
                </div>
              </el-form-item>
              <el-form-item label="旋转">
                <el-slider v-model="selectedComponent.rotation" :min="0" :max="360" :step="1" show-input input-size="default" />
              </el-form-item>
              <el-form-item label="透明度">
                <el-slider v-model="selectedComponent.opacity" :min="0" :max="100" :step="1" show-input input-size="default" />
              </el-form-item>
              <el-form-item label="层级">
                <el-input-number v-model="selectedComponent.zIndex" :min="0" :step="1" controls-position="right" class="rc-w100" />
              </el-form-item>
            </el-form>
          </div>
          <template v-if="isTextComponent">
            <div class="section">
              <div class="section-title">{{ selectedComponent.type === 'data-text' ? '数据文本' : '文本内容' }}</div>
              <el-form label-width="70px" size="default">
                <template v-if="selectedComponent.type === 'static-text'">
                  <el-form-item label="内容">
                    <el-input v-model="selectedComponent.data.value" type="textarea" :rows="3" placeholder="请输入文本内容" />
                  </el-form-item>
                </template>
                <template v-else>
                  <el-form-item label="数值">
                    <div class="text-tool-row">
                      <el-input-number :model-value="selectedComponent.props?.decimals ?? 0" @update:model-value="updateProps('decimals', $event)" :min="0" :max="6" controls-position="right" class="rc-flex-1" />
                      <span class="rc-label">千分位</span>
                      <el-switch :model-value="selectedComponent.props?.useGrouping !== false" @update:model-value="updateProps('useGrouping', $event)" />
                    </div>
                  </el-form-item>
                  <el-form-item label="前后缀">
                    <div class="text-tool-row">
                      <el-input :model-value="selectedComponent.props?.prefix || ''" @update:model-value="updateProps('prefix', $event)" placeholder="前缀" class="rc-flex-1" />
                      <el-input :model-value="selectedComponent.props?.suffix || ''" @update:model-value="updateProps('suffix', $event)" placeholder="后缀" class="rc-flex-1" />
                    </div>
                  </el-form-item>
                  <el-form-item label="标签">
                    <div class="text-tool-row">
                      <el-switch :model-value="selectedComponent.props?.labelShow !== false" @update:model-value="updateProps('labelShow', $event)" />
                      <span class="rc-label-muted">数据中的 label 字段</span>
                    </div>
                  </el-form-item>
                  <div class="rc-form-tip">数值来自「数据」面板的静态数据，如 {"{\"value\":1286520,\"label\":\"总销售额\"}"}</div>
                </template>
                <el-form-item label="字号颜色">
                  <div class="text-tool-row">
                    <el-input-number :model-value="selectedComponent.props?.fontSize || 24" @update:model-value="updateProps('fontSize', $event)" :min="12" :max="200" controls-position="right" class="rc-flex-1" />
                    <el-color-picker :model-value="selectedComponent.props?.color || '#ffffff'" @update:model-value="updateProps('color', $event)" />
                  </div>
                </el-form-item>
                <el-form-item label="样式">
                  <div class="font-toggles">
                    <button
                      type="button"
                      class="font-toggle"
                      :class="{ active: (selectedComponent.props?.fontWeight || 'normal') === 'bold' }"
                      title="粗细"
                      @click="toggleTextProp('fontWeight', 'bold', 'normal')"
                    ><b>B</b></button>
                    <button
                      type="button"
                      class="font-toggle"
                      :class="{ active: (selectedComponent.props?.fontStyle || 'normal') === 'italic' }"
                      title="斜体"
                      @click="toggleTextProp('fontStyle', 'italic', 'normal')"
                    ><i>I</i></button>
                    <button
                      type="button"
                      class="font-toggle"
                      :class="{ active: (selectedComponent.props?.textDecoration || 'none') !== 'none' }"
                      title="下划线"
                      @click="toggleTextProp('textDecoration', 'underline', 'none')"
                    ><u>U</u></button>
                    <span class="toggle-divider"></span>
                    <button
                      type="button"
                      class="font-toggle"
                      :class="{ active: (selectedComponent.props?.textAlign || 'center') === 'left' }"
                      title="左对齐"
                      @click="updateProps('textAlign', 'left')"
                    ><svg class="align-icon" viewBox="0 0 16 16"><line x1="1" y1="3" x2="15" y2="3" /><line x1="1" y1="8" x2="11" y2="8" /><line x1="1" y1="13" x2="13" y2="13" /></svg></button>
                    <button
                      type="button"
                      class="font-toggle"
                      :class="{ active: (selectedComponent.props?.textAlign || 'center') === 'center' }"
                      title="居中对齐"
                      @click="updateProps('textAlign', 'center')"
                    ><svg class="align-icon" viewBox="0 0 16 16"><line x1="4" y1="3" x2="12" y2="3" /><line x1="1" y1="8" x2="15" y2="8" /><line x1="5" y1="13" x2="11" y2="13" /></svg></button>
                    <button
                      type="button"
                      class="font-toggle"
                      :class="{ active: (selectedComponent.props?.textAlign || 'center') === 'right' }"
                      title="右对齐"
                      @click="updateProps('textAlign', 'right')"
                    ><svg class="align-icon" viewBox="0 0 16 16"><line x1="1" y1="3" x2="15" y2="3" /><line x1="5" y1="8" x2="15" y2="8" /><line x1="3" y1="13" x2="15" y2="13" /></svg></button>
                  </div>
                </el-form-item>
                <el-form-item label="行高">
                  <el-input-number :model-value="selectedComponent.props?.lineHeight || 1.5" @update:model-value="updateProps('lineHeight', $event)" :min="1" :max="5" :step="0.1" controls-position="right" class="rc-w100" />
                </el-form-item>
              </el-form>
            </div>
          </template>
          <template v-if="isChartComponent">
            <div class="section">
              <div class="section-title">图表配置</div>
              <el-form label-width="70px" size="default">
                <el-form-item label="渲染器">
                  <el-select :model-value="selectedComponent.props.renderer || 'svg'" @update:model-value="updateProps('renderer', $event)" class="rc-w100">
                    <el-option label="Canvas" value="canvas" />
                    <el-option label="SVG" value="svg" />
                  </el-select>
                </el-form-item>
                <el-form-item label="主题">
                  <el-select :model-value="selectedComponent.props.theme || '默认'" @update:model-value="applyTheme($event)" class="rc-w100">
                    <el-option v-for="t in chartThemes" :key="t" :label="t" :value="t">
                      <div class="theme-option">
                        <span>{{ t }}</span>
                        <div v-if="t !== '默认' && t !== '自定义'" class="theme-swatches">
                          <span v-for="(c, i) in (getColorPreset(t) || []).slice(0, 5)" :key="i" class="theme-swatch" :style="{ background: c }"></span>
                        </div>
                      </div>
                    </el-option>
                  </el-select>
                </el-form-item>
                <el-form-item v-if="selectedComponent.props.theme === '自定义'" label="自定义色">
                  <div class="custom-colors">
                    <div v-for="(c, i) in (selectedComponent.props.colors || [])" :key="i" class="color-item">
                      <el-color-picker :model-value="c" @update:model-value="updateColor(Number(i), $event)" size="default" />
                    </div>
                    <el-button size="default" @click="addCustomColor">+</el-button>
                  </div>
                </el-form-item>
              </el-form>
            </div>
            <div class="section">
              <div class="section-title">标题</div>
              <el-form label-width="70px" size="default">
                <el-form-item label="显示">
                  <el-switch :model-value="selectedComponent.props.titleShow !== false" @update:model-value="updateProps('titleShow', $event)" />
                </el-form-item>
                <template v-if="selectedComponent.props.titleShow !== false">
                  <el-form-item label="文本">
                    <el-input :model-value="selectedComponent.props.titleText || ''" @update:model-value="updateProps('titleText', $event)" placeholder="请输入标题" />
                  </el-form-item>
                  <el-form-item label="颜色大小">
                    <div class="rc-row">
                      <el-color-picker :model-value="selectedComponent.props.titleColor || '#ffffff'" @update:model-value="updateProps('titleColor', $event)" />
                      <el-input-number :model-value="selectedComponent.props.titleSize || 16" @update:model-value="updateProps('titleSize', $event)" :min="12" :max="36" controls-position="right" class="rc-flex-1" />
                    </div>
                  </el-form-item>
                  <el-form-item label="位置间距">
                    <div class="rc-row">
                      <el-select :model-value="selectedComponent.props.titlePosition || 'center'" @update:model-value="updateProps('titlePosition', $event)" class="rc-flex-1">
                        <el-option label="左" value="left" />
                        <el-option label="中" value="center" />
                        <el-option label="右" value="right" />
                      </el-select>
                      <el-input-number :model-value="selectedComponent.props.titlePadding ?? 10" @update:model-value="updateProps('titlePadding', $event)" :min="0" :max="100" controls-position="right" class="rc-flex-1" />
                    </div>
                  </el-form-item>
                </template>
              </el-form>
            </div>
            <div v-if="hasLegend" class="section">
              <div class="section-title">图例</div>
              <el-form label-width="70px" size="default">
                <el-form-item label="显示">
                  <el-switch :model-value="selectedComponent.props.legendShow !== false" @update:model-value="updateProps('legendShow', $event)" />
                </el-form-item>
                <template v-if="selectedComponent.props.legendShow !== false">
                  <el-form-item label="位置">
                    <div class="position-selector">
                      <div class="pos-row">
                        <div class="pos-cell" :class="{ active: (selectedComponent.props.legendPosition || 'bottom') === 'top-left' }" @click="updateProps('legendPosition', 'top-left')" title="左上">
                          <div class="pos-dot"></div>
                        </div>
                        <div class="pos-cell" :class="{ active: (selectedComponent.props.legendPosition || 'bottom') === 'top' }" @click="updateProps('legendPosition', 'top')" title="上中">
                          <div class="pos-dot"></div>
                        </div>
                        <div class="pos-cell" :class="{ active: (selectedComponent.props.legendPosition || 'bottom') === 'top-right' }" @click="updateProps('legendPosition', 'top-right')" title="右上">
                          <div class="pos-dot"></div>
                        </div>
                      </div>
                      <div class="pos-row">
                        <div class="pos-cell" :class="{ active: (selectedComponent.props.legendPosition || 'bottom') === 'left' }" @click="updateProps('legendPosition', 'left')" title="左中">
                          <div class="pos-dot"></div>
                        </div>
                        <div class="pos-cell center-cell" :class="{ active: (selectedComponent.props.legendPosition || 'bottom') === 'center' }" @click="updateProps('legendPosition', 'center')" title="居中">
                          <div class="pos-dot"></div>
                        </div>
                        <div class="pos-cell" :class="{ active: (selectedComponent.props.legendPosition || 'bottom') === 'right' }" @click="updateProps('legendPosition', 'right')" title="右中">
                          <div class="pos-dot"></div>
                        </div>
                      </div>
                      <div class="pos-row">
                        <div class="pos-cell" :class="{ active: (selectedComponent.props.legendPosition || 'bottom') === 'bottom-left' }" @click="updateProps('legendPosition', 'bottom-left')" title="左下">
                          <div class="pos-dot"></div>
                        </div>
                        <div class="pos-cell" :class="{ active: (selectedComponent.props.legendPosition || 'bottom') === 'bottom' }" @click="updateProps('legendPosition', 'bottom')" title="下中">
                          <div class="pos-dot"></div>
                        </div>
                        <div class="pos-cell" :class="{ active: (selectedComponent.props.legendPosition || 'bottom') === 'bottom-right' }" @click="updateProps('legendPosition', 'bottom-right')" title="右下">
                          <div class="pos-dot"></div>
                        </div>
                      </div>
                      <div class="pos-label">{{ positionLabels[selectedComponent.props.legendPosition || 'bottom'] || '下中' }}</div>
                    </div>
                  </el-form-item>
                  <el-form-item label="方向">
                    <div class="direction-selector">
                      <div class="dir-cell" :class="{ active: (selectedComponent.props.legendDirection || 'horizontal') === 'horizontal' }" @click="updateProps('legendDirection', 'horizontal')" title="水平">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                          <rect x="2" y="10" width="5" height="4" rx="1"/>
                          <rect x="9" y="10" width="5" height="4" rx="1"/>
                          <rect x="16" y="10" width="5" height="4" rx="1"/>
                        </svg>
                      </div>
                      <div class="dir-cell" :class="{ active: (selectedComponent.props.legendDirection || 'horizontal') === 'vertical' }" @click="updateProps('legendDirection', 'vertical')" title="垂直">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                          <rect x="10" y="2" width="4" height="5" rx="1"/>
                          <rect x="10" y="9" width="4" height="5" rx="1"/>
                          <rect x="10" y="16" width="4" height="5" rx="1"/>
                        </svg>
                      </div>
                    </div>
                  </el-form-item>
                  <el-form-item label="间距形状">
                    <div class="rc-row">
                      <el-input-number :model-value="selectedComponent.props.legendPadding ?? 10" @update:model-value="updateProps('legendPadding', $event)" :min="0" :max="100" controls-position="right" class="rc-flex-1" />
                      <el-select :model-value="selectedComponent.props.legendShape || 'roundRect'" @update:model-value="updateProps('legendShape', $event)" class="rc-flex-1">
                        <el-option label="圆形" value="circle" />
                        <el-option label="方形" value="rect" />
                        <el-option label="圆角方形" value="roundRect" />
                        <el-option label="三角形" value="triangle" />
                        <el-option label="菱形" value="diamond" />
                        <el-option label="针形" value="pin" />
                        <el-option label="箭头" value="arrow" />
                      </el-select>
                    </div>
                  </el-form-item>
                  <el-form-item label="宽高">
                    <div class="rc-row">
                      <el-input-number :model-value="selectedComponent.props.legendItemWidth || 14" @update:model-value="updateProps('legendItemWidth', $event)" :min="4" :max="50" controls-position="right" class="rc-flex-1" />
                      <el-input-number :model-value="selectedComponent.props.legendItemHeight || 14" @update:model-value="updateProps('legendItemHeight', $event)" :min="4" :max="50" controls-position="right" class="rc-flex-1" />
                    </div>
                  </el-form-item>
                  <el-form-item label="字号颜色">
                    <div class="rc-row">
                      <el-input-number :model-value="selectedComponent.props.legendFontSize || 12" @update:model-value="updateProps('legendFontSize', $event)" :min="8" :max="30" controls-position="right" class="rc-flex-1" />
                      <el-color-picker :model-value="selectedComponent.props.legendColor || '#ffffff'" @update:model-value="updateProps('legendColor', $event)" />
                    </div>
                  </el-form-item>
                </template>
              </el-form>
            </div>
            <div v-if="hasAxis" class="section">
              <div class="section-title">坐标轴</div>
              <el-form label-width="70px" size="default">
                <el-divider content-position="left">X轴</el-divider>
                <el-form-item label="显示">
                  <el-switch :model-value="selectedComponent.props.xAxisShow !== false" @update:model-value="updateProps('xAxisShow', $event)" />
                </el-form-item>
                <template v-if="selectedComponent.props.xAxisShow !== false">
<div class="rc-border-box">
                    <div class="rc-row rc-mb6">
                      <el-switch :model-value="selectedComponent.props.xAxisLineShow === true" @update:model-value="updateProps('xAxisLineShow', $event)" />
                      <span class="rc-label">显示轴线</span>
                      <el-color-picker :model-value="selectedComponent.props.xAxisLineColor || '#666666'" @update:model-value="updateProps('xAxisLineColor', $event)" />
                      <span class="rc-label-muted">轴线色</span>
                    </div>
                    <template v-if="selectedComponent.props.xAxisLineShow === true">
                      <div class="rc-row-auto">
                        <el-input :model-value="selectedComponent.props.xAxisName || ''" @update:model-value="updateProps('xAxisName', $event)" placeholder="轴名称" class="rc-flex-2" />
                        <el-color-picker :model-value="selectedComponent.props.xAxisNameColor || '#999'" @update:model-value="updateProps('xAxisNameColor', $event)" />
                        <el-input-number :model-value="selectedComponent.props.xAxisNameSize || 12" @update:model-value="updateProps('xAxisNameSize', $event)" :min="10" :max="20" controls-position="right" class="rc-flex-1" />
                      </div>
                    </template>
                  </div>
                  <el-divider content-position="left">X轴标签</el-divider>
                  <el-form-item label="标签">
                    <div class="rc-row-gap-sm">
                      <el-color-picker :model-value="selectedComponent.props.xAxisLabelColor || '#999999'" @update:model-value="updateProps('xAxisLabelColor', $event)" />
                      <el-input-number :model-value="selectedComponent.props.xAxisLabelSize || 12" @update:model-value="updateProps('xAxisLabelSize', $event)" :min="10" :max="20" controls-position="right" class="rc-flex-1" />
                      <div class="style-btn-group">
                        <button class="style-btn" :class="{ active: selectedComponent.props.xAxisLabelBold === true }" @click="updateProps('xAxisLabelBold', !(selectedComponent.props.xAxisLabelBold === true))" title="粗体">
                          <svg viewBox="0 0 24 24"><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg>
                        </button>
                        <button class="style-btn" :class="{ active: selectedComponent.props.xAxisLabelItalic === true }" @click="updateProps('xAxisLabelItalic', !(selectedComponent.props.xAxisLabelItalic === true))" title="斜体">
                          <svg viewBox="0 0 24 24"><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/></svg>
                        </button>
                        <button class="style-btn" :class="{ active: selectedComponent.props.xAxisLabelUnderline === true }" @click="updateProps('xAxisLabelUnderline', !(selectedComponent.props.xAxisLabelUnderline === true))" title="下划线">
                          <svg viewBox="0 0 24 24"><path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/></svg>
                        </button>
                      </div>
                    </div>
                  </el-form-item>
                  <el-form-item label="长度间隔">
                    <div class="rc-row">
                      <el-input-number :model-value="selectedComponent.props.xAxisLabelMaxLen" @update:model-value="updateProps('xAxisLabelMaxLen', $event)" :min="0" :max="20" placeholder="不限" controls-position="right" class="rc-flex-1" />
                      <el-input-number :model-value="selectedComponent.props.xAxisLabelInterval" @update:model-value="updateProps('xAxisLabelInterval', $event)" :min="0" :max="20" placeholder="自动" controls-position="right" class="rc-flex-1" />
                    </div>
                  </el-form-item>
                  <el-form-item label="旋转角度">
                    <el-input-number :model-value="selectedComponent.props.xAxisLabelRotate ?? 0" @update:model-value="updateProps('xAxisLabelRotate', $event)" :min="-90" :max="90" controls-position="right" class="rc-w100" />
                  </el-form-item>
                </template>
                <el-divider content-position="left">Y轴</el-divider>
                <el-form-item label="显示">
                  <el-switch :model-value="selectedComponent.props.yAxisShow !== false" @update:model-value="updateProps('yAxisShow', $event)" />
                </el-form-item>
                <template v-if="selectedComponent.props.yAxisShow !== false">
<div class="rc-border-box">
                    <div class="rc-row rc-mb6">
                      <el-switch :model-value="selectedComponent.props.yAxisLineShow === true" @update:model-value="updateProps('yAxisLineShow', $event)" />
                      <span class="rc-label">显示轴线</span>
                      <el-color-picker :model-value="selectedComponent.props.yAxisLineColor || '#666666'" @update:model-value="updateProps('yAxisLineColor', $event)" />
                      <span class="rc-label-muted">轴线色</span>
                    </div>
                    <template v-if="selectedComponent.props.yAxisLineShow === true">
                      <div class="rc-row-auto">
                        <el-input :model-value="selectedComponent.props.yAxisName || ''" @update:model-value="updateProps('yAxisName', $event)" placeholder="轴名称" class="rc-flex-2" />
                        <el-color-picker :model-value="selectedComponent.props.yAxisNameColor || '#999'" @update:model-value="updateProps('yAxisNameColor', $event)" />
                        <el-input-number :model-value="selectedComponent.props.yAxisNameSize || 12" @update:model-value="updateProps('yAxisNameSize', $event)" :min="10" :max="20" controls-position="right" class="rc-flex-1" />
                      </div>
                    </template>
                  </div>
                  <el-form-item label="位置单位">
                    <div class="rc-row">
                      <el-select :model-value="selectedComponent.props.yAxisNamePosition || 'end'" @update:model-value="updateProps('yAxisNamePosition', $event)" class="rc-flex-1">
                        <el-option label="轴外侧" value="end" />
                        <el-option label="轴上方" value="start" />
                      </el-select>
                      <el-input :model-value="selectedComponent.props.yAxisUnit || ''" @update:model-value="updateProps('yAxisUnit', $event)" placeholder="单位" class="rc-flex-1" />
                    </div>
                  </el-form-item>
                  <el-form-item label="步长范围">
                    <div class="rc-row">
                      <el-input-number :model-value="selectedComponent.props.yAxisSplitNumber" @update:model-value="updateProps('yAxisSplitNumber', $event)" :min="0" :max="20" placeholder="步长" controls-position="right" class="rc-flex-1" />
                      <el-input-number :model-value="selectedComponent.props.yAxisMin" @update:model-value="updateProps('yAxisMin', $event)" placeholder="最小" controls-position="right" class="rc-flex-1" />
                      <el-input-number :model-value="selectedComponent.props.yAxisMax" @update:model-value="updateProps('yAxisMax', $event)" placeholder="最大" controls-position="right" class="rc-flex-1" />
                    </div>
                  </el-form-item>
                  <el-divider content-position="left">网格线</el-divider>
                  <el-form-item label="显示网格">
                    <el-switch :model-value="selectedComponent.props.yAxisGridShow !== false" @update:model-value="updateProps('yAxisGridShow', $event)" />
                  </el-form-item>
                  <template v-if="selectedComponent.props.yAxisGridShow !== false">
                    <el-form-item label="网格">
                      <div class="rc-row">
                        <el-color-picker :model-value="selectedComponent.props.yAxisGridColor || '#333333'" @update:model-value="updateProps('yAxisGridColor', $event)" />
                        <el-select :model-value="selectedComponent.props.yAxisGridType || 'solid'" @update:model-value="updateProps('yAxisGridType', $event)" class="rc-flex-1">
                          <el-option label="实线" value="solid" />
                          <el-option label="虚线" value="dashed" />
                          <el-option label="点状线" value="dotted" />
                        </el-select>
                        <el-input-number :model-value="selectedComponent.props.yAxisGridWidth ?? 1" @update:model-value="updateProps('yAxisGridWidth', $event)" :min="1" :max="5" controls-position="right" class="rc-flex-1" />
                      </div>
                    </el-form-item>
                  </template>
                  <el-divider content-position="left">Y轴标签</el-divider>
                  <el-form-item label="标签">
                    <div class="rc-row-gap-sm">
                      <el-color-picker :model-value="selectedComponent.props.yAxisLabelColor || '#999999'" @update:model-value="updateProps('yAxisLabelColor', $event)" />
                      <el-input-number :model-value="selectedComponent.props.yAxisLabelSize || 12" @update:model-value="updateProps('yAxisLabelSize', $event)" :min="10" :max="20" controls-position="right" class="rc-flex-1" />
                      <div class="style-btn-group">
                        <button class="style-btn" :class="{ active: selectedComponent.props.yAxisLabelBold === true }" @click="updateProps('yAxisLabelBold', !(selectedComponent.props.yAxisLabelBold === true))" title="粗体">
                          <svg viewBox="0 0 24 24"><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg>
                        </button>
                        <button class="style-btn" :class="{ active: selectedComponent.props.yAxisLabelItalic === true }" @click="updateProps('yAxisLabelItalic', !(selectedComponent.props.yAxisLabelItalic === true))" title="斜体">
                          <svg viewBox="0 0 24 24"><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/></svg>
                        </button>
                        <button class="style-btn" :class="{ active: selectedComponent.props.yAxisLabelUnderline === true }" @click="updateProps('yAxisLabelUnderline', !(selectedComponent.props.yAxisLabelUnderline === true))" title="下划线">
                          <svg viewBox="0 0 24 24"><path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/></svg>
                        </button>
                      </div>
                    </div>
                  </el-form-item>
                  <el-form-item label="长度间隔">
                    <div class="rc-row">
                      <el-input-number :model-value="selectedComponent.props.yAxisLabelMaxLen" @update:model-value="updateProps('yAxisLabelMaxLen', $event)" :min="0" :max="20" placeholder="不限" controls-position="right" class="rc-flex-1" />
                      <el-input-number :model-value="selectedComponent.props.yAxisLabelInterval" @update:model-value="updateProps('yAxisLabelInterval', $event)" :min="0" :max="20" placeholder="自动" controls-position="right" class="rc-flex-1" />
                    </div>
                  </el-form-item>
                  <el-form-item label="旋转角度">
                    <el-input-number :model-value="selectedComponent.props.yAxisLabelRotate ?? 0" @update:model-value="updateProps('yAxisLabelRotate', $event)" :min="-90" :max="90" controls-position="right" class="rc-w100" />
                  </el-form-item>
                </template>
                <el-divider content-position="left">缩略轴</el-divider>
                <el-form-item label="显示">
                  <el-switch :model-value="selectedComponent.props.dataZoomShow === true" @update:model-value="updateProps('dataZoomShow', $event)" />
                </el-form-item>
              </el-form>
            </div>
            <div v-if="hasTooltip" class="section">
              <div class="section-title">提示框</div>
              <el-form label-width="70px" size="default">
                <el-form-item label="显示">
                  <el-switch :model-value="selectedComponent.props.tooltipShow !== false" @update:model-value="updateProps('tooltipShow', $event)" />
                </el-form-item>
                <template v-if="selectedComponent.props.tooltipShow !== false">
                  <el-form-item label="触发">
                    <el-select :model-value="selectedComponent.props.tooltipTrigger || 'item'" @update:model-value="updateProps('tooltipTrigger', $event)" class="rc-w100">
                      <el-option label="数据项" value="item" />
                      <el-option label="坐标轴" value="axis" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="颜色">
                    <div class="rc-row">
                      <el-color-picker :model-value="selectedComponent.props.tooltipBgColor || '#333333'" @update:model-value="updateProps('tooltipBgColor', $event)" />
                      <el-color-picker :model-value="selectedComponent.props.tooltipTextColor || '#ffffff'" @update:model-value="updateProps('tooltipTextColor', $event)" />
                    </div>
                  </el-form-item>
                </template>
              </el-form>
            </div>
            <div v-if="hasDataLabel" class="section">
              <div class="section-title">数据标签</div>
              <el-form label-width="70px" size="default">
                <el-form-item label="显示">
                  <el-switch :model-value="selectedComponent.props.labelShow === true" @update:model-value="updateProps('labelShow', $event)" />
                </el-form-item>
                <template v-if="selectedComponent.props.labelShow === true">
                  <el-form-item label="内容">
                    <el-checkbox-group :model-value="selectedComponent.props.labelContent || ['value']" @update:model-value="updateProps('labelContent', $event)">
                      <el-checkbox label="seriesName">系列名称</el-checkbox>
                      <el-checkbox label="categoryName">类别名称</el-checkbox>
                      <el-checkbox label="value">数值</el-checkbox>
                    </el-checkbox-group>
                  </el-form-item>
                  <el-form-item label="分隔符">
                    <el-select :model-value="selectedComponent.props.labelSeparator || ' '" @update:model-value="updateProps('labelSeparator', $event)" class="rc-w100">
                      <el-option label="空格" value=" " />
                      <el-option label="逗号" value=", " />
                      <el-option label="冒号" value=": " />
                      <el-option label="分号" value="; " />
                      <el-option label="句号" value=". " />
                      <el-option label="换行" value="\n" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="字号">
                    <div class="rc-row-gap-sm">
                      <el-input-number :model-value="selectedComponent.props.labelFontSize || 12" @update:model-value="updateProps('labelFontSize', $event)" :min="10" :max="24" controls-position="right" class="rc-flex-1" />
                      <el-color-picker :model-value="selectedComponent.props.labelColor || '#ffffff'" @update:model-value="updateProps('labelColor', $event)" />
                      <div class="style-btn-group">
                        <button class="style-btn" :class="{ active: selectedComponent.props.labelBold === true }" @click="updateProps('labelBold', !(selectedComponent.props.labelBold === true))" title="粗体">
                          <svg viewBox="0 0 24 24"><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg>
                        </button>
                        <button class="style-btn" :class="{ active: selectedComponent.props.labelItalic === true }" @click="updateProps('labelItalic', !(selectedComponent.props.labelItalic === true))" title="斜体">
                          <svg viewBox="0 0 24 24"><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/></svg>
                        </button>
                        <button class="style-btn" :class="{ active: selectedComponent.props.labelUnderline === true }" @click="updateProps('labelUnderline', !(selectedComponent.props.labelUnderline === true))" title="下划线">
                          <svg viewBox="0 0 24 24"><path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/></svg>
                        </button>
                      </div>
                    </div>
                  </el-form-item>
                  <el-form-item label="位置">
                    <el-select :model-value="selectedComponent.props.labelPosition || 'top'" @update:model-value="updateProps('labelPosition', $event)" class="rc-w100">
                      <el-option label="上" value="top" />
                      <el-option label="下" value="bottom" />
                      <el-option label="左" value="left" />
                      <el-option label="右" value="right" />
                      <el-option label="内" value="inside" />
                      <el-option label="内上方" value="insideTop" />
                      <el-option label="内下方" value="insideBottom" />
                      <el-option label="内部居中" value="insideCenter" />
                      <el-option label="轴内侧" value="insideEnd" />
                    </el-select>
                  </el-form-item>
                </template>
              </el-form>
            </div>
            <div v-if="hasSeriesStyle" class="section">
              <div class="section-title">图形显示</div>
              <el-form label-width="70px" size="default">
                <el-form-item v-if="selectedComponent.type.startsWith('line-') || selectedComponent.type === 'stacked-area' || selectedComponent.type === 'bar-line'" label="线条样式">
                  <el-select :model-value="selectedComponent.props.lineStyle || 'solid'" @update:model-value="updateProps('lineStyle', $event)" class="rc-w100">
                    <el-option label="实线" value="solid" />
                    <el-option label="虚线" value="dashed" />
                    <el-option label="点状" value="dotted" />
                  </el-select>
                </el-form-item>
                <el-form-item v-if="selectedComponent.type.startsWith('line-') || selectedComponent.type === 'stacked-area' || selectedComponent.type === 'bar-line'" label="线条粗细">
                  <el-input-number :model-value="selectedComponent.props.lineWidth || 2" @update:model-value="updateProps('lineWidth', $event)" :min="1" :max="10" controls-position="right" class="rc-w100" />
                </el-form-item>
                <el-form-item v-if="selectedComponent.type.startsWith('line-') || selectedComponent.type === 'stacked-area' || selectedComponent.type === 'bar-line'" label="数据点">
                  <el-switch :model-value="selectedComponent.props.symbolShow !== false" @update:model-value="updateProps('symbolShow', $event)" />
                </el-form-item>
                <template v-if="(selectedComponent.type.startsWith('line-') || selectedComponent.type === 'stacked-area' || selectedComponent.type === 'bar-line') && selectedComponent.props.symbolShow !== false">
                  <el-form-item label="点形状">
                    <el-select :model-value="selectedComponent.props.symbolType || 'circle'" @update:model-value="updateProps('symbolType', $event)" class="rc-w100">
                      <el-option label="实心圆" value="circle" />
                      <el-option label="空心圆" value="emptyCircle" />
                      <el-option label="方形" value="rect" />
                      <el-option label="空心方形" value="emptyRect" />
                      <el-option label="三角" value="triangle" />
                      <el-option label="菱形" value="diamond" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="点大小">
                    <el-select :model-value="selectedComponent.props.symbolSizeCategory || 'medium'" @update:model-value="updateProps('symbolSizeCategory', $event)" class="rc-w100">
                      <el-option label="小" value="small" />
                      <el-option label="中" value="medium" />
                      <el-option label="大" value="large" />
                    </el-select>
                  </el-form-item>
                </template>
                <el-form-item v-if="selectedComponent.type.startsWith('line-') || selectedComponent.type === 'stacked-area' || selectedComponent.type === 'bar-line'" label="曲线">
                  <el-switch :model-value="selectedComponent.props.smooth === true" @update:model-value="updateProps('smooth', $event)" />
                </el-form-item>
                <el-form-item v-if="selectedComponent.type.startsWith('bar-')" label="柱宽度">
                  <el-input-number :model-value="selectedComponent.props.barWidth" @update:model-value="updateProps('barWidth', $event)" :min="5" :max="100" placeholder="自动" controls-position="right" class="rc-w100" />
                </el-form-item>
                <el-form-item v-if="selectedComponent.type.startsWith('bar-')" label="圆角">
                  <el-input-number :model-value="selectedComponent.props.barBorderRadius ?? 0" @update:model-value="updateProps('barBorderRadius', $event)" :min="0" :max="50" controls-position="right" class="rc-w100" />
                </el-form-item>
                <el-form-item v-if="selectedComponent.type.startsWith('pie')" label="内半径">
                  <el-input-number :model-value="selectedComponent.props.innerRadius ?? 0" @update:model-value="updateProps('innerRadius', $event)" :min="0" :max="200" controls-position="right" class="rc-w100" />
                </el-form-item>
                <el-form-item v-if="selectedComponent.type.startsWith('pie')" label="外半径">
                  <el-input-number :model-value="selectedComponent.props.outerRadius" @update:model-value="updateProps('outerRadius', $event)" :min="50" :max="400" placeholder="自动" controls-position="right" class="rc-w100" />
                </el-form-item>
                <el-form-item v-if="selectedComponent.type.startsWith('pie')" label="扇间隙">
                  <el-input-number :model-value="selectedComponent.props.padAngle ?? 0" @update:model-value="updateProps('padAngle', $event)" :min="0" :max="20" controls-position="right" class="rc-w100" />
                </el-form-item>
                <el-form-item v-if="selectedComponent.type === 'scatter'" label="散点大小">
                  <el-input-number :model-value="selectedComponent.props.symbolSize || 15" @update:model-value="updateProps('symbolSize', $event)" :min="4" :max="40" controls-position="right" class="rc-w100" />
                </el-form-item>
              </el-form>
            </div>
            <Globe3DConfig v-if="selectedComponent.type === 'globe-3d'" :component="selectedComponent" @update-props="updateProps" />
            <DoughnutCenterConfig v-if="selectedComponent.type === 'pie-doughnut'" :component="selectedComponent" @update-props="updateProps" />
            <RadarConfig v-if="selectedComponent.type === 'radar'" :component="selectedComponent" @update-props="updateProps" />
            <GaugeConfig v-if="['gauge', 'gauge-speed', 'gauge-stage', 'gauge-level', 'gauge-temp', 'gauge-pressure', 'gauge-car', 'gauge-multi-title', 'gauge-score', 'gauge-clock'].includes(selectedComponent.type)" :component="selectedComponent" @update-props="updateProps" />
            <GaugeMultiConfig v-if="selectedComponent.type === 'gauge-multi'" :component="selectedComponent" @update-props="updateProps" />
            <FunnelConfig v-if="selectedComponent.type.startsWith('funnel')" :component="selectedComponent" @update-props="updateProps" />
            <StackedAreaConfig v-if="selectedComponent.type === 'stacked-area'" :component="selectedComponent" @update-props="updateProps" />
            <MixedPositiveNegativeConfig v-if="selectedComponent.type === 'mixed-positive-negative'" :component="selectedComponent" @update-props="updateProps" />
            <PolarBarConfig v-if="selectedComponent.type === 'polar-bar'" :component="selectedComponent" @update-props="updateProps" />
            <PositiveNegativeBarConfig v-if="selectedComponent.type === 'positive-negative-bar'" :component="selectedComponent" @update-props="updateProps" />
            <DynamicBarRaceConfig v-if="selectedComponent.type === 'dynamic-bar-race'" :component="selectedComponent" @update-props="updateProps" />
            <GeoMapConfig v-if="selectedComponent.type === 'geo-map'" :component="selectedComponent" @update-props="updateProps" />
          </template>
          <IframeConfig v-if="selectedComponent.type === 'iframe'" :component="selectedComponent" @update-props="updateProps" />
          <StaticImageConfig v-if="selectedComponent.type === 'static-image'" :component="selectedComponent" @update-props="updateProps" />
          <CarouselConfig v-if="selectedComponent.type === 'carousel-image'" :component="selectedComponent" @update-props="updateProps" />
          <VideoConfig v-if="selectedComponent.type === 'video'" :component="selectedComponent" @update-props="updateProps" />
        </el-collapse-item>

        <el-collapse-item v-if="selectedComponent.type === 'custom-chart'" name="code">
          <template #title>
            <div class="collapse-title"><ScreenIcon name="code" :size="15" /><span>代码</span></div>
          </template>
          <CustomChartConfig :component="selectedComponent" />
        </el-collapse-item>

        <el-collapse-item name="style">
          <template #title>
            <div class="collapse-title"><ScreenIcon name="style" :size="15" /><span>样式</span></div>
          </template>
          <div class="section">
            <div class="section-title">背景</div>
            <el-form label-width="70px" size="default">
              <el-form-item label="颜色">
                <el-color-picker v-model="selectedComponent.style.backgroundColor" show-alpha />
              </el-form-item>
            </el-form>
          </div>
          <div class="section">
            <div class="section-title">边框</div>
            <el-form label-width="70px" size="default">
              <el-form-item label="宽度颜色">
                <div class="rc-row">
                  <el-input-number v-model="selectedComponent.style.borderWidth" :min="0" :max="20" controls-position="right" class="rc-flex-1" />
                  <el-color-picker v-model="selectedComponent.style.borderColor" />
                </div>
              </el-form-item>
              <el-form-item label="圆角">
                <el-input-number v-model="selectedComponent.style.borderRadius" :min="0" controls-position="right" class="rc-w100" />
              </el-form-item>
            </el-form>
          </div>
          <div class="section">
            <div class="section-title">阴影</div>
            <el-form label-width="70px" size="default">
              <el-form-item label="偏移模糊">
                <div class="rc-row">
                  <el-input-number v-model="selectedComponent.style.boxShadowX" controls-position="right" class="rc-flex-1" />
                  <el-input-number v-model="selectedComponent.style.boxShadowY" controls-position="right" class="rc-flex-1" />
                  <el-input-number v-model="selectedComponent.style.boxShadowBlur" :min="0" controls-position="right" class="rc-flex-1" />
                </div>
              </el-form-item>
              <el-form-item label="颜色">
                <el-color-picker v-model="selectedComponent.style.boxShadowColor" show-alpha />
              </el-form-item>
            </el-form>
          </div>
        </el-collapse-item>
      </template>
      </el-collapse>
    </template>

    <el-dialog v-model="showDataEditor" title="编辑数据" width="70%" top="5vh" destroy-on-close>
      <div class="rc-dialog-body">
        <CodeEditor
          v-if="selectedComponent"
          :modelValue="selectedComponent.data.value || ''"
          @update:modelValue="selectedComponent.data.value = $event"
          language="json"
          height="100%"
        />
      </div>
      <template #footer>
        <el-button @click="showDataEditor = false">关闭</el-button>
        <el-button type="primary" @click="showDataEditor = false">确定</el-button>
      </template>
    </el-dialog>
    <DatasetQueryDialog
      v-model="showQueryDialog"
      :datasetId="selectedComponent ? selectedComponent.data.datasetId ?? null : null"
      :query="selectedComponent ? selectedComponent.data.query : undefined"
      @confirm="onQueryConfirm"
    />
  </div>
</template>

<style scoped>
.right-panel {
  position: relative;
  width: 350px;
  height: 100%;
  background: var(--scr-surface);
  border-left: 1px solid var(--scr-border-lighter);
  display: flex;
  flex-direction: column;
  overflow: visible;
  transition: width 0.25s ease;
}

.right-panel.collapsed {
  width: 0;
  border-left: none;
}

.query-summary {
  font-size: 12px;
  color: var(--scr-text-3);
  margin-right: 8px;
}

.rp-float-btn {
  position: absolute;
  top: 50%;
  left: -16px;
  transform: translateY(-50%);
  width: 16px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--scr-surface);
  color: var(--scr-text-2);
  border: 1px solid var(--scr-border-lighter);
  border-radius: 6px 0 0 6px;
  box-shadow: -2px 0 6px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  z-index: 100;
  font-size: 15px;
  line-height: 1;
  padding: 0;
  user-select: none;
  transition: color 0.15s, border-color 0.15s;
}

.rp-float-btn:hover {
  color: #409eff;
  border-color: #c6e2ff;
}

.panel-collapse {
  height: 100%;
  overflow-y: auto;
  border: none;
}

:deep(.el-collapse-item__header) {
  height: 40px;
  line-height: 40px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 500;
  background-color: var(--scr-surface);
  background-image: linear-gradient(var(--scr-surface-3), var(--scr-surface-3));
  border-bottom: 1px solid var(--scr-border-lighter);
  position: sticky;
  top: 0;
  z-index: 10;
}

:deep(.el-collapse-item__wrap) {
  border-bottom: 1px solid var(--scr-border-lighter);
}

:deep(.el-collapse-item__content) {
  padding-bottom: 0;
}

.collapse-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  color: var(--scr-text-1);
}

.collapse-title :deep(.screen-icon) {
  color: var(--scr-text-2);
}

.section {
  padding: 12px 16px;
  border-bottom: 1px solid var(--scr-fill);
}

.section:last-child {
  border-bottom: none;
}

.section-title {
  font-weight: 500;
  margin-bottom: 10px;
  color: var(--scr-text-1);
  font-size: 12px;
}

.position-selector {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px;
  background: var(--scr-surface-2);
  border-radius: 6px;
  border: 1px solid var(--scr-border);
}

.pos-row {
  display: flex;
  gap: 2px;
}

.pos-cell {
  width: 28px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--scr-surface);
  border: 1px solid var(--scr-border);
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.15s;
}

.pos-cell:hover {
  border-color: #409eff;
  background: var(--scr-accent-bg);
}

.pos-cell.active {
  border-color: #409eff;
  background: #409eff;
}

.pos-cell.active .pos-dot {
  background: var(--scr-surface);
}

.pos-dot {
  width: 6px;
  height: 6px;
  border-radius: 1px;
  background: var(--scr-dot);
  transition: background 0.15s;
}

.center-cell {
  width: 28px;
}

.pos-label {
  font-size: 11px;
  color: var(--scr-text-3);
  margin-top: 4px;
}

.direction-selector {
  display: flex;
  gap: 8px;
}

.dir-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  background: var(--scr-surface-2);
  border: 1px solid var(--scr-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  color: var(--scr-text-2);
}

.dir-cell:hover {
  border-color: #409eff;
  color: #409eff;
}

.dir-cell.active {
  border-color: #409eff;
  background: var(--scr-accent-bg);
  color: #409eff;
}

.dir-label {
  font-size: 12px;
}

.theme-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.theme-swatches {
  display: flex;
  gap: 2px;
}

.theme-swatch {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid rgba(0,0,0,0.1);
}

.custom-colors {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.color-item {
  display: flex;
  align-items: center;
}

.text-tool-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.font-toggles {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.font-toggle {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--scr-border);
  border-radius: 4px;
  background: var(--scr-surface);
  color: var(--scr-text-2);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
  line-height: 1;
}

.font-toggle:hover {
  border-color: #409eff;
  color: #409eff;
}

.font-toggle.active {
  background: #409eff;
  border-color: #409eff;
  color: var(--scr-on-accent);
}

.font-toggle b,
.font-toggle i,
.font-toggle u {
  font-weight: inherit;
}

.toggle-divider {
  width: 1px;
  height: 16px;
  background: var(--scr-border);
  margin: 0 2px;
}

.align-icon {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}

.bg-image-upload {
  width: 100%;
}

.bg-image-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.bg-image-preview img {
  width: 60px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--scr-border);
}

.image-upload-area {
  width: 100%;
  height: 100px;
  border: 1px dashed var(--scr-border);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: border-color 0.2s;
}

.image-upload-area:hover {
  border-color: #409eff;
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: var(--scr-text-3);
  font-size: 12px;
}

.carousel-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}

.carousel-img-item {
  position: relative;
  width: 60px;
  height: 60px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--scr-border);
}

.carousel-img-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.delete-img {
  position: absolute;
  top: 2px;
  right: 2px;
  color: #f56c6c;
  cursor: pointer;
  background: rgba(0,0,0,0.5);
  border-radius: 50%;
  padding: 2px;
  opacity: 0;
  transition: opacity 0.2s;
}

.carousel-img-item:hover .delete-img {
  opacity: 1;
}

.add-img-btn {
  width: 60px;
  height: 60px;
  border: 1px dashed var(--scr-border);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--scr-text-3);
  font-size: 10px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.add-img-btn:hover {
  border-color: #409eff;
  color: #409eff;
}

.data-preview {
  width: 100%;
  height: 60px;
  padding: 8px 12px;
  background: var(--scr-surface-2);
  border: 1px solid var(--scr-border);
  border-radius: 4px;
  font-size: 12px;
  color: var(--scr-text-3);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: border-color 0.2s;
}

.data-preview:hover {
  border-color: #409eff;
  color: #409eff;
}

.style-btn-group {
  display: inline-flex;
  border: 1px solid var(--scr-border);
  border-radius: 4px;
  overflow: hidden;
}
.style-btn {
  width: 32px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: none;
  background: var(--scr-surface);
  color: var(--scr-text-2);
  font-size: 14px;
  padding: 0;
  transition: all 0.15s;
  border-right: 1px solid var(--scr-border);
}
.style-btn:last-child {
  border-right: none;
}
.style-btn:hover {
  background: var(--scr-surface-2);
  color: #409eff;
}
.style-btn.active {
  background: var(--scr-accent-bg);
  color: #409eff;
}
.style-btn svg {
  width: 14px;
  height: 14px;
}
</style>
