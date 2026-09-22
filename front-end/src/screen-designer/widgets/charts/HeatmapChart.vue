<!-- 热力图 (heatmap) - 矩阵热力图 -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'
import { defaultColors, getCommonTitle, getCommonGrid, getCommonTooltip, getCommonXAxis, getCommonYAxis, getCommonDataZoom } from './chartUtils'

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

  const hours = ['12a', '2a', '4a', '6a', '8a', '10a', '12p', '2p', '4p', '6p', '8p', '10p']
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const data: number[][] = []
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 12; j++) {
      data.push([j, i, Math.round(Math.random() * 100)])
    }
  }

  let heatmapData = data
  let hoursData = hours
  let daysData = days
  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.series) heatmapData = parsed.series
      if (parsed.hours) hoursData = parsed.hours
      if (parsed.days) daysData = parsed.days
    } catch {}
  }

  const xAxisConfig = getCommonXAxis(p)
  xAxisConfig.data = hoursData
  xAxisConfig.splitArea = { show: true }

  const yAxisConfig = getCommonYAxis(p)
  yAxisConfig.type = 'category'
  yAxisConfig.data = daysData
  yAxisConfig.splitArea = { show: true }

  return {
    color: colors,
    title: getCommonTitle(p),
    grid: getCommonGrid(p),
    tooltip: {
      ...getCommonTooltip(p),
      formatter: (params: any) => `${params.data[0]}: ${params.data[1]}<br/>值: ${params.data[2]}`
    },
    xAxis: xAxisConfig,
    yAxis: yAxisConfig,
    dataZoom: getCommonDataZoom(p),
    visualMap: {
      min: 0,
      max: 100,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 10,
      textStyle: { color: '#fff' },
      inRange: {
        color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#fee090', '#fdae61', '#f46d43', '#d73027']
      }
    },
    series: [{
      type: 'heatmap',
      data: heatmapData,
      label: { show: false },
      emphasis: {
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' }
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
