<template>
  <div v-if="builtOpt && renderMode === 'table'" class="ec-non">
    <el-table border :data="tableRows">
      <el-table-column
        v-for="col in tableCols"
        :key="col.key"
        :label="col.label"
        min-width="100"
        show-overflow-tooltip
      >
        <template #default="{ row }">{{ row[col.key] }}</template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!tableRows.length" description="暂无数据" :image-size="60" />
  </div>

  <div v-else-if="builtOpt && (renderMode === 'stat' || renderMode === 'statTrend')" class="ec-non ec-stat-tile">
    <div class="ec-stat-value">{{ fmtNumber(builtOpt._stat ? builtOpt._stat.value : builtOpt._statTrend.value) }}</div>
    <div class="ec-stat-label">{{ builtOpt._stat ? builtOpt._stat.label : builtOpt._statTrend.label }}</div>
  </div>

  <div v-else-if="builtOpt && renderMode === 'progress'" class="ec-non ec-progress-tile">
    <div class="ec-prog-value">{{ pctValue }}%</div>
    <el-progress :percentage="pctValue" :stroke-width="16" :show-text="false" style="width: 70%" />
  </div>

  <div v-else class="ec-chart" ref="el"></div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch, computed, nextTick } from 'vue'
import echarts from '@/utils/echarts'
import { OPTION_BUILDERS } from '@/config/chart-configs'
import { getPalette } from '@/config/color-palettes'
import ZRLine from 'zrender/lib/graphic/shape/Line.js'
import ZRGroup from 'zrender/lib/graphic/Group.js'

const props = defineProps({
  chartType: { type: String, required: true },
  data: { type: Object, default: null },
  options: { type: Object, default: () => ({}) },
})

const el = ref(null)
let chart = null
let resizeObserver = null
let currentOpt = null
let ulGroup = null

const geoCache = {}
const geoLoading = {}

function resolveConfig(options = {}) {
  const { typeSpecific, ...rest } = options
  return { ...rest, ...(typeSpecific || {}) }
}

const builtOpt = computed(() => {
  if (!props.data) return null
  const builder = OPTION_BUILDERS[props.chartType]
  if (!builder) return null
  const palette = props.options._palette || getPalette(props.options.colorPalette || 0, props.options.customPalette)
  try {
    return builder(props.data, resolveConfig(props.options), palette)
  } catch (e) {
    return {
      title: {
        text: `图表构建失败: ${e.message}`,
        left: 'center', top: 'middle',
        textStyle: { color: '#F56C6C', fontSize: 13 },
      },
    }
  }
})

const renderMode = computed(() => {
  const opt = builtOpt.value
  if (!opt) return 'echarts'
  if (opt._table) return 'table'
  if (opt._stat) return 'stat'
  if (opt._statTrend) return 'statTrend'
  if (opt._progress) return 'progress'
  if (opt._map) return 'map'
  return 'echarts'
})

const isEChartsType = computed(() => renderMode.value === 'echarts' || renderMode.value === 'map')

const tableCols = computed(() => {
  const d = builtOpt.value?._table
  if (!d) return []
  const cols = []
  ;(d.dimensions || []).forEach((x) => cols.push({ key: `dim:${x.field}`, label: x.label || x.field }))
  ;(d.metrics || []).forEach((m) => cols.push({ key: `metric:${m.field}`, label: m.label || m.field }))
  return cols
})

const tableRows = computed(() => builtOpt.value?._table?.rows || [])

const pctValue = computed(() => {
  const p = builtOpt.value?._progress
  if (!p) return 0
  const max = p.max > 0 ? p.max : 100
  const v = typeof p.value === 'number' ? p.value : Number(p.value) || 0
  return max > 0 ? Math.min(100, Math.round((v / max) * 100)) : 0
})

function fmtNumber(n) {
  if (n === null || n === undefined) return '-'
  if (typeof n !== 'number') return String(n)
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

function initChart() {
  if (!el.value || chart) return
  chart = echarts.init(el.value)
  chart.on('finished', buildUnderlines)
  resizeObserver = new ResizeObserver(() => {
    if (!chart) return
    chart.resize()
    nextTick(() => buildUnderlines())
  })
  resizeObserver.observe(el.value)
  render()
}

function underlineIntent(opt) {
  const tx = (o) => o && o.textDecoration === 'underline'
  if (opt.title && tx(opt.title.textStyle)) return true
  if (opt.legend && tx(opt.legend.textStyle)) return true
  const axes = [opt.xAxis, opt.yAxis]
  for (const ax of axes) {
    const arr = Array.isArray(ax) ? ax : ax ? [ax] : []
    for (const a of arr) if (a && tx(a.nameTextStyle)) return true
  }
  if (Array.isArray(opt.series)) {
    for (const s of opt.series) if (s && s.label && tx(s.label)) return true
  }
  return false
}

function underlineTargets(opt, chart) {
  const set = new Set()
  const add = (t) => { if (t != null && String(t).trim() !== '') set.add(String(t)) }

  if (opt.title && opt.title.textStyle && opt.title.textStyle.textDecoration === 'underline') {
    if (opt.title.text) add(opt.title.text)
    if (opt.title.subtext) add(opt.title.subtext)
  }
  if (opt.legend && opt.legend.textStyle && opt.legend.textStyle.textDecoration === 'underline' && Array.isArray(opt.series)) {
    opt.series.forEach((s) => add(s.name))
  }
  const axes = [opt.xAxis, opt.yAxis]
  for (const ax of axes) {
    const arr = Array.isArray(ax) ? ax : ax ? [ax] : []
    for (const a of arr) {
      if (a && a.name && a.nameTextStyle && a.nameTextStyle.textDecoration === 'underline') add(a.name)
    }
  }
  if (chart && Array.isArray(opt.series)) {
    const model = chart.getModel()
    opt.series.forEach((s, i) => {
      if (!s.label || s.label.show === false) return
      if (!s.label.textDecoration || s.label.textDecoration === 'none') return
      const sm = model.getSeriesByIndex(i)
      if (!sm || !sm.getData) return
      const n = sm.getData().count()
      for (let j = 0; j < n; j++) {
        try {
          const t = sm.getFormattedLabel(j, 'normal')
          if (t) add(t)
        } catch (e) { /* ignore */ }
      }
    })
  }
  return set
}

function buildUnderlines() {
  if (!chart || !currentOpt) return
  const zr = chart.getZr()
  if (ulGroup) {
    zr.remove(ulGroup)
    ulGroup = null
  }
  if (!underlineIntent(currentOpt)) return
  const targets = underlineTargets(currentOpt, chart)
  if (!targets.size) return
  const group = new ZRGroup()
  group.z = 1000
  group.silent = true
  const list = zr.storage.getDisplayList()
  for (const e of list) {
    if (!e || e.type !== 'tspan') continue
    const text = e.style && e.style.text
    if (text == null || !targets.has(String(text))) continue
    const fs = e.style.fontSize || 12
    const rect = e.getBoundingRect().clone()
    const m = e.getComputedTransform()
    if (!m) continue
    rect.applyTransform(m)
    const y = rect.y + rect.height + 1
    const line = new ZRLine({
      shape: { x1: rect.x, y1: y, x2: rect.x + rect.width, y2: y },
      style: {
        stroke: e.style.fill || '#333',
        lineWidth: Math.max(1, Math.round(fs / 12)),
        lineCap: 'round',
      },
      silent: true,
      z: 1000,
    })
    group.add(line)
  }
  if (!group.childCount()) return
  ulGroup = group
  zr.add(ulGroup)
  zr.refresh()
}

function darkish(c) {
  if (!c || typeof c !== 'string') return false
  const s = c.trim().toLowerCase()
  const m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/)
  if (m) {
    let hex = m[1]
    if (hex.length === 3) hex = hex.split('').map((x) => x + x).join('')
    const n = parseInt(hex, 16)
    if (!Number.isFinite(n)) return false
    return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255) < 380
  }
  const rgb = s.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/)
  if (rgb) return Number(rgb[1]) + Number(rgb[2]) + Number(rgb[3]) < 380
  return false
}

function applyTheme(opt) {
  const theme = props.options.theme || {}
  const dark = theme.mode === 'dark'
  const textColor = theme.textColor || ''
  const lightText = textColor || (dark ? '#E6E9F0' : '')
  opt.backgroundColor = theme.background || (dark ? '#16181D' : 'transparent')
  if (!dark && !textColor) return

  const setText = (obj, key) => {
    const t = obj && obj[key]
    if (!t) return
    if (textColor) t.color = textColor
    else if (dark && (t.color == null || darkish(t.color))) t.color = lightText
  }
  const setLine = (obj, key, darkVal) => {
    const t = obj && obj[key] && obj[key].lineStyle
    if (!t) return
    if (dark && (t.color == null || !darkish(t.color))) t.color = darkVal
  }

  if (opt.title) {
    setText(opt.title, 'textStyle')
    setText(opt.title, 'subtextStyle')
  }
  if (opt.legend) {
    setText(opt.legend, 'textStyle')
    if (dark && !opt.legend.pageIconColor) opt.legend.pageIconColor = lightText
  }
  if (opt.tooltip && opt.tooltip.show !== false) {
    opt.tooltip.textStyle = opt.tooltip.textStyle || {}
    setText(opt.tooltip, 'textStyle')
    if (dark) {
      opt.tooltip.backgroundColor = theme.background && !textColor
        ? theme.background
        : (opt.tooltip.backgroundColor == null || !darkish(opt.tooltip.backgroundColor) ? 'rgba(34,38,46,0.96)' : opt.tooltip.backgroundColor)
      if (opt.tooltip.borderColor == null || !darkish(opt.tooltip.borderColor)) opt.tooltip.borderColor = '#3A4048'
    }
  }
  ;[opt.xAxis, opt.yAxis, opt.angleAxis, opt.radiusAxis].forEach((ax) => {
    ;(Array.isArray(ax) ? ax : ax ? [ax] : []).forEach((a) => {
      if (!a) return
      setText(a, 'nameTextStyle')
      setText(a, 'axisLabel')
      if (dark) {
        setLine(a, 'axisLine', '#3E4450')
        setLine(a, 'axisTick', '#3E4450')
        setLine(a, 'splitLine', '#262B33')
      }
    })
  })
  if (dark) {
    const seriesList = Array.isArray(opt.series) ? opt.series : opt.series ? [opt.series] : []
    seriesList.forEach((s) => {
      if (s && s.label && s.label.color != null && darkish(s.label.color)) s.label.color = lightText
    })
  }
  if (opt.visualMap && opt.visualMap.textStyle) {
    setText(opt.visualMap, 'textStyle')
  }
  if (opt.radar && opt.radar.axisName) setText(opt.radar, 'axisName')
  return opt
}

function render() {
  if (!chart || !props.data) return
  const opt = builtOpt.value
  if (!opt) return
  if (renderMode.value === 'map') {
    currentOpt = null
    renderMap(opt._map)
    return
  }
  if (renderMode.value !== 'echarts') {
    currentOpt = null
    chart.clear()
    return
  }
  applyTheme(opt)
  currentOpt = opt
  chart.setOption(opt, true)
}

function loadGeo(type) {
  const path = type === 'world' ? '/geo/world.json' : '/geo/china.json'
  if (geoCache[type]) return Promise.resolve(geoCache[type])
  if (!geoLoading[type]) {
    const p = fetch(path)
      .then((r) => {
        if (!r.ok) throw new Error(`地图数据加载失败: ${path}`)
        return r.json()
      })
      .then((g) => { geoCache[type] = g; return g })
    geoLoading[type] = p
    p.finally(() => { if (geoLoading[type] === p) delete geoLoading[type] })
  }
  return geoLoading[type]
}

function regionCentroid(coords) {
  let cx = 0
  let cy = 0
  let n = 0
  const walk = (arr) => {
    if (typeof arr[0] === 'number') {
      cx += arr[0]
      cy += arr[1]
      n += 1
      return
    }
    arr.forEach(walk)
  }
  walk(coords)
  return n ? [cx / n, cy / n] : null
}

function renderMap(meta) {
  const { type, data, config, mode } = meta || {}
  if (!data || !el.value || !chart) return
  const dim = data.dimensions?.[0]
  const metric = data.metrics?.[0]
  if (!dim || !metric || !data.rows?.length) {
    chart.setOption({ title: { text: '请配置维度与指标', left: 'center', top: 'middle', textStyle: { color: '#909399', fontSize: 14 } } }, true)
    return
  }
  const mapName = type === 'world' ? 'chinaWorld' : 'china'
  const mapData = data.rows
    .map((r) => ({ name: String(r[`dim:${dim.field}`]?.value ?? ''), value: Number(r[metric.field]) ?? null }))
    .filter((d) => d.name && d.value !== null && Number.isFinite(d.value))
  const nums = mapData.map((d) => d.value)
  let min = nums.length ? Math.min(...nums) : 0
  let max = nums.length ? Math.max(...nums) : 1
  if (min === max) max = min + 1

  loadGeo(type).then((geo) => {
    if (!el.value || !chart) return
    echarts.registerMap(mapName, geo)
    const bubble = mode === 'bubble' || mode === 'symbol'
    const theme = props.options.theme || {}
    const dark = theme.mode === 'dark'
    const option = {
      backgroundColor: theme.background || (dark ? '#16181D' : 'transparent'),
      tooltip: config.tooltip?.show === false || config.tooltip?.trigger === 'none'
        ? { show: false }
        : {
            trigger: 'item',
            formatter: config.tooltip?.formatter
              ? undefined
              : (p) => `${p.name}<br/>${metric.label}: ${p.value ?? ''}`,
            backgroundColor: config.tooltip?.backgroundColor || undefined,
            textStyle: config.tooltip?.textStyle || undefined,
          },
      visualMap: {
        min,
        max,
        calculable: true,
        orient: 'vertical',
        right: bubble ? 60 : 10,
        top: 'center',
        text: [String(max), String(min)],
        inRange: { color: ['#E8F3FF', '#66A6FF', '#2A5AA8'] },
        ...(bubble ? { dimension: 2, seriesIndex: 0 } : {}),
      },
      geo: {
        map: mapName,
        roam: true,
        zoom: Number(config.zoom) || 1,
        left: 20,
        right: bubble ? 70 : 40,
        top: 20,
        bottom: 20,
        itemStyle: { areaColor: '#EAF4FF', borderColor: '#B9CFE8' },
        emphasis: { itemStyle: { areaColor: '#A8CCFF' }, label: { show: true, color: '#333' } },
        label: { show: !!config.showLabels, color: '#333', fontSize: 10 },
      },
    }
    if (config.title?.show !== false && config.title?.text) {
      option.title = {
        text: config.title.text,
        subtext: config.title.subtext || '',
        left: config.title.left || 'center',
        top: 0,
        textStyle: {
          fontSize: config.title.textStyle?.fontSize ?? 16,
          fontWeight: config.title.textStyle?.fontWeight === 'bold' ? 'bold' : 600,
          color: config.title.textStyle?.color || '#333',
        },
      }
    }
    if (bubble) {
      const regions = {}
      const centroids = {}
      geo.features.forEach((f) => {
        const name = f.properties?.name || f.properties?.NAME || ''
        if (name) {
          regions[name] = true
          centroids[name] = centroids[name] || regionCentroid(f.geometry.coordinates)
        }
      })
      const bubbleData = mapData
        .filter((d) => regions[d.name])
        .map((d) => {
          const c = centroids[d.name]
          return c ? { name: d.name, value: [c[0], c[1], d.value] } : null
        })
        .filter(Boolean)
      const sizes = bubbleData.map((b) => b.value[2])
      const sMin = sizes.length ? Math.min(...sizes) : 1
      const sMax = sizes.length ? Math.max(...sizes) : 1
      option.series = [{
        name: metric.label,
        type: mode === 'symbol' ? 'scatter' : 'effectScatter',
        coordinateSystem: 'geo',
        data: bubbleData,
        symbolSize: mode === 'symbol'
          ? (config.symbolSize || 8)
          : (v) => {
            const r = sMax > sMin ? (v[2] - sMin) / (sMax - sMin) : 1
            return Math.max(4, Math.round(4 + r * (Number(config.symbolSize) || 12)))
          },
        label: { show: mode === 'symbol' || !!config.showLabels, formatter: '{b}', fontSize: 10, color: '#333' },
      }]
    } else {
      option.series = [{
        name: metric.label,
        type: 'map',
        map: mapName,
        geoIndex: 0,
        data: mapData,
        label: { show: !!config.showLabels, color: '#333', fontSize: 10 },
        emphasis: { label: { show: true, color: '#333' } },
      }]
    }
    chart.setOption(option, true)
  }).catch((e) => {
    if (!chart) return
    chart.setOption({ title: { text: e.message || '地图加载失败', left: 'center', top: 'middle', textStyle: { color: '#F56C6C', fontSize: 13 } } }, true)
  })
}

async function handleChartTypeChange() {
  await nextTick()
  if (isEChartsType.value && !chart) {
    initChart()
  } else if (!isEChartsType.value && chart) {
    chart.dispose()
    chart = null
    resizeObserver && resizeObserver.disconnect()
    resizeObserver = null
  }
  render()
}

onMounted(() => {
  if (isEChartsType.value) {
    initChart()
  }
})

watch(isEChartsType, handleChartTypeChange)
watch([() => props.chartType, () => props.data, () => props.options], render, { deep: true })

onBeforeUnmount(() => {
  if (chart && ulGroup) chart.getZr().remove(ulGroup)
  ulGroup = null
  resizeObserver && resizeObserver.disconnect()
  chart && chart.dispose()
  chart = null
})
</script>

<style scoped>
.ec-chart {
  width: 100%;
  height: 100%;
  min-height: 160px;
}

.ec-non {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px;
  box-sizing: border-box;
  overflow: auto;
}

.ec-stat-tile {
  gap: 4px;
}

.ec-stat-value {
  font-size: 42px;
  font-weight: 700;
  color: var(--app-primary);
  line-height: 1.2;
}

.ec-stat-label {
  color: var(--app-text-secondary);
  font-size: 13px;
}

.ec-progress-tile {
  gap: 14px;
}

.ec-prog-value {
  font-size: 28px;
  font-weight: 600;
  color: var(--app-primary);
}
</style>