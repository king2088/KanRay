import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * 画布配置接口
 * 定义大屏设计画布的基础属性，包括尺寸、背景等
 */
export interface CanvasConfig {
  width: number
  height: number
  background: string
  layoutMode: 'adaptive' | 'fixed'
  bgImage: string
  bgImageSize: 'cover' | 'contain' | 'stretch' | 'repeat' | 'auto'
  bgImagePosition: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  bgImageRepeat: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y'
  bgImageOpacity: number
}

export type PreviewDevice = 'pc' | 'mobile' | 'custom'

export interface DevicePreset {
  width: number
  height: number
  label: string
}

const DEVICE_PRESETS: Record<string, DevicePreset> = {
  pc: { width: 1920, height: 1080, label: 'PC' },
  mobile: { width: 375, height: 812, label: '移动端' }
}

export const useCanvasStore = defineStore('canvas', () => {
  const config = ref<CanvasConfig>({
    width: 1920,
    height: 1080,
    background: '#0a1929',
    layoutMode: 'adaptive',
    bgImage: '',
    bgImageSize: 'cover',
    bgImagePosition: 'center',
    bgImageRepeat: 'no-repeat',
    bgImageOpacity: 100
  })

  const designWidth = ref(1920)
  const designHeight = ref(1080)
  const previewDevice = ref<PreviewDevice>('pc')

  const zoom = ref(100)
  const offsetX = ref(0)
  const offsetY = ref(0)
  const userZoom = ref(false)

  const containerWidth = ref(800)
  const containerHeight = ref(600)

  /** 预览设备尺寸计算 - PC模式返回设计尺寸，移动端返回设备预设尺寸 */
  const viewportSize = computed(() => {
    const preset = DEVICE_PRESETS[previewDevice.value]
    return preset ? { width: preset.width, height: preset.height } : { width: designWidth.value, height: designHeight.value }
  })

  /** 预览设备缩放比例 - 移动端通过等比缩放适配设计尺寸 */
  const viewportScale = computed(() => {
    if (previewDevice.value === 'pc') return 1
    const vw = viewportSize.value.width
    const vh = viewportSize.value.height
    return Math.min(vw / designWidth.value, vh / designHeight.value)
  })

  /**
   * 自适应缩放比例
   * 根据容器尺寸与设计尺寸的比例，计算最佳缩放值（不超过100%）
   * 用于设计器画布的自动适配显示
   */
  const fitScale = computed(() => {
    const padding = 40
    const w = previewDevice.value !== 'pc' ? viewportSize.value.width : designWidth.value
    const h = previewDevice.value !== 'pc' ? viewportSize.value.height : designHeight.value
    const scaleX = (containerWidth.value - padding) / w
    const scaleY = (containerHeight.value - padding) / h
    return Math.min(scaleX, scaleY, 1)
  })

  /** 实际缩放值 - 用户手动缩放优先，否则使用自适应缩放 */
  const actualZoom = computed(() => {
    return userZoom.value ? zoom.value : Math.round(fitScale.value * 100)
  })

  const setContainerSize = (w: number, h: number) => {
    containerWidth.value = w
    containerHeight.value = h
  }

  const setConfig = (newConfig: Partial<CanvasConfig>) => {
    config.value = { ...config.value, ...newConfig }
    if (newConfig.width) designWidth.value = newConfig.width
    if (newConfig.height) designHeight.value = newConfig.height
  }

  const setDesignSize = (w: number, h: number) => {
    designWidth.value = w
    designHeight.value = h
    config.value.width = w
    config.value.height = h
  }

  const setPreviewDevice = (device: PreviewDevice) => {
    previewDevice.value = device
  }

  /** 放大 - 以10%为步进，最大500% */
  const zoomIn = () => {
    const base = userZoom.value ? zoom.value : Math.round(fitScale.value * 100)
    const stepped = Math.ceil(base / 10) * 10
    zoom.value = Math.min(stepped > base ? stepped : stepped + 10, 500)
    userZoom.value = true
  }

  /** 缩小 - 以10%为步进，最小10% */
  const zoomOut = () => {
    const base = userZoom.value ? zoom.value : Math.round(fitScale.value * 100)
    const stepped = Math.floor(base / 10) * 10
    zoom.value = Math.max(stepped < base ? stepped : stepped - 10, 10)
    userZoom.value = true
  }

  const setZoom = (newZoom: number) => {
    zoom.value = Math.min(Math.max(newZoom, 10), 500)
    userZoom.value = true
  }

  const setOffset = (x: number, y: number) => {
    offsetX.value = x
    offsetY.value = y
  }

  /** 重置视图 - 恢复自适应缩放并居中 */
  const resetView = () => {
    zoom.value = 100
    offsetX.value = 0
    offsetY.value = 0
    userZoom.value = false
  }

  return {
    config,
    designWidth,
    designHeight,
    previewDevice,
    viewportSize,
    viewportScale,
    zoom,
    offsetX,
    offsetY,
    userZoom,
    fitScale,
    actualZoom,
    containerWidth,
    containerHeight,
    setConfig,
    setDesignSize,
    setPreviewDevice,
    zoomIn,
    zoomOut,
    setZoom,
    setOffset,
    setContainerSize,
    resetView
  }
})
