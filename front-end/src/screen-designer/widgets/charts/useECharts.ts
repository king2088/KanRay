import { onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'

export function useECharts(containerRef: any, option: any) {
  let chart: echarts.ECharts | null = null

  const initChart = () => {
    if (!containerRef.value) return
    chart = echarts.init(containerRef.value)
    chart.setOption(option.value || option)
  }

  const updateOption = (newOption: any) => {
    if (chart) {
      chart.setOption(newOption, true)
    }
  }

  const resize = () => {
    chart?.resize()
  }

  onMounted(() => {
    nextTick(() => {
      initChart()
      window.addEventListener('resize', resize)
    })
  })

  onUnmounted(() => {
    window.removeEventListener('resize', resize)
    chart?.dispose()
  })

  return {
    chart,
    updateOption,
    resize
  }
}