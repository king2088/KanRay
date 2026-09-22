<!-- 单柱图 (bar-single) - 基础柱状图 -->
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

const getDefaultData = (type: string) => {
  if (type === 'bar-group') {
    return {
      xAxis: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      series: [
        { name: '系列一', type: 'bar', data: [120, 200, 150, 80, 70] },
        { name: '系列二', type: 'bar', data: [80, 130, 110, 60, 90] },
        { name: '系列三', type: 'bar', data: [60, 90, 120, 50, 80] }
      ]
    }
  }
  return {
    xAxis: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    series: [{ name: '系列一', type: 'bar', data: [120, 200, 150, 80, 70] }]
  }
}

const getChartOption = () => {
  const p = props.props || {}
  const colors = p.colors || defaultColors
  const isGroup = props.componentType === 'bar-group'

  let categoryData = ['A', 'B', 'C', 'D', 'E']
  let series: any[] = []

  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.xAxis) categoryData = parsed.xAxis
      if (parsed.series) {
        series = parsed.series.map((s: any) => ({
          ...s,
          type: 'bar',
          barWidth: p.barWidth || null,
          itemStyle: { borderRadius: p.barBorderRadius ?? 0 },
          label: getSeriesLabel(p)
        }))
      }
    } catch {}
  }

  if (series.length === 0) {
    const defaultData = getDefaultData(props.componentType || 'bar-single')
    categoryData = defaultData.xAxis
    series = defaultData.series.map((s: any) => ({
      ...s,
      type: 'bar',
      barWidth: p.barWidth || null,
      itemStyle: { borderRadius: p.barBorderRadius ?? 0 },
      label: getSeriesLabel(p)
    }))
  }

  if (isGroup) {
    series.forEach(s => { s.barGap = p.barGap || '20%' })
  }

  const xAxis: any = getCommonXAxis(p)
  xAxis.data = categoryData

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
