<template>
  <div class="admin-page">
    <template v-if="canView">
      <div class="page-header">
        <div class="page-header__main">
          <h2 class="page-title">用户管理</h2>
          <div class="page-desc">管理平台账号，分配角色并控制登录状态</div>
        </div>
        <div class="page-header__actions">
          <el-button type="primary" @click="openCreate">新建用户</el-button>
        </div>
      </div>

      <el-table :data="rows" border stripe v-loading="loading">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="email" label="邮箱" min-width="180" />
      <el-table-column prop="name" label="昵称" min-width="120" />
      <el-table-column label="角色" min-width="160">
        <template #default="{ row }">
          <el-tag v-for="r in row.roles" :key="r"  style="margin-right: 4px">{{ roleNameMap[r] || r }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-switch v-model="row.is_active" :disabled="row.id === auth.user?.id" @change="toggleActive(row)" />
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="170" />
      <el-table-column label="操作" width="230" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEditRoles(row)">分配角色</el-button>
          <el-button link type="primary" @click="openResetPw(row)">重置密码</el-button>
          <el-button v-if="row.id !== auth.user?.id" link type="danger" @click="remove(row)">删除</el-button>
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

    <!-- 新建用户 -->
    <el-dialog v-model="createOpen" title="新建用户" width="440px">
      <el-form label-position="top">
        <el-form-item label="邮箱"><el-input v-model="createForm.email" placeholder="you@example.com" /></el-form-item>
        <el-form-item label="昵称"><el-input v-model="createForm.name" maxlength="50" /></el-form-item>
        <el-form-item label="密码"><el-input v-model="createForm.password" type="password" show-password placeholder="至少8位，含字母和数字" /></el-form-item>
        <el-form-item label="角色">
          <el-checkbox-group v-model="createForm.roleIds">
            <el-checkbox v-for="r in roles" :key="r.id" :value="r.id">{{ r.name }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 分配角色 -->
    <el-dialog v-model="rolesOpen" title="分配角色" width="440px">
      <el-form label-position="top">
        <el-form-item label="用户邮箱"><el-input :model-value="activeUser?.email" disabled /></el-form-item>
        <el-form-item label="角色">
          <el-checkbox-group v-model="assignRoleIds">
            <el-checkbox v-for="r in roles" :key="r.id" :value="r.id">{{ r.name }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rolesOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitAssign">保存</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码 -->
    <el-dialog v-model="pwOpen" title="重置密码" width="420px">
      <el-form label-position="top">
        <el-form-item label="用户邮箱"><el-input :model-value="activeUser?.email" disabled /></el-form-item>
        <el-form-item label="新密码"><el-input v-model="newPassword" type="password" show-password placeholder="至少8位，含字母和数字" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitResetPw">重置</el-button>
      </template>
    </el-dialog>
    </template>
    <el-empty v-if="!canView" description="无权限访问该页面" />
  </div>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminApi } from '@/api'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const canView = computed(() => auth.hasPermission('user', 'read'))
const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const roles = ref([])
const roleNameMap = ref({})

const createOpen = ref(false)
const createForm = ref({ email: '', name: '', password: '', roleIds: [] })
const rolesOpen = ref(false)
const pwOpen = ref(false)
const activeUser = ref(null)
const assignRoleIds = ref([])
const newPassword = ref('')
const saving = ref(false)

function onPageChange(p) {
  page.value = p
  load()
}

function onSizeChange(size) {
  pageSize.value = size
  page.value = 1
  load()
}

async function load() {
  loading.value = true
  try {
    const r = await adminApi.users({ page: page.value, pageSize: pageSize.value })
    rows.value = r.list
    total.value = r.total
  } finally {
    loading.value = false
  }
}

async function loadRoles() {
  const rs = await adminApi.roles()
  roles.value = rs
  rs.forEach((x) => { roleNameMap.value[x.code] = x.name })
}

function openCreate() {
  createForm.value = { email: '', name: '', password: '', roleIds: [] }
  createOpen.value = true
}

async function submitCreate() {
  const f = createForm.value
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return ElMessage.warning('邮箱格式不正确')
  if (!f.name.trim()) return ElMessage.warning('请输入昵称')
  if (!String(f.password || '').match(/^(?=.*[A-Za-z])(?=.*\d).{8,64}$/)) return ElMessage.warning('密码至少8位且包含字母和数字')
  saving.value = true
  try {
    await adminApi.createUser({ email: f.email.trim(), name: f.name.trim(), password: f.password, roleIds: f.roleIds })
    ElMessage.success('用户创建成功')
    createOpen.value = false
    load()
  } finally {
    saving.value = false
  }
}

function openEditRoles(row) {
  activeUser.value = row
  assignRoleIds.value = roles.value.filter((r) => row.roles.includes(r.code)).map((r) => r.id)
  rolesOpen.value = true
}

async function submitAssign() {
  saving.value = true
  try {
    await adminApi.updateUser(activeUser.value.id, { roleIds: assignRoleIds.value })
    ElMessage.success('角色已更新')
    rolesOpen.value = false
    load()
  } finally {
    saving.value = false
  }
}

async function toggleActive(row) {
  try {
    await adminApi.updateUser(row.id, { is_active: row.is_active })
    ElMessage.success('已更新')
  } catch (e) {
    row.is_active = !row.is_active
  }
}

function openResetPw(row) {
  activeUser.value = row
  newPassword.value = ''
  pwOpen.value = true
}

async function submitResetPw() {
  if (!String(newPassword.value || '').match(/^(?=.*[A-Za-z])(?=.*\d).{8,64}$/)) return ElMessage.warning('密码至少8位且包含字母和数字')
  saving.value = true
  try {
    await adminApi.updateUser(activeUser.value.id, { password: newPassword.value })
    ElMessage.success('密码已重置')
    pwOpen.value = false
  } finally {
    saving.value = false
  }
}

async function remove(row) {
  await ElMessageBox.confirm(`删除用户 ${row.email}？`, '提示', { type: 'warning' })
  await adminApi.deleteUser(row.id)
  ElMessage.success('已删除')
  load()
}

onMounted(async () => {
  await load()
  await loadRoles()
})
</script>
<style scoped>
.admin-page { padding: 16px; }
</style>