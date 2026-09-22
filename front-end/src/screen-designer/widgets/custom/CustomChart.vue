<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as echarts from 'echarts'

const props = defineProps<{
  data: any
  style: any
  props: any
}>()

const containerRef = ref<HTMLDivElement>()
let renderTimer: ReturnType<typeof setTimeout> | null = null
let resizeObserver: ResizeObserver | null = null

function resolveData(data: any): any {
  if (data && typeof data === 'object' && !Array.isArray(data) && 'value' in data && 'type' in data) {
    const raw = data.value
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw)
      } catch {
        return raw
      }
    }
    return raw ?? null
  }
  return data ?? null
}

function render() {
  const el = containerRef.value
  if (!el) return
  el.innerHTML = ''
  const code = props.props
  if (!code?.html && !code?.css && !code?.js) return

  if (code.css) {
    const style = document.createElement('style')
    style.textContent = code.css
    el.appendChild(style)
  }
  if (code.html) {
    const content = document.createElement('div')
    content.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column'
    content.innerHTML = code.html
    el.appendChild(content)
  }
  if (code.js) {
    try {
      const fn = new Function('container', 'echarts', 'data', code.js)
      fn(el, echarts, resolveData(props.data))
    } catch (e) {
      console.error('Custom component error:', e)
    }
  }
}

function scheduleRender() {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(() => nextTick(render), 300)
}

onMounted(() => {
  nextTick(render)
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => scheduleRender())
    resizeObserver.observe(containerRef.value)
  }
})

watch(() => props.props?.html, scheduleRender)
watch(() => props.props?.css, scheduleRender)
watch(() => props.props?.js, scheduleRender)
watch(() => props.data, scheduleRender, { deep: true })

onUnmounted(() => {
  if (renderTimer) clearTimeout(renderTimer)
  if (resizeObserver) resizeObserver.disconnect()
})
</script>

<template>
  <div class="custom-chart" ref="containerRef">
    <div v-if="!props.props?.html && !props.props?.css && !props.props?.js" class="placeholder">
      <el-icon :size="40"><Edit /></el-icon>
      <span>自定义组件</span>
      <span class="hint">双击组件打开代码编辑器</span>
      <span class="hint">支持 HTML + CSS + JavaScript</span>
    </div>
  </div>
</template>

<style scoped>
.custom-chart {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.5);
  gap: 8px;
  font-size: 14px;
  pointer-events: none;
}

.hint {
  font-size: 12px;
  opacity: 0.7;
}
</style>
