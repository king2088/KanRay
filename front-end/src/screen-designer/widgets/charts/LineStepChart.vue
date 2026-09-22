<!-- 阶梯折线图 (line-step) - 阶梯状折线图 -->
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

  const xAxis: any = getCommonXAxis(p)

  let seriesList = [
    { name: '系列一', data: [120, 200, 150, 80, 70, 110, 130] },
    { name: '系列二', data: [60, 100, 80, 50, 40, 80, 90] }
  ]
  let categoryData = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.series) seriesList = parsed.series
      if (parsed.xAxis) categoryData = parsed.xAxis
    } catch {}
  }
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
    series: seriesList.map((s: any) => ({
      name: s.name,
      type: 'line',
      step: true,
      data: s.data,
      smooth: p.smooth || false,
      lineStyle: { width: p.lineWidth || 2, type: p.lineStyle || 'solid' },
      symbol: p.symbolShow !== false ? (p.symbolType || 'circle') : 'none',
      symbolSize: getSymbolSize(p.symbolSizeCategory),
      areaStyle: p.showArea ? {} : undefined,
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
