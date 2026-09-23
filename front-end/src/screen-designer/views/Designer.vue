<script setup lang="ts">
import { ref, onMounted, provide } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import TopToolbar from '../components/TopToolbar/TopToolbar.vue'
import LeftPanel from '../components/LeftPanel/LeftPanel.vue'
import RightPanel from '../components/RightPanel/RightPanel.vue'
import Canvas from '../components/Canvas/Canvas.vue'
import StatusBar from '../components/StatusBar/StatusBar.vue'
import CodeEditDialog from '../components/CodeEditor/CodeEditDialog.vue'
import { useCanvasStore } from '../stores/canvas'
import { useComponentsStore } from '../stores/components'
import { useHistoryStore } from '../stores/history'
import { bigScreenApi } from '@/api'

const route = useRoute()
const router = useRouter()
const canvasStore = useCanvasStore()
const componentsStore = useComponentsStore()
const historyStore = useHistoryStore()

const dashboardId = ref(route.params.id as string)
const screenName = ref('新建大屏')

const codeDialogVisible = ref(false)
const codeDialogHtml = ref('')
const codeDialogCss = ref('')
const codeDialogJs = ref('')
const codeDialogData = ref<any>(null)
const codeDialogComponentId = ref('')

function openCodeDialog(componentId: string) {
  const comp = componentsStore.components.find(c => c.id === componentId)
  if (!comp || comp.type !== 'custom-chart') return
  codeDialogComponentId.value = componentId
  codeDialogHtml.value = comp.props?.html || ''
  codeDialogCss.value = comp.props?.css || ''
  codeDialogJs.value = comp.props?.js || ''
  codeDialogData.value = comp.data ?? null
  codeDialogVisible.value = true
}

function onCodeDialogSave(val: { html: string; css: string; js: string }) {
  const comp = componentsStore.components.find(c => c.id === codeDialogComponentId.value)
  if (comp) {
    componentsStore.updateComponent(codeDialogComponentId.value, {
      props: { ...comp.props, html: val.html, css: val.css, js: val.js }
    })
  }
}

provide('openCodeDialog', openCodeDialog)
provide('showGrid', true)
provide('showRuler', true)

onMounted(async () => {
  canvasStore.setPreviewDevice('pc')

  try {
    const screen = await bigScreenApi.get(dashboardId.value)
    screenName.value = screen.name || '新建大屏'
    const config = typeof screen.config === 'string' ? JSON.parse(screen.config || '{}') : (screen.config || {})
    const list = typeof screen.components === 'string' ? JSON.parse(screen.components || '[]') : (screen.components || [])
    if (config && Object.keys(config).length) canvasStore.setConfig(config)
    const loaded = (list || []).map((comp: any) => {
      if (!comp.mobile) {
        comp.mobile = {
          hideOnMobile: false,
          mobileOrder: 0,
          mobileX: null,
          mobileY: null,
          mobileWidth: null,
          mobileHeight: null
        }
      }
      if (comp.mobileLayout === undefined) comp.mobileLayout = null
      if (!comp.data) comp.data = { type: 'static', value: '' }
      if (comp.data.type === 'dataset') {
        if (comp.data.datasetId === undefined) comp.data.datasetId = null
        if (comp.data.categoryField === undefined) comp.data.categoryField = ''
        if (comp.data.valueFields === undefined) comp.data.valueFields = []
      }
      return comp
    })
    componentsStore.resetComponents(loaded)
    historyStore.pushState(componentsStore.components)
  } catch (e: any) {
    if (e?.status === 404) {
      ElMessage.error('大屏不存在或已被删除')
      router.replace('/big-screen')
      return
    }
    ElMessage.error(e?.message || '加载大屏失败')
    componentsStore.resetComponents([])
    historyStore.pushState([])
  }
})
</script>

<template>
  <div class="designer">
    <TopToolbar :dashboard-id="dashboardId" />
    <div class="main">
      <LeftPanel />
      <Canvas />
      <RightPanel />
    </div>
    <StatusBar />
    <CodeEditDialog
      :visible="codeDialogVisible"
      :html="codeDialogHtml"
      :css="codeDialogCss"
      :js="codeDialogJs"
      :data="codeDialogData"
      @update:visible="codeDialogVisible = $event"
      @update:html="codeDialogHtml = $event"
      @update:css="codeDialogCss = $event"
      @update:js="codeDialogJs = $event"
      @save="onCodeDialogSave"
    />
  </div>
</template>

<style scoped>
.designer {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--scr-surface);
  padding: 0 8px;
  box-sizing: border-box;
}

.main {
  display: flex;
  flex: 1;
  overflow: hidden;
}
</style>