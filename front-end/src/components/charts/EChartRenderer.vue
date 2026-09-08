<template>
  <div class="ec-chart" ref="el" v-if="isEChartsType"></div>
  <div v-else class="ec-chart-native">
    <slot name="fallback"></slot>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch, computed } from 'vue'
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

function render() {
  if (!chart || !props.data) return
  const builder = OPTION_BUILDERS[props.chartType]
  if (!builder) return

  const palette = props.options._palette || getPalette(props.options.colorPalette)
  const opt = builder(props.data, props.options, palette)

  // Handle non-ECharts returns - these are rendered natively by parent component
  if (opt._table || opt._stat || opt._progress || opt._statTrend || opt._map) {
    chart.clear()
    return
  }

  if (!opt.backgroundColor) opt.backgroundColor = 'transparent'
  chart.setOption(opt, true)
}

onMounted(() => {
  chart = echarts.init(el.value)
  resizeObserver = new ResizeObserver(() => chart && chart.resize())
  resizeObserver.observe(el.value)
  render()
})

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
.ec-chart-native {
  width: 100%;
  height: 100%;
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>