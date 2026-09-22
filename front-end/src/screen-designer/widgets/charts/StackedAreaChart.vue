<!-- 堆叠面积图 (stacked-area) - 多系列堆叠面积图 -->
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

const getChartOption = () => {
  const p = props.props || {}
  const colors = p.colors || defaultColors

  const getSymbolSize = (category: string) => {
    const map: Record<string, number> = { small: 4, medium: 6, large: 10 }
    return map[category] || 6
  }

  let categoryData = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  let seriesList = [
    { name: '邮件营销', data: [120, 132, 101, 134, 90, 230, 210] },
    { name: '联盟广告', data: [220, 182, 191, 234, 290, 330, 310] },
    { name: '视频广告', data: [150, 232, 201, 154, 190, 330, 410] },
    { name: '直接访问', data: [320, 332, 301, 334, 390, 330, 320] },
    { name: '搜索引擎', data: [820, 932, 901, 934, 1290, 1330, 1320] }
  ]

  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.xAxis) categoryData = parsed.xAxis
      if (parsed.series) seriesList = parsed.series
    } catch {}
  }

  const xAxis: any = getCommonXAxis(p)
  xAxis.data = categoryData
  xAxis.boundaryGap = false

  return {
    color: colors,
    title: getCommonTitle(p),
    legend: getCommonLegend(p),
    grid: getCommonGrid(p),
    tooltip: getCommonTooltip(p),
    xAxis,
    yAxis: getCommonYAxis(p),
    dataZoom: getCommonDataZoom(p),
    series: seriesList.map((s: any) => ({
      name: s.name,
      type: 'line',
      stack: 'total',
      areaStyle: p.areaStyle === false ? undefined : {},
      smooth: p.smooth === true,
      data: s.data,
      lineStyle: { width: p.lineWidth || 2, type: p.lineStyle || 'solid' },
      symbol: p.symbolShow !== false ? (p.symbolType || 'circle') : 'none',
      symbolSize: getSymbolSize(p.symbolSizeCategory),
      label: getSeriesLabel(p)
    }))
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
