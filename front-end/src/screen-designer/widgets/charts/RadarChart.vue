<!-- 雷达图 (radar) - 多维数据雷达图 -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'
import { defaultColors, getCommonTitle, getCommonLegend, getCommonTooltip } from './chartUtils'

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

  const defaultIndicator = [
    { name: '销售', max: 6500 },
    { name: '管理', max: 16000 },
    { name: '信息技术', max: 30000 },
    { name: '客服', max: 38000 },
    { name: '研发', max: 52000 },
    { name: '市场', max: 25000 }
  ]
  const defaultSeries = [
    { value: [4200, 3000, 20000, 35000, 50000, 18000], name: '预算分配' }
  ]
  let indicator = defaultIndicator
  let seriesData: any = defaultSeries
  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.indicator) indicator = parsed.indicator
      if (parsed.series) {
        seriesData = parsed.series
          .map((cell: any) => {
            if (Array.isArray(cell)) return { value: cell }
            return { ...cell, value: cell.value ?? cell.data }
          })
          .filter((cell: any) => Array.isArray(cell.value))
      }
    } catch {}
  }

  return {
    color: colors,
    title: getCommonTitle(p),
    legend: getCommonLegend(p),
    tooltip: getCommonTooltip(p),
    radar: {
      indicator,
      shape: p.shape || 'polygon',
      center: p.center || ['50%', '50%'],
      radius: p.radius || '65%',
      splitNumber: p.splitNumber ?? 5,
      axisName: {
        show: p.axisNameShow !== false,
        color: p.axisNameColor || '#999',
        fontSize: p.axisNameSize || 12
      },
      axisLine: {
        show: p.axisLineShow === true,
        lineStyle: { color: p.axisLineColor || 'rgba(128,148,171,0.6)', width: p.axisLineWidth ?? 1 }
      },
      splitLine: {
        show: p.splitLineShow !== false,
        lineStyle: {
          color: p.splitLineColor || 'rgba(128,148,171,0.45)',
          width: p.splitLineWidth ?? 1,
          type: p.splitLineType || 'dashed'
        }
      },
      splitArea: p.splitAreaShow !== false ? {
        areaStyle: {
          color: Array.isArray(p.splitAreaColors) && p.splitAreaColors.length === 2
            ? p.splitAreaColors
            : ['#1a1a2e', '#1e2a3a']
        }
      } : { show: false }
    },
    series: [{
      type: 'radar',
      data: seriesData,
      symbol: p.symbolShow !== false ? 'circle' : 'none',
      symbolSize: p.symbolSize ?? 4,
      lineStyle: {
        width: p.seriesLineWidth ?? 2,
        color: p.seriesLineColor
      },
      itemStyle: {
        color: p.seriesItemColor
      },
      areaStyle: p.areaStyle ? { opacity: p.areaOpacity ?? 0.3 } : undefined
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
