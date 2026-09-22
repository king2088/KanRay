<!-- 日历视图 (calendar) - 日历热力图 -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'
import { defaultColors, getCommonTitle, getCommonGrid, getCommonTooltip } from './chartUtils'

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
  const currentYear = new Date().getFullYear()
  
  let calendarData: [string, number][] = []
  const start = `${currentYear}-01-01`
  const end = `${currentYear}-12-31`
  
  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.series) calendarData = parsed.series
    } catch {}
  }

  if (calendarData.length === 0) {
    for (let i = 0; i < 365; i++) {
      const date = new Date(currentYear, 0, i + 1)
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      calendarData.push([dateStr, Math.round(Math.random() * 100)])
    }
  }

  return {
    color: colors,
    title: getCommonTitle(p),
    grid: getCommonGrid(p),
    tooltip: {
      ...getCommonTooltip(p),
      formatter: (params: any) => `${params.value[0]}<br/>值: ${params.value[1]}`
    },
    visualMap: {
      min: 0,
      max: 100,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      top: 20,
      textStyle: { color: '#fff' },
      inRange: {
        color: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39']
      }
    },
    calendar: {
      range: [start, end],
      cellSize: ['auto', 15],
      yearLabel: { show: true, color: '#fff' },
      monthLabel: { show: true, color: '#fff' },
      dayLabel: { show: true, color: '#fff', firstDay: 1 },
      itemStyle: { color: '#141e30', borderWidth: 3, borderColor: '#141e30' },
      splitLine: { lineStyle: { color: '#333' } }
    },
    series: [{
      type: 'heatmap',
      coordinateSystem: 'calendar',
      data: calendarData
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
