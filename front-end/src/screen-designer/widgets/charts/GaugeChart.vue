<!-- 仪表盘组件集合 - 包含多种仪表盘类型 -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'
import 'echarts-liquidfill'

const props = defineProps<{
  componentType?: string
  data: any
  style: any
  props: any
}>()

const chartRef = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null
let resizeObserver: ResizeObserver | null = null
const selectedRingIndex = ref(-1)

const getGaugeValue = () => {
  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.value !== undefined) return Number(parsed.value)
      if (parsed.rings && parsed.rings.length > 0) return Number(parsed.rings[0].value)
      if (Array.isArray(parsed.series) && parsed.series.length > 0) {
        const first = parsed.series[0]
        if (typeof first === 'number') return Number(first)
        if (first && first.value !== undefined) return Number(first.value)
      }
    } catch {}
  }
  return 72
}

// 读取通用配置
const getC = () => {
  const p = props.props || {}
  return {
    radius: `${p.gaugeRadius ?? 85}%`,
    lineWidth: p.gaugeLineWidth ?? 10,
    detailSize: p.detailFontSize ?? 11,
    titleSize: p.titleFontSize ?? 12,
    axisLabelSize: p.axisLabelFontSize ?? 8,
    pointerWidth: p.pointerWidth ?? 3,
    pointerLength: `${p.pointerLength ?? 60}%`,
    name: p.gaugeName || ''
  }
}

const getChartOption = () => {
  const p = props.props || {}
  const type = props.componentType || 'gauge'
  const val = getGaugeValue()

  switch (type) {
    case 'gauge-speed': return getSpeedGauge(p, val)
    case 'gauge-stage': return getStageGauge(p, val)
    case 'gauge-level': return getGradeGauge(p, val)
    case 'gauge-multi-title': return getMultiTitleGauge(p, val)
    case 'gauge-temp': return getTemperatureGauge(p, val)
    case 'gauge-score': return getScoreRing(p, val)
    case 'gauge-pressure': return getBarometerGauge(p, val)
    case 'gauge-clock': return getClockGauge()
    case 'gauge-car': return getCarGauge(p, val)
    case 'gauge-multi': return getMultiGauge(p)
    case 'liquid-fill': return getLiquidFill(p, val)
    case 'water-ball': return getLiquidFill(p, val)
    default: return getDefaultGauge(p, val)
  }
}

// 基础仪表盘 (gauge)
function getDefaultGauge(_p: any, val: number) {
  const c = getC()
  return {
    series: [{
      name: c.name || '完成率',
      type: 'gauge',
      center: ['50%', '60%'],
      radius: c.radius,
      detail: { formatter: '{value}%', fontSize: c.detailSize, color: '#ccc' },
      data: [{ value: val, name: c.name || '完成率' }],
      title: { fontSize: c.titleSize, offsetCenter: [0, '80%'] },
      axisLine: { lineStyle: { width: c.lineWidth, color: [[0.7, '#67e0e3'], [1, '#37a2da']] } },
      axisTick: { distance: -(c.lineWidth * 0.8), length: 4, lineStyle: { color: 'auto', width: 1 } },
      splitLine: { distance: -(c.lineWidth), length: 8, lineStyle: { color: 'auto', width: 1.5 } },
      axisLabel: { distance: 2, color: '#999', fontSize: c.axisLabelSize },
      pointer: { width: c.pointerWidth, length: c.pointerLength }
    }]
  }
}

// 速度仪表盘 (gauge-speed)
function getSpeedGauge(_p: any, val: number) {
  const c = getC()
  return {
    series: [{
      type: 'gauge',
      startAngle: 180,
      endAngle: 0,
      min: 0,
      max: 240,
      splitNumber: 12,
      center: ['50%', '70%'],
      radius: c.radius,
      itemStyle: { color: '#58D9F9', shadowColor: 'rgba(0,138,255,0.45)', shadowBlur: 10, shadowOffsetX: 2, shadowOffsetY: 2 },
      progress: { show: true, roundCap: true, width: c.lineWidth },
      pointer: { length: c.pointerLength, width: c.pointerWidth, offsetCenter: [0, '-5%'] },
      axisLine: { roundCap: true, lineStyle: { width: c.lineWidth } },
      axisTick: { splitNumber: 2, lineStyle: { width: 1, color: '#999' } },
      splitLine: { length: 6, lineStyle: { width: 2, color: '#999' } },
      axisLabel: { distance: 16, color: '#999', fontSize: c.axisLabelSize },
      title: { show: false },
      detail: {
        backgroundColor: '#fff',
        borderColor: '#999',
        borderWidth: 1,
        width: '50%',
        lineHeight: 20,
        height: 20,
        borderRadius: 4,
        offsetCenter: [0, '35%'],
        valueAnimation: true,
        formatter: (value: number) => `{value|${value.toFixed(0)}}{unit|km/h}`,
        rich: { value: { fontSize: Math.max(c.detailSize, 14), fontWeight: 'bolder', color: '#777' }, unit: { fontSize: Math.max(c.axisLabelSize, 8), color: '#999', padding: [0, 0, -8, 5] } }
      },
      data: [{ value: val }]
    }]
  }
}

// 阶段仪表盘 (gauge-stage)
function getStageGauge(_p: any, val: number) {
  const c = getC()
  return {
    series: [{
      type: 'gauge',
      center: ['50%', '60%'],
      radius: c.radius,
      axisLine: { lineStyle: { width: c.lineWidth, color: [[0.3, '#67e0e3'], [0.7, '#37a2da'], [1, '#fd666d']] } },
      pointer: { itemStyle: { color: 'auto' }, width: c.pointerWidth, length: c.pointerLength },
      axisTick: { distance: -(c.lineWidth * 0.8), length: 4, lineStyle: { color: '#fff', width: 1 } },
      splitLine: { distance: -(c.lineWidth), length: 8, lineStyle: { color: '#fff', width: 2 } },
      axisLabel: { color: '#999', distance: 14, fontSize: c.axisLabelSize },
      detail: { valueAnimation: true, formatter: '{value} km/h', color: '#ccc', fontSize: c.detailSize },
      title: { fontSize: c.titleSize, offsetCenter: [0, '80%'] },
      data: [{ value: val, name: c.name || '' }]
    }]
  }
}

// 等级仪表盘 (gauge-level)
function getGradeGauge(_p: any, val: number) {
  const c = getC()
  const normalizedVal = val / 100
  return {
    series: [{
      type: 'gauge',
      startAngle: 180,
      endAngle: 0,
      center: ['50%', '72%'],
      radius: c.radius,
      min: 0,
      max: 1,
      splitNumber: 8,
      axisLine: { lineStyle: { width: c.lineWidth * 0.8, color: [[0.25, '#FF6E76'], [0.5, '#FDDD60'], [0.75, '#58D9F9'], [1, '#7CFFB2']] } },
      pointer: { icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z', length: '10%', width: 8, offsetCenter: [0, '-55%'], itemStyle: { color: 'auto' } },
      axisTick: { length: 6, lineStyle: { color: 'auto', width: 1 } },
      splitLine: { length: 10, lineStyle: { color: 'auto', width: 2 } },
      axisLabel: { color: '#666', fontSize: c.axisLabelSize, distance: -40, rotate: 'tangential', formatter: (value: number) => { if (value === 0.875) return 'A'; else if (value === 0.625) return 'B'; else if (value === 0.375) return 'C'; else if (value === 0.125) return 'D'; return '' } },
      title: { offsetCenter: [0, '-8%'], fontSize: c.titleSize },
      detail: { fontSize: c.detailSize, offsetCenter: [0, '-25%'], valueAnimation: true, formatter: (value: number) => Math.round(value * 100) + '', color: 'inherit' },
      data: [{ value: normalizedVal, name: c.name || 'Grade' }]
    }]
  }
}

// 多标题仪表盘 (gauge-multi-title)
function getMultiTitleGauge(_p: any, _val: number) {
  const c = getC()
  return {
    series: [{
      type: 'gauge',
      center: ['50%', '50%'],
      radius: c.radius,
      anchor: { show: true, showAbove: true, size: 8, itemStyle: { color: '#FAC858' } },
      pointer: { width: c.pointerWidth, length: c.pointerLength, offsetCenter: [0, '8%'] },
      progress: { show: true, overlap: true, roundCap: true },
      axisLine: { roundCap: true },
      data: [
        { value: 20, name: 'Good', title: { offsetCenter: ['-40%', '80%'], fontSize: c.axisLabelSize }, detail: { offsetCenter: ['-40%', '95%'], fontSize: c.axisLabelSize } },
        { value: 40, name: 'Better', title: { offsetCenter: ['0%', '80%'], fontSize: c.axisLabelSize }, detail: { offsetCenter: ['0%', '95%'], fontSize: c.axisLabelSize } },
        { value: 60, name: 'Perfect', title: { offsetCenter: ['40%', '80%'], fontSize: c.axisLabelSize }, detail: { offsetCenter: ['40%', '95%'], fontSize: c.axisLabelSize } }
      ],
      detail: { width: 24, height: 10, fontSize: c.axisLabelSize, color: '#fff', backgroundColor: 'inherit', borderRadius: 2, formatter: '{value}%' }
    }]
  }
}

// 气温仪表盘 (gauge-temp)
function getTemperatureGauge(_p: any, val: number) {
  const c = getC()
  return {
    series: [
      {
        type: 'gauge',
        center: ['50%', '65%'],
        radius: c.radius,
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 60,
        splitNumber: 12,
        itemStyle: { color: '#FFAB91' },
        progress: { show: true, width: c.lineWidth },
        pointer: { show: false },
        axisLine: { lineStyle: { width: c.lineWidth } },
        axisTick: { distance: -(c.lineWidth * 1.2), splitNumber: 5, lineStyle: { width: 1, color: '#999' } },
        splitLine: { distance: -(c.lineWidth * 1.4), length: 8, lineStyle: { width: 2, color: '#999' } },
        axisLabel: { distance: -8, color: '#999', fontSize: c.axisLabelSize },
        anchor: { show: false },
        title: { show: false },
        detail: {
          valueAnimation: true,
          width: '50%',
          lineHeight: 20,
          borderRadius: 4,
          offsetCenter: [0, '-15%'],
          fontSize: c.detailSize,
          fontWeight: 'bolder',
          formatter: '{value} °C',
          color: 'inherit'
        },
        data: [{ value: val }]
      },
      {
        type: 'gauge',
        center: ['50%', '65%'],
        radius: c.radius,
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 60,
        itemStyle: { color: '#FD7347' },
        progress: { show: true, width: 4 },
        pointer: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: { show: false },
        data: [{ value: val }]
      }
    ]
  }
}

// 得分环 (gauge-score)
function getScoreRing(_p: any, _val: number) {
  const c = getC()
  return {
    series: [{
      type: 'gauge',
      center: ['50%', '50%'],
      radius: c.radius,
      startAngle: 90,
      endAngle: -270,
      pointer: { show: false },
      progress: { show: true, overlap: false, roundCap: true, clip: false, itemStyle: { borderWidth: 1, borderColor: '#464646' } },
      axisLine: { lineStyle: { width: c.lineWidth } },
      splitLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      data: [
        { value: 20, name: 'Perfect', title: { offsetCenter: ['0%', '-30%'], fontSize: c.axisLabelSize }, detail: { valueAnimation: true, offsetCenter: ['0%', '-20%'], fontSize: c.axisLabelSize } },
        { value: 40, name: 'Good', title: { offsetCenter: ['0%', '0%'], fontSize: c.axisLabelSize }, detail: { valueAnimation: true, offsetCenter: ['0%', '10%'], fontSize: c.axisLabelSize } },
        { value: 60, name: 'Commonly', title: { offsetCenter: ['0%', '30%'], fontSize: c.axisLabelSize }, detail: { valueAnimation: true, offsetCenter: ['0%', '40%'], fontSize: c.axisLabelSize } }
      ],
      title: { fontSize: c.axisLabelSize },
      detail: { width: 28, height: 10, fontSize: c.axisLabelSize, color: 'inherit', borderColor: 'inherit', borderRadius: 12, borderWidth: 1, formatter: '{value}%' }
    }]
  }
}

// 气压表 (gauge-pressure)
function getBarometerGauge(p: any, val: number) {
  const c = getC()
  return {
    series: [
      {
        type: 'gauge',
        min: 0,
        max: 100,
        splitNumber: 10,
        radius: c.radius,
        center: ['50%', '55%'],
        axisLine: { lineStyle: { color: [[1, '#f00']], width: 2 } },
        splitLine: { distance: -10, length: 10, lineStyle: { color: '#f00' } },
        axisTick: { distance: -7, length: 5, lineStyle: { color: '#f00' } },
        axisLabel: { distance: -28, color: '#f00', fontSize: c.axisLabelSize },
        anchor: { show: true, size: 10, itemStyle: { borderColor: '#000', borderWidth: 1 } },
        pointer: { offsetCenter: [0, '10%'], length: '80%', itemStyle: { color: '#000' } },
        detail: { valueAnimation: true, precision: 1, fontSize: c.detailSize, offsetCenter: [0, '40%'] },
        title: { offsetCenter: [0, '-40%'], fontSize: c.titleSize },
        data: [{ value: val, name: c.name || p.gaugeName || 'PLP' }]
      },
      {
        type: 'gauge',
        min: 0,
        max: 60,
        splitNumber: 6,
        radius: c.radius,
        center: ['50%', '55%'],
        axisLine: { lineStyle: { color: [[1, '#000']], width: 2 } },
        splitLine: { distance: -2, length: 10, lineStyle: { color: '#000' } },
        axisTick: { distance: 0, length: 5, lineStyle: { color: '#000' } },
        axisLabel: { distance: 6, fontSize: c.axisLabelSize, color: '#000' },
        pointer: { show: false },
        title: { show: false },
        anchor: { show: true, size: 6, itemStyle: { color: '#000' } }
      }
    ]
  }
}

// 时钟仪表盘 (gauge-clock)
function getClockGauge() {
  const c = getC()
  const now = new Date()
  const hours = now.getHours() % 12
  const minutes = now.getMinutes()
  const seconds = now.getSeconds()
  return {
    series: [
      {
        name: 'hour',
        type: 'gauge',
        center: ['50%', '50%'],
        radius: c.radius,
        startAngle: 90,
        endAngle: -270,
        min: 0,
        max: 12,
        splitNumber: 12,
        clockwise: true,
        axisLine: { lineStyle: { width: 6, color: [[1, 'rgba(0,0,0,0.7)']], shadowColor: 'rgba(0, 0, 0, 0.5)', shadowBlur: 8 } },
        splitLine: { lineStyle: { shadowColor: 'rgba(0, 0, 0, 0.3)', shadowBlur: 3, shadowOffsetX: 1, shadowOffsetY: 2 } },
        axisLabel: { fontSize: c.axisLabelSize, distance: 10, formatter: (value: number) => { if (value === 0) return ''; return value + '' } },
        anchor: { show: true, showAbove: false, offsetCenter: [0, '-35%'], size: 6, keepAspect: true, itemStyle: { color: '#707177' } },
        pointer: { width: c.pointerWidth, length: c.pointerLength, offsetCenter: [0, '8%'], itemStyle: { color: '#C0911F' } },
        detail: { show: false },
        data: [{ value: hours + minutes / 60 }]
      },
      {
        name: 'minute',
        type: 'gauge',
        center: ['50%', '50%'],
        radius: c.radius,
        startAngle: 90,
        endAngle: -270,
        min: 0,
        max: 60,
        clockwise: true,
        axisLine: { show: false },
        splitLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        pointer: { width: 2, length: '70%', offsetCenter: [0, '8%'], itemStyle: { color: '#C0911F' } },
        anchor: { show: true, size: 10, showAbove: false, itemStyle: { borderWidth: 8, borderColor: '#C0911F' } },
        detail: { show: false },
        data: [{ value: minutes + seconds / 60 }]
      },
      {
        name: 'second',
        type: 'gauge',
        center: ['50%', '50%'],
        radius: c.radius,
        startAngle: 90,
        endAngle: -270,
        min: 0,
        max: 60,
        animationEasingUpdate: 'bounceOut',
        clockwise: true,
        axisLine: { show: false },
        splitLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        pointer: { width: 1, length: '85%', offsetCenter: [0, '8%'], itemStyle: { color: '#C0911F' } },
        anchor: { show: true, size: 5, showAbove: true, itemStyle: { color: '#C0911F' } },
        detail: { show: false },
        data: [{ value: seconds }]
      }
    ]
  }
}

// 汽车仪表盘 (gauge-car) - 对照官方 demo：中心转数表 + 速度显示
function getCarGauge(_p: any, val: number) {
  const c = getC()
  return {
    backgroundColor: '#000',
    series: [
      {
        name: 'gauge 0',
        type: 'gauge',
        min: -200,
        max: 250,
        startAngle: -30,
        endAngle: -315,
        splitNumber: 9,
        radius: '65%',
        center: ['50%', '90%'],
        axisLine: { lineStyle: { color: [[1, '#AE96A6']] } },
        splitLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        anchor: {},
        pointer: { show: false },
        detail: { show: false },
        title: { fontSize: 7, fontWeight: 600, color: '#fff', offsetCenter: [0, '-45%'] },
        progress: { show: true, width: 2, itemStyle: { color: '#fff' } },
        data: [{ value: 250, name: 'km/h' }]
      },
      {
        name: 'gauge 2',
        type: 'gauge',
        min: 0,
        max: 8,
        z: 10,
        startAngle: 210,
        endAngle: -30,
        splitNumber: 8,
        radius: '65%',
        center: ['50%', '90%'],
        axisLine: { show: true, lineStyle: { width: 0, color: [[0.825, '#fff'], [1, '#f00']] } },
        splitLine: { distance: 12, length: 8, lineStyle: { color: 'auto', width: 2, shadowColor: 'rgba(255, 255, 255, 0.5)', shadowBlur: 8, shadowOffsetY: -5 } },
        axisTick: { distance: 12, length: 4, lineStyle: { color: 'auto', width: 1, shadowColor: 'rgba(255, 255, 255)', shadowBlur: 5, shadowOffsetY: -5 } },
        axisLabel: { distance: 8, fontSize: c.axisLabelSize, fontWeight: 600, color: '#fff' },
        anchor: {},
        pointer: { width: c.pointerWidth, offsetCenter: [0, '-10%'], length: '50%', itemStyle: { color: '#f00' } },
        title: { color: '#fff', fontSize: 7, fontWeight: 600, offsetCenter: [0, '-42%'] },
        data: [{ value: val, name: '1/min x 1000' }],
        detail: { show: false }
      },
      {
        name: 'gauge 3',
        type: 'gauge',
        min: 0,
        max: 8,
        z: 10,
        splitNumber: 8,
        radius: '65%',
        center: ['50%', '90%'],
        axisLine: { lineStyle: { width: 6, color: [[1, '#000']] } },
        splitLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        anchor: {},
        pointer: { show: false },
        title: { show: false },
        detail: {
          offsetCenter: ['25%', '50%'],
          formatter: '{a|{value}}{b|km/h}',
          rich: { a: { fontSize: Math.max(c.detailSize, 14), fontWeight: 600, color: '#fff', align: 'center', padding: [0, 2, 0, 0] }, b: { fontSize: 7, fontWeight: 600, color: '#fff', padding: [0, 0, 8, 0] } }
        },
        data: [{ value: val }]
      }
    ]
  }
}

// 多环仪表盘 (gauge-multi)
function getMultiGauge(p: any) {
  let rings = [
    { name: '指标A', value: 85, color: '#409eff' },
    { name: '指标B', value: 72, color: '#67c23a' },
    { name: '指标C', value: 58, color: '#e6a23c' },
    { name: '指标D', value: 40, color: '#f56c6c' }
  ]
  if (props.data?.value) {
    try {
      const parsed = JSON.parse(props.data.value)
      if (parsed.rings && Array.isArray(parsed.rings) && parsed.rings.length > 0) {
        rings = parsed.rings
      }
    } catch {}
  }

  const selIdx = selectedRingIndex.value >= 0 ? selectedRingIndex.value : rings.length - 1
  const selRing = rings[selIdx] || rings[rings.length - 1]

  const ringWidth = p.ringWidth ?? 6
  const centerDiameter = p.centerSize ?? 30
  const centerNameColor = p.centerNameColor || '#aaaaaa'
  const centerNameSize = p.centerNameSize ?? 8
  const centerValueColor = p.centerValueColor || '#ffffff'
  const centerValueSize = p.centerValueSize ?? 14

  const series = rings.map((ring: any, i: number) => ({
    type: 'gauge' as const,
    center: ['50%', '50%'],
    radius: `${90 - i * 16}%`,
    startAngle: 90,
    endAngle: -270,
    pointer: { show: false },
    progress: { show: true, overlap: false, roundCap: true, clip: false, itemStyle: { color: ring.color } },
    axisLine: { lineStyle: { width: ringWidth, color: [[1, 'rgba(255,255,255,0.08)']] } },
    axisTick: { show: false },
    splitLine: { show: false },
    axisLabel: { show: false },
    title: { show: false },
    detail: { show: false },
    data: [{ value: ring.value, name: ring.name }]
  }))

  series.push({
    type: 'gauge' as const,
    center: ['50%', '50%'],
    radius: `${centerDiameter / 2}%`,
    startAngle: 90,
    endAngle: -270,
    pointer: { show: false },
    progress: { show: true, overlap: false, roundCap: false, clip: false, itemStyle: { color: 'rgba(255,255,255,0.05)' } },
    axisLine: { lineStyle: { width: centerDiameter / 2, color: [[1, 'rgba(30,40,65,0.9)']] } },
    axisTick: { show: false },
    splitLine: { show: false },
    axisLabel: { show: false },
    title: { show: false },
    detail: {
      show: true,
      valueAnimation: true,
      offsetCenter: [0, 0],
      formatter: () => `{name|${selRing.name}}\n{value|${selRing.value}%}`,
      rich: {
        name: { fontSize: centerNameSize, color: centerNameColor, lineHeight: 14 },
        value: { fontSize: centerValueSize, fontWeight: 'bold', color: centerValueColor, lineHeight: 18 }
      }
    } as any,
    data: [{ value: selRing.value, name: selRing.name }]
  })

  return { series }
}

// 水波球 (liquid-fill)
function getLiquidFill(_p: any, val: number) {
  return {
    series: [{
      type: 'liquidFill',
      name: '完成率',
      data: [val / 100],
      radius: '80%',
      center: ['50%', '50%'],
      label: { show: true, fontSize: 16, color: '#fff' },
      outline: { show: true, borderDistance: 4, itemStyle: { color: 'none', borderColor: '#409eff', borderWidth: 2 } },
      backgroundStyle: { color: '#1a1a2e' },
      itemStyle: { opacity: 0.8, color: '#409eff' },
      emphasis: { itemStyle: { opacity: 1 } }
    }]
  }
}

const initChart = () => {
  if (!chartRef.value) return
  chart = echarts.init(chartRef.value, undefined, { renderer: props.props?.renderer || 'svg' })
  chart.setOption(getChartOption())

  if (props.componentType === 'gauge-multi') {
    chart.on('click', (params: any) => {
      if (params.seriesIndex !== undefined && params.seriesIndex < 4) {
        selectedRingIndex.value = params.seriesIndex
        chart?.setOption(getChartOption(), true)
      }
    })
  }

  resizeObserver = new ResizeObserver(() => chart?.resize())
  resizeObserver.observe(chartRef.value)
}

onMounted(() => setTimeout(initChart, 100))
watch(() => [props.data, props.props], () => chart?.setOption(getChartOption(), true), { deep: true })
onUnmounted(() => { resizeObserver?.disconnect(); chart?.dispose() })
</script>
<template>
  <div ref="chartRef" style="width: 100%; height: 100%;"></div>
</template>
