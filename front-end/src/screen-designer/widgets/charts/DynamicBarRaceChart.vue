<!-- 动态排序条形图 (dynamic-bar-race) - 动画条形图竞赛 -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'
import { defaultColors, getCommonTitle, getCommonLegend, getCommonGrid, getCommonTooltip, getCommonValueXAxis, getCommonCategoryYAxis, getCommonDataZoom } from './chartUtils'

const props = defineProps<{
  componentType?: string
  data: any
  style: any
  props: any
}>()

const chartRef = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null
let resizeObserver: ResizeObserver | null = null
let animationTimer: ReturnType<typeof setInterval> | null = null

const defaultSeries = [
  { name: '内蒙古', value: 2800 }, { name: '新疆', value: 2200 },
  { name: '西藏', value: 1500 }, { name: '青海', value: 1800 },
  { name: '四川', value: 3200 }, { name: '黑龙江', value: 2500 },
  { name: '甘肃', value: 1900 }, { name: '云南', value: 2900 },
  { name: '广西', value: 2400 }, { name: '湖南', value: 3100 }
]

const getBarData = () => {
  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.series && Array.isArray(parsed.series)) {
        return parsed.series.map((d: any) => ({ name: d.name, value: Number(d.value) || 0 }))
      }
    } catch {}
  }
  return [...defaultSeries]
}

const getChartOption = () => {
  const p = props.props || {}
  const colors = p.colors || defaultColors
  const barData = getBarData()
  barData.sort((a: any, b: any) => a.value - b.value)

  const xAxis = getCommonValueXAxis(p)
  const yAxis = getCommonCategoryYAxis(p, barData.map((d: any) => d.name))
  yAxis.inverse = true
  yAxis.animationDuration = 300
  yAxis.animationDurationUpdate = 300

  return {
    color: colors,
    title: getCommonTitle(p),
    legend: getCommonLegend(p),
    grid: getCommonGrid(p),
    tooltip: getCommonTooltip(p),
    xAxis,
    yAxis,
    dataZoom: getCommonDataZoom(p),
    series: [{
      type: 'bar',
      data: barData.map((d: any) => ({
        name: d.name,
        value: d.value,
        itemStyle: { borderRadius: [0, 4, 4, 0] }
      })),
      barWidth: p.barWidth || 16,
      realtimeSort: true,
      seriesLayoutBy: 'column',
      label: {
        show: true,
        position: 'right',
        color: '#fff'
      }
    }],
    animationDuration: 0,
    animationDurationUpdate: p.animationDuration || 1000,
    animationEasing: 'cubicOut' as const,
    animationEasingUpdate: 'linear' as const
  }
}

const startAnimation = () => {
  if (animationTimer) clearInterval(animationTimer)
  const p = props.props || {}
  animationTimer = setInterval(() => {
    if (!chart) return
    const option = chart.getOption()
    const seriesData = (option.series as any[])?.[0]?.data
    if (!seriesData || !seriesData.length) return
    const newData = seriesData.map((item: any) => ({
      name: item.name,
      value: Math.max(0, (item.value || 0) + Math.round((Math.random() - 0.5) * 200)),
      itemStyle: { borderRadius: [0, 4, 4, 0] }
    }))
    newData.sort((a: any, b: any) => a.value - b.value)
    chart.setOption({
      yAxis: { data: newData.map((d: any) => d.name) },
      series: [{ data: newData }]
    })
  }, p.animationDuration || 1000)
}

const initChart = () => {
  if (!chartRef.value) return
  chart = echarts.init(chartRef.value, undefined, { renderer: props.props?.renderer || 'svg' })
  chart.setOption(getChartOption())
  resizeObserver = new ResizeObserver(() => chart?.resize())
  resizeObserver.observe(chartRef.value)
  startAnimation()
}

onMounted(() => setTimeout(initChart, 100))
watch(() => [props.data, props.props], () => {
  chart?.setOption(getChartOption(), true)
  startAnimation()
}, { deep: true })
onUnmounted(() => {
  if (animationTimer) clearInterval(animationTimer)
  resizeObserver?.disconnect()
  chart?.dispose()
})
</script>
<template><div ref="chartRef" style="width:100%;height:100%"></div></template>
