<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useCanvasStore } from '../stores/canvas'
import { useComponentsStore } from '../stores/components'
import { getComponent } from '../core/components/registry'
import { bigScreenApi } from '@/api'

const route = useRoute()
const canvasStore = useCanvasStore()
const componentsStore = useComponentsStore()

const dashboardId = ref(route.params.id as string)
const isFullscreen = ref(false)
const viewportW = ref(window.innerWidth)
const viewportH = ref(window.innerHeight - 40)

// 预览模式：pc / mobile
const previewMode = ref<'pc' | 'mobile'>('pc')
const MOBILE_WIDTH = 375
const MOBILE_HEIGHT = 812

const isMobile = computed(() => previewMode.value === 'mobile')
const isAdaptive = computed(() => canvasStore.config.layoutMode === 'adaptive')

const designW = computed(() => canvasStore.designWidth)
const designH = computed(() => canvasStore.designHeight)

// 移动端画布尺寸
const mobileCanvasW = MOBILE_WIDTH
const mobileCanvasH = MOBILE_HEIGHT

const fitScale = computed(() => {
  if (isAdaptive.value && !isMobile.value) return 1
  const w = isMobile.value ? mobileCanvasW : designW.value
  const h = isMobile.value ? mobileCanvasH : designH.value
  if (viewportW.value === 0 || viewportH.value === 0) return 0.5
  return Math.min(viewportW.value / w, (viewportH.value - 40) / h, 1)
})

const visibleComponents = computed(() => {
  return componentsStore.components.filter(c => {
    if (!c.visible) return false
    if (isMobile.value && c.mobile?.hideOnMobile) return false
    return true
  })
})

// 移动端内容实际高度
const mobileContentHeight = computed(() => {
  let maxBottom = MOBILE_HEIGHT
  for (const comp of componentsStore.components) {
    if (!comp.visible || comp.mobile?.hideOnMobile) continue
    const ml = comp.mobileLayout
    if (ml) {
      const bottom = ml.y + ml.height
      if (bottom > maxBottom) maxBottom = bottom
    }
  }
  return maxBottom + 40
})

const canvasStyle = computed(() => {
  const cfg = canvasStore.config
  const bgImageStyle = cfg.bgImage ? {
    backgroundImage: `url(${cfg.bgImage})`,
    backgroundSize: cfg.bgImageSize === 'stretch' ? '100% 100%' : cfg.bgImageSize,
    backgroundPosition: cfg.bgImagePosition,
    backgroundRepeat: cfg.bgImageRepeat,
    opacity: cfg.bgImageOpacity < 100 ? cfg.bgImageOpacity / 100 : undefined
  } : {}

  if (isAdaptive.value) {
    return {
      width: '100%',
      height: '100%',
      background: cfg.background,
      ...bgImageStyle,
      position: 'relative' as const
    }
  }
  // PC固定尺寸
  return {
    width: designW.value + 'px',
    height: designH.value + 'px',
    background: cfg.background,
    ...bgImageStyle,
    position: 'relative' as const,
    transform: `scale(${fitScale.value})`,
    transformOrigin: 'top center',
    margin: '20px auto',
    boxShadow: '0 0 30px rgba(0,0,0,0.5)'
  }
})

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
    isFullscreen.value = true
  } else {
    document.exitFullscreen()
    isFullscreen.value = false
  }
}

const getWidgetComponent = (type: string) => getComponent(type)

const getCompStyle = (comp: any) => {
  if (isMobile.value) {
    const ml = comp.mobileLayout
    if (ml) {
      // 使用mobileLayout原始坐标，由canvas整体缩放
      return {
        position: 'absolute' as const,
        left: ml.x + 'px',
        top: ml.y + 'px',
        width: ml.width + 'px',
        height: ml.height + 'px',
        transform: `rotate(${comp.rotation}deg)`,
        opacity: comp.opacity / 100,
        zIndex: comp.zIndex
      }
    }
    // 无mobileLayout时，按比例映射PC坐标到移动端
    return {
      position: 'absolute' as const,
      left: (comp.x / designW.value * mobileCanvasW) + 'px',
      top: (comp.y / designH.value * mobileCanvasH) + 'px',
      width: (comp.width / designW.value * mobileCanvasW) + 'px',
      height: (comp.height / designH.value * mobileCanvasH) + 'px',
      transform: `rotate(${comp.rotation}deg)`,
      opacity: comp.opacity / 100,
      zIndex: comp.zIndex
    }
  }

  if (isAdaptive.value) {
    const pctX = (comp.x / designW.value) * 100
    const pctY = (comp.y / designH.value) * 100
    const pctW = (comp.width / designW.value) * 100
    const pctH = (comp.height / designH.value) * 100
    return {
      position: 'absolute' as const,
      left: pctX + '%',
      top: pctY + '%',
      width: pctW + '%',
      height: pctH + '%',
      transform: `rotate(${comp.rotation}deg)`,
      opacity: comp.opacity / 100,
      zIndex: comp.zIndex
    }
  }

  // 固定尺寸模式：使用原始坐标，由canvas整体缩放
  return {
    position: 'absolute' as const,
    left: comp.x + 'px',
    top: comp.y + 'px',
    width: comp.width + 'px',
    height: comp.height + 'px',
    transform: `rotate(${comp.rotation}deg)`,
    opacity: comp.opacity / 100,
    zIndex: comp.zIndex
  }
}

const onResize = () => {
  viewportW.value = window.innerWidth
  viewportH.value = window.innerHeight - 40
}

// 移动端自动排列组件（与设计器逻辑一致）
const autoArrangeMobile = () => {
  const vp = { width: MOBILE_WIDTH, height: MOBILE_HEIGHT }
  const gap = 10
  let currentY = 0
  const visibleComps = componentsStore.components.filter(c => c.visible && !c.mobile?.hideOnMobile)

  // 检测紧密重叠的组件组
  const groups: any[][] = []
  const assigned = new Set<string>()
  for (const comp of visibleComps) {
    if (assigned.has(comp.id)) continue
    const group = [comp]
    assigned.add(comp.id)
    for (const other of visibleComps) {
      if (assigned.has(other.id)) continue
      const ix = Math.max(comp.x, other.x)
      const iy = Math.max(comp.y, other.y)
      const iw = Math.min(comp.x + comp.width, other.x + other.width) - ix
      const ih = Math.min(comp.y + comp.height, other.y + other.height) - iy
      if (iw <= 0 || ih <= 0) continue
      const overlapArea = iw * ih
      const smallerArea = Math.min(comp.width * comp.height, other.width * other.height)
      if (overlapArea / smallerArea >= 0.6) {
        group.push(other)
        assigned.add(other.id)
      }
    }
    groups.push(group)
  }

  for (const group of groups) {
    if (group.length === 1) {
      const comp = group[0]
      // 跳过：与画布同大且无数据的背景组件
      const isEmptyBg = comp.width >= vp.width - 10 && comp.height >= vp.height - 10 &&
        (!comp.data?.value || comp.data.value === '') &&
        !comp.props?.content && comp.type !== 'number-flip' && comp.type !== 'time-text'
      if (isEmptyBg) {
        componentsStore.updateComponent(comp.id, { mobile: { ...comp.mobile, hideOnMobile: true } })
        continue
      }
      if (!comp.mobileLayout) {
        const newLayout = { x: 0, y: currentY, width: vp.width, height: comp.height }
        componentsStore.updateComponent(comp.id, { mobileLayout: newLayout })
        currentY += comp.height + gap
      } else {
        currentY = comp.mobileLayout.y + comp.mobileLayout.height + gap
      }
    } else {
      group.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
      const groupH = Math.max(...group.map(c => c.y + c.height)) - Math.min(...group.map(c => c.y))
      const hasData = group.some(c => c.data?.value || c.props?.content ||
        c.type === 'number-flip' || c.type === 'time-text' || c.type === 'rank-list' ||
        c.type === 'carousel-list' || c.type === 'table-normal')
      if (groupH >= vp.height - 10 && hasData === false) {
        for (const c of group) {
          componentsStore.updateComponent(c.id, { mobile: { ...c.mobile, hideOnMobile: true } })
        }
        continue
      }
      for (const comp of group) {
        if (!comp.mobileLayout) {
          const newLayout = { x: 0, y: currentY, width: vp.width, height: comp.height }
          componentsStore.updateComponent(comp.id, { mobileLayout: newLayout })
        }
      }
      currentY += groupH + gap
    }
  }
}

// 保存原始组件，用于卸载时恢复
let originalComponents: any[] = []

onMounted(async () => {
  // 保存原始组件
  originalComponents = [...componentsStore.components]

  try {
    const screen = await bigScreenApi.get(dashboardId.value)
    if (screen.config) canvasStore.setConfig(screen.config)
    if (screen.components) {
      const list = typeof screen.components === 'string' ? JSON.parse(screen.components) : screen.components
      componentsStore.components = [] // 清空后重新加载
      ;(list || []).forEach((comp: any) => {
        if (!comp.mobile) {
          comp.mobile = { hideOnMobile: false, mobileOrder: 0, mobileX: null, mobileY: null, mobileWidth: null, mobileHeight: null }
        }
        if (comp.mobileLayout === undefined) comp.mobileLayout = null
        if (comp.data && comp.data.type === 'dataset' && !comp.data.value) {
          comp.data.type = 'static'
        }
        componentsStore.addComponent(comp)
      })
    }
  } catch (e: any) {
    if (e?.status === 404) {
      ElMessage.error('大屏不存在或已被删除')
    } else {
      ElMessage.error(e?.message || '加载大屏失败')
    }
  }

  // 移动端模式自动排列
  if (previewMode.value === 'mobile') {
    autoArrangeMobile()
  }

  onResize()
  window.addEventListener('resize', onResize)
})

// 切换预览模式时重新排列
watch(previewMode, (val) => {
  if (val === 'mobile') {
    autoArrangeMobile()
  }
})

onUnmounted(() => {
  // 恢复原始组件
  componentsStore.components = originalComponents
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <div class="preview">
    <div class="toolbar">
      <el-button @click="toggleFullscreen" type="primary" size="small">
        <el-icon><FullScreen /></el-icon>
        {{ isFullscreen ? '退出全屏' : '全屏预览' }}
      </el-button>
      <el-button-group size="small">
        <el-button :type="previewMode === 'pc' ? 'primary' : ''" @click="previewMode = 'pc'">PC端</el-button>
        <el-button :type="previewMode === 'mobile' ? 'primary' : ''" @click="previewMode = 'mobile'">移动端</el-button>
      </el-button-group>
      <span class="mode-tag">
        {{ isMobile ? `移动端 ${MOBILE_WIDTH}×${MOBILE_HEIGHT}` : (isAdaptive ? 'PC端 · 自适应' : `PC端 ${designW}×${designH}`) }}
      </span>
      <span class="scale-info">缩放: {{ Math.round(fitScale * 100) }}%</span>
    </div>
    <div class="canvas-wrapper">
      <!-- 移动端：外层容器固定尺寸，内层canvas可滚动 -->
      <div v-if="isMobile" class="mobile-viewport" :style="{
        width: (MOBILE_WIDTH * fitScale) + 'px',
        height: (MOBILE_HEIGHT * fitScale) + 'px',
        margin: '20px auto',
        overflow: 'hidden',
        boxShadow: '0 0 30px rgba(0,0,0,0.5)',
        borderRadius: '8px'
      }">
        <div class="mobile-canvas-scroll" :style="{
          width: (MOBILE_WIDTH * fitScale) + 'px',
          height: (MOBILE_HEIGHT * fitScale) + 'px',
          overflow: 'auto'
        }">
          <div class="canvas" :style="{
            width: MOBILE_WIDTH + 'px',
            minHeight: MOBILE_HEIGHT + 'px',
            height: mobileContentHeight + 'px',
            background: canvasStore.config.background,
            position: 'relative',
            transform: 'scale(' + fitScale + ')',
            transformOrigin: 'top left'
          }">
            <div
              v-for="comp in visibleComponents"
              :key="comp.id"
              class="component"
              :style="getCompStyle(comp)"
            >
              <div class="component-content" :style="{
                backgroundColor: comp.style?.backgroundColor,
                borderWidth: (comp.style?.borderWidth || 0) + 'px',
                borderColor: comp.style?.borderColor,
                borderStyle: (comp.style?.borderWidth || 0) > 0 ? 'solid' : 'none',
                borderRadius: (comp.style?.borderRadius || 0) + 'px',
                boxShadow: `${comp.style?.boxShadowX || 0}px ${comp.style?.boxShadowY || 0}px ${comp.style?.boxShadowBlur || 0}px ${comp.style?.boxShadowColor || 'transparent'}`
              }">
                <component
                  v-if="getWidgetComponent(comp.type)"
                  :is="getWidgetComponent(comp.type)"
                  :componentType="comp.type"
                  :data="comp.data"
                  :style="comp.style"
                  :props="comp.props"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- PC端直接显示 -->
      <div v-else class="canvas" :style="canvasStyle">
        <div
          v-for="comp in visibleComponents"
          :key="comp.id"
          class="component"
          :style="getCompStyle(comp)"
        >
          <div class="component-content" :style="{
            backgroundColor: comp.style?.backgroundColor,
            borderWidth: (comp.style?.borderWidth || 0) + 'px',
            borderColor: comp.style?.borderColor,
            borderStyle: (comp.style?.borderWidth || 0) > 0 ? 'solid' : 'none',
            borderRadius: (comp.style?.borderRadius || 0) + 'px',
            boxShadow: `${comp.style?.boxShadowX || 0}px ${comp.style?.boxShadowY || 0}px ${comp.style?.boxShadowBlur || 0}px ${comp.style?.boxShadowColor || 'transparent'}`
          }">
            <component
              v-if="getWidgetComponent(comp.type)"
              :is="getWidgetComponent(comp.type)"
              :componentType="comp.type"
              :data="comp.data"
              :style="comp.style"
              :props="comp.props"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview {
  height: 100vh;
  background: #0a1929;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.toolbar {
  height: 40px;
  padding: 0 16px;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  z-index: 100;
  flex-shrink: 0;
}

.mode-tag { color: #409eff; font-size: 13px; font-weight: 500; }
.scale-info { color: #aaa; font-size: 13px; }

.canvas-wrapper {
  flex: 1;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.mobile-viewport {
  border-radius: 8px;
  overflow: hidden;
}

.mobile-canvas-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.3) transparent;
  overflow-x: hidden;
  overflow-y: auto;
}

.mobile-canvas-scroll::-webkit-scrollbar {
  width: 6px;
}

.mobile-canvas-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.mobile-canvas-scroll::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.3);
  border-radius: 3px;
}

.canvas {
  position: relative;
}

.component {
  position: absolute;
}

.component-content {
  width: 100%;
  height: 100%;
  overflow: visible;
}
</style>
