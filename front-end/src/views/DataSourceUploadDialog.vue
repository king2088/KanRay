<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="上传 Excel / CSV 文件"
    width="80%"
    align-center
    destroy-on-close
    :body-style="{ maxHeight: 'calc(80vh - 100px)', overflowY: 'auto' }"
    class="upload-dialog"
    @closed="resetWizard"
  >
    <div class="upload-dialog__body">
      <el-steps :active="step" align-center class="wizard-steps" finish-status="success">
        <el-step title="选择文件" description="Excel / CSV" />
        <el-step title="确认字段" description="类型校正" />
        <el-step title="完成" description="准备就绪" />
      </el-steps>

      <!-- Step 1: 选择文件 -->
      <div v-if="step === 0" class="page-card">
        <div class="page-card__body" style="padding: 28px">
          <el-upload
            drag
            :auto-upload="false"
            :show-file-list="false"
            accept=".xlsx,.xls,.csv"
            :on-change="onFileChange"
            :limit="1"
            class="upload-drag"
          >
            <div class="upload-icon-wrap">
              <el-icon class="upload-icon" :size="46"><UploadFilled /></el-icon>
            </div>
            <div class="el-upload__text">将 Excel / CSV 拖到此处，或<em>点击选择文件</em></div>
            <template #tip>
              <div class="el-upload__tip">
                支持 .xlsx / .xls / .csv 格式，单文件不超过 20MB、不超过 20 万行，第一行作为列名。
              </div>
            </template>
          </el-upload>

          <div v-if="selectedFile" class="file-panel">
            <div class="file-panel__info">
              <div class="file-panel__icon"><el-icon :size="20"><Document /></el-icon></div>
              <div class="file-panel__meta">
                <div class="file-panel__name">{{ selectedFile.name }}</div>
                <div class="file-panel__size">{{ (selectedFile.size / 1024 / 1024).toFixed(2) }} MB</div>
              </div>
              <el-input
                v-model="datasetName"
                placeholder="数据集名称（可选，默认使用文件名）"
                style="width: 320px; margin-left: auto"
                maxlength="100"
              />
            </div>
            <div class="file-panel__actions">
              <el-button type="primary" :loading="parsing" @click="doPreview">
                <el-icon style="margin-right: 6px"><MagicStick /></el-icon>下一步：解析并预览
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 2: 确认字段 -->
      <div v-if="step === 1" class="page-card">
        <div class="page-card__header">
          <div class="page-card__header-title">
            确认字段类型
            <el-tag type="info" effect="plain" style="margin-left: 8px">共 {{ preview.rowCount }} 行</el-tag>
          </div>
          <div class="page-card__header-right">
            <el-button @click="step = 0">上一步</el-button>
            <el-button type="primary" :loading="creating" @click="doCreate">
              <el-icon style="margin-right: 6px"><Check /></el-icon>创建数据集
            </el-button>
          </div>
        </div>
        <div class="page-card__body">
          <el-table :data="previewHeader">
            <el-table-column type="index" label="#" width="54" align="center" />
            <el-table-column prop="label" label="字段名（原始）" min-width="160" />
            <el-table-column prop="key" label="内部字段名" min-width="160" show-overflow-tooltip />
            <el-table-column label="字段类型" width="170" align="center">
              <template #default="{ row }">
                <el-select v-model="row.type">
                  <el-option label="文本" value="string" />
                  <el-option label="整数" value="integer" />
                  <el-option label="小数" value="number" />
                  <el-option label="日期" value="date" />
                  <el-option label="布尔" value="boolean" />
                </el-select>
              </template>
            </el-table-column>
          </el-table>

          <div class="preview-block">
            <div class="preview-block__title">数据预览（前 {{ preview.previewRows.length }} 行）</div>
            <el-table :data="preview.previewRows" max-height="300">
              <el-table-column
                v-for="h in previewHeader"
                :key="h.key"
                :prop="h.key"
                :label="h.label"
                min-width="130"
                show-overflow-tooltip
              />
            </el-table>
          </div>
        </div>
      </div>

      <!-- Step 3: 完成 -->
      <div v-if="step === 2" class="page-card">
        <div class="page-card__body" style="padding: 40px">
          <el-result icon="success" :title="`数据集「${createdName}」创建成功`" :sub-title="`共 ${createdRowCount} 行数据，已准备好用于图表构建`">
            <template #extra>
              <el-button type="primary" @click="goChart">
                <el-icon style="margin-right: 6px"><DataAnalysis /></el-icon>去创建图表
              </el-button>
              <el-button @click="doClose">完成</el-button>
            </template>
          </el-result>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { UploadFilled, Document, MagicStick, Check, DataAnalysis } from '@element-plus/icons-vue'
import { datasetApi } from '@/api'

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue', 'created'])
const router = useRouter()

const step = ref(0)
const selectedFile = ref(null)
const datasetName = ref('')
const parsing = ref(false)
const creating = ref(false)
const preview = ref({ header: [], previewRows: [], rowCount: 0 })
const previewHeader = ref([])
const createdId = ref(null)
const createdName = ref('')
const createdRowCount = ref(0)

function resetWizard() {
  step.value = 0
  selectedFile.value = null
  datasetName.value = ''
  parsing.value = false
  creating.value = false
  preview.value = { header: [], previewRows: [], rowCount: 0 }
  previewHeader.value = []
  createdId.value = null
  createdName.value = ''
  createdRowCount.value = 0
}

function onFileChange(file) {
  selectedFile.value = file.raw
  if (!datasetName.value || datasetName.value === '') {
    const n = (file.name || '').replace(/\.(xlsx|xls|csv)$/i, '')
    if (n) datasetName.value = n
  }
}

async function doPreview() {
  if (!selectedFile.value) return ElMessage.warning('请先选择文件')
  parsing.value = true
  try {
    preview.value = await datasetApi.preview(selectedFile.value)
    previewHeader.value = preview.value.header.map((h) => ({ ...h }))
    step.value = 1
  } finally {
    parsing.value = false
  }
}

async function doCreate() {
  creating.value = true
  try {
    const name = datasetName.value.trim() || (selectedFile.value ? selectedFile.value.name : '未命名')
    const ds = await datasetApi.create(selectedFile.value, name)
    createdId.value = ds.id
    createdName.value = ds.name
    createdRowCount.value = ds.row_count
    step.value = 2
    emit('created')
  } finally {
    creating.value = false
  }
}

function goChart() {
  emit('update:modelValue', false)
  router.push(`/charts/new?dataset=${createdId.value}`)
}

function doClose() {
  emit('update:modelValue', false)
}
</script>

<style scoped>
.wizard-steps {
  margin: 0 0 20px;
}

.upload-drag :deep(.el-upload-dragger) {
  padding: 40px 20px 30px;
}

.upload-icon-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 10px;
}

.upload-icon {
  color: var(--app-primary);
}

.file-panel {
  margin-top: 20px;
  border: 1px solid var(--app-border-light);
  border-radius: var(--app-radius);
  padding: 14px 16px;
  background: var(--app-card);
}

.file-panel__info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-panel__icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--app-primary-light);
  color: var(--app-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.file-panel__meta {
  min-width: 0;
}

.file-panel__name {
  font-weight: 600;
  color: var(--app-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 240px;
}

.file-panel__size {
  font-size: 13px;
  color: var(--app-text-secondary);
}

.file-panel__actions {
  margin-top: 14px;
  text-align: right;
}

.preview-block {
  margin-top: 20px;
  border-top: 1px solid var(--app-border-light);
  padding-top: 18px;
}

.preview-block__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text-primary);
  margin-bottom: 10px;
}
</style>
