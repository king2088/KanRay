<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">看板中心</h2>
      <div>
        <el-input v-model="newName" placeholder="新看板名称" style="width: 200px; margin-right: 8px" maxlength="100" @keyup.enter="create" />
        <el-button type="primary" :disabled="!newName.trim()" @click="create">
          <el-icon style="margin-right: 4px"><Plus /></el-icon>新建看板
        </el-button>
      </div>
    </div>

    <el-card shadow="never">
      <el-table :data="dashboards" v-loading="loading" empty-text="还没有看板，输入名称创建一个">
        <el-table-column prop="name" label="名称" min-width="200">
          <template #default="{ row }">
            <el-link type="primary" @click="$router.push(`/dashboards/${row.id}`)">{{ row.name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column label="组件数" width="120">
          <template #default="{ row }">{{ row.layout.length }}</template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="200">
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="$router.push(`/dashboards/${row.id}`)">查看</el-button>
            <el-button link type="primary" size="small" @click="$router.push(`/dashboards/${row.id}/edit`)">编辑</el-button>
            <el-button link type="danger" size="small" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { dashboardApi } from '@/api'

const router = useRouter()
const dashboards = ref([])
const loading = ref(false)
const newName = ref('')

function formatDate(s) {
  return s ? String(s).replace('T', ' ').slice(0, 19) : '-'
}

async function load() {
  loading.value = true
  try {
    dashboards.value = await dashboardApi.list()
  } finally {
    loading.value = false
  }
}

async function create() {
  const name = newName.value.trim()
  if (!name) return
  const d = await dashboardApi.create(name)
  ElMessage.success('看板创建成功')
  newName.value = ''
  router.push(`/dashboards/${d.id}/edit`)
}

async function remove(row) {
  await ElMessageBox.confirm(`确定删除看板「${row.name}」？`, '删除确认', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  })
  await dashboardApi.remove(row.id)
  ElMessage.success('删除成功')
  load()
}

onMounted(load)
</script>