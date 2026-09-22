<!-- 瀑布图 (bar-waterfall) - 数据增减瀑布图 -->
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

  let waterfallData = [500, -200, -150, -100, -50, 0]
  let categoryData = ['收入', '商品成本', '工资', '房租', '水电', '利润']
  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.series) waterfallData = parsed.series
      if (parsed.xAxis) categoryData = parsed.xAxis
    } catch {}
  }
  xAxisConfig.data = categoryData

  const helper: number[] = []
  const positive: number[] = []
  const negative: number[] = []
  let sum = 0
  for (let i = 0; i < waterfallData.length; i++) {
    if (i === waterfallData.length - 1) {
      helper.push(0)
      positive.push(sum)
      negative.push(0)
    } else if (waterfallData[i] >= 0) {
      helper.push(sum)
      positive.push(waterfallData[i])
      negative.push(0)
      sum += waterfallData[i]
    } else {
      sum += waterfallData[i]
      helper.push(sum)
      positive.push(0)
      negative.push(-waterfallData[i])
    }
  }

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
        name: '辅助',
        type: 'bar',
        stack: 'waterfall',
        itemStyle: { color: 'transparent' },
        data: helper
      },
      {
        name: '增加',
        type: 'bar',
        stack: 'waterfall',
        data: positive,
        barWidth: p.barWidth || null,
        itemStyle: { color: '#67c23a', borderRadius: p.barBorderRadius ?? 0 },
        label: getSeriesLabel(p)
      },
      {
        name: '减少',
        type: 'bar',
        stack: 'waterfall',
        data: negative,
        barWidth: p.barWidth || null,
        itemStyle: { color: '#f56c6c', borderRadius: p.barBorderRadius ?? 0 },
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
