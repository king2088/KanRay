<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, inject, nextTick } from 'vue'
import { useCanvasStore } from '../../stores/canvas'
import { useComponentsStore } from '../../stores/components'
import { useHistoryStore } from '../../stores/history'
import { getComponent } from '../../core/components/registry'
import { getDefaultDataForComponent } from '../../core/components/defaultData'
import { useDataFetch } from '../../composables/useDataFetch'
import { generateId } from '../../utils/id'

const canvasStore = useCanvasStore()
const componentsStore = useComponentsStore()
const historyStore = useHistoryStore()
const { getData, startAllFetches, stopAllFetches } = useDataFetch()

const getWidgetComponent = (type: string) => getComponent(type)

const canvasRef = ref<HTMLDivElement>()
const viewportRef = ref<HTMLDivElement>()

const contextMenu = ref<{ show: boolean; x: number; y: number; componentId: string | null }>({
  show: false, x: 0, y: 0, componentId: null
})
const isPanning = ref(false)
const isSpaceDown = ref(false)
const panX = ref(0)
const panY = ref(0)
const isSelecting = ref(false)
const justSelected = ref(false)
const draggingId = ref<string | null>(null)
const dragContentEl = ref<HTMLElement | null>(null)
const selectionBox = ref<{ startX: number; startY: number; endX: number; endY: number } | null>(null)
const showGrid = ref(true)
const gridSize = ref(20)

const openCodeDialog = inject<(id: string) => void>('openCodeDialog', () => {})

const canvasImageUploadRef = ref<HTMLInputElement>()
const canvasImageUploadId = ref('')
const canvasCarouselUploadRef = ref<HTMLInputElement>()
const canvasCarouselUploadId = ref('')

function handleCanvasImageUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !canvasImageUploadId.value) return
  const reader = new FileReader()
  reader.onload = () => {
    const comp = componentsStore.components.find(c => c.id === canvasImageUploadId.value)
    if (comp) {
      componentsStore.updateComponent(canvasImageUploadId.value, {
        props: { ...comp.props, src: reader.result as string }
      })
    }
  }
  reader.readAsDataURL(file)
  ;(e.target as HTMLInputElement).value = ''
}

function handleCanvasCarouselUpload(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files || [])
  if (!files.length || !canvasCarouselUploadId.value) return
  const comp = componentsStore.components.find(c => c.id === canvasCarouselUploadId.value)
  if (!comp) return
  const existing = comp.props?.images || []
  const readers = files.map(f => new Promise<string>(resolve => {
    const r = new FileReader(); r.onload = () => resolve(r.result as string); r.readAsDataURL(f)
  }))
  Promise.all(readers).then(results => {
    componentsStore.updateComponent(canvasCarouselUploadId.value, {
      props: { ...comp.props, images: [...existing, ...results] }
    })
  })
  ;(e.target as HTMLInputElement).value = ''
}

const viewportWidth = ref(800)
const viewportHeight = ref(600)

const currentScale = computed(() => {
  return canvasStore.userZoom ? canvasStore.zoom / 100 : canvasStore.fitScale
})

const canvasWidth = computed(() => isMobilePreview.value ? canvasStore.viewportSize.width : canvasStore.designWidth)

const mobileContentHeight = computed(() => {
  if (!isMobilePreview.value) return 0
  const positions = mobileLayoutPositions.value
  let maxBottom = 0
  for (const id in positions) {
    const p = positions[id]
    const bottom = p.y + p.height
    if (bottom > maxBottom) maxBottom = bottom
  }
  return maxBottom + 20
})

const canvasHeight = computed(() => {
  if (isMobilePreview.value) {
    return Math.max(canvasStore.viewportSize.height, mobileContentHeight.value)
  }
  return canvasStore.designHeight
})

const scaledCanvasWidth = computed(() => canvasWidth.value * currentScale.value)
const scaledCanvasHeight = computed(() => canvasHeight.value * currentScale.value)

const canvasStyle = computed(() => {
  const cfg = canvasStore.config
  const bgImageStyle = cfg.bgImage && !isMobilePreview.value ? {
    backgroundImage: `url(${cfg.bgImage})`,
    backgroundSize: cfg.bgImageSize === 'stretch' ? '100% 100%' : cfg.bgImageSize,
    backgroundPosition: cfg.bgImagePosition,
    backgroundRepeat: cfg.bgImageRepeat,
    opacity: cfg.bgImageOpacity < 100 ? cfg.bgImageOpacity / 100 : undefined
  } : {}

  if (isMobilePreview.value) {
    return {
      width: `${canvasWidth.value}px`,
      height: `${canvasHeight.value}px`,
      background: cfg.background
    }
  }
  return {
    width: `${canvasWidth.value}px`,
    height: `${canvasHeight.value}px`,
    background: cfg.background,
    ...bgImageStyle,
    transform: `scale(${currentScale.value})`,
    transformOrigin: 'top left'
  }
})

const wrapperStyle = computed(() => {
  const w = scaledCanvasWidth.value
  const h = scaledCanvasHeight.value
  return {
    width: `${w}px`,
    height: `${h}px`,
    transform: `translate(${panX.value}px, ${panY.value}px)`
  }
})

const vpW = computed(() => viewportRef.value?.clientWidth || viewportWidth.value)
const vpH = computed(() => viewportRef.value?.clientHeight || viewportHeight.value)

const needScrollH = computed(() => scaledCanvasWidth.value > vpW.value)
const needScrollV = computed(() => scaledCanvasHeight.value > vpH.value)

const scrollTrackHStyle = computed(() => ({
  display: needScrollH.value ? 'block' : 'none'
}))
const scrollTrackVStyle = computed(() => ({
  display: needScrollV.value ? 'block' : 'none'
}))

const scrollThumbHStyle = computed(() => {
  const ratio = vpW.value / scaledCanvasWidth.value
  const thumbW = Math.max(30, vpW.value * ratio)
  const maxPan = scaledCanvasWidth.value - vpW.value
  const thumbX = maxPan > 0 ? (-panX.value / maxPan) * (vpW.value - thumbW) : 0
  return {
    width: `${thumbW}px`,
    left: `${Math.max(0, thumbX)}px`
  }
})

const scrollThumbVStyle = computed(() => {
  const ratio = vpH.value / scaledCanvasHeight.value
  const thumbH = Math.max(30, vpH.value * ratio)
  const maxPan = scaledCanvasHeight.value - vpH.value
  const thumbY = maxPan > 0 ? (-panY.value / maxPan) * (vpH.value - thumbH) : 0
  return {
    height: `${thumbH}px`,
    top: `${Math.max(0, thumbY)}px`
  }
})

function centerCanvas() {
  const cw = scaledCanvasWidth.value
  const ch = scaledCanvasHeight.value
  panX.value = (vpW.value - cw) / 2
  panY.value = (vpH.value - ch) / 2
}

const isMobilePreview = computed(() => canvasStore.previewDevice !== 'pc')

watch(currentScale, () => { nextTick(() => centerCanvas()) })

const viewportClass = computed(() => {
  const classes: string[] = []
  if (isMobilePreview.value) {
    classes.push('mobile-mode')
  }
  return classes
})

watch(isMobilePreview, (val) => {
  if (val) {
    const vp = canvasStore.viewportSize
    const gap = 10
    let currentY = 0
    const visibleComps = componentsStore.components.filter(c => c.visible && !c.mobile?.hideOnMobile)

    // Detect tightly overlapping groups (one component inside another)
    const groups: any[][] = []
    const assigned = new Set<string>()
    for (const comp of visibleComps) {
      if (assigned.has(comp.id)) continue
      const group = [comp]
      assigned.add(comp.id)
      for (const other of visibleComps) {
        if (assigned.has(other.id)) continue
        // Check if other is mostly inside comp (or vice versa)
        const ix = Math.max(comp.x, other.x)
        const iy = Math.max(comp.y, other.y)
        const iw = Math.min(comp.x + comp.width, other.x + other.width) - ix
        const ih = Math.min(comp.y + comp.height, other.y + other.height) - iy
        if (iw <= 0 || ih <= 0) continue
        const overlapArea = iw * ih
        const smallerArea = Math.min(comp.width * comp.height, other.width * other.height)
        // Only group if overlap covers >= 60% of the smaller component
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
        // Skip: same size as canvas and no data
        const isEmptyBg = comp.width >= vp.width - 10 && comp.height >= vp.height - 10 &&
          (!comp.data?.value || comp.data.value === '') &&
          !comp.props?.content && comp.type !== 'number-flip' && comp.type !== 'time-text'
        if (isEmptyBg) {
          componentsStore.updateComponent(comp.id, { mobile: { ...comp.mobile, hideOnMobile: true } })
          continue
        }
        if (!comp.mobileLayout) {
          componentsStore.updateComponent(comp.id, {
            mobileLayout: { x: 0, y: currentY, width: vp.width, height: comp.height }
          })
          currentY += comp.height + gap
        } else {
          currentY = comp.mobileLayout.y + comp.mobileLayout.height + gap
        }
      } else {
        // Overlapping group: all at same position, full width, sorted by z-index
        group.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
        const groupH = Math.max(...group.map(c => c.y + c.height)) - Math.min(...group.map(c => c.y))
        // Skip group if bounding box same size as canvas and no data
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
            componentsStore.updateComponent(comp.id, {
              mobileLayout: { x: 0, y: currentY, width: vp.width, height: comp.height }
            })
          }
        }
        currentY += groupH + gap
      }
    }
  }
})

const mobileLayoutPositions = computed(() => {
  const positions: Record<string, { x: number; y: number; width: number; height: number }> = {}
  if (!isMobilePreview.value) return positions

  for (const c of componentsStore.components) {
    if (!c.visible || c.mobile?.hideOnMobile) continue
    if (c.mobileLayout) {
      positions[c.id] = { x: c.mobileLayout.x, y: c.mobileLayout.y, width: c.mobileLayout.width, height: c.mobileLayout.height }
    }
  }

  return positions
})

const getComponentStyle = (component: any) => {
  if (isMobilePreview.value && component.mobileLayout) {
    return {
      left: `${component.mobileLayout.x}px`,
      top: `${component.mobileLayout.y}px`,
      width: `${component.mobileLayout.width}px`,
      height: `${component.mobileLayout.height}px`,
      transform: `rotate(${component.rotation}deg)`,
      opacity: component.opacity / 100,
      zIndex: component.zIndex
    }
  }
  return {
    left: `${component.x}px`,
    top: `${component.y}px`,
    width: `${component.width}px`,
    height: `${component.height}px`,
    transform: `rotate(${component.rotation}deg)`,
    opacity: component.opacity / 100,
    zIndex: component.zIndex
  }
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (viewportRef.value) {
    viewportWidth.value = viewportRef.value.clientWidth
    viewportHeight.value = viewportRef.value.clientHeight
    canvasStore.setContainerSize(viewportWidth.value, viewportHeight.value)
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        viewportWidth.value = entry.contentRect.width
        viewportHeight.value = entry.contentRect.height
        canvasStore.setContainerSize(viewportWidth.value, viewportHeight.value)
        centerCanvas()
      }
    })
    resizeObserver.observe(viewportRef.value)
    centerCanvas()
  }
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)
  startAllFetches()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('keyup', onKeyUp)
  stopAllFetches()
})

function clientToCanvas(clientX: number, clientY: number) {
  const rect = canvasRef.value!.getBoundingClientRect()
  return {
    x: (clientX - rect.left) / currentScale.value,
    y: (clientY - rect.top) / currentScale.value
  }
}

const onDrop = (event: DragEvent) => {
  event.preventDefault()
  const componentData = event.dataTransfer?.getData('component')
  if (!componentData) return
  const component = JSON.parse(componentData)
  const { x, y } = clientToCanvas(event.clientX, event.clientY)
const defaultProps: Record<string, any> = {}

  if (component.type === 'data-text') {
    defaultProps.fontSize = 32
    defaultProps.color = '#409eff'
    defaultProps.fontWeight = 'bold'
    defaultProps.textAlign = 'center'
    defaultProps.prefix = ''
    defaultProps.suffix = ''
    defaultProps.decimals = 0
    defaultProps.useGrouping = true
    defaultProps.labelShow = true
    defaultProps.glow = true
  }

  if (component.type === 'custom-chart') {
    defaultProps.html = `<div class="demo">\n  <h2>Hello World</h2>\n  <p>双击在这里编写HTML</p>\n  <div class="chart-box"></div>\n</div>`
    defaultProps.css = `.demo {\n  width: 100%;\n  height: 100%;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  color: #fff;\n  font-family: Arial, sans-serif;\n}\nh2 { margin: 0 0 8px; font-size: 28px; }\np { margin: 0 0 12px; font-size: 13px; opacity: 0.7; }\n.chart-box {\n  width: 80%;\n  height: 200px;\n  background: rgba(255,255,255,0.1);\n  border-radius: 6px;\n}`
    defaultProps.js = `var chartBox = container.querySelector('.chart-box');\nif (chartBox) {\n  var chart = echarts.init(chartBox);\n  var labels = (data && data.labels) || [];\n  var values = (data && data.values) || [];\n  if (!values.length) {\n    chartBox.innerHTML = '<div style="color:rgba(255,255,255,0.5);font-size:13px;text-align:center;padding-top:80px;">暂无数据</div>';\n    return;\n  }\n  chart.setOption({\n    xAxis: { type: 'category', data: labels },\n    yAxis: { type: 'value' },\n    series: [{ data: values, type: 'bar', itemStyle: { color: '#409eff' } }],\n    grid: { left: 40, right: 20, top: 20, bottom: 30 }\n  });\n}`
  }

  componentsStore.addComponent({
    id: generateId(),
    type: component.type,
    name: component.name,
    x: Math.max(0, Math.min(x, canvasStore.designWidth - 200)),
    y: Math.max(0, Math.min(y, canvasStore.designHeight - 100)),
    width: 300,
    height: 280,
    rotation: 0,
    zIndex: componentsStore.components.length + 1,
    locked: false,
    visible: true,
    opacity: 100,
    props: defaultProps,
    style: { backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderRadius: 0, boxShadowX: 0, boxShadowY: 0, boxShadowBlur: 0, boxShadowColor: 'rgba(0,0,0,0)' },
    data: { type: 'static', value: getDefaultDataForComponent(component.type) ? JSON.stringify(getDefaultDataForComponent(component.type), null, 2) : '', datasetId: null, categoryField: '', valueFields: [] },
    animation: { type: 'none', duration: 500, delay: 0 },
    interaction: {},
    mobile: {
      hideOnMobile: false,
      mobileOrder: componentsStore.components.length + 1,
      mobileX: null,
      mobileY: null,
      mobileWidth: null,
      mobileHeight: null
    },
    mobileLayout: null
  })
  historyStore.pushState(componentsStore.components)
}

const onDragOver = (event: DragEvent) => {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

function getCompPos(c: any) {
  if (isMobilePreview.value && c.mobileLayout) {
    return { x: c.mobileLayout.x, y: c.mobileLayout.y, width: c.mobileLayout.width, height: c.mobileLayout.height }
  }
  return { x: c.x, y: c.y, width: c.width, height: c.height }
}

function setCompPos(id: string, updates: { x?: number; y?: number; width?: number; height?: number }) {
  const c = componentsStore.components.find(comp => comp.id === id)
  if (!c) return
  const rounded: typeof updates = { ...updates }
  if (rounded.x !== undefined) rounded.x = Math.round(rounded.x)
  if (rounded.y !== undefined) rounded.y = Math.round(rounded.y)
  if (rounded.width !== undefined) rounded.width = Math.round(rounded.width)
  if (rounded.height !== undefined) rounded.height = Math.round(rounded.height)
  if (isMobilePreview.value) {
    const ml = c.mobileLayout || { x: c.x, y: c.y, width: c.width, height: c.height }
    componentsStore.updateComponent(id, {
      mobileLayout: { ...ml, ...rounded }
    })
  } else {
    componentsStore.updateComponent(id, rounded)
  }
}

const SNAP_THRESHOLD = 5

interface SnapLine {
  type: 'horizontal' | 'vertical'
  pos: number
}

const snapLines = ref<SnapLine[]>([])

function snapPosition(x: number, y: number, width: number, height: number, excludeId: string): { x: number; y: number; lines: SnapLine[] } {
  const others = componentsStore.components.filter(c => c.id !== excludeId && c.visible)
  const myLeft = x, myRight = x + width, myCenterX = x + width / 2
  const myTop = y, myBottom = y + height, myMiddleY = y + height / 2

  interface SnapTarget { edge: number; canvasPos: number }
  const targetsX: SnapTarget[] = [{ edge: 0, canvasPos: 0 }, { edge: canvasWidth.value, canvasPos: canvasWidth.value }]
  const targetsY: SnapTarget[] = [{ edge: 0, canvasPos: 0 }, { edge: canvasHeight.value, canvasPos: canvasHeight.value }]

  for (const o of others) {
    const op = getCompPos(o)
    targetsX.push({ edge: op.x, canvasPos: op.x })
    targetsX.push({ edge: op.x + op.width / 2, canvasPos: op.x + op.width / 2 })
    targetsX.push({ edge: op.x + op.width, canvasPos: op.x + op.width })
    targetsY.push({ edge: op.y, canvasPos: op.y })
    targetsY.push({ edge: op.y + op.height / 2, canvasPos: op.y + op.height / 2 })
    targetsY.push({ edge: op.y + op.height, canvasPos: op.y + op.height })
  }

  let snapX: number | null = null, snapY: number | null = null
  let minDx = SNAP_THRESHOLD, minDy = SNAP_THRESHOLD
  let lineX: number | null = null, lineY: number | null = null

  for (const t of targetsX) {
    for (const [myEdge, myOffset] of [[myLeft, 0], [myCenterX, width / 2], [myRight, width]] as [number, number][]) {
      const d = Math.abs(myEdge - t.edge)
      if (d < minDx) {
        minDx = d
        snapX = t.edge - myOffset
        lineX = t.edge
      }
    }
  }
  for (const t of targetsY) {
    for (const [myEdge, myOffset] of [[myTop, 0], [myMiddleY, height / 2], [myBottom, height]] as [number, number][]) {
      const d = Math.abs(myEdge - t.edge)
      if (d < minDy) {
        minDy = d
        snapY = t.edge - myOffset
        lineY = t.edge
      }
    }
  }

  const lines: SnapLine[] = []
  if (lineX !== null) lines.push({ type: 'vertical', pos: lineX })
  if (lineY !== null) lines.push({ type: 'horizontal', pos: lineY })

  return { x: snapX ?? x, y: snapY ?? y, lines }
}

const onComponentPressCapture = (event: MouseEvent) => {
  if (event.button !== 0) return
  if (isSpaceDown.value) return

  const target = event.target as HTMLElement
  if (target.closest('.handle')) return

  const compEl = target.closest<HTMLElement>('.component')
  if (!compEl) return
  const componentId = compEl.dataset.id
  if (!componentId) return
  const component = componentsStore.components.find(c => c.id === componentId)
  if (!component || component.locked) return

  if (event.ctrlKey || event.metaKey || event.shiftKey) {
    onComponentMouseDown(event, componentId)
    return
  }

  event.stopPropagation()
  event.preventDefault()
  onComponentMouseDown(event, componentId)

  const contentEl = target.closest<HTMLElement>('.component-content') as HTMLElement | null
  if (contentEl) {
    dragContentEl.value = contentEl
    contentEl.style.pointerEvents = 'none'
  }
}

const onComponentMouseDown = (event: MouseEvent, componentId: string) => {
  // If Space is held, allow panning to continue (don't select/drag component)
  if (isSpaceDown.value) {
    return
  }
  
  event.stopPropagation()

  const component = componentsStore.components.find(c => c.id === componentId)
  if (component?.locked) return

  // Select the component (if not already selected)
  const isSelected = componentsStore.selectedIds.includes(componentId)
  if (!isSelected) {
    if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
      componentsStore.selectComponent(componentId, false)
    } else {
      componentsStore.selectComponent(componentId, true)
      return
    }
  }

  if (event.ctrlKey || event.metaKey || event.shiftKey) {
    componentsStore.selectComponent(componentId, true)
    return
  }

  draggingId.value = componentId

  // Start dragging immediately
  const startX = event.clientX
  const startY = event.clientY
  let hasMoved = false
  const startPositions = componentsStore.selectedIds.map(id => {
    const c = componentsStore.components.find(comp => comp.id === id)!
    const pos = getCompPos(c)
    return { id, x: pos.x, y: pos.y }
  })

  const onMouseMove = (e: MouseEvent) => {
    const dx = (e.clientX - startX) / currentScale.value
    const dy = (e.clientY - startY) / currentScale.value
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasMoved = true
    const allLines: SnapLine[] = []
    startPositions.forEach(pos => {
      const c = componentsStore.components.find(comp => comp.id === pos.id)
      if (c && !c.locked) {
        const rawX = pos.x + dx, rawY = pos.y + dy
        const result = snapPosition(rawX, rawY, c.width, c.height, pos.id)
        setCompPos(pos.id, { x: result.x, y: result.y })
        allLines.push(...result.lines)
      }
    })
    snapLines.value = allLines
  }

  const onMouseUp = () => {
    snapLines.value = []
    draggingId.value = null
    const el = dragContentEl.value
    if (el) {
      el.style.pointerEvents = ''
      dragContentEl.value = null
    }
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    if (hasMoved) historyStore.pushState(componentsStore.components)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

const onResizeStart = (event: MouseEvent, componentId: string, handle: string) => {
  event.stopPropagation()
  event.preventDefault()
  const component = componentsStore.components.find(c => c.id === componentId)
  if (!component || component.locked) return

  const pos = getCompPos(component)
  const startX = event.clientX
  const startY = event.clientY
  const { width: startWidth, height: startHeight, x: startPosX, y: startPosY } = pos

  const onMouseMove = (e: MouseEvent) => {
    const dx = (e.clientX - startX) / currentScale.value
    const dy = (e.clientY - startY) / currentScale.value
    let newWidth = startWidth, newHeight = startHeight, newX = startPosX, newY = startPosY

    if (handle.includes('right')) newWidth = Math.max(20, startWidth + dx)
    if (handle.includes('left')) { newWidth = Math.max(20, startWidth - dx); newX = startPosX + dx }
    if (handle.includes('bottom')) newHeight = Math.max(20, startHeight + dy)
    if (handle.includes('top')) { newHeight = Math.max(20, startHeight - dy); newY = startPosY + dy }

    const result = snapPosition(newX, newY, newWidth, newHeight, componentId)
    setCompPos(componentId, { width: newWidth, height: newHeight, x: result.x, y: result.y })
    snapLines.value = result.lines
  }

  const onMouseUp = () => {
    snapLines.value = []
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    historyStore.pushState(componentsStore.components)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

const onViewportMouseDown = (event: MouseEvent) => {
  if (event.button !== 0) return

  if (isSpaceDown.value) {
    event.preventDefault()
    isPanning.value = true
    const startX = event.clientX
    const startY = event.clientY
    const startPanX = panX.value
    const startPanY = panY.value

    const onMouseMove = (e: MouseEvent) => {
      panX.value = startPanX + (e.clientX - startX)
      panY.value = startPanY + (e.clientY - startY)
    }

    const onMouseUp = () => {
      isPanning.value = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return
  }

  const target = event.target as HTMLElement
  if (target.closest('.component')) return

  event.preventDefault()

  const { x: startX, y: startY } = clientToCanvas(event.clientX, event.clientY)
  isSelecting.value = true
  selectionBox.value = { startX, startY, endX: startX, endY: startY }

  const onMouseMove = (e: MouseEvent) => {
    if (!selectionBox.value) return
    const { x: endX, y: endY } = clientToCanvas(e.clientX, e.clientY)
    selectionBox.value = { ...selectionBox.value, endX, endY }
  }

  const onMouseUp = (e: MouseEvent) => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)

    if (selectionBox.value) {
      const minX = Math.min(selectionBox.value.startX, selectionBox.value.endX)
      const maxX = Math.max(selectionBox.value.startX, selectionBox.value.endX)
      const minY = Math.min(selectionBox.value.startY, selectionBox.value.endY)
      const maxY = Math.max(selectionBox.value.startY, selectionBox.value.endY)

      if (Math.abs(maxX - minX) > 3 || Math.abs(maxY - minY) > 3) {
        if (!e.ctrlKey && !e.metaKey) {
          componentsStore.clearSelection()
        }

        let selectedCount = 0
        componentsStore.components.forEach(c => {
          if (c.locked || !c.visible) return
          // 移动端模式使用mobileLayout坐标
          const pos = getCompPos(c)
          const cRight = pos.x + pos.width
          const cBottom = pos.y + pos.height
          if (pos.x < maxX && cRight > minX && pos.y < maxY && cBottom > minY) {
            componentsStore.selectComponent(c.id, true)
            selectedCount++
          }
        })
        if (selectedCount > 0) justSelected.value = true
      } else {
        componentsStore.clearSelection()
      }
    }

    setTimeout(() => {
      isSelecting.value = false
      selectionBox.value = null
    }, 0)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

const onWheel = (event: WheelEvent) => {
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault()
    if (event.deltaY > 0) {
      canvasStore.zoomOut()
    } else {
      canvasStore.zoomIn()
    }
  } else {
    panX.value -= event.deltaX
    panY.value -= event.deltaY
  }
}

function onScrollbarDrag(event: MouseEvent, axis: 'x' | 'y') {
  event.preventDefault()
  event.stopPropagation()
  const startClient = axis === 'x' ? event.clientX : event.clientY
  const startPan = axis === 'x' ? panX.value : panY.value
  const contentSize = axis === 'x' ? scaledCanvasWidth.value : scaledCanvasHeight.value
  const vpSize = axis === 'x' ? vpW.value : vpH.value
  const maxPan = contentSize - vpSize

  const onMouseMove = (e: MouseEvent) => {
    const delta = (axis === 'x' ? e.clientX : e.clientY) - startClient
    const panDelta = delta * (contentSize / vpSize)
    if (axis === 'x') {
      panX.value = Math.max(-maxPan, Math.min(0, startPan - panDelta))
    } else {
      panY.value = Math.max(-maxPan, Math.min(0, startPan - panDelta))
    }
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

const onKeyDown = (event: KeyboardEvent) => {
  const tag = (event.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (event.target as HTMLElement)?.isContentEditable) return

  if (event.code === 'Space' && !event.repeat) { isSpaceDown.value = true; event.preventDefault() }
  if ((event.key === 'Delete' || event.key === 'Backspace') && componentsStore.selectedIds.length > 0) {
    componentsStore.selectedIds.forEach(id => componentsStore.removeComponent(id))
    historyStore.pushState(componentsStore.components)
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
    event.preventDefault()
    const components = event.shiftKey ? historyStore.redo() : historyStore.undo()
    if (components) componentsStore.components = components
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
    event.preventDefault()
    ctxAction('duplicate')
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'a') { event.preventDefault(); componentsStore.selectAll() }
  if ((event.ctrlKey || event.metaKey) && event.key === 'c') { event.preventDefault(); ctxAction('copy') }
  if ((event.ctrlKey || event.metaKey) && event.key === 'x') { event.preventDefault(); ctxAction('cut') }
  if ((event.ctrlKey || event.metaKey) && event.key === 'v') { event.preventDefault(); ctxAction('paste') }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); ctxAction('delete') }
  if (event.key === 'Escape') componentsStore.clearSelection()
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) && componentsStore.selectedIds.length > 0) {
    event.preventDefault()
    const step = event.ctrlKey ? 10 : 1
    componentsStore.selectedIds.forEach(id => {
      const c = componentsStore.components.find(comp => comp.id === id)
      if (c) {
        const pos = getCompPos(c)
        if (event.key === 'ArrowUp') setCompPos(id, { x: pos.x, y: pos.y - step })
        if (event.key === 'ArrowDown') setCompPos(id, { x: pos.x, y: pos.y + step })
        if (event.key === 'ArrowLeft') setCompPos(id, { x: pos.x - step, y: pos.y })
        if (event.key === 'ArrowRight') setCompPos(id, { x: pos.x + step, y: pos.y })
      }
    })
    historyStore.pushState(componentsStore.components)
  }
  if (event.key === '=' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    const cur = canvasStore.actualZoom
    const next = Math.ceil(cur / 10) * 10
    canvasStore.setZoom(next > cur ? next : next + 10)
  }
  if (event.key === '-' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    const cur = canvasStore.actualZoom
    const prev = Math.floor(cur / 10) * 10
    canvasStore.setZoom(prev < cur ? prev : prev - 10)
  }
  if (event.key === '0' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); resetView() }
  if ((event.ctrlKey || event.metaKey) && event.key === 'l') {
    event.preventDefault()
    componentsStore.selectedIds.forEach(id => componentsStore.lockComponent(id))
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'h') {
    event.preventDefault()
    componentsStore.selectedIds.forEach(id => componentsStore.hideComponent(id))
  }
  if (event.key === 'Tab' && componentsStore.components.length > 0) {
    event.preventDefault()
    const visible = componentsStore.components.filter(c => c.visible && !c.locked)
    if (visible.length === 0) return
    const current = componentsStore.selectedIds
    let nextIndex = 0
    if (current.length > 0) {
      const lastId = current[current.length - 1]
      const idx = visible.findIndex(c => c.id === lastId)
      nextIndex = (idx + 1) % visible.length
    }
    componentsStore.clearSelection()
    componentsStore.selectComponent(visible[nextIndex].id)
  }
}

const onKeyUp = (event: KeyboardEvent) => {
  if (event.code === 'Space') {
    isSpaceDown.value = false
  }
}

function onContextMenu(event: MouseEvent) {
  event.preventDefault()
  const target = (event.target as HTMLElement).closest('.component')
  let componentId: string | null = null
  if (target) {
    componentId = target.getAttribute('data-id')
    if (componentId && !componentsStore.selectedIds.includes(componentId)) {
      componentsStore.selectComponent(componentId)
    }
  }

  const menuWidth = 160
  const hasAlign = componentsStore.selectedIds.length >= 2
  const baseItems = componentId ? 11 : 1
  const alignItems = hasAlign ? 6 : 0
  const menuHeight = (baseItems + alignItems) * 36 + 16
  const vpWinW = window.innerWidth
  const vpWinH = window.innerHeight

  let x = event.clientX
  let y = event.clientY

  if (x + menuWidth > vpWinW) x = vpWinW - menuWidth - 4
  if (y + menuHeight > vpWinH) y = vpWinH - menuHeight - 4
  if (x < 0) x = 4
  if (y < 0) y = 4

  contextMenu.value = { show: true, x, y, componentId }
}

function closeContextMenu() {
  contextMenu.value.show = false
}

function alignComponents(direction: string) {
  const selected = componentsStore.selectedComponents
  if (selected.length < 2) return
  // 使用getCompPos获取正确的坐标（支持移动端mobileLayout）
  const positions = selected.map(c => ({ comp: c, pos: getCompPos(c) }))
  const minX = Math.min(...positions.map(p => p.pos.x))
  const maxX = Math.max(...positions.map(p => p.pos.x + p.pos.width))
  const minY = Math.min(...positions.map(p => p.pos.y))
  const maxY = Math.max(...positions.map(p => p.pos.y + p.pos.height))
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  positions.forEach(({ comp, pos }) => {
    switch (direction) {
      case 'left': setCompPos(comp.id, { x: minX, y: pos.y }); break
      case 'right': setCompPos(comp.id, { x: maxX - pos.width, y: pos.y }); break
      case 'top': setCompPos(comp.id, { x: pos.x, y: minY }); break
      case 'bottom': setCompPos(comp.id, { x: pos.x, y: maxY - pos.height }); break
      case 'center-h': setCompPos(comp.id, { x: centerX - pos.width / 2, y: pos.y }); break
      case 'center-v': setCompPos(comp.id, { x: pos.x, y: centerY - pos.height / 2 }); break
    }
  })
  historyStore.pushState(componentsStore.components)
}

function resetView() {
  canvasStore.resetView()
  nextTick(() => centerCanvas())
}

import { ElMessage } from 'element-plus'

const exportJSON = () => {
  const data = {
    config: canvasStore.config,
    components: componentsStore.components
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `大屏设计.json`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('导出成功')
}

const importJSON = () => {
  // 如果当前有组件，先确认是否覆盖
  if (componentsStore.components.length > 0) {
    if (!confirm('导入将覆盖当前设计内容，是否继续？')) return
  }

  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const data = JSON.parse(text)
      // 先推入历史，允许撤销
      historyStore.pushState(componentsStore.components)

      if (data.config) canvasStore.setConfig(data.config)
      if (data.components) {
        componentsStore.components = []
        data.components.forEach((c: any) => {
          if (!c.mobile) {
            c.mobile = { hideOnMobile: false, mobileOrder: 0, mobileX: null, mobileY: null, mobileWidth: null, mobileHeight: null }
          }
          if (c.mobileLayout === undefined) c.mobileLayout = null
          // 验证必需字段
          if (!c.id || !c.type) return
          if (typeof c.x !== 'number') c.x = 0
          if (typeof c.y !== 'number') c.y = 0
          if (typeof c.width !== 'number') c.width = 200
          if (typeof c.height !== 'number') c.height = 100
          componentsStore.addComponent(c)
        })
      }
      ElMessage.success('导入成功')
    } catch {
      ElMessage.error('导入失败：无效的JSON文件')
    }
  }
  input.click()
}

function onCanvasDblclick(e: MouseEvent) {
  const target = (e.target as HTMLElement).closest('.component')
  if (!target) return
  const id = target.getAttribute('data-id')
  if (!id) return
  const comp = componentsStore.components.find(c => c.id === id)
  if (comp?.type === 'custom-chart') {
    openCodeDialog(id)
  } else if (comp?.type === 'static-image') {
    canvasImageUploadId.value = id
    canvasImageUploadRef.value?.click()
  } else if (comp?.type === 'carousel-image') {
    canvasCarouselUploadId.value = id
    canvasCarouselUploadRef.value?.click()
  }
}

function ctxAction(action: string) {
  const ids = componentsStore.selectedIds
  if (ids.length === 0 && action !== 'paste') { closeContextMenu(); return }
  switch (action) {
    case 'copy': componentsStore.copyComponents(); break
    case 'cut': componentsStore.cutComponents(); break
    case 'paste': componentsStore.pasteComponents(); historyStore.pushState(componentsStore.components); break
    case 'delete': componentsStore.deleteSelected(); historyStore.pushState(componentsStore.components); break
    case 'lock': ids.forEach(id => componentsStore.lockComponent(id)); break
    case 'hide': ids.forEach(id => componentsStore.hideComponent(id)); break
    case 'front': ids.forEach(id => componentsStore.bringToFront(id)); break
    case 'back': ids.forEach(id => componentsStore.sendToBack(id)); break
    case 'up': ids.forEach(id => componentsStore.moveUp(id)); break
    case 'down': ids.forEach(id => componentsStore.moveDown(id)); break
    case 'duplicate':
      ids.forEach(id => {
        const c = componentsStore.components.find(comp => comp.id === id)
        if (c) componentsStore.addComponent({ ...c, id: generateId(), x: c.x + 20, y: c.y + 20, name: c.name + ' - 副本' })
      })
      historyStore.pushState(componentsStore.components)
      break
  }
  closeContextMenu()
}
</script>

<template>
  <input ref="canvasImageUploadRef" type="file" accept="image/*" style="display:none" @change="handleCanvasImageUpload" />
  <input ref="canvasCarouselUploadRef" type="file" accept="image/*" multiple style="display:none" @change="handleCanvasCarouselUpload" />
  <div class="canvas-wrapper" :style="{ cursor: isSpaceDown ? (isPanning ? 'grabbing' : 'grab') : 'default' }" @click="closeContextMenu">
    <div class="canvas-viewport" :class="viewportClass" ref="viewportRef" @mousedown="onViewportMouseDown" @wheel="onWheel">
      <div class="canvas-scale-wrapper" :style="wrapperStyle">
        <div ref="canvasRef" class="canvas" :style="canvasStyle" @mousedown.capture="onComponentPressCapture" @drop="onDrop" @dragover="onDragOver" @contextmenu="onContextMenu" @dblclick="onCanvasDblclick">
          <div class="grid-overlay" v-if="showGrid" :style="{
            backgroundSize: `${gridSize}px ${gridSize}px`,
            backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)`
          }"></div>

          <template v-for="(line, idx) in snapLines" :key="'snap-' + idx">
            <div v-if="line.type === 'horizontal'" class="snap-line snap-line-h" :style="{ top: line.pos + 'px' }"></div>
            <div v-else class="snap-line snap-line-v" :style="{ left: line.pos + 'px' }"></div>
          </template>

          <div v-if="selectionBox" class="selection-box" :style="{
            left: `${Math.min(selectionBox.startX, selectionBox.endX)}px`,
            top: `${Math.min(selectionBox.startY, selectionBox.endY)}px`,
            width: `${Math.abs(selectionBox.endX - selectionBox.startX)}px`,
            height: `${Math.abs(selectionBox.endY - selectionBox.startY)}px`
          }"></div>

          <div v-for="component in componentsStore.components" :key="component.id" class="component"
            :data-id="component.id"
            :class="{ selected: componentsStore.selectedIds.includes(component.id), locked: component.locked, hidden: !component.visible, dragging: draggingId === component.id }"
            :style="getComponentStyle(component)"
            v-show="component.visible && !(isMobilePreview && component.mobile?.hideOnMobile)">
            <div class="component-content" :style="{ backgroundColor: component.style.backgroundColor, borderWidth: component.style.borderWidth + 'px', borderColor: component.style.borderColor, borderStyle: component.style.borderWidth > 0 ? 'solid' : 'none', borderRadius: component.style.borderRadius + 'px', boxShadow: `${component.style.boxShadowX}px ${component.style.boxShadowY}px ${component.style.boxShadowBlur}px ${component.style.boxShadowColor}` }">
              <component v-if="getWidgetComponent(component.type)" :is="getWidgetComponent(component.type)" :componentType="component.type" :data="getData(component.id) || component.data" :style="component.style" :props="component.props" />
              <div v-else class="component-placeholder">{{ component.name }}</div>
            </div>
            <div v-if="componentsStore.selectedIds.includes(component.id) && !component.locked" class="resize-handles">
              <div class="handle top-left" @mousedown="onResizeStart($event, component.id, 'top-left')"></div>
              <div class="handle top-right" @mousedown="onResizeStart($event, component.id, 'top-right')"></div>
              <div class="handle bottom-left" @mousedown="onResizeStart($event, component.id, 'bottom-left')"></div>
              <div class="handle bottom-right" @mousedown="onResizeStart($event, component.id, 'bottom-right')"></div>
              <div class="handle top" @mousedown="onResizeStart($event, component.id, 'top')"></div>
              <div class="handle bottom" @mousedown="onResizeStart($event, component.id, 'bottom')"></div>
              <div class="handle left" @mousedown="onResizeStart($event, component.id, 'left')"></div>
              <div class="handle right" @mousedown="onResizeStart($event, component.id, 'right')"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="scrollbar-track scrollbar-track-h" :style="scrollTrackHStyle" @mousedown="onScrollbarDrag($event, 'x')">
      <div class="scrollbar-thumb scrollbar-thumb-h" :style="scrollThumbHStyle"></div>
    </div>
    <div class="scrollbar-track scrollbar-track-v" :style="scrollTrackVStyle" @mousedown="onScrollbarDrag($event, 'y')">
      <div class="scrollbar-thumb scrollbar-thumb-v" :style="scrollThumbVStyle"></div>
    </div>

    <div class="zoom-controls">
      <el-tooltip content="缩小" placement="top" :show-after="500">
        <button class="zoom-btn" @click="canvasStore.zoomOut()">−</button>
      </el-tooltip>
      <span class="zoom-label">{{ canvasStore.actualZoom }}%</span>
      <el-tooltip content="放大" placement="top" :show-after="500">
        <button class="zoom-btn" @click="canvasStore.zoomIn()">+</button>
      </el-tooltip>
      <el-tooltip content="重置视图" placement="top" :show-after="500">
        <button class="zoom-btn zoom-reset" @click="resetView">↺</button>
      </el-tooltip>
      <span class="zoom-divider"></span>
      <el-tooltip content="导入JSON文件" placement="top" :show-after="500">
        <button class="zoom-btn" @click="importJSON">↑</button>
      </el-tooltip>
      <el-tooltip content="导出JSON文件" placement="top" :show-after="500">
        <button class="zoom-btn" @click="exportJSON">↓</button>
      </el-tooltip>
    </div>
    <Teleport to="body">
      <div v-if="contextMenu.show" class="context-menu" :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }" @click.stop>
        <template v-if="contextMenu.componentId">
          <div class="ctx-item" @click="ctxAction('copy')">复制</div>
          <div class="ctx-item" @click="ctxAction('cut')">剪切</div>
          <div class="ctx-item" @click="ctxAction('paste')">粘贴</div>
          <div class="ctx-item" @click="ctxAction('duplicate')">复制组件</div>
          <div class="ctx-divider"></div>
          <div class="ctx-item" @click="ctxAction('front')">置顶</div>
          <div class="ctx-item" @click="ctxAction('back')">置底</div>
          <div class="ctx-item" @click="ctxAction('up')">上移一层</div>
          <div class="ctx-item" @click="ctxAction('down')">下移一层</div>
          <div class="ctx-divider"></div>
          <div class="ctx-item" @click="ctxAction('lock')">
            {{ componentsStore.components.find(c => c.id === contextMenu.componentId)?.locked ? '解锁' : '锁定' }}
          </div>
          <div class="ctx-item" @click="ctxAction('hide')">
            {{ componentsStore.components.find(c => c.id === contextMenu.componentId)?.visible ? '隐藏' : '显示' }}
          </div>
          <div class="ctx-divider"></div>
          <div class="ctx-item ctx-submenu" v-if="componentsStore.selectedIds.length >= 2">
            对齐
            <span class="ctx-arrow">▶</span>
            <div class="ctx-submenu-panel">
              <div class="ctx-item" @click="alignComponents('left')">左对齐</div>
              <div class="ctx-item" @click="alignComponents('right')">右对齐</div>
              <div class="ctx-item" @click="alignComponents('top')">顶部对齐</div>
              <div class="ctx-item" @click="alignComponents('bottom')">底部对齐</div>
              <div class="ctx-item" @click="alignComponents('center-h')">水平居中</div>
              <div class="ctx-item" @click="alignComponents('center-v')">垂直居中</div>
            </div>
          </div>
          <div class="ctx-divider"></div>
          <div class="ctx-item ctx-danger" @click="ctxAction('delete')">删除</div>
        </template>
        <template v-else>
          <div class="ctx-item" @click="ctxAction('paste')">粘贴</div>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.canvas-wrapper { flex: 1; overflow: hidden; background: #1a1a2e; position: relative; user-select: none; }
.canvas-viewport { width: 100%; height: 100%; overflow: hidden; user-select: none; position: relative; }
.canvas-scale-wrapper { position: absolute; top: 0; left: 0; will-change: transform; }
.canvas { box-shadow: 0 0 50px rgba(0, 0, 0, 0.5); position: absolute; top: 0; left: 0; }
.grid-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
.selection-box { position: absolute; border: 1px dashed #409eff; background: rgba(64, 158, 255, 0.1); pointer-events: none; z-index: 1000; }
.snap-line { position: absolute; pointer-events: none; z-index: 999; }
.snap-line-h {
  left: 0; right: 0; height: 0;
  border-top: 1px dashed #f56c6c;
}
.snap-line-v {
  top: 0; bottom: 0; width: 0;
  border-left: 1px dashed #f56c6c;
}
.component { position: absolute; cursor: move; box-sizing: border-box; }
.component:hover { outline: 1px dashed rgba(64, 158, 255, 0.5); }
.component.selected { outline: 2px solid #409eff; }
.component.locked { cursor: not-allowed; }
.component.hidden { opacity: 0.3; }
.component-content { width: 100%; height: 100%; overflow: visible; display: flex; align-items: center; justify-content: center; pointer-events: auto; cursor: default; user-select: none; }
.component.dragging .component-content { pointer-events: none; }
.component.dragging { cursor: move; }
.component-placeholder { color: rgba(255, 255, 255, 0.5); font-size: 12px; text-align: center; padding: 5px; }
.resize-handles { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2; }
.handle { position: absolute; width: 12px; height: 12px; background: #409eff; border: 2px solid white; pointer-events: auto; }
.handle.top-left { top: -6px; left: -6px; cursor: nw-resize; }
.handle.top-right { top: -6px; right: -6px; cursor: ne-resize; }
.handle.bottom-left { bottom: -6px; left: -6px; cursor: sw-resize; }
.handle.bottom-right { bottom: -6px; right: -6px; cursor: se-resize; }
.handle.left { top: 50%; left: -6px; transform: translateY(-50%); cursor: w-resize; }
.handle.right { top: 50%; right: -6px; transform: translateY(-50%); cursor: e-resize; }
.handle.top { top: -6px; left: 50%; transform: translateX(-50%); cursor: n-resize; }
.handle.bottom { bottom: -6px; left: 50%; transform: translateX(-50%); cursor: s-resize; }

.scrollbar-track {
  position: absolute;
  background: rgba(255,255,255,0.06);
  z-index: 40;
}
.scrollbar-track-h {
  bottom: 0; left: 0; right: 16px; height: 10px;
  cursor: pointer;
}
.scrollbar-track-v {
  top: 0; right: 0; bottom: 16px; width: 10px;
  cursor: pointer;
}
.scrollbar-thumb {
  position: absolute;
  background: rgba(255,255,255,0.35);
  border-radius: 4px;
  transition: background 0.15s;
}
.scrollbar-thumb:hover { background: rgba(255,255,255,0.55); }
.scrollbar-thumb-h {
  top: 2px; bottom: 2px; min-width: 30px;
  cursor: grab;
}
.scrollbar-thumb-v {
  left: 2px; right: 2px; min-height: 30px;
  cursor: grab;
}
.scrollbar-thumb:active { cursor: grabbing; }

.context-menu {
  position: fixed;
  background: var(--scr-surface);
  border: 1px solid var(--scr-border);
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  min-width: 120px;
  z-index: 9999;
}
.ctx-item {
  padding: 8px 16px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  white-space: nowrap;
}
.ctx-item:hover { background: var(--scr-surface-2); color: #409eff; }
.ctx-danger { color: #f56c6c; }
.ctx-danger:hover { background: #fef0f0; color: #f56c6c; }
.ctx-divider { height: 1px; background: var(--scr-border-lighter); margin: 4px 0; }

.ctx-submenu { position: relative; }
.ctx-arrow { float: right; margin-left: 20px; font-size: 9px; color: #999; }
.ctx-submenu-panel {
  display: none;
  position: absolute;
  left: 100%;
  top: -4px;
  background: var(--scr-surface);
  border: 1px solid var(--scr-border);
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  min-width: 100px;
  z-index: 10000;
}
.ctx-submenu:hover .ctx-submenu-panel { display: block; }

.zoom-controls {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 2px;
  background: rgba(60, 60, 67, 0.85);
  border: 1px solid #555;
  border-radius: 6px;
  padding: 4px 6px;
  z-index: 50;
  backdrop-filter: blur(4px);
}

.zoom-btn {
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: #e0e0e0;
  font-size: 16px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.zoom-btn:hover { background: rgba(255,255,255,0.15); }
.zoom-btn:active { background: rgba(255,255,255,0.25); }

.zoom-label {
  font-size: 12px;
  color: #e0e0e0;
  min-width: 40px;
  text-align: center;
  user-select: none;
}

.zoom-reset { font-size: 14px; }

.zoom-divider {
  width: 1px;
  height: 18px;
  background: #666;
  margin: 0 4px;
}
</style>
