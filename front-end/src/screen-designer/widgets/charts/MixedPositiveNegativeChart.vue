<!-- 交错正负标签图 (mixed-positive-negative) - 正负值交错柱状图 -->
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

  const positiveData = [120, 132, 101, 134, 90, 230, 210]
  const negativeData = [-120, -132, -101, -134, -90, -230, -210]
  const categoryData = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  let posData = positiveData
  let negData = negativeData
  let categories = categoryData

  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.xAxis) categories = parsed.xAxis
      if (parsed.positive) posData = parsed.positive
      if (parsed.negative) negData = parsed.negative
    } catch {}
  }

  const xAxis: any = getCommonXAxis(p)
  xAxis.data = categories

  const posLabel = getSeriesLabel(p)
  posLabel.position = 'top'
  const negLabel = getSeriesLabel(p)
  negLabel.position = 'bottom'

  return {
    color: colors,
    title: getCommonTitle(p),
    legend: getCommonLegend(p),
    grid: getCommonGrid(p),
    tooltip: getCommonTooltip(p),
    xAxis,
    yAxis: getCommonYAxis(p),
    dataZoom: getCommonDataZoom(p),
    series: [
      {
        name: '正向',
        type: 'bar',
        data: posData,
        barWidth: p.barWidth || null,
        label: posLabel
      },
      {
        name: '负向',
        type: 'bar',
        data: negData,
        barWidth: p.barWidth || null,
        label: negLabel
      }
    ]
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
