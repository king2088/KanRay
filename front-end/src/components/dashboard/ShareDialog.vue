<template>
  <el-dialog
    :model-value="modelValue"
    :title="`分享看板：${name}`"
    width="680px"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="share-create">
      <el-input v-model="password" type="password" show-password placeholder="访问密码（4-64 位）" style="width: 200px" />
      <el-date-picker v-model="expiresAt" type="datetime" placeholder="过期时间（可选）"
        value-format="YYYY-MM-DDTHH:mm:ssZ" style="width: 200px" />
      <el-button type="primary" :loading="creating" @click="create">创建分享</el-button>
    </div>

    <el-table :data="shares" v-loading="loading" empty-text="还没有分享链接">
      <el-table-column label="链接" min-width="260">
        <template #default="{ row }">
          <span class="share-link">{{ shareUrl(row) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="过期时间" width="150">
        <template #default="{ row }">{{ row.expiresAt ? formatDate(row.expiresAt) : '永久' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="70" align="center">
        <template #default="{ row }">
          <el-switch :model-value="!!row.isActive" @change="(v) => toggleActive(row, v)" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140" align="center">
        <template #default="{ row }">
          <el-button link type="primary" @click="copy(row)">复制链接</el-button>
          <el-button link type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { dashboardApi } from '@/api'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  dashboardId: { type: Number, required: true },
  name: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const shares = ref([])
const loading = ref(false)
const creating = ref(false)
const password = ref('')
const expiresAt = ref(null)

function shareUrl(row) {
  return `${window.location.origin}/s/${row.token}`
}

function formatDate(s) {
  return s ? String(s).replace('T', ' ').slice(0, 16) : '-'
}

async function load() {
  loading.value = true
  try {
    shares.value = (await dashboardApi.shares(props.dashboardId)) || []
  } finally {
    loading.value = false
  }
}

async function create() {
  if (!password.value || password.value.length < 4) return ElMessage.warning('访问密码至少 4 位')
  creating.value = true
  try {
    const s = await dashboardApi.createShare(props.dashboardId, {
      password: password.value,
      expiresAt: expiresAt.value || null,
    })
    shares.value.unshift(s)
    password.value = ''
    expiresAt.value = null
    ElMessage.success('分享创建成功')
  } finally {
    creating.value = false
  }
}

async function toggleActive(row, v) {
  await dashboardApi.updateShare(row.id, { isActive: v })
  row.isActive = v ? 1 : 0
  ElMessage.success(v ? '已启用' : '已停用')
}

async function remove(row) {
  await dashboardApi.deleteShare(row.id)
  shares.value = shares.value.filter((s) => s.id !== row.id)
  ElMessage.success('分享已删除')
}

async function copy(row) {
  try {
    await navigator.clipboard.writeText(shareUrl(row))
    ElMessage.success('链接已复制')
  } catch (e) {
    ElMessage.warning('复制失败，请手动复制')
  }
}

onMounted(load)
</script>

<style scoped>
.share-create {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.share-link {
  font-size: 12px;
  color: #606266;
  word-break: break-all;
}
</style>