<!-- 百分比条形图 (bar-horizontal-percent) - 百分比水平柱状图 -->
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

  const xAxisConfig = getCommonXAxis(p)
  const yAxisConfig = getCommonYAxis(p)
  yAxisConfig.max = 100
  yAxisConfig.axisLabel = {
    ...yAxisConfig.axisLabel,
    formatter: '{value}%'
  }

  let seriesData1 = [30, 40, 35, 50, 45]
  let seriesData2 = [70, 60, 65, 50, 55]
  let categoryData = ['A', 'B', 'C', 'D', 'E']

  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.xAxis) categoryData = parsed.xAxis
      if (parsed.series && Array.isArray(parsed.series)) {
        if (parsed.series[0]) seriesData1 = parsed.series[0]
        if (parsed.series[1]) seriesData2 = parsed.series[1]
      }
    } catch {}
  }
  xAxisConfig.data = categoryData

  const seriesLabel = getSeriesLabel(p)
  seriesLabel.formatter = (params: any) => `${params.value}%`

  return {
    color: colors,
    title: getCommonTitle(p),
    legend: getCommonLegend(p),
    grid: getCommonGrid(p),
    tooltip: getCommonTooltip(p),
    xAxis: xAxisConfig,
    yAxis: yAxisConfig,
    dataZoom: getCommonDataZoom(p),
    series: [
      {
        name: '系列1',
        type: 'bar',
        stack: 'total',
        data: seriesData1,
        barWidth: p.barWidth || null,
        label: seriesLabel
      },
      {
        name: '系列2',
        type: 'bar',
        stack: 'total',
        data: seriesData2,
        barWidth: p.barWidth || null,
        label: seriesLabel
      }
    ],
    animation: p.animation !== false,
    animationDuration: p.animationDuration || 1000,
    animationEasing: p.animationEasing || 'cubicOut'
  }
}

const initChart = () => {
  if (!chartRef.value) return
  chart = echarts.init(chartRef.value, undefined, { renderer: props.props?.renderer || 'svg' })
  chart.setOption(getChartOption())
  resizeObserver = new ResizeObserver(() => { chart?.resize() })
  resizeObserver.observe(chartRef.value)
}

onMounted(() => { setTimeout(initChart, 100) })

watch(() => [props.data, props.props], () => {
  chart?.setOption(getChartOption(), true)
}, { deep: true })

onUnmounted(() => {
  resizeObserver?.disconnect()
  chart?.dispose()
})
</script>

<template>
  <div ref="chartRef" style="width: 100%; height: 100%;"></div>
</template>
