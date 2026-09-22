<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__main">
        <h2 class="page-title">大屏设计</h2>
        <div class="page-desc">从零开始设计可视化大屏，支持数据集绑定与发布分享</div>
      </div>
      <div class="page-header__actions">
        <el-button type="primary" @click="create">
          <el-icon style="margin-right: 4px"><Plus /></el-icon>新建大屏
        </el-button>
      </div>
    </div>

    <div class="page-card">
      <div class="page-card__header">
        <div class="page-card__header-title">大屏列表</div>
        <div class="page-card__header-right">
          <el-input v-model="search" placeholder="搜索大屏名称" clearable style="width: 240px" :prefix-icon="Search" />
          <el-tag type="info" effect="plain">共 {{ total }} 条</el-tag>
        </div>
      </div>

      <el-table :data="filtered" v-loading="loading" empty-text="还没有大屏，输入名称创建一个">
        <el-table-column prop="name" label="名称" min-width="220">
          <template #default="{ row }">
            <div class="cell-name">
              <div class="cell-name__icon"><el-icon><Monitor /></el-icon></div>
              <el-link type="primary" @click="$router.push(`/big-screen/design/${row.id}`)">{{ row.name }}</el-link>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">{{ fmt(row.created_at) }}</template>
        </el-table-column>
        <el-table-column prop="updated_at" label="更新时间" width="180">
          <template #default="{ row }">{{ fmt(row.updated_at) }}</template>
        </el-table-column>
        <el-table-column fixed="right" label="操作" width="180" align="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="$router.push(`/big-screen/preview/${row.id}`)">预览</el-button>
            <el-button link type="primary" @click="openShare(row)">分享</el-button>
            <el-popconfirm title="确定删除该大屏吗？" @confirm="remove(row)">
              <template #reference><el-button link type="danger">删除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="total > pageSize" class="page-card__footer">
        <el-pagination background layout="prev, pager, next" :page-size="pageSize" :total="total" v-model:current-page="page" />
      </div>
    </div>

    <el-dialog v-model="showCreate" title="新建大屏" width="420px" @close="createForm.name = ''">
      <el-form @submit.prevent="submitCreate">
        <el-form-item label="大屏名称" required>
          <el-input v-model.trim="createForm.name" placeholder="请输入大屏名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="submitCreate">确定</el-button>
      </template>
    </el-dialog>

    <ShareDialog v-model="share.show" :shares="share.list" :creating="share.creating" @create="createShare" @toggle="toggleShare" @expire="expireShare" @delete="deleteShare" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Search, Monitor } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { bigScreenApi } from '@/api'
import ShareDialog from '@/components/dashboard/ShareDialog.vue'

const router = useRouter()
const loading = ref(false)
const items = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const search = ref('')
const showCreate = ref(false)
const creating = ref(false)
const createForm = ref({ name: '' })
const share = ref({ show: false, creating: false, list: [], screenId: null })

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter((x) => (x.name || '').toLowerCase().includes(q))
})

function fmt(t) {
  return t ? dayjs(t).format('YYYY-MM-DD HH:mm') : ''
}

async function fetchList() {
  loading.value = true
  try {
    const { list, total: t } = await bigScreenApi.listPaged(page.value, pageSize.value)
    items.value = list || []
    total.value = t || items.value.length
  } catch (e) {
    ElMessage.error(e.message || '获取大屏列表失败')
  } finally {
    loading.value = false
  }
}

onMounted(fetchList)
watch([page, pageSize], fetchList)

function create() {
  createForm.value.name = ''
  showCreate.value = true
}

async function submitCreate() {
  if (!createForm.value.name.trim()) {
    ElMessage.warning('请填写大屏名称')
    return
  }
  creating.value = true
  try {
    const d = await bigScreenApi.create({ name: createForm.value.name.trim(), config: '{}', components: '[]' })
    showCreate.value = false
    router.push(`/big-screen/design/${d.id}`)
  } catch (e) {
    ElMessage.error(e.message || '创建失败')
  } finally {
    creating.value = false
  }
}

async function remove(row) {
  try {
    await bigScreenApi.remove(row.id)
    ElMessage.success('删除成功')
    fetchList()
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  }
}

async function openShare(row) {
  share.value.screenId = row.id
  try {
    share.value.list = await bigScreenApi.shares(row.id)
  } catch (e) {
    share.value.list = []
  }
  share.value.show = true
}

async function createShare({ password, expiresAt }) {
  share.value.creating = true
  try {
    await bigScreenApi.createShare(share.value.screenId, { password: password || null, expiresAt: expiresAt || null })
    share.value.list = await bigScreenApi.shares(share.value.screenId)
    ElMessage.success('分享创建成功')
  } catch (e) {
    ElMessage.error(e.message || '创建分享失败')
  } finally {
    share.value.creating = false
  }
}

async function toggleShare(s) {
  try {
    await bigScreenApi.updateShare(s.id, { isActive: !s.isActive })
    share.value.list = await bigScreenApi.shares(share.value.screenId)
  } catch (e) {
    ElMessage.error(e.message || '更新失败')
  }
}

async function expireShare(s, expiresAt) {
  try {
    await bigScreenApi.updateShare(s.id, { expiresAt })
    share.value.list = await bigScreenApi.shares(share.value.screenId)
  } catch (e) {
    ElMessage.error(e.message || '更新失败')
  }
}

async function deleteShare(s) {
  try {
    await bigScreenApi.deleteShare(s.id)
    share.value.list = await bigScreenApi.shares(share.value.screenId)
    ElMessage.success('删除成功')
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  }
}
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
</style>