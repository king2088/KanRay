<!-- 中国地图 (map-china) - 中国省级地图 -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, shallowRef } from 'vue'
import * as echarts from 'echarts'

const props = defineProps<{
  data: any
  style: any
  props: any
}>()

const chartRef = ref<HTMLDivElement>()
const chart = shallowRef<echarts.ECharts | null>(null)
let resizeObserver: ResizeObserver | null = null

const CHINA_GEO_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json'

async function loadChinaMap() {
  if (echarts.getMap('china')) return true
  try {
    const res = await fetch(CHINA_GEO_URL)
    if (!res.ok) return false
    const geoJson = await res.json()
    echarts.registerMap('china', geoJson)
    return true
  } catch {
    return false
  }
}

function getOption() {
  const p = props.props || {}
  const seriesData = parseSeriesData()

  return {
    title: p.titleShow ? { text: p.titleText || '中国地图', left: 'center', textStyle: { color: '#fff', fontSize: 16 } } : undefined,
    tooltip: p.tooltipShow ? { trigger: 'item', formatter: '{b}: {c}' } : undefined,
    visualMap: p.visualMapShow ? {
      min: 0,
      max: Math.max(...seriesData.map((d: any) => d.value), 100),
      left: 'left',
      top: 'bottom',
      text: ['高', '低'],
      calculable: true,
      inRange: { color: ['#e0f3f8', '#abd9e9', '#74add1', '#4575b4', '#313695'] },
      textStyle: { color: '#fff' }
    } : undefined,
    series: [{
      type: 'map',
      map: 'china',
      roam: p.roam === true,
      label: { show: p.labelShow !== false, color: '#fff', fontSize: 10 },
      itemStyle: {
        areaColor: p.areaColor || '#1a2a6c',
        borderColor: p.borderColor || '#4db8ff',
        borderWidth: 1
      },
      emphasis: {
        label: { color: '#fff', fontSize: 12 },
        itemStyle: { areaColor: '#389bb7' }
      },
      data: seriesData
    }]
  }
}

function parseSeriesData() {
  if (props.data?.type === 'static' && props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (Array.isArray(parsed)) return parsed
      if (parsed.series) return parsed.series
    } catch {}
  }
  return [
    { name: '北京', value: 2154 },
    { name: '上海', value: 2424 },
    { name: '广东', value: 11346 },
    { name: '四川', value: 8367 },
    { name: '浙江', value: 5567 },
    { name: '江苏', value: 8070 },
    { name: '山东', value: 10047 },
    { name: '河南', value: 9605 }
  ]
}

async function initChart() {
  if (!chartRef.value) return
  const ok = await loadChinaMap()
  if (!ok) return

  chart.value = echarts.init(chartRef.value)
  chart.value.setOption(getOption())

  resizeObserver = new ResizeObserver(() => { chart?.value?.resize() })
  resizeObserver.observe(chartRef.value)
}

watch(() => [props.props, props.data], () => {
  chart.value?.setOption(getOption())
}, { deep: true })

onMounted(() => initChart())

onUnmounted(() => {
  resizeObserver?.disconnect()
  chart.value?.dispose()
})
</script>

<template>
  <div class="map-chart" ref="chartRef"></div>
</template>

<style scoped>
.map-chart { width: 100%; height: 100%; }
</style>
