<!-- K线图 (candlestick) - 股票K线图 -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'
import { defaultColors, getCommonTitle, getCommonLegend, getCommonGrid, getCommonTooltip, getCommonXAxis, getCommonYAxis, getCommonDataZoom } from './chartUtils'

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

  let klineData = [
    ['周一', [20, 34, 10, 38]],
    ['周二', [40, 35, 30, 50]],
    ['周三', [31, 38, 28, 44]],
    ['周四', [38, 42, 33, 52]],
    ['周五', [34, 40, 25, 48]]
  ]
  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.series) klineData = parsed.series
    } catch {}
  }
  xAxisConfig.data = klineData.map(d => d[0] as string)

  return {
    color: colors,
    title: getCommonTitle(p),
    legend: getCommonLegend(p),
    grid: getCommonGrid(p),
    tooltip: getCommonTooltip(p),
    xAxis: xAxisConfig,
    yAxis: yAxisConfig,
    dataZoom: getCommonDataZoom(p),
    series: [{
      type: 'candlestick',
      data: klineData.map(d => d[1]),
      itemStyle: {
        color: '#f56c6c',
        color0: '#67c23a',
        borderColor: '#f56c6c',
        borderColor0: '#67c23a'
      },
      barWidth: p.barWidth || '50%'
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
