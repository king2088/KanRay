<!-- Pie chart set - pie, donut and nightingale rose -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'
import { currentEchartsLocale, useChartLocale } from '@/utils/useChartLocale'
import { defaultColors, getCommonTitle, getCommonLegend, getCommonTooltip, getSeriesLabel } from './chartUtils'

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
  const type = props.componentType || 'pie'

  let seriesData = [
    { value: 1048, name: '搜索引擎' },
    { value: 735, name: '直接访问' },
    { value: 580, name: '邮件营销' },
    { value: 484, name: '联盟广告' },
    { value: 300, name: '视频广告' }
  ]
  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.series) seriesData = parsed.series
    } catch {}
  }

  const isDoughnut = type === 'pie-doughnut'
  const radius = isDoughnut
    ? [p.innerRadius || '40%', p.outerRadius || '60%']
    : [0, p.outerRadius || '60%']

  const roseType = type === 'pie-rose' ? 'area' : undefined

  const option: any = {
    color: colors,
    title: getCommonTitle(p),
    legend: getCommonLegend(p),
    tooltip: {
      ...getCommonTooltip(p),
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    series: [{
      type: 'pie',
      radius,
      center: ['50%', '50%'],
      roseType,
      padAngle: p.padAngle || 0,
      data: seriesData,
      label: getSeriesLabel(p),
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }],
    animation: p.animation !== false,
    animationDuration: p.animationDuration || 1000,
    animationEasing: p.animationEasing || 'cubicOut'
  }

  if (isDoughnut && p.centerTextShow) {
    const totalCount = seriesData.reduce((sum, item) => sum + (item.value || 0), 0)
    option.graphic = [
      {
        type: 'text',
        left: 'center',
        top: '42%',
        style: {
          text: p.centerTitle || '总计',
          textAlign: 'center',
          fill: p.centerTitleColor || '#fff',
          fontSize: p.centerTitleSize || 14
        }
      },
      {
        type: 'text',
        left: 'center',
        top: '52%',
        style: {
          text: p.centerValue || totalCount.toLocaleString(),
          textAlign: 'center',
          fill: p.centerValueColor || '#fff',
          fontSize: p.centerValueSize || 20,
          fontWeight: 'bold'
        }
      }
    ]
  }

  return option
}

const initChart = () => {
  if (!chartRef.value) return
  chart = echarts.init(chartRef.value, undefined, { renderer: props.props?.renderer || 'svg', locale: currentEchartsLocale() })
  chart.setOption(getChartOption())
  resizeObserver = new ResizeObserver(() => chart?.resize())
  resizeObserver.observe(chartRef.value)
}

// ECharts 的 locale 在 init 时确定，setOption 改不了，切语言必须重建实例。
const rebuildChart = () => {
  resizeObserver?.disconnect()
  chart?.dispose()
  chart = null
  initChart()
}
useChartLocale(rebuildChart)

onMounted(() => setTimeout(initChart, 100))
watch(() => [props.data, props.props], () => chart?.setOption(getChartOption(), true), { deep: true })
onUnmounted(() => { resizeObserver?.disconnect(); chart?.dispose() })
</script>
<template><div ref="chartRef" style="width:100%;height:100%"></div></template>
