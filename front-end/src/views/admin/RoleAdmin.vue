<template>
  <div class="page-container">
    <template v-if="canView">
      <div class="page-header">
        <div class="page-header__main">
          <h2 class="page-title">{{ t('admin.role.title') }}</h2>
          <div class="page-desc">{{ t('admin.role.pageDesc') }}</div>
        </div>
        <div class="page-header__actions">
          <el-button type="primary" @click="openCreate">{{ t('admin.role.create') }}</el-button>
        </div>
      </div>

      <div class="page-card">
        <div class="page-card__header">
          <div class="page-card__header-title">{{ t('admin.role.listTitle') }}</div>
          <div class="page-card__header-right">
            <el-tag type="info" effect="plain">{{ t('admin.role.totalCount', { count: pagedTotal }) }}</el-tag>
          </div>
        </div>

      <el-table :data="pagedRows" stripe v-loading="loading">
      <el-table-column :label="t('admin.role.name')" min-width="160">
        <template #default="{ row }">{{ roleNameOf(row) }}</template>
      </el-table-column>
      <el-table-column prop="code" :label="t('admin.role.code')" width="150" />
      <el-table-column :label="t('admin.role.permissions')" min-width="220">
        <template #default="{ row }">
          <el-popover placement="top-start" :width="360" trigger="hover">
            <template #reference>
              <div class="perm-tags" :class="{ 'is-overflow': overflowMap[row.id] }" :data-row-id="row.id">
                <el-tag v-for="p in row.permissions" :key="p" class="perm-tag">{{ permNameOf(p) }}</el-tag>
              </div>
            </template>
            <div class="perm-pop">
              <el-tag v-for="p in row.permissions" :key="p" class="perm-tag">{{ permNameOf(p) }}</el-tag>
            </div>
          </el-popover>
        </template>
      </el-table-column>
      <el-table-column :label="t('admin.role.type')" width="90">
        <template #default="{ row }">
          <el-tag :type="row.is_builtin ? 'warning' : 'success'">{{ row.is_builtin ? t('admin.role.builtin') : t('admin.role.custom') }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('admin.role.description')" min-width="180">
        <template #default="{ row }">{{ roleDescOf(row) }}</template>
      </el-table-column>
      <el-table-column :label="t('admin.role.actions')" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" :disabled="!isCustom(row)" @click="openEdit(row)">{{ t('admin.role.edit') }}</el-button>
          <el-button link type="danger" :disabled="!isCustom(row)" @click="remove(row)">{{ t('admin.role.delete') }}</el-button>
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

    <el-dialog v-model="dialogOpen" :title="editing ? t('admin.role.dialogEditTitle') : t('admin.role.dialogCreateTitle')" width="560px" class="role-dialog">
      <el-form label-position="top">
        <el-form-item :label="t('admin.role.codeLabel')">
          <el-input v-model="form.code" :disabled="editing" :placeholder="t('admin.role.codePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('admin.role.nameLabel')"><el-input v-model="form.name" maxlength="50" /></el-form-item>
        <el-form-item :label="t('admin.role.descLabel')"><el-input v-model="form.description" maxlength="200" /></el-form-item>
        <el-form-item :label="t('admin.role.permConfig')">
          <div class="perm-collapse-wrap">
            <el-collapse v-if="permGroups.length">
              <el-collapse-item v-for="group in permGroups" :key="group.key" :name="group.key" :title="`${permGroupLabel(group.key)} · ${t('admin.role.permCount', { count: group.perms.length })}`">
                <el-checkbox-group v-model="form.permissions">
                  <el-checkbox v-for="p in group.perms" :key="p.code" :value="p.code">{{ permNameOf(p.code) }}</el-checkbox>
                </el-checkbox-group>
              </el-collapse-item>
            </el-collapse>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">{{ t('common.actions.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="submit">{{ editing ? t('admin.role.save') : t('admin.role.submitCreate') }}</el-button>
      </template>
    </el-dialog>
    </template>
    <el-empty v-if="!canView" :description="t('admin.role.noPermission')" />
  </div>
</template>
<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { adminApi } from '@/api'
import { roleDesc, roleName } from '@/i18n/role-label'
import { useAuthStore } from '@/stores/auth'

const { t, te } = useI18n()
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
const overflowMap = ref({})
const pagedTotal = computed(() => rows.value.length)
const pagedRows = computed(() => rows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))

function refreshOverflow() {
  nextTick(() => {
    document.querySelectorAll('.perm-tags').forEach((el) => {
      const id = el.dataset.rowId
      if (id !== undefined) overflowMap.value[id] = el.scrollWidth > el.clientWidth
    })
  })
}

watch([page, pageSize], refreshOverflow)

function onPageChange(p) {
  page.value = p
}

function onSizeChange(size) {
  pageSize.value = size
  page.value = 1
}

// 权限码 → admin.perm.* 标签。后端 permissions.name 是中文数据，界面统一走词典，
// 未收录的码原样回退为码本身。这段内联早于 i18n/role-label.js，保持原样不委托。
const permNameOf = (code) => (te(`admin.perm.${code}`) ? t(`admin.perm.${code}`) : code)

const permGroups = computed(() => {
  const map = {}
  permissions.value.forEach((p) => {
    const key = p.code.split(':')[0]
    if (!map[key]) map[key] = []
    map[key].push(p)
  })
  return Object.keys(map).sort().map((key) => ({ key, perms: map[key] }))
})

// 模块码取自后端权限码前缀（dataset/chart/.../apikey），展示文案走词典。
function permGroupLabel(key) {
  return t(`admin.role.moduleLabels.${key}`)
}

async function load() {
  loading.value = true
  try {
    rows.value = await adminApi.roles()
  } finally {
    loading.value = false
  }
}

const isCustom = (row) => !row.is_builtin

// 编辑弹窗不动：内置角色的编辑按钮已禁用，弹窗只为自定义角色打开。
const roleNameOf = (row) => roleName(t, te, row)
const roleDescOf = (row) => roleDesc(t, te, row)

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
  if (!String(form.value.code || '').match(/^[a-z0-9_-]{2,32}$/)) return ElMessage.warning(t('admin.role.codeInvalid'))
  if (!form.value.name.trim()) return ElMessage.warning(t('admin.role.nameRequired'))
  saving.value = true
  try {
    if (editing.value) {
      await adminApi.updateRole(editingId.value, { name: form.value.name, description: form.value.description, permissions: form.value.permissions })
      ElMessage.success(t('admin.role.updateSuccess'))
    } else {
      await adminApi.createRole({ code: form.value.code, name: form.value.name, description: form.value.description, permissions: form.value.permissions })
      ElMessage.success(t('admin.role.createSuccess'))
    }
    dialogOpen.value = false
    load()
  } finally {
    saving.value = false
  }
}

async function remove(row) {
  await ElMessageBox.confirm(
      t('admin.role.deleteConfirm', { name: roleName(t, te, row) }),
      t('admin.role.confirmTitle'),
      { type: 'warning' },
    )
  await adminApi.deleteRole(row.id)
  ElMessage.success(t('admin.role.deleteSuccess'))
  load()
}

onMounted(async () => {
  await load()
  permissions.value = await adminApi.permissions()
  refreshOverflow()
})
</script>

<style scoped>
.role-dialog :deep(.el-dialog__body) {
  max-height: calc(80vh - 120px);
  overflow-y: auto;
}

.perm-collapse-wrap {
  width: 100%;
}

.perm-collapse-wrap :deep(.el-collapse) {
  width: 100%;
}

.perm-tags {
  position: relative;
  display: flex;
  flex-wrap: nowrap;
  overflow: hidden;
  line-height: 24px;
}

.perm-tag {
  margin: 0;
}

.perm-tags.is-overflow::after {
  content: '…';
  position: absolute;
  right: 2px;
  top: 0;
  line-height: 24px;
  padding: 0 3px;
  border-radius: 4px;
  color: var(--app-text-secondary);
  font-weight: 700;
  background: var(--el-fill-color);
}

.perm-pop {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  max-height: 40vh;
  overflow-y: auto;
}
</style>