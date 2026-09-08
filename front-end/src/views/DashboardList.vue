<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__main">
        <h2 class="page-title">看板中心</h2>
        <div class="page-desc">将已建图表编排到看板中，通过筛选组件逐张联动</div>
      </div>
      <div class="page-header__actions">
        <el-input
          v-model="newName"
          placeholder="新看板名称"
          style="width: 200px"
          maxlength="100"
          clearable
          @keyup.enter="create"
        />
        <el-button type="primary" :disabled="!newName.trim()" @click="create">
          <el-icon style="margin-right: 4px"><Plus /></el-icon>新建看板
        </el-button>
      </div>
    </div>

    <div class="page-card">
      <div class="page-card__header">
        <div class="page-card__header-title">看板列表</div>
        <div class="page-card__header-right">
          <el-tag type="info" effect="plain">共 {{ total }} 个看板</el-tag>
        </div>
      </div>

      <el-table :data="dashboards" v-loading="loading" height="calc(100vh - 275px)" empty-text="还没有看板，输入名称创建一个">
        <el-table-column prop="name" label="名称" min-width="220">
          <template #default="{ row }">
            <div class="cell-name">
              <div class="cell-name__icon"><el-icon><Odometer /></el-icon></div>
              <el-link type="primary" @click="$router.push(`/dashboards/${row.id}`)">{{ row.name }}</el-link>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="组件数" width="120" align="center">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.layout.length }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="190">
          <template #default="{ row }">
            <span class="cell-muted">{{ formatDate(row.updatedAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="$router.push(`/dashboards/${row.id}`)">查看</el-button>
            <el-button link type="primary" size="small" @click="$router.push(`/dashboards/${row.id}/edit`)">编辑</el-button>
            <el-button link type="danger" size="small" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="page-card__footer">
        <el-pagination
          layout="total, sizes, prev, pager, next"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          :page-sizes="[10, 20, 50]"
          background
          @size-change="onSizeChange"
          @current-change="onPageChange"
        />
      </div>
    </div>
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
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

function formatDate(s) {
  return s ? String(s).replace('T', ' ').slice(0, 19) : '-'
}

async function load() {
  loading.value = true
  try {
    const res = await dashboardApi.listPaged(page.value, pageSize.value)
    dashboards.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function onPageChange(p) {
  page.value = p
  load()
}

function onSizeChange(size) {
  pageSize.value = size
  page.value = 1
  load()
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

<style scoped>
.cell-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cell-name__icon {
  width: 26px;
  height: 26px;
  border-radius: var(--app-radius);
  background: var(--app-primary-light);
  color: var(--app-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cell-muted {
  color: var(--app-text-secondary);
  font-size: 13px;
}
</style>