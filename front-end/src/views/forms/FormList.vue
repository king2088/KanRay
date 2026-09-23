<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__main">
        <h2 class="page-title">表单中心</h2>
        <div class="page-desc">拖拽设计表单，发布后自动建表；提交数据可被图表/看板直接查询</div>
      </div>
      <div class="page-header__actions">
        <el-button type="primary" @click="create">
          <el-icon style="margin-right: 4px"><Plus /></el-icon>新建表单
        </el-button>
      </div>
    </div>

    <div class="page-card">
      <div class="page-card__header">
        <div class="page-card__header-title">表单列表</div>
        <div class="page-card__header-right">
          <el-input
            v-model="search"
            placeholder="搜索表单名称"
            clearable
            style="width: 240px"
            :prefix-icon="Search"
          />
          <el-tag type="info" effect="plain">共 {{ total }} 条</el-tag>
        </div>
      </div>

      <el-table :data="filtered" v-loading="loading" empty-text="还没有表单，点右上角新建">
        <el-table-column prop="name" label="名称" min-width="200">
          <template #default="{ row }">
            <div class="cell-name">
              <div class="cell-name__icon"><el-icon><Tickets /></el-icon></div>
              <el-link type="primary" @click="$router.push(`/forms/${row.id}/design`)">{{ row.name }}</el-link>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="cell-muted">{{ row.description || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" effect="plain">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="180">
          <template #default="{ row }">
            <span class="cell-muted">{{ formatDateTime(row.updatedAt, appStore.timezone) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="300" fixed="right" align="center">
          <template #default="{ row }">
            <el-button v-if="canShare" link type="primary" @click="openShare(row)">
              <el-icon style="margin-right: 2px"><Share /></el-icon>分享
            </el-button>
            <el-button link type="primary" @click="$router.push(`/forms/${row.id}/design`)">设计</el-button>
            <el-button link type="primary" @click="$router.push(`/forms/${row.id}/fill`)">填写</el-button>
            <el-button link type="primary" @click="$router.push(`/forms/${row.id}/submissions`)">记录</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
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

    <FormShareDialog v-if="shareDialog.open" v-model="shareDialog.open" :form-id="shareDialog.formId" :name="shareDialog.name" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Share, Tickets } from '@element-plus/icons-vue'
import { formApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { formatDateTime } from '@/utils/datetime'
import FormShareDialog from '@/components/form/FormShareDialog.vue'

const router = useRouter()
const auth = useAuthStore()
const appStore = useAppStore()
const canShare = computed(() => auth.hasPermission('form', 'share'))

const forms = ref([])
const loading = ref(false)
const search = ref('')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const shareDialog = ref({ open: false, formId: 0, name: '' })

const filtered = computed(() => {
  const kw = search.value.trim().toLowerCase()
  if (!kw) return forms.value
  return forms.value.filter((d) => d.name.toLowerCase().includes(kw))
})

function statusLabel(s) {
  return { draft: '草稿', published: '已发布', closed: '已关闭' }[s] || s
}
function statusType(s) {
  return { draft: 'info', published: 'success', closed: 'warning' }[s] || 'info'
}

async function load() {
  loading.value = true
  try {
    const res = await formApi.list()
    forms.value = res
    total.value = res.length
  } finally {
    loading.value = false
  }
}

async function create() {
  try {
    const { value } = await ElMessageBox.prompt('给表单起个名字', '新建表单', {
      inputValidator: (v) => (v && v.trim() ? true : '名称不能为空'),
      inputPlaceholder: '如：员工满意度调查',
    })
    const f = await formApi.create(value)
    ElMessage.success('已创建，开始设计吧')
    router.push(`/forms/${f.id}/design`)
  } catch (e) {
    if (e === 'cancel' || e?.action === 'cancel') return
  }
}

function openShare(row) {
  shareDialog.value = { open: true, formId: row.id, name: row.name }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(`确定删除表单「${row.name}」？将同时删除其数据表与全部提交记录`, '删除确认', { type: 'warning' })
  } catch (e) {
    return
  }
  await formApi.remove(row.id)
  ElMessage.success('已删除')
  load()
}

function onSizeChange(v) {
  pageSize.value = v
  page.value = 1
  load()
}
function onPageChange(v) {
  page.value = v
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
  color: var(--el-text-color-secondary);
}
</style>