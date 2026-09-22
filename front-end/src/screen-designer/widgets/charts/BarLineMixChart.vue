<!-- 折线混合图 (bar-line) - 柱状图与折线图混合 -->
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

  let categories = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  let data1 = [820, 932, 901, 934, 1290]
  let data2 = [120, 132, 101, 134, 290]
  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.xAxis) categories = parsed.xAxis
      if (parsed.series) { data1 = parsed.series[0] || data1; data2 = parsed.series[1] || data2 }
    } catch {}
  }

  const getSymbolSize = (category: string) => {
    const map: Record<string, number> = { small: 4, medium: 6, large: 10 }
    return map[category] || 6
  }

  const xAxis: any = getCommonXAxis(p)
  xAxis.data = categories

  const yAxis: any = getCommonYAxis(p)
  const yAxis2: any = {
    type: 'value',
    axisLabel: {
      color: p.yAxisLabelColor || '#999',
      fontSize: p.yAxisLabelSize || 12,
      formatter: p.yAxisLabelMaxLen ? (v: any) => String(v) : undefined
    },
    splitLine: { show: false }
  }

  return {
    color: colors,
    title: getCommonTitle(p),
    legend: getCommonLegend(p),
    grid: getCommonGrid(p),
    tooltip: getCommonTooltip(p),
    xAxis,
    yAxis: [yAxis, yAxis2],
    dataZoom: getCommonDataZoom(p),
    series: [
      { name: '柱形', type: 'bar', data: data1, barWidth: p.barWidth || null, itemStyle: { borderRadius: p.barBorderRadius ?? 0 }, label: getSeriesLabel(p) },
      {
        name: '折线', type: 'line', yAxisIndex: 1, data: data2,
        smooth: p.smooth === true,
        lineStyle: { width: p.lineWidth || 2, type: p.lineStyle || 'solid' },
        symbol: p.symbolShow !== false ? (p.symbolType || 'circle') : 'none',
        symbolSize: getSymbolSize(p.symbolSizeCategory),
        label: getSeriesLabel(p)
      }
    ],
    animation: p.animation !== false,
    animationDuration: p.animationDuration || 1000,
    animationEasing: p.animationEasing || 'cubicOut'
  }
}

const initChart = () => {
  if (!chartRef.value) return
  chart = echarts.init(chartRef.value)
  chart.setOption(getChartOption())
  resizeObserver = new ResizeObserver(() => chart?.resize())
  resizeObserver.observe(chartRef.value)
}

onMounted(() => setTimeout(initChart, 100))
watch(() => [props.data, props.props], () => chart?.setOption(getChartOption(), true), { deep: true })
onUnmounted(() => { resizeObserver?.disconnect(); chart?.dispose() })
</script>
<template><div ref="chartRef" style="width:100%;height:100%"></div></template>
