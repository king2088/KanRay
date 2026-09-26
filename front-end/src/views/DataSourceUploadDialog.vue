<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :title="t('dataset.dataSource.uploadExcelCsv')"
    width="80%"
    align-center
    destroy-on-close
    :body-style="{ maxHeight: 'calc(80vh - 100px)', overflowY: 'auto' }"
    class="upload-dialog"
    @closed="resetWizard"
  >
    <div class="upload-dialog__body">
      <el-steps :active="step" align-center class="wizard-steps" finish-status="success">
        <el-step :title="t('dataset.dataSource.upload.stepFile')" :description="t('dataset.dataSource.upload.stepFileDesc')" />
        <el-step :title="t('dataset.dataSource.upload.stepFields')" :description="t('dataset.dataSource.upload.stepFieldsDesc')" />
        <el-step :title="t('dataset.dataSource.upload.stepDone')" :description="t('dataset.dataSource.upload.stepDoneDesc')" />
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
            <div class="el-upload__text">{{ t('dataset.dataSource.upload.dragBefore') }}<em>{{ t('dataset.dataSource.upload.dragClick') }}</em></div>
            <template #tip>
              <div class="el-upload__tip">
                {{ t('dataset.dataSource.upload.dragTip') }}
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
                :placeholder="t('dataset.dataSource.upload.namePlaceholder')"
                style="width: 320px; margin-left: auto"
                maxlength="100"
              />
              <el-input
                v-model="sheetName"
                :placeholder="t('dataset.dataSource.upload.sheetPlaceholder')"
                style="width: 220px"
                clearable
              />
            </div>
            <div class="file-panel__actions">
              <el-button type="primary" :loading="parsing" @click="doPreview">
                <el-icon style="margin-right: 6px"><MagicStick /></el-icon>{{ t('dataset.dataSource.upload.nextParse') }}
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 2: 确认字段 -->
      <div v-if="step === 1" class="page-card">
        <div class="page-card__header">
          <div class="page-card__header-title">
            {{ t('dataset.dataSource.upload.confirmFieldsTitle') }}
            <el-tag type="info" effect="plain" style="margin-left: 8px">{{ t('dataset.dataSource.upload.rowCount', { count: preview.rowCount }) }}</el-tag>
          </div>
          <div class="page-card__header-right">
            <el-button @click="step = 0">{{ t('dataset.dataSource.upload.prevStep') }}</el-button>
            <el-button type="primary" :loading="creating" @click="doCreate">
              <el-icon style="margin-right: 6px"><Check /></el-icon>{{ t('dataset.dataSource.upload.createDataset') }}
            </el-button>
          </div>
        </div>
        <div class="page-card__body">
          <el-table :data="previewHeader">
            <el-table-column type="index" label="#" width="54" align="center" />
            <el-table-column prop="label" :label="t('dataset.dataSource.upload.colLabel')" min-width="160" />
            <el-table-column prop="key" :label="t('dataset.dataSource.upload.colKey')" min-width="160" show-overflow-tooltip />
            <el-table-column :label="t('dataset.dataSource.upload.colType')" width="170" align="center">
              <template #default="{ row }">
                <el-select v-model="row.type">
                  <el-option :label="t('dataset.fieldType.string')" value="string" />
                  <el-option :label="t('dataset.fieldType.integer')" value="integer" />
                  <el-option :label="t('dataset.fieldType.number')" value="number" />
                  <el-option :label="t('dataset.fieldType.date')" value="date" />
                  <el-option :label="t('dataset.fieldType.boolean')" value="boolean" />
                </el-select>
              </template>
            </el-table-column>
          </el-table>

          <div class="preview-block">
            <div class="preview-block__title">{{ t('dataset.dataSource.upload.previewTitle', { count: preview.previewRows.length }) }}</div>
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
          <el-result
            icon="success"
            :title="t('dataset.dataSource.upload.resultTitle', { name: createdName })"
            :sub-title="t('dataset.dataSource.upload.resultSub', { count: createdRowCount })"
          >
            <template #extra>
              <el-button type="primary" @click="goChart">
                <el-icon style="margin-right: 6px"><DataAnalysis /></el-icon>{{ t('dataset.dataSource.upload.goChart') }}
              </el-button>
              <el-button @click="doClose">{{ t('dataset.dataSource.upload.done') }}</el-button>
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
import { t } from '@/i18n'

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue', 'created'])
const router = useRouter()

const step = ref(0)
const selectedFile = ref(null)
const datasetName = ref('')
const sheetName = ref('')
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
  sheetName.value = ''
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
  if (!selectedFile.value) return ElMessage.warning(t('dataset.dataSource.upload.selectFileFirst'))
  parsing.value = true
  try {
    preview.value = await datasetApi.preview(selectedFile.value, sheetName.value.trim())
    previewHeader.value = preview.value.header.map((h) => ({ ...h }))
    step.value = 1
  } finally {
    parsing.value = false
  }
}

async function doCreate() {
  creating.value = true
  try {
    const name = datasetName.value.trim() || (selectedFile.value ? selectedFile.value.name : t('dataset.dataSource.upload.untitled'))
    const ds = await datasetApi.create(selectedFile.value, name, sheetName.value.trim())
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
  background: var(--app-surface);
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
