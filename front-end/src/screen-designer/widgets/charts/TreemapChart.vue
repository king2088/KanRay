<!-- 矩形树图 (pie-treemap) - 层级矩形树图 -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps<{
  componentType?: string
  data: any
  style: any
  props: any
}>()

const chartRef = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null
let resizeObserver: ResizeObserver | null = null

const defaultColors = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399']

const getChartOption = () => {
  const p = props.props || {}
  const colors = p.colors || defaultColors

  const titleConfig = p.titleShow !== false ? {
    text: p.titleText || '',
    left: p.titlePosition || 'center',
    textStyle: { color: p.titleColor || '#fff', fontSize: p.titleSize || 16 }
  } : {}

  const tooltipConfig = p.tooltipShow !== false ? {
    show: true,
    backgroundColor: p.tooltipBgColor || '#333',
    textStyle: { color: p.tooltipTextColor || '#fff' }
  } : { show: false }

  let treemapData: any[] = [
    {
      name: '数据可视化',
      value: 95,
      children: [
        { name: 'ECharts', value: 45 },
        { name: 'D3.js', value: 25 },
        { name: 'Highcharts', value: 25 }
      ]
    },
    {
      name: '前端框架',
      value: 80,
      children: [
        { name: 'Vue', value: 35 },
        { name: 'React', value: 30 },
        { name: 'Angular', value: 15 }
      ]
    },
    {
      name: '后端技术',
      value: 60,
      children: [
        { name: 'Node.js', value: 25 },
        { name: 'Python', value: 20 },
        { name: 'Java', value: 15 }
      ]
    },
    {
      name: '数据库',
      value: 45,
      children: [
        { name: 'MySQL', value: 20 },
        { name: 'Redis', value: 15 },
        { name: 'MongoDB', value: 10 }
      ]
    }
  ]
  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.series) treemapData = parsed.series
    } catch {}
  }

  return {
    color: colors,
    title: titleConfig,
    tooltip: tooltipConfig,
    series: [{
      type: 'treemap',
      data: treemapData,
      roam: false,
      nodeClick: 'zoomToNode',
      breadcrumb: {
        show: true,
        bottom: 5,
        itemStyle: { color: '#333', borderColor: '#666', textStyle: { color: '#fff' } }
      },
      label: {
        show: true,
        color: '#fff',
        fontSize: 13,
        formatter: '{b}\n{c}'
      },
      upperLabel: {
        show: true,
        height: 20,
        color: '#fff',
        fontSize: 12,
        backgroundColor: 'transparent'
      },
      itemStyle: {
        borderColor: '#1a1a2e',
        borderWidth: 2,
        gapWidth: 2
      },
      levels: [
        {
          itemStyle: { borderColor: '#1a1a2e', borderWidth: 3, gapWidth: 3 },
          upperLabel: { show: true, height: 24, fontSize: 13 }
        },
        {
          itemStyle: { borderColor: '#2a2a3e', borderWidth: 1, gapWidth: 1 },
          colorSaturation: [0.35, 0.5]
        }
      ]
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

  resizeObserver = new ResizeObserver(() => {
    chart?.resize()
  })
  resizeObserver.observe(chartRef.value)
}

onMounted(() => {
  setTimeout(initChart, 100)
})

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
