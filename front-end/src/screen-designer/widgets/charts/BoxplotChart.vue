<!-- 箱线图 (boxplot) - 数据分布箱线图 -->
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

  let boxData = [
    [650, 850, 800, 1000, 1200],
    [500, 700, 650, 900, 1100],
    [700, 900, 850, 1050, 1300],
    [400, 600, 550, 800, 1000],
    [600, 800, 750, 950, 1150]
  ]
  let categoryData = ['周一', '周二', '周三', '周四', '周五']
  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.series) boxData = parsed.series
      if (parsed.xAxis) categoryData = parsed.xAxis
    } catch {}
  }
  xAxisConfig.data = categoryData

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
      type: 'boxplot',
      data: boxData,
      itemStyle: {
        color: colors[0] + '33',
        borderColor: colors[0],
        borderWidth: 2
      },
      emphasis: {
        itemStyle: {
          borderColor: colors[1],
          borderWidth: 2
        }
      }
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
