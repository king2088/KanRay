<!-- 堆积柱形图 (bar-stack / bar-group-stacked / bar-percent) - 垂直堆叠柱状图 -->
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
  const type = props.componentType || 'bar-stack'

  let categories = ['邮件', '联盟', '视频', '直接', '搜索引擎']
  let seriesData = [
    [120, 132, 101, 134, 90],
    [220, 182, 191, 234, 290],
    [150, 232, 201, 154, 190]
  ]
  let seriesNames = ['周一', '周二', '周三']

  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.categories) categories = parsed.categories
      if (parsed.series) seriesData = parsed.series
      if (parsed.names) seriesNames = parsed.names
      if (parsed.xAxis) categories = parsed.xAxis
    } catch {}
  }

  const grid = getCommonGrid(p)

  const isPercent = type === 'bar-percent'
  const isGroupStacked = type === 'bar-group-stacked'

  const series = seriesData.map((dataGroup: any, gi: number) => {
    const rawArr = Array.isArray(dataGroup) ? dataGroup : dataGroup.data
    let data = rawArr || []
    if (isPercent) {
      const total = data.reduce((s: number, v: number) => s + (Number(v) || 0), 0)
      data = data.map((v: number) => total ? Math.round((Number(v) / total) * 100) : 0)
    }
    return {
      name: seriesNames[gi] || `系列${gi + 1}`,
      type: 'bar',
      stack: isGroupStacked ? `g${Math.floor(gi / 2)}` : 'total',
      barWidth: p.barWidth || null,
      barMaxWidth: 30,
      data,
      itemStyle: { borderRadius: p.barBorderRadius ?? 0, color: colors[gi % colors.length] },
      label: {
        ...getSeriesLabel(p),
        formatter: isPercent ? (params: any) => params.value + '%' : undefined
      },
      emphasis: { focus: 'series' }
    }
  })

  const xAxis: any = getCommonXAxis(p)
  xAxis.data = categories

  return {
    color: colors,
    title: getCommonTitle(p),
    legend: {
      ...getCommonLegend(p),
      data: seriesNames,
    },
    tooltip: getCommonTooltip(p),
    grid,
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
