<!-- 气泡地图 (map-bubble) - 地图上的气泡散点 -->
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

// City coordinate data
const cityCoords: Record<string, [number, number]> = {
  '北京': [116.46, 39.92], '上海': [121.48, 31.22], '广州': [113.23, 23.16],
  '深圳': [114.07, 22.62], '成都': [104.06, 30.67], '杭州': [120.19, 30.26],
  '武汉': [114.31, 30.52], '南京': [118.78, 32.04], '重庆': [106.54, 29.59],
  '天津': [117.2, 39.13], '苏州': [120.62, 31.32], '西安': [108.95, 34.27],
  '长沙': [112.98, 28.19], '沈阳': [123.38, 41.8], '青岛': [120.33, 36.07],
  '郑州': [113.65, 34.76], '大连': [121.62, 38.92], '厦门': [118.1, 24.46],
  '哈尔滨': [126.63, 45.75], '济南': [117.0, 36.65], '福州': [119.3, 26.08],
  '昆明': [102.73, 25.04], '南宁': [108.33, 22.84], '长春': [125.35, 43.88],
  '石家庄': [114.48, 38.03], '合肥': [117.27, 31.86], '南昌': [115.89, 28.68],
  '贵阳': [106.71, 26.57], '太原': [112.55, 37.87], '乌鲁木齐': [87.68, 43.77],
  '兰州': [103.73, 36.03], '呼和浩特': [111.65, 40.82], '海口': [110.35, 20.02],
  '银川': [106.27, 38.47], '西宁': [101.74, 36.56], '拉萨': [91.11, 29.97],
  '台北': [121.5, 25.05], '香港': [114.17, 22.28], '澳门': [113.54, 22.2]
}

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
  const scatterData = parseScatterData()

  return {
    title: p.titleShow ? { text: p.titleText || '气泡地图', left: 'center', textStyle: { color: '#fff', fontSize: 16 } } : undefined,
    tooltip: p.tooltipShow ? {
      trigger: 'item',
      formatter: (params: any) => `${params.name}: ${params.value?.[2] || 0}`
    } : undefined,
    geo: {
      map: 'china',
      roam: p.roam === true,
      label: { show: false },
      itemStyle: {
        areaColor: p.areaColor || '#1a2a6c',
        borderColor: p.borderColor || '#4db8ff',
        borderWidth: 1
      },
      emphasis: {
        label: { color: '#fff' },
        itemStyle: { areaColor: '#389bb7' }
      }
    },
    series: [{
      type: 'effectScatter',
      coordinateSystem: 'geo',
      data: scatterData.map((d: any) => ({
        name: d.name,
        value: [...(cityCoords[d.name] || [0, 0]), d.value]
      })),
      symbolSize: (val: number[]) => Math.max(8, Math.min(40, val[2] / 50)),
      rippleEffect: { brushType: 'stroke', scale: 3 },
      label: { show: false },
      itemStyle: { color: p.scatterColor || '#ffd700', shadowBlur: 10, shadowColor: 'rgba(255,215,0,0.5)' }
    }]
  }
}

function parseScatterData() {
  if (props.data?.type === 'static' && props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (Array.isArray(parsed)) return parsed
      if (parsed.scatter) return parsed.scatter
    } catch {}
  }
  return [
    { name: '北京', value: 2154 }, { name: '上海', value: 2424 },
    { name: '广州', value: 1530 }, { name: '深圳', value: 1302 },
    { name: '成都', value: 1633 }, { name: '杭州', value: 1036 },
    { name: '武汉', value: 1112 }, { name: '重庆', value: 3124 }
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
  <div class="bubble-map" ref="chartRef"></div>
</template>

<style scoped>
.bubble-map { width: 100%; height: 100%; }
</style>
