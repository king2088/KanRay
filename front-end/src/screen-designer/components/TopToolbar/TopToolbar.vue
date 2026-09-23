<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
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

const dashboardName = ref('新建大屏')
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
    console.warn('缩略图捕获失败:', err)
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
    ElMessage.success('保存成功')
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  }
}

const openSaveTemplate = () => {
  templateForm.value = { name: dashboardName.value || '我的模板', description: '' }
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
    ElMessage.warning('请填写模板名称')
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
    ElMessage.success('已保存为模板')
  } catch (e: any) {
    ElMessage.error(e?.message || '保存模板失败')
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
    console.warn('加载大屏名称失败:', err)
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
      <el-button link @click="goBack" title="返回列表">
        <el-icon><ArrowLeft /></el-icon>
      </el-button>
      <el-input v-model="dashboardName" style="width: 180px; margin-left: 10px;" placeholder="大屏名称" />
    </div>

    <div class="center">
      <el-button-group>
        <el-button :disabled="!historyStore.canUndo" @click="undo" title="撤销 (Ctrl+Z)">
          <el-icon><RefreshLeft /></el-icon>
        </el-button>
        <el-button :disabled="!historyStore.canRedo" @click="redo" title="重做 (Ctrl+Shift+Z)">
          <el-icon><RefreshRight /></el-icon>
        </el-button>
      </el-button-group>

      <el-divider direction="vertical" />

      <el-button-group>
        <el-button :type="previewMode === 'pc' ? 'primary' : ''" @click="setPreviewMode('pc')" title="PC预览 (1920×1080)">
          PC
        </el-button>
        <el-button :type="previewMode === 'mobile' ? 'primary' : ''" @click="setPreviewMode('mobile')" title="移动端预览 (375×812)">
          移动端
        </el-button>
      </el-button-group>

      <el-divider direction="vertical" />

      <el-button-group>
        <el-button :type="canvasStore.config.layoutMode === 'adaptive' ? 'primary' : ''" @click="setLayoutMode('adaptive')" title="自适应模式">
          自适应
        </el-button>
        <el-button :type="canvasStore.config.layoutMode === 'fixed' ? 'primary' : ''" @click="setLayoutMode('fixed')" title="固定分辨率">
          固定
        </el-button>
      </el-button-group>
    </div>

    <div class="right">
      <el-button @click="previewDashboard" title="预览">
        <ScreenIcon name="eye" :size="15" />
        预览
      </el-button>

      <el-dropdown split-button type="primary" title="保存 (Ctrl+S)" trigger="click" @click="handleSave" @command="onSaveCommand">
        <ScreenIcon name="save" :size="15" />
        保存
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="save-as">另存为模板</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <el-dialog v-model="showSaveTemplate" title="另存为模板" width="440px" @closed="templateForm.description = ''">
      <el-form @submit.prevent="submitSaveTemplate">
        <el-form-item label="模板名称" required>
          <el-input v-model.trim="templateForm.name" placeholder="请输入模板名称" @keyup.enter="submitSaveTemplate" />
        </el-form-item>
        <el-form-item label="模板描述">
          <el-input v-model.trim="templateForm.description" type="textarea" :rows="2" placeholder="可选，描述模板用途" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSaveTemplate = false">取消</el-button>
        <el-button type="primary" :loading="savingTemplate" @click="submitSaveTemplate">保存</el-button>
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