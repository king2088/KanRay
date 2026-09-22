<!-- 桑基图 (sankey) - 数据流向桑基图 -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'
import { defaultColors, getCommonTitle, getCommonLegend, getCommonGrid, getCommonTooltip } from './chartUtils'

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

  const nodes = [
    { name: '访问', itemStyle: { color: '#4d76fd' } },
    { name: '点击', itemStyle: { color: '#5470c6' } },
    { name: '搜索', itemStyle: { color: '#91cc75' } },
    { name: '注册', itemStyle: { color: '#fac858' } },
    { name: '购买', itemStyle: { color: '#ee6666' } },
    { name: '浏览', itemStyle: { color: '#73c0de' } }
  ]

  const links = [
    { source: '访问', target: '点击', value: 100 },
    { source: '访问', target: '搜索', value: 80 },
    { source: '点击', target: '注册', value: 60 },
    { source: '搜索', target: '浏览', value: 50 },
    { source: '注册', target: '购买', value: 40 }
  ]

  let sankeyData = { nodes, links }
  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.nodes && parsed.links) sankeyData = parsed
    } catch {}
  }

  return {
    color: colors,
    title: getCommonTitle(p),
    legend: getCommonLegend(p),
    grid: getCommonGrid(p),
    tooltip: getCommonTooltip(p),
    series: [{
      type: 'sankey',
      layout: 'none',
      emphasis: { focus: 'adjacency' },
      data: sankeyData.nodes,
      links: sankeyData.links,
      lineStyle: { color: 'gradient', curveness: 0.5 },
      label: { color: '#fff' }
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
