<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useCanvasStore } from '../stores/canvas'
import { useComponentsStore } from '../stores/components'
import { getComponent } from '../core/components/registry'
import { bigScreenShareApi, saveBigScreenShareToken, clearBigScreenShareToken } from '@/api/bigScreenShare'

const route = useRoute()
const canvasStore = useCanvasStore()
const componentsStore = useComponentsStore()

const token = ref(route.params.token as string)
const dashboardName = ref('')
const notFound = ref(false)
const loading = ref(true)
const showPasswordDialog = ref(false)
const password = ref('')
const verifying = ref(false)
const viewportW = ref(window.innerWidth)
const viewportH = ref(window.innerHeight)

const MOBILE_WIDTH = 375
const MOBILE_HEIGHT = 812

const isMobile = computed(() => viewportW.value < 768)
const isAdaptive = computed(() => canvasStore.config.layoutMode === 'adaptive')

const designW = computed(() => canvasStore.designWidth)
const designH = computed(() => canvasStore.designHeight)

const fitScale = computed(() => {
  if (isAdaptive.value && !isMobile.value) return 1
  const w = isMobile.value ? MOBILE_WIDTH : designW.value
  const h = isMobile.value ? MOBILE_HEIGHT : designH.value
  if (viewportW.value === 0 || viewportH.value === 0) return 0.5
  return Math.min(viewportW.value / w, viewportH.value / h, 1)
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

  if (isAdaptive.value && !isMobile.value) {
    return {
      width: '100%',
      height: '100%',
      background: cfg.background,
      ...bgImageStyle,
      position: 'relative' as const
    }
  }
  return {
    width: designW.value + 'px',
    height: designH.value + 'px',
    background: cfg.background,
    ...bgImageStyle,
    position: 'relative' as const,
    transform: `scale(${fitScale.value})`,
    transformOrigin: 'top center',
    margin: '0 auto',
    boxShadow: '0 0 60px rgba(0,0,0,0.8)'
  }
})

const getWidgetComponent = (type: string) => getComponent(type)

const getCompStyle = (comp: any) => {
  if (isMobile.value) {
    const ml = comp.mobileLayout
    if (ml) {
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
      left: (comp.x / designW.value * MOBILE_WIDTH) + 'px',
      top: (comp.y / designH.value * MOBILE_HEIGHT) + 'px',
      width: (comp.width / designW.value * MOBILE_WIDTH) + 'px',
      height: (comp.height / designH.value * MOBILE_HEIGHT) + 'px',
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

// 移动端自动排列组件
const autoArrangeMobile = () => {
  const vp = { width: MOBILE_WIDTH, height: MOBILE_HEIGHT }
  const gap = 10
  let currentY = 0
  const visibleComps = componentsStore.components.filter(c => c.visible && !c.mobile?.hideOnMobile)

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

const onResize = () => {
  viewportW.value = window.innerWidth
  viewportH.value = window.innerHeight
}

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

// 保存原始组件，用于卸载时恢复
let originalComponents: any[] = []

const loadScreen = async (screen: any) => {
  canvasStore.setConfig(screen.config || {})
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
      if (comp.data && comp.data.type === 'api') {
        comp.data.type = 'static'
      }
      componentsStore.addComponent(comp)
    })
  }

  // 移动端自动排列
  if (isMobile.value) {
    autoArrangeMobile()
  }

  onResize()
  window.addEventListener('resize', onResize)
}

const submitPassword = async () => {
  verifying.value = true
  try {
    const res = await bigScreenShareApi.verify(token.value, password.value)
    if (res?.accessToken) {
      saveBigScreenShareToken(res.accessToken)
      showPasswordDialog.value = false
      const screen = await bigScreenShareApi.screen(token.value)
      dashboardName.value = screen?.name || ''
      await loadScreen(screen)
    } else if (res?.requiresPassword === false) {
      showPasswordDialog.value = false
      const screen = await bigScreenShareApi.screen(token.value)
      dashboardName.value = screen?.name || ''
      await loadScreen(screen)
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '访问失败')
  } finally {
    verifying.value = false
  }
}

onMounted(async () => {
  // 保存原始组件
  originalComponents = [...componentsStore.components]
  clearBigScreenShareToken()

  try {
    const meta = await bigScreenShareApi.meta(token.value)
    if (!meta?.found) {
      notFound.value = true
      return
    }
    if (meta.requiresPassword) {
      showPasswordDialog.value = true
      return
    }
    const res = await bigScreenShareApi.verify(token.value, '')
    if (res?.accessToken) saveBigScreenShareToken(res.accessToken)
    const screen = await bigScreenShareApi.screen(token.value)
    dashboardName.value = screen?.name || ''
    await loadScreen(screen)
  } catch (e: any) {
    notFound.value = true
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  // 恢复原始组件
  componentsStore.components = originalComponents
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <div class="share-preview">
    <div v-if="loading" class="not-found">
      <el-icon :size="64" style="color: #909399;" class="is-loading"><Loading /></el-icon>
      <h2>正在加载大屏...</h2>
    </div>
    <div v-else-if="notFound" class="not-found">
      <el-icon :size="64" style="color: #909399;"><WarningFilled /></el-icon>
      <h2>大屏未找到或已取消发布</h2>
      <p>该链接对应的大屏不存在或已被发布者取消发布</p>
    </div>
    <template v-else>
      <div class="canvas-wrapper">
        <!-- 移动端 -->
        <div v-if="isMobile" class="mobile-viewport" :style="{
          width: (MOBILE_WIDTH * fitScale) + 'px',
          height: (MOBILE_HEIGHT * fitScale) + 'px',
          overflow: 'hidden'
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
                    :data="comp.data"
                    :style="comp.style"
                    :props="comp.props"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- PC端 -->
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
                :data="comp.data"
                :style="comp.style"
                :props="comp.props"
              />
            </div>
          </div>
        </div>
      </div>
      <button class="fullscreen-btn" @click="toggleFullscreen" title="全屏">
        <el-icon><FullScreen /></el-icon>
      </button>
    </template>

    <el-dialog v-model="showPasswordDialog" title="访问大屏" width="400px" :close-on-click-modal="false" :close-on-press-escape="false" :show-close="false">
      <p style="margin: 0 0 12px; color: #909399;">该大屏已设置访问密码，请输入密码查看：</p>
      <el-input v-model="password" type="password" placeholder="请输入分享密码" show-password @keyup.enter="submitPassword" />
      <template #footer>
        <el-button :loading="verifying" type="primary" @click="submitPassword">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.share-preview {
  height: 100vh;
  background: #0a0e1a;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;
}

.not-found h2 {
  margin: 16px 0 8px;
  color: #c0c4cc;
}

.not-found p {
  color: #909399;
  font-size: 14px;
}

.canvas-wrapper {
  flex: 1;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.mobile-viewport {
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

.fullscreen-btn {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
  z-index: 1000;
}

.share-preview:hover .fullscreen-btn {
  opacity: 1;
}

.fullscreen-btn:hover {
  background: rgba(64, 158, 255, 0.6);
  color: #fff;
}
</style>
