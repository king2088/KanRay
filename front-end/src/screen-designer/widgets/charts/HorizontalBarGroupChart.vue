<!-- 簇状条形图 (bar-horizontal-group) - 分组水平柱状图 -->
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

  const xAxis: any = getCommonValueXAxis(p)
  const yAxis: any = getCommonCategoryYAxis(p)

  let seriesList = [
    { name: '系列一', data: [120, 200, 150, 80, 70] },
    { name: '系列二', data: [60, 100, 80, 50, 40] }
  ]
  let categoryData = ['A', 'B', 'C', 'D', 'E']
  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.series) seriesList = parsed.series
      if (parsed.yAxis) categoryData = parsed.yAxis
    } catch {}
  }
  yAxis.data = categoryData

  return {
    color: colors,
    title: getCommonTitle(p),
    legend: getCommonLegend(p),
    grid: getCommonGrid(p),
    tooltip: getCommonTooltip(p),
    xAxis,
    yAxis,
    dataZoom: getCommonDataZoom(p),
    series: seriesList.map((s: any) => ({
      name: s.name,
      type: 'bar',
      data: s.data,
      barWidth: p.barWidth || null,
      barGap: p.barGap || '20%',
      itemStyle: { borderRadius: [0, p.barBorderRadius ?? 4, p.barBorderRadius ?? 4, 0] },
      label: getSeriesLabel(p)
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
