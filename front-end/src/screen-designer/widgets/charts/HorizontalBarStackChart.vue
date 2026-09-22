<!-- 堆积条形图 (horizontal-stack) - 水平方向堆积柱状图 -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'
import { defaultColors, getCommonTitle, getCommonLegend, getCommonGrid, getCommonTooltip, getCommonValueXAxis, getCommonCategoryYAxis, getCommonDataZoom, getSeriesLabel } from './chartUtils'

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
    } catch {}
  }

  const grid = getCommonGrid(p)

  return {
    color: colors,
    title: getCommonTitle(p),
    legend: {
      ...getCommonLegend(p),
      data: seriesNames,
    },
    tooltip: getCommonTooltip(p),
    grid,
    xAxis: getCommonValueXAxis(p),
    yAxis: getCommonCategoryYAxis(p, categories),
    dataZoom: getCommonDataZoom(p),
    series: seriesNames.map((name: string, i: number) => ({
      name,
      type: 'bar',
      stack: 'total',
      barWidth: p.barWidth || null,
      barMaxWidth: 30,
      data: seriesData[i],
      label: getSeriesLabel(p),
      emphasis: { focus: 'series' },
      itemStyle: { color: colors[i % colors.length], borderRadius: p.barBorderRadius ?? (i === seriesNames.length - 1 ? [0, 4, 4, 0] : 0) }
    })),
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
