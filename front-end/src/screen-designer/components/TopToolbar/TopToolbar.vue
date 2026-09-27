<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { toastApiError } from '@/api/error-toast'
import { ElMessage } from 'element-plus'
import { ArrowLeft, RefreshLeft, RefreshRight } from '@element-plus/icons-vue'
import { useCanvasStore } from '../../stores/canvas'
import { useComponentsStore } from '../../stores/components'
import { useHistoryStore } from '../../stores/history'
import { bigScreenApi } from '@/api'
import { datasetApi } from '@/api'
import { rowsToChartData, queryRowsToChartData, buildQueryPayload } from '../../utils/chartData'
import html2canvas from 'html2canvas'
import ScreenIcon from '../ScreenIcon.vue'

const props = defineProps<{
  dashboardId: string
}>()

const router = useRouter()
const canvasStore = useCanvasStore()
const componentsStore = useComponentsStore()
const historyStore = useHistoryStore()

const { t } = useI18n()
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const mod = isMac ? '⌘' : 'Ctrl'

const dashboardName = ref(t('bigscreen.editor.untitled'))
const previewMode = ref<'pc' | 'mobile'>('pc')
const showSaveTemplate = ref(false)
const savingTemplate = ref(false)
const templateForm = ref<{ name: string; description: string }>({ name: '', description: '' })

const captureThumbnail = async (): Promise<string> => {
  try {
    const canvasEl = document.querySelector('.canvas') as HTMLElement
    if (!canvasEl) return ''

    const canvas = await html2canvas(canvasEl, {
      scale: 0.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      logging: false
    })

    return canvas.toDataURL('image/jpeg', 0.6)
  } catch (err) {
    console.warn('Thumbnail capture failed:', err)
    return ''
  }
}

const bakeDatasetData = async (components: any[]): Promise<any[]> => {
  const result: any[] = []
  for (const comp of components) {
    const copy = JSON.parse(JSON.stringify(comp))
    if (copy.data && copy.data.type === 'dataset' && copy.data.datasetId) {
      try {
        if (copy.data.query && copy.data.query.metrics?.length) {
          const res = await datasetApi.query(copy.data.datasetId, buildQueryPayload(copy.data.query), { silent: true })
          copy.data.value = queryRowsToChartData(res)
        } else {
          const page = await datasetApi.rows(copy.data.datasetId, 1, 1000)
          const rows = page?.rows || []
          if (rows.length) {
            copy.data.value = rowsToChartData(rows, copy.data.categoryField, copy.data.valueFields)
          }
        }
      } catch (err) {
        console.error(`[TopToolbar] bake dataset ${comp.name}:`, err)
      }
    }
    result.push(copy)
  }
  return result
}

const saveDashboard = async () => {
  const thumbnail = await captureThumbnail()
  const components = await bakeDatasetData(componentsStore.components)

  try {
    await bigScreenApi.update(props.dashboardId, {
      name: dashboardName.value,
      config: canvasStore.config,
      components,
      thumbnail
    })
    ElMessage.success(t('bigscreen.editor.saveSuccess'))
  } catch (e: any) {
    toastApiError(t, e, 'bigscreen.editor.saveFailed')
  }
}

const openSaveTemplate = () => {
  templateForm.value = { name: dashboardName.value || t('bigscreen.editor.defaultTemplateName'), description: '' }
  showSaveTemplate.value = true
}

const onSaveCommand = (cmd: 'save-as') => {
  if (cmd === 'save-as') openSaveTemplate()
}

const handleSave = async () => {
  await saveDashboard()
}

const submitSaveTemplate = async () => {
  const name = templateForm.value.name.trim()
  if (!name) {
    ElMessage.warning(t('bigscreen.editor.templateNameRequired'))
    return
  }
  savingTemplate.value = true
  try {
    const thumbnail = await captureThumbnail()
    const components = await bakeDatasetData(componentsStore.components)
    await bigScreenApi.createTemplate({
      name,
      description: templateForm.value.description.trim(),
      config: canvasStore.config,
      components,
      thumbnail
    })
    showSaveTemplate.value = false
    ElMessage.success(t('bigscreen.editor.saveTemplateSuccess'))
  } catch (e: any) {
    toastApiError(t, e, 'bigscreen.editor.saveTemplateFailed')
  } finally {
    savingTemplate.value = false
  }
}

const previewDashboard = () => {
  window.open(`/big-screen/preview/${props.dashboardId}`, '_blank')
}

const goBack = () => {
  router.push('/big-screen')
}

const onKeyDown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    saveDashboard()
  }
}

onMounted(async () => {
  document.addEventListener('keydown', onKeyDown)
  try {
    const d = await bigScreenApi.get(props.dashboardId)
    if (d?.name) dashboardName.value = d.name
  } catch (err) {
    console.warn('Failed to load screen name:', err)
  }
})
onUnmounted(() => { document.removeEventListener('keydown', onKeyDown) })

const undo = () => {
  const components = historyStore.undo()
  if (components) {
    componentsStore.components = components
  }
}

const redo = () => {
  const components = historyStore.redo()
  if (components) {
    componentsStore.components = components
  }
}

const setLayoutMode = (mode: 'adaptive' | 'fixed') => {
  canvasStore.setConfig({ layoutMode: mode })
}

const setPreviewMode = (mode: 'pc' | 'mobile') => {
  previewMode.value = mode
  canvasStore.setPreviewDevice(mode)
}
</script>

<template>
  <div class="top-toolbar">
    <div class="left">
      <el-button link @click="goBack" :title="t('bigscreen.editor.backToList')">
        <el-icon><ArrowLeft /></el-icon>
      </el-button>
      <el-input v-model="dashboardName" style="width: 180px; margin-left: 10px;" :placeholder="t('bigscreen.editor.namePlaceholder')" />
    </div>

    <div class="center">
      <el-button-group>
        <el-button :disabled="!historyStore.canUndo" @click="undo" :title="`${t('bigscreen.editor.undo')} (${mod}+Z)`">
          <el-icon><RefreshLeft /></el-icon>
        </el-button>
        <el-button :disabled="!historyStore.canRedo" @click="redo" :title="`${t('bigscreen.editor.redo')} (${isMac ? mod + '⇧' : 'Ctrl+Shift'}+Z)`">
          <el-icon><RefreshRight /></el-icon>
        </el-button>
      </el-button-group>

      <el-divider direction="vertical" />

      <el-button-group>
        <el-button :type="previewMode === 'pc' ? 'primary' : ''" @click="setPreviewMode('pc')" :title="t('bigscreen.editor.pcPreview', { width: 1920, height: 1080 })">
          PC
        </el-button>
        <el-button :type="previewMode === 'mobile' ? 'primary' : ''" @click="setPreviewMode('mobile')" :title="t('bigscreen.editor.mobilePreview', { width: 375, height: 812 })">
          {{ t('bigscreen.editor.mobile') }}
        </el-button>
      </el-button-group>

      <el-divider direction="vertical" />

      <el-button-group>
        <el-button :type="canvasStore.config.layoutMode === 'adaptive' ? 'primary' : ''" @click="setLayoutMode('adaptive')" :title="t('bigscreen.editor.adaptiveTitle')">
          {{ t('bigscreen.editor.adaptive') }}
        </el-button>
        <el-button :type="canvasStore.config.layoutMode === 'fixed' ? 'primary' : ''" @click="setLayoutMode('fixed')" :title="t('bigscreen.editor.fixedTitle')">
          {{ t('bigscreen.editor.fixed') }}
        </el-button>
      </el-button-group>
    </div>

    <div class="right">
      <el-button @click="previewDashboard" :title="t('bigscreen.editor.preview')">
        <ScreenIcon name="eye" :size="15" />
        {{ t('bigscreen.editor.preview') }}
      </el-button>

      <el-dropdown split-button type="primary" :title="t('bigscreen.editor.saveTitle', { shortcut: mod + '+S' })" trigger="click" @click="handleSave" @command="onSaveCommand">
        <ScreenIcon name="save" :size="15" />
        {{ t('bigscreen.editor.save') }}
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="save-as">{{ t('bigscreen.editor.saveAsTemplate') }}</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <el-dialog v-model="showSaveTemplate" :title="t('bigscreen.editor.saveAsTemplate')" width="440px" @closed="templateForm.description = ''">
      <el-form @submit.prevent="submitSaveTemplate">
        <el-form-item :label="t('bigscreen.editor.templateNameLabel')" required>
          <el-input v-model.trim="templateForm.name" :placeholder="t('bigscreen.editor.templateNamePlaceholder')" @keyup.enter="submitSaveTemplate" />
        </el-form-item>
        <el-form-item :label="t('bigscreen.editor.templateDescLabel')">
          <el-input v-model.trim="templateForm.description" type="textarea" :rows="2" :placeholder="t('bigscreen.editor.templateDescPlaceholder')" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSaveTemplate = false">{{ t('bigscreen.codeEditor.cancel') }}</el-button>
        <el-button type="primary" :loading="savingTemplate" @click="submitSaveTemplate">{{ t('bigscreen.codeEditor.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.top-toolbar {
  height: 50px;
  background: var(--scr-surface);
  border-bottom: 1px solid var(--scr-border-lighter);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 15px;
}

.left, .center, .right {
  display: flex;
  align-items: center;
  gap: 5px;
}
</style>