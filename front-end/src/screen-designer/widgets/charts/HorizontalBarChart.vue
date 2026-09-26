<!-- Single horizontal bar chart (bar-horizontal) -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'
import { currentEchartsLocale, useChartLocale } from '@/utils/useChartLocale'
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

const getSymbolSize = (category: string) => {
  const map: Record<string, number> = { small: 4, medium: 6, large: 10 }
  return map[category] || 6
}

const getChartOption = () => {
  const p = props.props || {}
  const colors = p.colors || defaultColors
  const isMixed = props.componentType === 'bar-horizontal-mixed'

  const xAxis: any = getCommonValueXAxis(p)
  const yAxis: any = getCommonCategoryYAxis(p)

  let categoryData = ['A', 'B', 'C', 'D', 'E']
  let series: any[] = []

  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.yAxis) categoryData = parsed.yAxis
      if (parsed.series) {
        series = parsed.series.map((s: any, si: number) => ({
          ...s,
          type: s.type || (isMixed && si > 0 ? 'line' : 'bar'),
          yAxisIndex: isMixed ? (si > 0 ? 1 : 0) : 0,
          barWidth: p.barWidth || null,
          smooth: isMixed && si > 0 ? (p.smooth === true) : undefined,
          lineStyle: isMixed && si > 0 ? { width: p.lineWidth || 2, type: p.lineStyle || 'solid' } : undefined,
          symbol: isMixed && si > 0 ? (p.symbolShow !== false ? (p.symbolType || 'circle') : 'none') : undefined,
          symbolSize: getSymbolSize(p.symbolSizeCategory),
          itemStyle: {
            borderRadius: [0, p.barBorderRadius ?? 4, p.barBorderRadius ?? 4, 0],
            ...(p.barColor ? { color: p.barColor } : {})
          },
          label: getSeriesLabel(p)
        }))
      }
    } catch {}
  }

  if (series.length === 0) {
    if (isMixed) {
      series = [
        { name: '柱形', type: 'bar', data: [120, 200, 150, 80, 70], barWidth: p.barWidth || null, itemStyle: { borderRadius: [0, 4, 4, 0] }, label: getSeriesLabel(p) },
        {
          name: '折线', type: 'line', yAxisIndex: 1, data: [120, 200, 150, 80, 70],
          smooth: p.smooth === true, lineStyle: { width: p.lineWidth || 2, type: p.lineStyle || 'solid' },
          symbol: p.symbolShow !== false ? (p.symbolType || 'circle') : 'none',
          symbolSize: getSymbolSize(p.symbolSizeCategory), label: getSeriesLabel(p)
        }
      ]
    } else {
      series = [{ name: '系列一', type: 'bar', data: [120, 200, 150, 80, 70], barWidth: p.barWidth || null, itemStyle: { borderRadius: [0, 4, 4, 0] }, label: getSeriesLabel(p) }]
    }
  }

  yAxis.data = categoryData

  if (isMixed) {
    const xAxisTop = { ...getCommonValueXAxis(p), position: 'top' }
    const xAxisBottom = { ...getCommonValueXAxis(p), position: 'bottom', splitLine: { show: false } }
    return {
      color: colors,
      title: getCommonTitle(p),
      legend: getCommonLegend(p),
      grid: getCommonGrid(p),
      tooltip: getCommonTooltip(p),
      xAxis: [xAxisTop, xAxisBottom],
      yAxis,
      dataZoom: getCommonDataZoom(p),
      series,
      animation: p.animation !== false,
      animationDuration: p.animationDuration || 1000,
      animationEasing: p.animationEasing || 'cubicOut'
    }
  }

  return {
    color: colors,
    title: getCommonTitle(p),
    legend: getCommonLegend(p),
    grid: getCommonGrid(p),
    tooltip: getCommonTooltip(p),
    xAxis,
    yAxis,
    dataZoom: getCommonDataZoom(p),
    series,
    animation: p.animation !== false,
    animationDuration: p.animationDuration || 1000,
    animationEasing: p.animationEasing || 'cubicOut'
  }
}

const initChart = () => {
  if (!chartRef.value) return
  chart = echarts.init(chartRef.value, undefined, { renderer: props.props?.renderer || 'svg', locale: currentEchartsLocale() })
  chart.setOption(getChartOption())
  resizeObserver = new ResizeObserver(() => { chart?.resize() })
  resizeObserver.observe(chartRef.value)
}

// ECharts fixes its locale at init time and setOption cannot change it, so switching
// language has to go through a full dispose + init.
const rebuildChart = () => {
  resizeObserver?.disconnect()
  chart?.dispose()
  chart = null
  initChart()
}
useChartLocale(rebuildChart)

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
