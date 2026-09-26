<!-- Positive/negative bar chart (positive-negative-bar) -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'
import { currentEchartsLocale, useChartLocale } from '@/utils/useChartLocale'
import { useI18n } from 'vue-i18n'
import { getCommonTitle, getCommonLegend, getCommonGrid, getCommonTooltip, getCommonValueXAxis, getCommonCategoryYAxis, getCommonDataZoom, getSeriesLabel } from './chartUtils'

const { t } = useI18n()

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
  const colors = p.colors || [p.positiveColor || '#67c23a', p.negativeColor || '#f56c6c']

  const categories = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const positive = [120, 132, 101, 134, 90]
  const negative = [-80, -100, -60, -90, -120]

  let posData = positive
  let negData = negative
  let cats = categories

  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.xAxis) cats = parsed.xAxis
      if (parsed.positive) posData = parsed.positive
      if (parsed.negative) negData = parsed.negative
    } catch {}
  }

  const xAxis: any = getCommonValueXAxis(p)

  const yAxis: any = getCommonCategoryYAxis(p, cats)

  const labelPos = getSeriesLabel(p)
  const labelNeg = getSeriesLabel(p)

  return {
    color: colors,
    title: getCommonTitle(p),
    legend: getCommonLegend(p),
    grid: getCommonGrid(p),
    tooltip: {
      ...getCommonTooltip(p),
      trigger: p.tooltipTrigger || 'axis',
      axisPointer: { type: 'shadow' }
    },
    xAxis,
    yAxis,
    dataZoom: getCommonDataZoom(p),
    series: [
      {
        name: t('bigscreen.chart.incomeLabel'),
        type: 'bar',
        stack: 'total',
        data: posData,
        barWidth: p.barWidth || null,
        itemStyle: { borderRadius: [4, 0, 0, 4] },
        label: { ...labelPos, position: 'inside' }
      },
      {
        name: t('bigscreen.chart.expenseLabel'),
        type: 'bar',
        stack: 'total',
        data: negData,
        barWidth: p.barWidth || null,
        itemStyle: { borderRadius: [0, 4, 4, 0] },
        label: { ...labelNeg, position: 'inside', formatter: (params: any) => Math.abs(params.value) }
      }
    ]
  }
}

const initChart = () => {
  if (!chartRef.value) return
  chart = echarts.init(chartRef.value, undefined, { renderer: props.props?.renderer || 'svg', locale: currentEchartsLocale() })
  chart.setOption(getChartOption())
  resizeObserver = new ResizeObserver(() => chart?.resize())
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

onMounted(() => setTimeout(initChart, 100))
watch(() => [props.data, props.props], () => chart?.setOption(getChartOption(), true), { deep: true })
onUnmounted(() => { resizeObserver?.disconnect(); chart?.dispose() })
</script>
<template><div ref="chartRef" style="width:100%;height:100%"></div></template>
