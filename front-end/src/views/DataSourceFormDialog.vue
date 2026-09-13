<template>
  <el-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" :title="editRow ? '编辑数据源' : '新建数据源'" width="560px" destroy-on-close>
    <el-form :model="form" label-width="100px">
      <el-form-item label="数据源类型" required>
        <el-select v-model="form.type" placeholder="请选择" :disabled="!!editRow" style="width: 100%">
          <el-option-group v-for="cat in groupedDrivers" :key="cat.category" :label="cat.category">
            <el-option v-for="d in cat.items" :key="d.type" :value="d.type" :label="d.name" :disabled="d.status === 'planned'">
              <span>{{ d.name }}</span>
              <el-tag v-if="d.status === 'planned'" size="small" type="info" style="margin-left: 8px">暂不支持</el-tag>
            </el-option>
          </el-option-group>
        </el-select>
      </el-form-item>
      <el-form-item label="名称" required>
        <el-input v-model="form.name" placeholder="请输入数据源名称" maxlength="100" />
      </el-form-item>
      <template v-if="currentDriver">
        <el-form-item v-for="f in currentDriver.fields" :key="f.name" :label="f.label" :required="f.required">
          <el-input v-if="f.type === 'text' || f.type === 'password'" v-model="form.config[f.name]" :placeholder="f.default || ''" :type="f.type === 'password' ? 'password' : 'text'" />
          <el-input-number v-else-if="f.type === 'number'" v-model="form.config[f.name]" :min="1" :max="65535" />
          <el-select v-else-if="f.type === 'select'" v-model="form.config[f.name]">
            <el-option v-for="opt in f.options" :key="opt" :value="opt" :label="opt" />
          </el-select>
        </el-form-item>
      </template>
    </el-form>
    <div v-if="testResult" style="margin-top: 8px">
      <el-alert :type="testResult.ok ? 'success' : 'error'" :title="testResult.message" show-icon />
    </div>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button :loading="testing" @click="doTest">测试连接</el-button>
      <el-button type="primary" :loading="saving" @click="doSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { datasourceApi } from '@/api'

const props = defineProps({ modelValue: Boolean, editRow: Object })
const emit = defineEmits(['update:modelValue', 'saved'])

const drivers = ref([])
const form = ref({ name: '', type: '', config: {} })
const testing = ref(false)
const saving = ref(false)
const testResult = ref(null)

const groupedDrivers = computed(() => {
  const map = {}
  for (const d of drivers.value) {
    if (!map[d.category]) map[d.category] = { category: d.category, items: [] }
    map[d.category].items.push(d)
  }
  return Object.values(map)
})

const currentDriver = computed(() => drivers.value.find((d) => d.type === form.value.type))

watch(() => props.editRow, (row) => {
  if (row) {
    form.value = { name: row.name, type: row.type, config: { ...row.config } }
  } else {
    form.value = { name: '', type: '', config: {} }
  }
  testResult.value = null
}, { immediate: true, deep: true })

async function loadDrivers() {
  try { drivers.value = await datasourceApi.drivers() } catch (e) { /* 拦截器已提示 */ }
}

async function doTest() {
  if (!form.value.type) return ElMessage.warning('请选择数据源类型')
  testing.value = true
  testResult.value = null
  try {
    const res = await datasourceApi.test({ type: form.value.type, config: form.value.config })
    testResult.value = res
  } finally { testing.value = false }
}

async function doSave() {
  if (!form.value.name.trim()) return ElMessage.warning('请输入名称')
  if (!form.value.type) return ElMessage.warning('请选择类型')
  saving.value = true
  try {
    if (props.editRow) {
      await datasourceApi.update(props.editRow.id, form.value)
    } else {
      await datasourceApi.create(form.value)
    }
    ElMessage.success('保存成功')
    emit('saved')
  } finally { saving.value = false }
}

loadDrivers()
</script>
