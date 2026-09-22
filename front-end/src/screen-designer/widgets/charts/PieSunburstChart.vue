<!-- 旭日图 (sunburst) - 环形太阳爆发图 -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'
import { getCommonTitle, getCommonTooltip } from './chartUtils'

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
  let sunburstData: any[] = []

  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.children && Array.isArray(parsed.children)) sunburstData = parsed.children
    } catch {}
  }

  if (sunburstData.length === 0) {
    sunburstData = [
      {
        name: '数据访问',
        children: [
          { name: '浏览器', value: 560 },
          { name: '移动应用', value: 500 },
          {
            name: '客户端',
            children: [
              { name: 'Mac', value: 150 },
              { name: 'Windows', value: 200 },
              { name: 'Linux', value: 180 }
            ]
          }
        ]
      },
      {
        name: '搜索引擎',
        children: [
          { name: '谷歌', value: 1000 },
          { name: '百度', value: 600 },
          { name: '必应', value: 300 },
          { name: '其他', value: 200 }
        ]
      },
      {
        name: '外部来源',
        children: [
          { name: '社交媒体', value: 400 },
          { name: '直接访问', value: 350 },
          { name: '邮件营销', value: 150 }
        ]
      }
    ]
  }

  const palette = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399', '#9b59b6', '#3498db', '#2ecc71', '#e74c3c', '#f39c12']

  return {
    title: getCommonTitle(p),
    tooltip: getCommonTooltip(p),
    series: [{
      type: 'sunburst',
      data: sunburstData,
      radius: ['15%', '90%'],
      sort: undefined,
      emphasis: { focus: 'ancestor' },
      levels: [
        {},
        {
          r0: '15%',
          r: '45%',
          itemStyle: { borderWidth: 2, borderColor: '#1a1a2e' },
          label: { rotate: 'tangential', fontSize: 10 }
        },
        {
          r0: '45%',
          r: '70%',
          label: { align: 'right' }
        },
        {
          r0: '70%',
          r: '82%',
          label: { position: 'outside', padding: 3, silent: false, fontSize: 9 },
          itemStyle: { borderWidth: 2 }
        }
      ],
      itemStyle: (params: any) => ({
        color: palette[params.dataIndex % palette.length]
      })
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
