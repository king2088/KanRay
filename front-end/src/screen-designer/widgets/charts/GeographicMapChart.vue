<!-- 地理坐标图 (geo-map) - 地理散点图 -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, shallowRef } from 'vue'
import * as echarts from 'echarts'
import { defaultColors, getCommonTitle, getCommonLegend, getCommonTooltip } from './chartUtils'

const props = defineProps<{
  componentType?: string
  data: any
  style: any
  props: any
}>()

const chartRef = ref<HTMLDivElement>()
const chart = shallowRef<echarts.ECharts | null>(null)
let resizeObserver: ResizeObserver | null = null

const getChartOption = () => {
  const p = props.props || {}
  const colors = p.colors || defaultColors

  const scatterData = [
    { name: '北京', value: [116.46, 39.92, 4823] },
    { name: '上海', value: [121.48, 31.22, 3874] },
    { name: '广州', value: [113.23, 23.16, 2957] },
    { name: '深圳', value: [114.07, 22.62, 2693] },
    { name: '杭州', value: [120.19, 30.26, 1893] },
    { name: '成都', value: [104.06, 30.67, 1633] },
    { name: '武汉', value: [114.31, 30.52, 1508] },
    { name: '西安', value: [108.95, 34.27, 1259] },
    { name: '南京', value: [118.78, 32.04, 1170] },
    { name: '重庆', value: [106.54, 29.59, 1121] }
  ]

  let pointsData = scatterData
  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.series) pointsData = parsed.series
    } catch {}
  }

  return {
    color: colors,
    title: getCommonTitle(p),
    legend: getCommonLegend(p),
    tooltip: {
      ...getCommonTooltip(p),
      trigger: 'item',
      formatter: (params: any) => {
        if (params.seriesType === 'scatter') {
          return `${params.name}<br/>${params.value[2] || ''}`
        }
        return params.name
      }
    },
    geo: {
      map: 'china',
      roam: false,
      zoom: 1.2,
      label: {
        show: true,
        color: '#ccc',
        fontSize: 10
      },
      emphasis: {
        label: { color: '#fff', fontSize: 12 },
        itemStyle: { areaColor: '#3388ff' }
      },
      itemStyle: {
        areaColor: '#1a1a3e',
        borderColor: '#444',
        borderWidth: 1
      }
    },
    series: [{
      type: 'scatter',
      coordinateSystem: 'geo',
      data: pointsData.map((p: any) => ({
        name: p.name,
        value: p.value
      })),
      symbolSize: (val: any) => {
        const base = p.symbolSize || 12
        return Math.max(base, (val[2] || 1000) / 500 * (base / 12))
      },
      label: { show: false },
      emphasis: {
        label: { show: true, color: '#fff' },
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' }
      }
    }]
  }
}

const initChart = async () => {
  if (!chartRef.value) return
  chart.value = echarts.init(chartRef.value, undefined, { renderer: props.props?.renderer || 'svg' })

  try {
    const response = await fetch('/map/china.json')
    const geoJson = await response.json()
    echarts.registerMap('china', geoJson)
  } catch (e) {
    console.warn('Failed to load china map:', e)
  }

  chart.value.setOption(getChartOption())
  resizeObserver = new ResizeObserver(() => chart.value?.resize())
  resizeObserver.observe(chartRef.value)
}

onMounted(() => setTimeout(initChart, 100))
watch(() => [props.data, props.props], () => chart.value?.setOption(getChartOption(), true), { deep: true })
onUnmounted(() => { resizeObserver?.disconnect(); chart.value?.dispose() })
</script>
<template><div ref="chartRef" style="width:100%;height:100%"></div></template>
