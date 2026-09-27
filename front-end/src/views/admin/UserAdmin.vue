<template>
  <div class="page-container">
    <template v-if="canView">
      <div class="page-header">
        <div class="page-header__main">
          <h2 class="page-title">{{ t('admin.user.title') }}</h2>
          <div class="page-desc">{{ t('admin.user.pageDesc') }}</div>
        </div>
        <div class="page-header__actions">
          <el-button type="primary" @click="openCreate">{{ t('admin.user.createDialog') }}</el-button>
        </div>
      </div>

      <div class="page-card">
        <div class="page-card__header">
          <div class="page-card__header-title">{{ t('admin.user.listTitle') }}</div>
          <div class="page-card__header-right">
            <el-tag type="info" effect="plain">{{ t('admin.user.totalCount', { count: total }) }}</el-tag>
          </div>
        </div>

      <el-table :data="rows" stripe v-loading="loading">
      <el-table-column type="index" :label="t('admin.user.index')" width="70" align="center" />
      <el-table-column prop="email" :label="t('admin.user.email')" min-width="180" />
      <el-table-column prop="name" :label="t('admin.user.nickname')" min-width="120" />
      <el-table-column :label="t('admin.user.roles')" min-width="160">
        <template #default="{ row }">
          <el-tag v-for="r in row.roles" :key="r"  style="margin-right: 4px">{{ roleNameOf(roleByCode(r)) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('admin.user.status')" width="90">
        <template #default="{ row }">
          <el-switch v-model="row.is_active" :disabled="row.id === auth.user?.id" @change="toggleActive(row)" />
        </template>
      </el-table-column>
      <el-table-column :label="t('admin.user.createdAt')" width="170">
        <template #default="{ row }">{{ formatDateTime(row.created_at, appStore.timezone) }}</template>
      </el-table-column>
      <el-table-column :label="t('admin.user.actions')" width="250" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEditRoles(row)">{{ t('admin.user.assignRoles') }}</el-button>
          <el-button link type="primary" @click="openResetPw(row)">{{ t('admin.user.resetPassword') }}</el-button>
          <el-button v-if="row.id !== auth.user?.id" link type="danger" @click="remove(row)">{{ t('admin.user.delete') }}</el-button>
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

    <!-- 新建用户 -->
    <el-dialog v-model="createOpen" :title="t('admin.user.createDialog')" width="440px">
      <el-form label-position="top">
        <el-form-item :label="t('admin.user.fieldEmail')"><el-input v-model="createForm.email" placeholder="you@example.com" /></el-form-item>
        <el-form-item :label="t('admin.user.fieldNickname')"><el-input v-model="createForm.name" maxlength="50" /></el-form-item>
        <el-form-item :label="t('admin.user.fieldPassword')"><el-input v-model="createForm.password" type="password" show-password :placeholder="t('admin.user.passwordPlaceholder')" /></el-form-item>
        <el-form-item :label="t('admin.user.fieldRoles')">
          <el-checkbox-group v-model="createForm.roleIds">
            <el-checkbox v-for="r in roles" :key="r.id" :value="r.id">{{ r.name }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createOpen = false">{{ t('common.actions.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="submitCreate">{{ t('common.actions.create') }}</el-button>
      </template>
    </el-dialog>

    <!-- 分配角色 -->
    <el-dialog v-model="rolesOpen" :title="t('admin.user.assignDialog')" width="440px">
      <el-form label-position="top">
        <el-form-item :label="t('admin.user.dialogUserEmail')"><el-input :model-value="activeUser?.email" disabled /></el-form-item>
        <el-form-item :label="t('admin.user.fieldRoles')">
          <el-checkbox-group v-model="assignRoleIds">
            <el-checkbox v-for="r in roles" :key="r.id" :value="r.id">{{ r.name }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rolesOpen = false">{{ t('common.actions.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="submitAssign">{{ t('admin.user.save') }}</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码 -->
    <el-dialog v-model="pwOpen" :title="t('admin.user.resetDialog')" width="420px">
      <el-form label-position="top">
        <el-form-item :label="t('admin.user.dialogUserEmail')"><el-input :model-value="activeUser?.email" disabled /></el-form-item>
        <el-form-item :label="t('admin.user.fieldNewPassword')"><el-input v-model="newPassword" type="password" show-password :placeholder="t('admin.user.passwordPlaceholder')" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwOpen = false">{{ t('common.actions.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="submitResetPw">{{ t('admin.user.reset') }}</el-button>
      </template>
    </el-dialog>
    </template>
    <el-empty v-if="!canView" :description="t('admin.user.noPermission')" />
  </div>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { adminApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/utils/datetime'
import { useAppStore } from '@/stores/app'
import { roleName } from '@/i18n/role-label'

const { t, te } = useI18n()

const auth = useAuthStore()
const appStore = useAppStore()
const canView = computed(() => auth.hasPermission('user', 'read'))
const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const roles = ref([])

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

// row.roles 装的是角色 code（rbac.service.js:85），不是 id。
// 原 roleNameMap 在 loadRoles 里把中文名定死，语言切换后不刷新；
// 改为渲染时解析，t 的 locale 依赖自然触发重渲染。
const roleByCode = (code) => roles.value.find((x) => x.code === code) || { code }
const roleNameOf = (role) => roleName(t, te, role)

async function loadRoles() {
  roles.value = await adminApi.roles()
}

function openCreate() {
  createForm.value = { email: '', name: '', password: '', roleIds: [] }
  createOpen.value = true
}

async function submitCreate() {
  const f = createForm.value
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return ElMessage.warning(t('admin.user.emailInvalid'))
  if (!f.name.trim()) return ElMessage.warning(t('admin.user.nicknameRequired'))
  if (!String(f.password || '').match(/^(?=.*[A-Za-z])(?=.*\d).{8,64}$/)) return ElMessage.warning(t('admin.user.passwordRule'))
  saving.value = true
  try {
    await adminApi.createUser({ email: f.email.trim(), name: f.name.trim(), password: f.password, roleIds: f.roleIds })
    ElMessage.success(t('admin.user.createSuccess'))
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
    ElMessage.success(t('admin.user.rolesUpdated'))
    rolesOpen.value = false
    load()
  } finally {
    saving.value = false
  }
}

async function toggleActive(row) {
  try {
    await adminApi.updateUser(row.id, { is_active: row.is_active })
    ElMessage.success(t('admin.user.updated'))
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
  if (!String(newPassword.value || '').match(/^(?=.*[A-Za-z])(?=.*\d).{8,64}$/)) return ElMessage.warning(t('admin.user.passwordRule'))
  saving.value = true
  try {
    await adminApi.updateUser(activeUser.value.id, { password: newPassword.value })
    ElMessage.success(t('admin.user.passwordReset'))
    pwOpen.value = false
  } finally {
    saving.value = false
  }
}

async function remove(row) {
  await ElMessageBox.confirm(
      t('admin.user.deleteConfirm', { email: row.email }),
      t('admin.user.confirmTitle'),
      { type: 'warning' },
    )
  await adminApi.deleteUser(row.id)
  ElMessage.success(t('admin.user.deleteSuccess'))
  load()
}

onMounted(async () => {
  await load()
  await loadRoles()
})
</script>