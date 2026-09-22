<!-- 水平漏斗图 (funnel-horizontal) - 水平方向漏斗图 -->
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

  const legendConfig = p.legendShow !== false ? {
    show: true,
    bottom: p.legendPosition === 'bottom' ? 10 : undefined,
    top: p.legendPosition === 'top' ? 10 : undefined,
    left: p.legendPosition === 'left' ? 10 : undefined,
    right: p.legendPosition === 'right' ? 10 : undefined,
    orient: p.legendDirection || 'horizontal',
    icon: p.legendShape || 'roundRect',
    itemWidth: p.legendItemWidth || 14,
    itemHeight: p.legendItemHeight || 14,
    textStyle: { color: p.legendColor || '#fff' }
  } : { show: false }

  const tooltipConfig = p.tooltipShow !== false ? {
    show: true,
    backgroundColor: p.tooltipBgColor || '#333',
    textStyle: { color: p.tooltipTextColor || '#fff' }
  } : { show: false }

  let funnelData = [
    { name: '展现', value: 100 },
    { name: '点击', value: 80 },
    { name: '访问', value: 60 },
    { name: '咨询', value: 40 },
    { name: '订单', value: 20 }
  ]
  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.series) funnelData = parsed.series
    } catch {}
  }

  return {
    color: colors,
    title: titleConfig,
    legend: legendConfig,
    tooltip: tooltipConfig,
    series: [{
      type: 'funnel',
      left: '10%',
      top: 60,
      bottom: 30,
      width: '80%',
      min: 0,
      max: 100,
      minSize: '0%',
      maxSize: '100%',
      sort: p.sort || 'descending',
      orient: 'horizontal',
      gap: 4,
      label: {
        show: true,
        position: 'inside',
        color: '#fff',
        fontSize: 13
      },
      itemStyle: {
        borderColor: '#1a1a2e',
        borderWidth: 2
      },
      emphasis: {
        label: { fontSize: 15 }
      },
      data: funnelData
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
