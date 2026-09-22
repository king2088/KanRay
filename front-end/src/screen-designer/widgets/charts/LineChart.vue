<!-- 折线图组件 - 包含单线/多线/面积/平滑等类型 -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'
import { defaultColors, getCommonTitle, getCommonLegend, getCommonGrid, getCommonTooltip, getCommonXAxis, getCommonYAxis, getCommonDataZoom, getSeriesLabel } from './chartUtils'

const props = defineProps<{
  componentType?: string
  data: any
  style: any
  props: any
}>()

const chartRef = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null
let resizeObserver: ResizeObserver | null = null

const getSymbolSize = (category: string) => {
  const map: Record<string, number> = { small: 4, medium: 6, large: 10 }
  return map[category] || 6
}

const getChartOption = () => {
  const p = props.props || {}
  const colors = p.colors || defaultColors
  const type = props.componentType || 'line-single'

  let categoryData = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  let series: any[] = []

  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.xAxis) categoryData = parsed.xAxis
      if (parsed.series) {
        series = parsed.series.map((s: any) => ({
          name: s.name || '系列',
          type: 'line',
          data: s.data || s,
          smooth: p.smooth === true,
          lineStyle: {
            width: p.lineWidth || 2,
            type: p.lineStyle || 'solid'
          },
          areaStyle: type === 'line-area' || type === 'stacked-area' ? { opacity: 0.3 } : undefined,
          symbol: p.symbolShow !== false ? (p.symbolType || 'circle') : 'none',
          symbolSize: getSymbolSize(p.symbolSizeCategory),
          label: getSeriesLabel(p)
        }))
      }
    } catch {}
  }

  if (series.length === 0) {
    if (type === 'line-multi') {
      series = [
        { name: '系列一', type: 'line', data: [150, 230, 224, 218, 135, 147, 260] },
        { name: '系列二', type: 'line', data: [80, 150, 124, 168, 95, 107, 180] },
        { name: '系列三', type: 'line', data: [200, 180, 264, 198, 175, 207, 300] }
      ]
    } else if (type === 'line-area') {
      series = [
        { name: '系列一', type: 'line', data: [150, 230, 224, 218, 135, 147, 260], areaStyle: { opacity: 0.3 } },
        { name: '系列二', type: 'line', data: [80, 150, 124, 168, 95, 107, 180], areaStyle: { opacity: 0.3 } }
      ]
    } else {
      series = [{ name: '系列一', type: 'line', data: [150, 230, 224, 218, 135, 147, 260] }]
    }
    series.forEach(s => {
      s.smooth = p.smooth === true
      s.lineStyle = { width: p.lineWidth || 2, type: p.lineStyle || 'solid' }
      s.symbol = p.symbolShow !== false ? (p.symbolType || 'circle') : 'none'
      s.symbolSize = getSymbolSize(p.symbolSizeCategory)
      s.label = getSeriesLabel(p)
    })
  }

  const xAxis: any = getCommonXAxis(p)
  xAxis.data = categoryData
  xAxis.boundaryGap = type !== 'line-area'

  return {
    color: colors,
    title: getCommonTitle(p),
    legend: getCommonLegend(p),
    grid: getCommonGrid(p),
    tooltip: getCommonTooltip(p),
    xAxis,
    yAxis: getCommonYAxis(p),
    dataZoom: getCommonDataZoom(p),
    series,
    animation: p.animation !== false,
    animationDuration: p.animationDuration || 1000,
    animationEasing: p.animationEasing || 'cubicOut'
  }
}

const initChart = () => {
  if (!chartRef.value) return
  chart = echarts.init(chartRef.value, undefined, { renderer: props.props?.renderer || 'svg' })
  chart.setOption(getChartOption())
  resizeObserver = new ResizeObserver(() => chart?.resize())
  resizeObserver.observe(chartRef.value)
}

onMounted(() => setTimeout(initChart, 100))
watch(() => [props.data, props.props], () => chart?.setOption(getChartOption(), true), { deep: true })
onUnmounted(() => { resizeObserver?.disconnect(); chart?.dispose() })
</script>
<template><div ref="chartRef" style="width:100%;height:100%"></div></template>
