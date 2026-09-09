<template>
  <div class="ec-chart" ref="el"></div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch, computed, nextTick } from 'vue'
import echarts from '@/utils/echarts'
import { OPTION_BUILDERS } from '@/config/chart-configs'
import { getPalette } from '@/config/color-palettes'

const props = defineProps({
  chartType: { type: String, required: true },
  data: { type: Object, default: null },
  options: { type: Object, default: () => ({}) },
})

const el = ref(null)
let chart = null
let resizeObserver = null

const isEChartsType = computed(() => {
  if (!props.data) return true
  const builder = OPTION_BUILDERS[props.chartType]
  if (!builder) return false
  const palette = props.options._palette || getPalette(props.options.colorPalette)
  const opt = builder(props.data, props.options, palette)
  return !opt._table && !opt._stat && !opt._progress && !opt._statTrend && !opt._map
})

function initChart() {
  if (!el.value || chart) return
  chart = echarts.init(el.value)
  resizeObserver = new ResizeObserver(() => chart && chart.resize())
  resizeObserver.observe(el.value)
  render()
}

function render() {
  if (!chart || !props.data) return
  const builder = OPTION_BUILDERS[props.chartType]
  if (!builder) return

  const palette = props.options._palette || getPalette(props.options.colorPalette)
  const opt = builder(props.data, props.options, palette)

  // Handle non-ECharts returns
  if (opt._table || opt._stat || opt._progress || opt._statTrend || opt._map) {
    if (chart) chart.clear()
    return
  }

  if (!opt.backgroundColor) opt.backgroundColor = 'transparent'
  chart.setOption(opt, true)
}

async function handleChartTypeChange() {
  await nextTick()
  if (isEChartsType.value && !chart) {
    initChart()
  } else if (!isEChartsType.value && chart) {
    chart.dispose()
    chart = null
    resizeObserver && resizeObserver.disconnect()
    resizeObserver = null
  }
  render()
}

onMounted(() => {
  if (isEChartsType.value) {
    initChart()
  }
})

watch(isEChartsType, handleChartTypeChange)
watch(() => [props.chartType, props.data, props.options?.title, props.options?.colorPalette], render, { deep: false })

onBeforeUnmount(() => {
  resizeObserver && resizeObserver.disconnect()
  chart && chart.dispose()
  chart = null
})
</script>

<style scoped>
.ec-chart {
  width: 100%;
  height: 100%;
  min-height: 160px;
}
</style>