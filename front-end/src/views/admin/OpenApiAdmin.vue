<template>
  <div class="page-container">
    <template v-if="canView">
      <div class="page-header">
        <div class="page-header__main">
          <h2 class="page-title">开放 API</h2>
          <div class="page-desc">创建长期凭证（API Key / PAT），供外部系统经 <code>/api/open/v1</code> 拉取图表、数据集与看板数据</div>
        </div>
        <div class="page-header__actions">
          <a class="doc-link" href="/api/open/docs" target="_blank" rel="noopener">
            <el-icon style="margin-right: 4px"><Document /></el-icon>接口文档
          </a>
        </div>
      </div>

      <div class="page-card">
        <div class="page-card__header">
          <div class="page-card__header-title">API Key 管理</div>
          <div class="page-card__header-right">
            <el-select
              v-model="typeFilter"
              placeholder="全部类型"
              clearable
              style="width: 140px; margin-right: 8px"
              @change="load"
            >
              <el-option label="API Key" value="static" />
              <el-option label="访问令牌 (PAT)" value="pat" />
            </el-select>
            <el-button type="primary" @click="openCreate">
              <el-icon style="margin-right: 4px"><Plus /></el-icon>新建 Key
            </el-button>
          </div>
        </div>

        <el-table :data="rows" stripe v-loading="loading">
          <el-table-column type="index" label="序号" width="60" align="center" />
          <el-table-column prop="name" label="名称" min-width="140" />
          <el-table-column label="类型" width="120">
            <template #default="{ row }">
              <el-tag :type="row.type === 'pat' ? 'warning' : 'primary'" size="small" effect="plain">
                {{ row.type === 'pat' ? '访问令牌' : 'API Key' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="前缀" width="150">
            <template #default="{ row }">
              <code class="mono">{{ row.keyPrefix }}...</code>
            </template>
          </el-table-column>
          <el-table-column label="归属用户" width="120">
            <template #default="{ row }">{{ usersName(row.userId) }}</template>
          </el-table-column>
          <el-table-column label="Scopes" min-width="180">
            <template #default="{ row }">
              <el-tag v-for="s in scopesOf(row)" :key="s" size="small" style="margin-right: 4px">{{ s }}</el-tag>
              <span v-if="row.type === 'pat'" class="muted">继承本人权限</span>
              <span v-else-if="scopesOf(row).length === 0" class="muted">无</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">
                {{ row.status === 'active' ? '启用' : '已停用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="expiresAt" label="过期时间" width="180">
            <template #default="{ row }">{{ row.expiresAt ? formatDateTime(row.expiresAt, appStore.timezone) : '-' }}</template>
          </el-table-column>
          <el-table-column label="最近使用" width="180">
            <template #default="{ row }">{{ row.lastUsedAt ? formatDateTime(row.lastUsedAt, appStore.timezone) : '-' }}</template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openRotate(row)">滚动</el-button>
              <el-button link :type="row.status === 'active' ? 'warning' : 'success'" @click="toggleActive(row)">
                {{ row.status === 'active' ? '停用' : '启用' }}
              </el-button>
              <el-button link type="danger" @click="onDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 新建 Key -->
      <el-dialog v-model="createVisible" title="新建 API Key" width="560px" @closed="resetForm">
        <el-form :model="form" label-width="96px">
          <el-form-item label="名称" required>
            <el-input v-model="form.name" maxlength="100" placeholder="例如：客户大屏取数" />
          </el-form-item>
          <el-form-item label="类型" required>
            <el-radio-group v-model="form.type">
              <el-radio value="static">静态 API Key</el-radio>
              <el-radio value="pat">访问令牌 (PAT，继承该用户权限)</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="归属用户" required>
            <el-select v-model="form.userId" filterable placeholder="选择用户" style="width: 100%">
              <el-option v-for="u in users" :key="u.id" :label="`${u.name || u.email}（${u.email}）`" :value="u.id" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="form.type === 'static'" label="Scopes">
            <el-checkbox-group v-model="form.scopes">
              <el-checkbox v-for="s in scopeOptions" :key="s.value" :value="s.value">{{ s.label }}</el-checkbox>
            </el-checkbox-group>
          </el-form-item>
          <el-form-item label="过期时间">
            <el-date-picker v-model="form.expiresAt" type="datetime" placeholder="留空 = 永不过期" value-format="YYYY-MM-DDTHH:mm:ss" style="width: 100%" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="createVisible = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="onCreate">创建</el-button>
        </template>
      </el-dialog>

      <!-- 一次性明文 -->
      <el-dialog v-model="secretVisible" title="请立即保存 Key" width="560px" :close-on-click-modal="false">
        <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 12px">
          该凭证仅在此次创建 / 滚动时明文展示一次，关闭后无法再次查看。请妥善保存。
        </el-alert>
        <el-input v-model="secretText" readonly>
          <template #append>
            <el-button @click="copySecret">复制</el-button>
          </template>
        </el-input>
      </el-dialog>
    </template>
    <el-empty v-if="!canView" description="无权限访问该页面" />
  </div>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminApi } from '@/api'
import { openApiAdminApi, OPEN_SCOPES } from '@/api/open'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/utils/datetime'
import { useAppStore } from '@/stores/app'

const auth = useAuthStore()
const appStore = useAppStore()
const canView = computed(() => auth.hasPermission('apikey', 'manage'))

const rows = ref([])
const users = ref([])
const typeFilter = ref('')
const loading = ref(false)
const scopeOptions = OPEN_SCOPES.map((s) => ({ value: s, label: s }))

const createVisible = ref(false)
const saving = ref(false)
const form = ref({ name: '', type: 'static', userId: null, scopes: [], expiresAt: null })
function resetForm() {
  form.value = { name: '', type: 'static', userId: null, scopes: [], expiresAt: null }
}

const secretVisible = ref(false)
const secretText = ref('')

const owners = {}
function usersName(id) {
  const u = users.value.find((x) => x.id === id)
  return u ? u.name || u.email : `#${id}`
}
function scopesOf(row) {
  return row.scopes || []
}

function copySecret() {
  navigator.clipboard?.writeText(secretText.value)
  ElMessage.success('已复制')
}
function openCreate() {
  resetForm()
  createVisible.value = true
}
async function onCreate() {
  if (!form.value.name.trim()) return ElMessage.warning('请输入名称')
  if (!form.value.userId) return ElMessage.warning('请选择归属用户')
  saving.value = true
  try {
    const r = await openApiAdminApi.create({
      name: form.value.name,
      type: form.value.type,
      userId: form.value.userId,
      scopes: form.value.type === 'static' ? form.value.scopes : [],
      expiresAt: form.value.expiresAt || null,
    })
    createVisible.value = false
    secretText.value = r.plaintext
    secretVisible.value = true
    ElMessage.success('API Key 已创建')
    await load()
  } finally {
    saving.value = false
  }
}
async function openRotate(row) {
  await ElMessageBox.confirm(`滚动后将立即使旧 Key 失效，确认滚动「${row.name}」？`, '滚动 Key', { type: 'warning' })
  const r = await openApiAdminApi.rotate(row.id)
  secretText.value = r.plaintext
  secretVisible.value = true
  ElMessage.success('已滚动，请保存新 Key')
  await load()
}
async function toggleActive(row) {
  const next = row.status === 'active' ? false : true
  await openApiAdminApi.update(row.id, { isActive: next })
  ElMessage.success(next ? '已启用' : '已停用')
  await load()
}
async function onDelete(row) {
  await ElMessageBox.confirm(`删除「${row.name}」后将立即失效，且不可恢复。确认删除？`, '删除 Key', { type: 'danger' })
  await openApiAdminApi.remove(row.id)
  ElMessage.success('已删除')
  await load()
}
async function load() {
  loading.value = true
  try {
    const r = await openApiAdminApi.list(typeFilter.value ? { type: typeFilter.value } : {})
    rows.value = r.list
  } finally {
    loading.value = false
  }
}
async function loadUsers() {
  try {
    const r = await adminApi.users({ page: 1, pageSize: 500 })
    users.value = r.list || []
  } catch (e) { /* 无权限时不阻塞 */ }
}
onMounted(() => {
  load()
  loadUsers()
})
</script>
<style scoped>
.doc-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--app-primary);
  font-size: 14px;
  text-decoration: none;
}
.doc-link:hover {
  text-decoration: underline;
}
</style>