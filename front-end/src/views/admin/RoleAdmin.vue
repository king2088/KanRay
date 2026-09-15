<template>
  <div class="page-container">
    <template v-if="canView">
      <div class="page-header">
        <div class="page-header__main">
          <h2 class="page-title">角色管理</h2>
          <div class="page-desc">维护角色及其权限点，界定不同成员的访问范围</div>
        </div>
        <div class="page-header__actions">
          <el-button type="primary" @click="openCreate">新建角色</el-button>
        </div>
      </div>

      <div class="page-card">
        <div class="page-card__header">
          <div class="page-card__header-title">角色列表</div>
          <div class="page-card__header-right">
            <el-tag type="info" effect="plain">共 {{ pagedTotal }} 条</el-tag>
          </div>
        </div>

      <el-table :data="pagedRows" stripe v-loading="loading">
      <el-table-column prop="name" label="角色名称" min-width="160" />
      <el-table-column prop="code" label="标识" width="150" />
      <el-table-column label="权限点" min-width="220">
        <template #default="{ row }">
          <el-tag v-for="p in row.permissions" :key="p"  style="margin: 2px">{{ permNameOf(p) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="类型" width="90">
        <template #default="{ row }">
          <el-tag :type="row.is_builtin ? 'warning' : 'success'" >{{ row.is_builtin ? '内置' : '自定义' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" min-width="180" />
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" :disabled="!isCustom(row)" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" :disabled="!isCustom(row)" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="page-card__footer">
      <el-pagination
        layout="total, sizes, prev, pager, next"
        :total="pagedTotal"
        :page-size="pageSize"
        :current-page="page"
        :page-sizes="[10, 20, 50]"
        background
        @size-change="onSizeChange"
        @current-change="onPageChange"
      />
    </div>
    </div>

    <el-dialog v-model="dialogOpen" :title="editing ? '编辑角色' : '新建角色'" width="560px">
      <el-form label-position="top">
        <el-form-item label="标识（小写字母/数字/下划线）">
          <el-input v-model="form.code" :disabled="editing" placeholder="如 finance" />
        </el-form-item>
        <el-form-item label="名称"><el-input v-model="form.name" maxlength="50" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" maxlength="200" /></el-form-item>
        <el-form-item label="权限点">
          <el-collapse v-if="permGroups.length">
            <el-collapse-item v-for="group in permGroups" :key="group.key" :name="group.key" :title="`${group.key} · ${group.perms.length} 项`">
              <el-checkbox-group v-model="form.permissions">
                <el-checkbox v-for="p in group.perms" :key="p.code" :value="p.code">{{ p.name }}</el-checkbox>
              </el-checkbox-group>
            </el-collapse-item>
          </el-collapse>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">{{ editing ? '保存' : '创建' }}</el-button>
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
const canView = computed(() => auth.hasPermission('role', 'read'))

const rows = ref([])
const loading = ref(false)
const permissions = ref([])
const dialogOpen = ref(false)
const editing = ref(false)
const editingId = ref(null)
const saving = ref(false)
const form = ref({ code: '', name: '', description: '', permissions: [] })

const page = ref(1)
const pageSize = ref(10)
const pagedTotal = computed(() => rows.value.length)
const pagedRows = computed(() => rows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))

function onPageChange(p) {
  page.value = p
}

function onSizeChange(size) {
  pageSize.value = size
  page.value = 1
}

const permNameOf = (code) => {
  const found = permissions.value.find((p) => p.code === code)
  return found ? found.name : code
}

const permGroups = computed(() => {
  const map = {}
  permissions.value.forEach((p) => {
    const key = p.code.split(':')[0]
    if (!map[key]) map[key] = []
    map[key].push(p)
  })
  return Object.keys(map).sort().map((key) => ({ key, perms: map[key] }))
})

async function load() {
  loading.value = true
  try {
    rows.value = await adminApi.roles()
  } finally {
    loading.value = false
  }
}

const isCustom = (row) => !row.is_builtin

function openCreate() {
  editing.value = false
  editingId.value = null
  form.value = { code: '', name: '', description: '', permissions: [] }
  dialogOpen.value = true
}

function openEdit(row) {
  editing.value = true
  editingId.value = row.id
  form.value = { code: row.code, name: row.name, description: row.description || '', permissions: [...row.permissions] }
  dialogOpen.value = true
}

async function submit() {
  if (!String(form.value.code || '').match(/^[a-z0-9_-]{2,32}$/)) return ElMessage.warning('角色标识不合法（2-32位小写字母/数字/下划线）')
  if (!form.value.name.trim()) return ElMessage.warning('请输入角色名称')
  saving.value = true
  try {
    if (editing.value) {
      await adminApi.updateRole(editingId.value, { name: form.value.name, description: form.value.description, permissions: form.value.permissions })
      ElMessage.success('角色已更新')
    } else {
      await adminApi.createRole({ code: form.value.code, name: form.value.name, description: form.value.description, permissions: form.value.permissions })
      ElMessage.success('角色创建成功')
    }
    dialogOpen.value = false
    load()
  } finally {
    saving.value = false
  }
}

async function remove(row) {
  await ElMessageBox.confirm(`删除角色 ${row.name}？`, '提示', { type: 'warning' })
  await adminApi.deleteRole(row.id)
  ElMessage.success('已删除')
  load()
}

onMounted(async () => {
  await load()
  permissions.value = await adminApi.permissions()
})
</script>