<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__main">
        <h2 class="page-title">访问令牌</h2>
        <div class="page-desc">个人访问令牌（PAT）用于外部系统调用开放 API（<code>/api/open/v1</code>），权限范围等同你的账号</div>
      </div>
    </div>

    <div class="page-card">
      <div class="page-card__header">
        <div class="page-card__header-title">我的令牌</div>
        <div class="page-card__header-right">
          <el-button type="primary" @click="createVisible = true">
            <el-icon style="margin-right: 4px"><Plus /></el-icon>新建令牌
          </el-button>
        </div>
      </div>

      <el-table :data="rows" stripe v-loading="loading">
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column prop="name" label="名称" min-width="160" />
        <el-table-column label="前缀" width="150">
          <template #default="{ row }"><code class="mono">{{ row.keyPrefix }}...</code></template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">
              {{ row.status === 'active' ? '启用' : '已停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.createdAt, appStore.timezone) }}</template>
        </el-table-column>
        <el-table-column label="过期时间" width="180">
          <template #default="{ row }">{{ row.expiresAt ? formatDateTime(row.expiresAt, appStore.timezone) : '-' }}</template>
        </el-table-column>
        <el-table-column label="最近使用" width="180">
          <template #default="{ row }">{{ row.lastUsedAt ? formatDateTime(row.lastUsedAt, appStore.timezone) : '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="onRotate(row)">滚动</el-button>
            <el-button link :type="row.status === 'active' ? 'warning' : 'success'" @click="onToggle(row)">
              {{ row.status === 'active' ? '停用' : '启用' }}
            </el-button>
            <el-button link type="danger" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="createVisible" title="新建访问令牌" width="460px" @closed="resetForm">
      <el-form :model="form" label-width="96px" @submit.prevent>
        <el-form-item label="名称" required>
          <el-input v-model="form.name" maxlength="100" placeholder="例如：CI 发布集成" @keyup.enter="onCreate" />
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

    <el-dialog v-model="secretVisible" title="请立即保存令牌" width="560px" :close-on-click-modal="false">
      <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 12px">
        令牌仅在此次创建 / 滚动时明文展示一次，关闭后无法再次查看。请妥善保存。
      </el-alert>
      <el-input v-model="secretText" readonly>
        <template #append><el-button @click="copySecret">复制</el-button></template>
      </el-input>
    </el-dialog>
  </div>
</template>
<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { tokenApi } from '@/api/open'
import { formatDateTime } from '@/utils/datetime'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const rows = ref([])
const loading = ref(false)
const createVisible = ref(false)
const saving = ref(false)
const form = ref({ name: '', expiresAt: null })
const secretVisible = ref(false)
const secretText = ref('')

function resetForm() {
  form.value = { name: '', expiresAt: null }
}

function copySecret() {
  navigator.clipboard?.writeText(secretText.value)
  ElMessage.success('已复制')
}
async function onCreate() {
  if (!form.value.name.trim()) return ElMessage.warning('请输入名称')
  saving.value = true
  try {
    const r = await tokenApi.create({ name: form.value.name, expiresAt: form.value.expiresAt || null })
    createVisible.value = false
    secretText.value = r.plaintext
    secretVisible.value = true
    ElMessage.success('令牌已创建')
    await load()
  } finally {
    saving.value = false
  }
}
async function onRotate(row) {
  await ElMessageBox.confirm(`滚动后旧令牌立即失效，确认滚动「${row.name}」？`, '滚动令牌', { type: 'warning' })
  const r = await tokenApi.rotate(row.id)
  secretText.value = r.plaintext
  secretVisible.value = true
  ElMessage.success('已滚动，请保存新令牌')
  await load()
}
async function onToggle(row) {
  const next = row.status === 'active' ? false : true
  await tokenApi.update(row.id, { isActive: next })
  ElMessage.success(next ? '已启用' : '已停用')
  await load()
}
async function onDelete(row) {
  await ElMessageBox.confirm(`删除「${row.name}」后立即失效且不可恢复，确认删除？`, '删除令牌', { type: 'danger' })
  await tokenApi.remove(row.id)
  ElMessage.success('已删除')
  await load()
}
async function load() {
  loading.value = true
  try {
    const r = await tokenApi.list()
    rows.value = r.list
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>