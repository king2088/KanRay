<!-- 散点图 (scatter) - 基础散点图 -->
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

  let scatterData: number[][] = []
  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (Array.isArray(parsed.series) && parsed.series.length > 0) {
        scatterData = parsed.series.map((item: any) => {
          if (Array.isArray(item)) return item
          return item.data ? item.data : [item.x || 0, item.y || 0]
        })
      }
    } catch {}
  }
  if (scatterData.length === 0) {
    scatterData = [
      [10.0, 8.04], [8.0, 6.95], [13.0, 7.58], [9.0, 8.81], [11.0, 8.33],
      [14.0, 9.96], [6.0, 7.24], [4.0, 4.26], [12.0, 10.84], [7.0, 4.82],
      [5.0, 5.68], [15.0, 12.50], [16.0, 5.20], [18.0, 15.00], [11.5, 9.12]
    ]
  }

  return {
    color: colors,
    title: getCommonTitle(p),
    legend: getCommonLegend(p),
    tooltip: getCommonTooltip(p),
    grid: getCommonGrid(p),
    xAxis: getCommonXAxis(p),
    yAxis: getCommonYAxis(p),
    dataZoom: getCommonDataZoom(p),
    series: [{
      type: 'scatter',
      symbolSize: p.symbolSize || 15,
      data: scatterData,
      itemStyle: { color: colors[0], opacity: 0.8, borderColor: '#fff', borderWidth: 1 },
      emphasis: { itemStyle: { borderColor: '#333', borderWidth: 2, opacity: 1 } },
      label: getSeriesLabel(p)
    }],
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
