/**
 * Generate a canvas-based thumbnail for a template.
 * Returns a data URL (JPEG) that can be used as an image src.
 */
export function generateTemplateThumbnail(template: {
  config: { width: number; height: number; background: string }
  components: any[]
}): string {
  const canvas = document.createElement('canvas')
  const W = 320
  const H = 180
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  if (!ctx) return ''

  const scaleX = W / template.config.width
  const scaleY = H / template.config.height

  // Draw background
  drawBackground(ctx, template.config.background, W, H)

  // Sort components by zIndex then by type priority
  const typePriority: Record<string, number> = {
    'deco-scan': 0, 'deco-glow': 0, 'deco-corner': 1, 'deco-line': 1,
    'border-1': 2, 'border-2': 2, 'border-3': 2, 'border-4': 2, 'border-5': 2,
    'border-6': 2, 'border-7': 2, 'border-8': 2, 'border-9': 2, 'border-10': 2,
    'border-11': 2, 'border-12': 2, 'border-13': 2, 'border-tech': 2,
    'static-text': 3, 'number-flip': 4,
    'bar-single': 5, 'bar-horizontal': 5, 'line-smooth': 5, 'line-step': 5,
    'area-stack': 5, 'pie-doughnut': 5, 'pie-rose': 5, 'radar': 5,
    'gauge-ring': 6, 'gauge-solid': 6, 'funnel': 5, 'sankey': 5,
    'scatter': 5, 'heatmap': 5, 'rank-list': 5, 'water-ball': 5,
    'map-china': 7, 'map-bubble': 7, 'calendar': 5,
    'custom-chart': 5, 'static-image': 3
  }

  const sorted = [...template.components].sort((a, b) => {
    const pa = typePriority[a.type] ?? 3
    const pb = typePriority[b.type] ?? 3
    return pa - pb
  })

  for (const comp of sorted) {
    const x = (comp.x || 0) * scaleX
    const y = (comp.y || 0) * scaleY
    const w = (comp.width || 100) * scaleX
    const h = (comp.height || 50) * scaleY
    const type = comp.type || ''

    if (type.startsWith('deco-scan')) {
      // Scan line overlay
      ctx.fillStyle = 'rgba(0, 200, 255, 0.03)'
      for (let i = 0; i < H; i += 4) {
        ctx.fillRect(0, i, W, 1)
      }
      continue
    }
    if (type.startsWith('deco-glow')) {
      const grd = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, w)
      grd.addColorStop(0, 'rgba(100, 200, 255, 0.25)')
      grd.addColorStop(1, 'rgba(100, 200, 255, 0)')
      ctx.fillStyle = grd
      ctx.fillRect(x, y, w, h)
      continue
    }
    if (type.startsWith('deco-corner')) {
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.5)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, y + h * 0.6)
      ctx.lineTo(x, y)
      ctx.lineTo(x + w * 0.6, y)
      ctx.stroke()
      continue
    }
    if (type.startsWith('deco-line')) {
      ctx.fillStyle = 'rgba(0, 200, 255, 0.4)'
      ctx.fillRect(x, y, w, Math.max(1, h))
      continue
    }

    // Border frames
    if (type.startsWith('border')) {
      ctx.strokeStyle = 'rgba(0, 180, 255, 0.4)'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1))
      // Subtle fill
      ctx.fillStyle = 'rgba(0, 20, 60, 0.3)'
      ctx.fillRect(x, y, w, h)
      continue
    }

    // Text
    if (type === 'static-text') {
      const content = comp.props?.content || ''
      if (content) {
        ctx.fillStyle = comp.props?.color || 'rgba(255,255,255,0.8)'
        const fontSize = Math.max(6, Math.min(12, (comp.props?.fontSize || 14) * scaleX * 1.5))
        ctx.font = `${comp.props?.fontWeight || 'normal'} ${fontSize}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(content.substring(0, 12), x + w / 2, y + h / 2)
      }
      continue
    }

    // Number flip
    if (type === 'number-flip') {
      ctx.fillStyle = comp.props?.color || '#00e5ff'
      const fontSize = Math.max(8, Math.min(14, (comp.props?.fontSize || 36) * scaleX * 1.5))
      ctx.font = `bold ${fontSize}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const val = comp.props?.value ?? 0
      const suffix = comp.props?.suffix || ''
      ctx.fillText(`${val}${suffix}`, x + w / 2, y + h / 2)
      continue
    }

    // Charts
    if (type.startsWith('bar')) {
      drawBarChart(ctx, x, y, w, h)
      continue
    }
    if (type.startsWith('line')) {
      drawLineChart(ctx, x, y, w, h)
      continue
    }
    if (type === 'area-stack') {
      drawAreaChart(ctx, x, y, w, h)
      continue
    }
    if (type.startsWith('pie')) {
      drawPieChart(ctx, x, y, w, h)
      continue
    }
    if (type === 'radar') {
      drawRadarChart(ctx, x, y, w, h)
      continue
    }
    if (type.startsWith('gauge')) {
      drawGaugeChart(ctx, x, y, w, h)
      continue
    }
    if (type === 'funnel') {
      drawFunnelChart(ctx, x, y, w, h)
      continue
    }
    if (type === 'sankey') {
      drawSankeyChart(ctx, x, y, w, h)
      continue
    }
    if (type.startsWith('map')) {
      drawMapPlaceholder(ctx, x, y, w, h)
      continue
    }
    if (type === 'water-ball') {
      drawWaterBall(ctx, x, y, w, h)
      continue
    }
    if (type === 'rank-list') {
      drawRankList(ctx, x, y, w, h)
      continue
    }
    if (type === 'scatter') {
      drawScatterChart(ctx, x, y, w, h)
      continue
    }
    if (type === 'heatmap') {
      drawHeatmap(ctx, x, y, w, h)
      continue
    }
    if (type === 'calendar') {
      drawCalendar(ctx, x, y, w, h)
      continue
    }
    if (type === 'custom-chart') {
      ctx.fillStyle = 'rgba(0, 20, 60, 0.4)'
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = 'rgba(0, 180, 255, 0.3)'
      ctx.lineWidth = 1
      ctx.strokeRect(x, y, w, h)
      continue
    }

    // Default: subtle box
    ctx.fillStyle = 'rgba(0, 30, 80, 0.2)'
    ctx.fillRect(x, y, w, h)
  }

  return canvas.toDataURL('image/jpeg', 0.7)
}

function drawBackground(ctx: CanvasRenderingContext2D, bg: string, w: number, h: number) {
  if (bg.includes('radial-gradient') || bg.includes('linear-gradient')) {
    // Parse gradient colors
    const colors = extractGradientColors(bg)
    if (colors.length >= 2) {
      const grd = ctx.createLinearGradient(0, 0, 0, h)
      colors.forEach((c, i) => grd.addColorStop(i / (colors.length - 1), c))
      ctx.fillStyle = grd
    } else {
      ctx.fillStyle = colors[0] || '#0a0e1a'
    }
  } else if (bg.startsWith('#')) {
    ctx.fillStyle = bg
  } else {
    ctx.fillStyle = '#0a0e1a'
  }
  ctx.fillRect(0, 0, w, h)
}

function extractGradientColors(gradient: string): string[] {
  const colorRegex = /#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/g
  const matches = gradient.match(colorRegex) || []
  return matches.length > 0 ? matches : ['#0a0e1a', '#0d2847']
}

function drawBarChart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(0, 20, 60, 0.3)'
  ctx.fillRect(x, y, w, h)
  const barColors = ['rgba(0, 180, 255, 0.7)', 'rgba(0, 230, 117, 0.7)', 'rgba(255, 193, 7, 0.7)', 'rgba(255, 82, 82, 0.7)', 'rgba(171, 71, 188, 0.7)']
  const barCount = 6
  const gap = w * 0.08
  const barW = (w - gap * (barCount + 1)) / barCount
  for (let i = 0; i < barCount; i++) {
    const barH = h * (0.3 + Math.random() * 0.5)
    const bx = x + gap + i * (barW + gap)
    const by = y + h - barH
    ctx.fillStyle = barColors[i % barColors.length]
    ctx.fillRect(bx, by, barW, barH)
  }
}

function drawLineChart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(0, 20, 60, 0.3)'
  ctx.fillRect(x, y, w, h)
  const padding = 8
  const points = 8
  const lineW = w - padding * 2
  const lineH = h - padding * 2

  // Draw line
  ctx.strokeStyle = 'rgba(0, 180, 255, 0.8)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (let i = 0; i < points; i++) {
    const px = x + padding + (i / (points - 1)) * lineW
    const py = y + padding + Math.random() * lineH
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()

  // Area fill
  ctx.lineTo(x + padding + lineW, y + padding + lineH)
  ctx.lineTo(x + padding, y + padding + lineH)
  ctx.closePath()
  ctx.fillStyle = 'rgba(0, 180, 255, 0.1)'
  ctx.fill()
}

function drawAreaChart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(0, 20, 60, 0.3)'
  ctx.fillRect(x, y, w, h)
  const padding = 8
  const points = 10
  const lineW = w - padding * 2
  const lineH = h - padding * 2
  const colors = ['rgba(0, 180, 255, 0.5)', 'rgba(0, 230, 117, 0.4)']
  colors.forEach((color, ci) => {
    ctx.beginPath()
    for (let i = 0; i < points; i++) {
      const px = x + padding + (i / (points - 1)) * lineW
      const py = y + padding + (0.2 + ci * 0.15 + Math.random() * 0.4) * lineH
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.lineTo(x + padding + lineW, y + padding + lineH)
    ctx.lineTo(x + padding, y + padding + lineH)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
  })
}

function drawPieChart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(0, 20, 60, 0.3)'
  ctx.fillRect(x, y, w, h)
  const cx = x + w / 2
  const cy = y + h / 2
  const r = Math.min(w, h) * 0.35
  const colors = ['rgba(0, 180, 255, 0.8)', 'rgba(0, 230, 117, 0.8)', 'rgba(255, 193, 7, 0.8)', 'rgba(255, 82, 82, 0.8)', 'rgba(171, 71, 188, 0.8)']
  const slices = [0.3, 0.25, 0.2, 0.15, 0.1]
  let startAngle = -Math.PI / 2
  slices.forEach((slice, i) => {
    const endAngle = startAngle + slice * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, r, startAngle, endAngle)
    ctx.closePath()
    ctx.fillStyle = colors[i % colors.length]
    ctx.fill()
    startAngle = endAngle
  })
  // Inner circle for doughnut
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(10, 14, 26, 0.8)'
  ctx.fill()
}

function drawRadarChart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(0, 20, 60, 0.3)'
  ctx.fillRect(x, y, w, h)
  const cx = x + w / 2
  const cy = y + h / 2
  const r = Math.min(w, h) * 0.35
  const sides = 6
  // Grid
  for (let level = 1; level <= 3; level++) {
    ctx.beginPath()
    for (let i = 0; i <= sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2
      const px = cx + Math.cos(angle) * r * (level / 3)
      const py = cy + Math.sin(angle) * r * (level / 3)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.strokeStyle = 'rgba(0, 180, 255, 0.15)'
    ctx.lineWidth = 0.5
    ctx.stroke()
  }
  // Data polygon
  ctx.beginPath()
  for (let i = 0; i <= sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2
    const val = 0.4 + Math.random() * 0.5
    const px = cx + Math.cos(angle) * r * val
    const py = cy + Math.sin(angle) * r * val
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.fillStyle = 'rgba(0, 180, 255, 0.25)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(0, 180, 255, 0.7)'
  ctx.lineWidth = 1.5
  ctx.stroke()
}

function drawGaugeChart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(0, 20, 60, 0.3)'
  ctx.fillRect(x, y, w, h)
  const cx = x + w / 2
  const cy = y + h * 0.6
  const r = Math.min(w, h) * 0.35
  // Background arc
  ctx.beginPath()
  ctx.arc(cx, cy, r, Math.PI, 0)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.lineWidth = 6
  ctx.stroke()
  // Value arc
  const val = 0.4 + Math.random() * 0.4
  ctx.beginPath()
  ctx.arc(cx, cy, r, Math.PI, Math.PI + val * Math.PI)
  ctx.strokeStyle = 'rgba(255, 200, 50, 0.8)'
  ctx.lineWidth = 6
  ctx.stroke()
}

function drawFunnelChart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(0, 20, 60, 0.3)'
  ctx.fillRect(x, y, w, h)
  const colors = ['rgba(0, 180, 255, 0.7)', 'rgba(0, 230, 117, 0.7)', 'rgba(255, 193, 7, 0.7)', 'rgba(255, 82, 82, 0.7)']
  const levels = 4
  const levelH = h / levels
  for (let i = 0; i < levels; i++) {
    const topW = w * (1 - i * 0.15)
    const botW = w * (1 - (i + 1) * 0.15)
    const topX = x + (w - topW) / 2
    const botX = x + (w - botW) / 2
    ctx.beginPath()
    ctx.moveTo(topX, y + i * levelH)
    ctx.lineTo(topX + topW, y + i * levelH)
    ctx.lineTo(botX + botW, y + (i + 1) * levelH)
    ctx.lineTo(botX, y + (i + 1) * levelH)
    ctx.closePath()
    ctx.fillStyle = colors[i % colors.length]
    ctx.fill()
  }
}

function drawSankeyChart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(0, 20, 60, 0.3)'
  ctx.fillRect(x, y, w, h)
  // Simple nodes and links
  const nodeW = 6
  const nodes = [
    { x: x + 10, y: y + h * 0.1, h: h * 0.3 },
    { x: x + 10, y: y + h * 0.5, h: h * 0.2 },
    { x: x + 10, y: y + h * 0.75, h: h * 0.15 },
    { x: x + w - 16, y: y + h * 0.15, h: h * 0.25 },
    { x: x + w - 16, y: y + h * 0.5, h: h * 0.35 },
  ]
  const colors = ['rgba(0, 180, 255, 0.6)', 'rgba(0, 230, 117, 0.6)', 'rgba(255, 193, 7, 0.6)', 'rgba(255, 82, 82, 0.6)', 'rgba(171, 71, 188, 0.6)']
  nodes.forEach((n, i) => {
    ctx.fillStyle = colors[i % colors.length]
    ctx.fillRect(n.x, n.y, nodeW, n.h)
    ctx.fillRect(n.x + w - 26, y + h * (0.1 + i * 0.18), nodeW, h * 0.12)
  })
  // Links
  ctx.strokeStyle = 'rgba(0, 180, 255, 0.15)'
  ctx.lineWidth = 2
  for (let i = 0; i < 3; i++) {
    for (let j = 3; j < 5; j++) {
      ctx.beginPath()
      const sx = nodes[i].x + nodeW
      const sy = nodes[i].y + nodes[i].h / 2
      const ex = nodes[j].x
      const ey = y + h * (0.1 + j * 0.18) + h * 0.06
      ctx.moveTo(sx, sy)
      ctx.bezierCurveTo(sx + w * 0.3, sy, ex - w * 0.3, ey, ex, ey)
      ctx.stroke()
    }
  }
}

function drawMapPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(0, 30, 80, 0.4)'
  ctx.fillRect(x, y, w, h)
  // China map silhouette hint
  ctx.strokeStyle = 'rgba(0, 180, 255, 0.4)'
  ctx.lineWidth = 1
  const cx = x + w / 2
  const cy = y + h / 2
  const r = Math.min(w, h) * 0.35
  ctx.beginPath()
  ctx.ellipse(cx, cy, r, r * 0.7, 0, 0, Math.PI * 2)
  ctx.stroke()
  // Dots
  ctx.fillStyle = 'rgba(0, 230, 255, 0.5)'
  for (let i = 0; i < 8; i++) {
    const dx = cx + (Math.random() - 0.5) * r * 1.5
    const dy = cy + (Math.random() - 0.5) * r
    ctx.beginPath()
    ctx.arc(dx, dy, 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawWaterBall(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(0, 20, 60, 0.3)'
  ctx.fillRect(x, y, w, h)
  const cx = x + w / 2
  const cy = y + h / 2
  const r = Math.min(w, h) * 0.35
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(0, 180, 255, 0.5)'
  ctx.lineWidth = 2
  ctx.stroke()
  // Water level
  const waterY = cy + r * 0.3
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI)
  ctx.lineTo(cx + r, waterY)
  for (let i = 0; i <= 20; i++) {
    const wx = cx + r - (i / 20) * r * 2
    const wy = waterY + Math.sin(i * 0.8) * 3
    ctx.lineTo(wx, wy)
  }
  ctx.closePath()
  ctx.fillStyle = 'rgba(0, 180, 255, 0.4)'
  ctx.fill()
}

function drawRankList(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(0, 20, 60, 0.3)'
  ctx.fillRect(x, y, w, h)
  const rows = 5
  const rowH = h / rows
  const colors = ['#ffc107', '#c0c4cc', '#cd7f32']
  for (let i = 0; i < rows; i++) {
    const ry = y + i * rowH
    // Rank number
    ctx.fillStyle = i < 3 ? colors[i] : 'rgba(255,255,255,0.4)'
    ctx.font = 'bold 7px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`${i + 1}`, x + 6, ry + rowH * 0.6)
    // Bar
    const barW = w * (0.3 + Math.random() * 0.5)
    ctx.fillStyle = i < 3 ? 'rgba(0, 180, 255, 0.5)' : 'rgba(0, 180, 255, 0.25)'
    ctx.fillRect(x + 20, ry + rowH * 0.25, barW, rowH * 0.5)
  }
}

function drawScatterChart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(0, 20, 60, 0.3)'
  ctx.fillRect(x, y, w, h)
  const colors = ['rgba(0, 180, 255, 0.6)', 'rgba(0, 230, 117, 0.6)', 'rgba(255, 193, 7, 0.6)']
  for (let i = 0; i < 20; i++) {
    const px = x + 10 + Math.random() * (w - 20)
    const py = y + 10 + Math.random() * (h - 20)
    ctx.beginPath()
    ctx.arc(px, py, 2 + Math.random() * 3, 0, Math.PI * 2)
    ctx.fillStyle = colors[i % colors.length]
    ctx.fill()
  }
}

function drawHeatmap(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(0, 20, 60, 0.3)'
  ctx.fillRect(x, y, w, h)
  const cols = 7
  const rows = 5
  const cellW = (w - 10) / cols
  const cellH = (h - 10) / rows
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const val = Math.random()
      const alpha = 0.1 + val * 0.6
      ctx.fillStyle = `rgba(255, ${Math.floor(100 - val * 100)}, ${Math.floor(50 + val * 50)}, ${alpha})`
      ctx.fillRect(x + 5 + c * cellW, y + 5 + r * cellH, cellW - 2, cellH - 2)
    }
  }
}

function drawCalendar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(0, 20, 60, 0.3)'
  ctx.fillRect(x, y, w, h)
  const cols = 7
  const rows = 5
  const cellW = (w - 10) / cols
  const cellH = (h - 15) / rows
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const val = Math.random()
      ctx.fillStyle = val > 0.7 ? 'rgba(0, 180, 255, 0.5)' : 'rgba(255, 255, 255, 0.08)'
      ctx.fillRect(x + 5 + c * cellW, y + 12 + r * cellH, cellW - 2, cellH - 2)
    }
  }
}
