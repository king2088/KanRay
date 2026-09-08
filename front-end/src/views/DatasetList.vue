<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">数据管理</h2>
      <el-button type="primary" @click="$router.push('/datasets/new')">
        <el-icon style="margin-right: 4px"><Upload /></el-icon>上传数据
      </el-button>
    </div>

    <el-card shadow="never">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <el-input
            v-model="search"
            placeholder="搜索数据集名称"
            clearable
            style="width: 260px"
            :prefix-icon="Search"
          />
          <span>共 {{ datasets.length }} 个数据集</span>
        </div>
      </template>

      <el-table :data="filtered" v-loading="loading" empty-text="还没有数据集，点击右上角「上传数据」开始">
        <el-table-column prop="name" label="名称" min-width="160">
          <template #default="{ row }">
            <el-link type="primary" @click="$router.push(`/datasets/${row.id}`)">{{ row.name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="row_count" label="行数" width="120" />
        <el-table-column prop="column_count" label="列数" width="100" />
        <el-table-column prop="original_file" label="来源文件" min-width="140" show-overflow-tooltip />
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openRename(row)">重命名</el-button>
            <el-button link type="primary" size="small" @click="$router.push(`/datasets/${row.id}`)">查看</el-button>
            <el-button link type="danger" size="small" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="renameVisible" title="重命名数据集" width="420px">
      <el-input v-model="renameName" placeholder="请输入新的数据集名称" maxlength="100" />
      <template #footer>
        <el-button @click="renameVisible = false">取消</el-button>
        <el-button type="primary" :loading="renaming" @click="confirmRename">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { datasetApi } from '@/api'

const datasets = ref([])
const loading = ref(false)
const search = ref('')
const renameVisible = ref(false)
const renameName = ref('')
const renaming = ref(false)
let renamingId = null

const filtered = computed(() => {
  const kw = search.value.trim().toLowerCase()
  if (!kw) return datasets.value
  return datasets.value.filter((d) => d.name.toLowerCase().includes(kw))
})

function formatDate(s) {
  return s ? String(s).replace('T', ' ').slice(0, 19) : '-'
}

async function load() {
  loading.value = true
  try {
    datasets.value = await datasetApi.list()
  } finally {
    loading.value = false
  }
}

function openRename(row) {
  renamingId = row.id
  renameName.value = row.name
  renameVisible.value = true
}

async function confirmRename() {
  if (!renameName.value.trim()) return ElMessage.warning('名称不能为空')
  renaming.value = true
  try {
    await datasetApi.rename(renamingId, renameName.value.trim())
    ElMessage.success('重命名成功')
    renameVisible.value = false
    load()
  } finally {
    renaming.value = false
  }
}

async function remove(row) {
  await ElMessageBox.confirm(`确定删除数据集「${row.name}」？删除后其下图表数据将不可用。`, '删除确认', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  })
  await datasetApi.remove(row.id)
  ElMessage.success('删除成功')
  load()
}

onMounted(load)
</script>