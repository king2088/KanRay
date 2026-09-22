<!-- 极坐标柱状图 (polar-bar) - 极坐标系下的柱状图 -->
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

  let categories = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  let seriesData = [120, 200, 150, 80, 70, 110, 130]

  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.categories) categories = parsed.categories
      if (parsed.series) seriesData = parsed.series
    } catch {}
  }

  return {
    color: colors,
    title: getCommonTitle(p),
    legend: getCommonLegend(p),
    tooltip: getCommonTooltip(p),
    polar: {
      radius: [p.radiusMin ?? 30, p.radiusMax ? p.radiusMax + '%' : '80%'],
      shape: p.shape || 'circle'
    },
    radiusAxis: {
      max: Math.max(...seriesData) * 1.2,
      axisLine: { show: p.radiusAxisLineShow === true, lineStyle: { color: p.radiusAxisLineColor || '#555' } },
      axisTick: { show: false },
      axisLabel: {
        show: p.radiusLabelShow !== false,
        color: p.radiusLabelColor || '#999',
        fontSize: p.radiusLabelSize || 11,
        formatter: p.radiusLabelShow === false ? undefined : ((val: number) => (p.radiusUnit ? val + p.radiusUnit : String(val)))
      },
      splitLine: {
        show: p.radiusSplitShow !== false,
        lineStyle: {
          color: p.radiusSplitColor || 'rgba(128,148,171,0.35)',
          width: p.radiusSplitWidth ?? 1,
          type: 'dashed'
        }
      }
    },
    angleAxis: {
      type: 'category',
      data: categories,
      startAngle: p.startAngle ?? 75,
      boundaryGap: true,
      axisLine: { show: p.angleAxisLineShow === true, lineStyle: { color: p.angleAxisLineColor || '#555' } },
      axisTick: { show: false },
      axisLabel: {
        show: p.angleLabelShow !== false,
        color: p.angleLabelColor || '#999',
        fontSize: p.angleLabelSize || 11,
        rotate: p.angleLabelRotate ?? 0,
        interval: p.angleLabelInterval
      },
      splitLine: {
        show: p.angleSplitShow === true,
        lineStyle: { color: p.angleSplitColor || 'rgba(128,148,171,0.2)', width: p.angleSplitWidth ?? 1 }
      }
    },
    series: {
      type: 'bar',
      data: seriesData,
      coordinateSystem: 'polar',
      barWidth: p.barWidth,
      label: {
        show: p.labelShow !== false,
        position: 'middle',
        formatter: '{b}: {c}',
        color: p.labelColor || '#fff',
        fontSize: p.labelFontSize || 11
      },
      itemStyle: {
        color: p.barColor,
        borderRadius: p.barBorderRadius ?? (p.shape === 'circle' ? 6 : 0)
      }
    },
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
