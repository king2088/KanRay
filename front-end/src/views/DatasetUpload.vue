<template>
  <div class="page-container" style="max-width: 1100px; margin: 0 auto">
    <div class="page-header">
      <h2 class="page-title">上传数据</h2>
      <el-button @click="$router.push('/datasets')">返回</el-button>
    </div>

    <el-steps :active="step" align-center style="margin: 8px 0 28px">
      <el-step title="选择文件" />
      <el-step title="确认字段" />
      <el-step title="完成" />
    </el-steps>

    <!-- Step 1: 选择文件 -->
    <el-card v-if="step === 0" shadow="never">
      <el-upload
        drag
        :auto-upload="false"
        :show-file-list="false"
        accept=".xlsx,.xls,.csv"
        :on-change="onFileChange"
        :limit="1"
      >
        <el-icon class="el-icon--upload" :size="60"><UploadFilled /></el-icon>
        <div class="el-upload__text">将 Excel / CSV 拖到此处，或<em>点击选择文件</em></div>
        <template #tip>
          <div class="el-upload__tip">
            支持 .xlsx / .xls / .csv 格式，单文件不超过 20MB、不超过 20 万行。第一行作为列名。
          </div>
        </template>
      </el-upload>

      <div v-if="selectedFile" style="margin-top: 16px; display: flex; align-items: center; gap: 12px">
        <el-icon :size="20" color="#409eff"><Document /></el-icon>
        <span>{{ selectedFile.name }}</span>
        <span style="color: #909399">({{ (selectedFile.size / 1024 / 1024).toFixed(2) }} MB)</span>
        <el-input
          v-model="datasetName"
          placeholder="数据集名称（可选，默认使用文件名）"
          style="width: 280px; margin-left: 8px"
          maxlength="100"
        />
      </div>

      <div v-if="selectedFile" style="margin-top: 16px; text-align: right">
        <el-button type="primary" :loading="parsing" @click="doPreview">
          <el-icon style="margin-right: 4px"><MagicStick /></el-icon>下一步：解析并预览
        </el-button>
      </div>
    </el-card>

    <!-- Step 2: 确认字段 -->
    <el-card v-if="step === 1" shadow="never">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>
            确认字段类型（系统已自动识别，可手工调整）
            <el-tag size="small" style="margin-left: 8px">共 {{ preview.rowCount }} 行</el-tag>
          </span>
          <div>
            <el-button @click="step = 0">上一步</el-button>
            <el-button type="primary" :loading="creating" @click="doCreate">
              <el-icon style="margin-right: 4px"><Check /></el-icon>创建数据集
            </el-button>
          </div>
        </div>
      </template>

      <el-table :data="previewHeader" border>
        <el-table-column type="index" label="#" width="50" />
        <el-table-column prop="label" label="字段名（原始）" min-width="140" />
        <el-table-column prop="key" label="内部字段名" min-width="140" show-overflow-tooltip />
        <el-table-column label="字段类型" width="160">
          <template #default="{ row }">
            <el-select v-model="row.type" size="default">
              <el-option label="文本" value="string" />
              <el-option label="整数" value="integer" />
              <el-option label="小数" value="number" />
              <el-option label="日期" value="date" />
              <el-option label="布尔" value="boolean" />
            </el-select>
          </template>
        </el-table-column>
      </el-table>

      <div style="margin-top: 16px">
        <div style="font-weight: 600; margin-bottom: 8px">数据预览（前 {{ preview.previewRows.length }} 行）</div>
        <el-table :data="preview.previewRows" border max-height="360" size="small">
          <el-table-column v-for="h in previewHeader" :key="h.key" :prop="h.key" :label="h.label" min-width="120" show-overflow-tooltip />
        </el-table>
      </div>
    </el-card>

    <!-- Step 3: 完成 -->
    <el-card v-if="step === 2" shadow="never" style="text-align: center; padding: 40px">
      <el-result icon="success" :title="`数据集「${createdName}」创建成功`" :sub-title="`共 ${createdRowCount} 行数据`">
        <template #extra>
          <el-button type="primary" @click="$router.push(`/charts/new?dataset=${createdId}`)">去创建图表</el-button>
          <el-button @click="$router.push('/datasets')">返回数据集列表</el-button>
        </template>
      </el-result>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { UploadFilled, Document, MagicStick, Check } from '@element-plus/icons-vue'
import { datasetApi } from '@/api'

const route = useRoute()
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
    // 支持从图表页跳回：若有 query 参数
    if (route.query.from) router.replace({ path: '/datasets' })
  } finally {
    creating.value = false
  }
}
</script>