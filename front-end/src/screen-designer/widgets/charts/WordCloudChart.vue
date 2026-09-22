<!-- 词云 (wordcloud) - 自绘 Canvas 词云图（高性能：词位图预渲染 + 粗粒度碰撞网格 + RAF 防抖） -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  componentType?: string
  data: any
  style: any
  props: any
}>()

const canvasRef = ref<HTMLCanvasElement>()
let resizeObserver: ResizeObserver | null = null
let rafId = 0
let lastW = 0
let lastH = 0

const fallbackWords = [
  { text: '数据可视化', weight: 95 }, { text: '大屏设计', weight: 88 },
  { text: 'ECharts', weight: 82 }, { text: 'Vue3', weight: 78 },
  { text: 'TypeScript', weight: 75 }, { text: '图表组件', weight: 72 },
  { text: '响应式布局', weight: 68 }, { text: '数据大屏', weight: 65 },
  { text: '实时数据', weight: 60 }, { text: '交互设计', weight: 55 },
  { text: 'Canvas', weight: 50 }, { text: 'SVG', weight: 48 },
  { text: 'Pinia', weight: 45 }, { text: 'Vue Router', weight: 42 },
  { text: 'Element Plus', weight: 40 }, { text: 'Monaco Editor', weight: 38 },
  { text: 'Three.js', weight: 35 }, { text: 'HTML5', weight: 90 },
  { text: 'CSS3', weight: 85 }, { text: 'JavaScript', weight: 92 }
]

const themeColors = ['#58d9f9', '#7cffb2', '#fd666d', '#ffd666', '#66a6ff', '#b28dff', '#4bd67f', '#ff8fc2']

interface WordItem { text: string; weight: number; color?: string }

function getWords(): WordItem[] {
  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      const raw = parsed.series || parsed.words
      if (Array.isArray(raw)) {
        return raw.map((w: any) => ({
          text: String(w.name ?? w.text ?? ''),
          weight: Number(w.value ?? w.weight ?? 10),
          color: w.color
        })).filter(w => w.text && w.weight > 0)
      }
    } catch {}
  }
  return [...fallbackWords]
}

interface Bitmap {
  canvas: HTMLCanvasElement
  bits: Uint8Array
  cellW: number
  cellH: number
  w: number
  h: number
  offX: number
  offY: number
}

const FONT = '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif'

function buildBitmap(text: string, font: string, color: string, rotation: number, pad: number): Bitmap {
  const tmp = document.createElement('canvas')
  const tctx = tmp.getContext('2d')!
  tctx.font = font
  const tw = Math.ceil(tctx.measureText(text).width)
  const th = Math.ceil(Number(font.match(/(\d+)px/)?.[1] || 20) * 1.2)

  const cos = Math.abs(Math.cos(rotation))
  const sin = Math.abs(Math.sin(rotation))
  const boxW = Math.ceil(tw * cos + th * sin) + pad * 2
  const boxH = Math.ceil(tw * sin + th * cos) + pad * 2

  tmp.width = Math.max(1, boxW)
  tmp.height = Math.max(1, boxH)
  tctx.font = font
  tctx.textBaseline = 'middle'
  tctx.fillStyle = color
  tctx.translate(boxW / 2, boxH / 2)
  tctx.rotate(rotation)
  tctx.fillText(text, -tw / 2, 0)

  const img = tctx.getImageData(0, 0, boxW, boxH)
  const CELL = 3
  const cellW = Math.max(1, Math.ceil(boxW / CELL))
  const cellH = Math.max(1, Math.ceil(boxH / CELL))
  const bits = new Uint8Array(cellW * cellH)
  for (let py = 0; py < boxH; py++) {
    for (let px = 0; px < boxW; px++) {
      if (img.data[(py * boxW + px) * 4 + 3] > 0) {
        bits[Math.floor(py / CELL) * cellW + Math.floor(px / CELL)] = 1
      }
    }
  }

  return { canvas: tmp, bits, cellW, cellH, w: boxW, h: boxH, offX: Math.floor(boxW / 2), offY: Math.floor(boxH / 2) }
}

interface Placed { bm: Bitmap; x: number; y: number }

// 在独立的“簇坐标空间”内用黄金角螺旋做碰撞安置（不依赖画布尺寸），
// 最后统一居中并缩放填充画布，保证词云始终居中、完整显示且不被丢弃/截断。
function placeCluster(bitmaps: Bitmap[]): Placed[] {
  const CELL = 3
  const GR = 2.399963229728653
  const occupied = new Set<number>()
  const key = (cx: number, cy: number) => cy * 200000 + cx

  const placed: Placed[] = []

  // 预估簇的规模，决定螺旋搜索半径与尝试次数上限
  const totalArea = bitmaps.reduce((s, b) => s + b.w * b.h, 0)
  const estR = Math.sqrt(totalArea) * 1.4 + 40
  const maxAttempts = Math.min(60000, Math.round(estR * estR))

  const canPlace = (bm: Bitmap, px: number, py: number): boolean => {
    const x0 = Math.floor(px / CELL)
    const y0 = Math.floor(py / CELL)
    if (x0 < -100000 || y0 < -100000) return false
    for (let cy = 0; cy < bm.cellH; cy++) {
      const iy = y0 + cy
      for (let cx = 0; cx < bm.cellW; cx++) {
        const ix = x0 + cx
        if (bm.bits[cy * bm.cellW + cx] && occupied.has(key(ix, iy))) return false
      }
    }
    return true
  }

  const occupy = (bm: Bitmap, px: number, py: number) => {
    const x0 = Math.floor(px / CELL)
    const y0 = Math.floor(py / CELL)
    for (let cy = 0; cy < bm.cellH; cy++) {
      const iy = y0 + cy
      for (let cx = 0; cx < bm.cellW; cx++) {
        const ix = x0 + cx
        if (bm.bits[cy * bm.cellW + cx]) occupied.add(key(ix, iy))
      }
    }
  }

  for (let bi = 0; bi < bitmaps.length; bi++) {
    const bm = bitmaps[bi]
    let done = false
    if (bi === 0) {
      // 首个(最大的)词居中放置
      const px = -Math.floor(bm.w / 2)
      const py = -Math.floor(bm.h / 2)
      if (canPlace(bm, px, py)) {
        occupy(bm, px, py)
        placed.push({ bm, x: px, y: py })
        done = true
      }
    }
    if (!done) {
      for (let i = 1; i < maxAttempts; i++) {
        const r = Math.sqrt(i) * 3.2
        const a = GR * i
        if (r > estR) break
        const px = Math.round(r * Math.cos(a)) - Math.floor(bm.w / 2)
        const py = Math.round(r * Math.sin(a)) - Math.floor(bm.h / 2)
        if (canPlace(bm, px, py)) {
          occupy(bm, px, py)
          placed.push({ bm, x: px, y: py })
          break
        }
      }
    }
  }

  return placed
}

function drawWordCloud(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const p = props.props || {}
  const words = getWords()
  const cw = canvas.width
  const ch = canvas.height

  ctx.clearRect(0, 0, cw, ch)
  if (!words.length) return

  const maxW = Math.max(...words.map(w => w.weight))
  const minW = Math.min(...words.map(w => w.weight))
  const span = Math.max(1, maxW - minW)

  // 字号基准随画布大小缩放，保证词云始终饱满填充
  const baseSize = Math.max(12, Math.round(Math.min(cw, ch) / 6.5))
  const sizeRange = p.sizeRange && p.sizeRange.length >= 2 ? p.sizeRange : [Math.round(baseSize * 0.32), baseSize]
  const minSize = sizeRange[0] ?? Math.round(baseSize * 0.32)
  const maxSize = sizeRange[1] ?? baseSize
  const pad = Math.round(baseSize / 18)

  const colors = (p.colors && p.colors.length ? p.colors : themeColors)
  const rotations = [-0.5, 0, 0.5, 0]

  const sorted = [...words].sort((a, b) => b.weight - a.weight)

  const bitmaps: Bitmap[] = sorted.map((word, idx) => {
    const fontSize = Math.round(minSize + (span === 0 ? 0 : (word.weight - minW) / span) * (maxSize - minSize))
    const color = word.color || colors[idx % colors.length]
    const font = `bold ${fontSize}px ${FONT}`
    return buildBitmap(word.text, font, color, rotations[idx % rotations.length], pad)
  })

  const placed = placeCluster(bitmaps)
  if (!placed.length) return

  // 计算已放置词云的包围盒
  let minL = Infinity, minT = Infinity, maxR2 = -Infinity, maxB = -Infinity
  for (const pl of placed) {
    minL = Math.min(minL, pl.x)
    minT = Math.min(minT, pl.y)
    maxR2 = Math.max(maxR2, pl.x + pl.bm.w)
    maxB = Math.max(maxB, pl.y + pl.bm.h)
  }
  const bw = maxR2 - minL
  const bh = maxB - minT

  // 整体缩放填充画布(保留一点边距)，缩放范围受限避免过大/过小
  let scale = Math.min(cw / bw, ch / bh) * 0.92
  scale = Math.max(0.25, Math.min(scale, 2))

  const scaledW = bw * scale
  const scaledH = bh * scale
  const offX = (cw - scaledW) / 2 - minL * scale
  const offY = (ch - scaledH) / 2 - minT * scale

  ctx.save()
  for (const pl of placed) {
    const x = pl.x * scale + offX
    const y = pl.y * scale + offY
    const dw = Math.max(1, Math.round(pl.bm.w * scale))
    const dh = Math.max(1, Math.round(pl.bm.h * scale))
    ctx.drawImage(pl.bm.canvas, Math.round(x), Math.round(y), dw, dh)
  }
  ctx.restore()
}

function render() {
  const canvas = canvasRef.value
  if (!canvas) return
  // 用 offsetWidth/offsetHeight 取组件逻辑尺寸(不受父级 scale 变换干扰)
  const el = canvas.parentElement as HTMLElement | null
  const w = el?.offsetWidth || canvas.width || 100
  const h = el?.offsetHeight || canvas.height || 100
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.max(1, Math.round(w * dpr))
  canvas.height = Math.max(1, Math.round(h * dpr))
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
  drawWordCloud(canvas)
}

function scheduleRender() {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    const canvas = canvasRef.value
    if (!canvas) return
    const rect = canvas.parentElement?.getBoundingClientRect()
    const w = Math.round(rect?.width || 0)
    const h = Math.round(rect?.height || 0)
    if (w !== lastW || h !== lastH) {
      lastW = w
      lastH = h
      render()
    }
  })
}

const init = () => {
  render()
  if (!resizeObserver) {
    resizeObserver = new ResizeObserver(scheduleRender)
  }
  if (canvasRef.value?.parentElement) {
    resizeObserver.observe(canvasRef.value.parentElement)
  }
}

onMounted(() => setTimeout(init, 100))
watch(() => [props.data, props.props], init, { deep: true })
onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
  resizeObserver?.disconnect()
})
</script>
<template>
  <div style="width:100%;height:100%;position:relative;overflow:hidden">
    <canvas ref="canvasRef" style="display:block;width:100%;height:100%"></canvas>
  </div>
</template>
