<template>
  <div class="ec-chart" ref="el"></div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import echarts from '@/utils/echarts'
import { toEChartsOption } from '@/utils/chart-utils'

const props = defineProps({
  chartType: { type: String, required: true },
  data: { type: Object, default: null },
  options: { type: Object, default: () => ({}) },
})

const el = ref(null)
let chart = null
let resizeObserver = null

function render() {
  if (!chart || !props.data) return
  const opt = toEChartsOption(props.chartType, props.data, props.options)
  if (opt._table || opt._stat) {
    chart.clear()
    return
  }
  chart.setOption(opt, true)
}

onMounted(() => {
  chart = echarts.init(el.value)
  resizeObserver = new ResizeObserver(() => chart && chart.resize())
  resizeObserver.observe(el.value)
  render()
})

watch(() => [props.chartType, props.data, props.options?.title], render, { deep: false })

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