<!-- Funnel chart (funnel) - vertical funnel -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'
import { currentEchartsLocale, useChartLocale } from '@/utils/useChartLocale'
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
  const isHorizontal = props.componentType === 'funnel-horizontal'

  let seriesData = [
    { value: 100, name: '展示' },
    { value: 80, name: '点击' },
    { value: 60, name: '访问' },
    { value: 40, name: '咨询' },
    { value: 20, name: '订单' }
  ]
  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.series) seriesData = parsed.series
    } catch {}
  }

  return {
    color: colors,
    title: getCommonTitle(p),
    legend: getCommonLegend(p),
    tooltip: getCommonTooltip(p),
    series: [{
      type: 'funnel',
      left: isHorizontal ? '10%' : '15%',
      top: isHorizontal ? '10%' : 60,
      bottom: isHorizontal ? '10%' : 60,
      width: isHorizontal ? '80%' : '70%',
      height: isHorizontal ? '80%' : undefined,
      sort: p.sort || 'descending',
      gap: 2,
      orient: isHorizontal ? 'horizontal' : undefined,
      label: {
        show: p.labelShow !== false,
        position: isHorizontal ? 'right' : 'inside',
        color: '#fff'
      },
      data: seriesData
    }]
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
