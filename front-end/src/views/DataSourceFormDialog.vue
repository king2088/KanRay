<template>
  <el-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" :title="editRow ? t('dataset.dataSource.editTitle') : t('dataset.dataSource.create')" width="560px" destroy-on-close>
    <el-form :model="form" label-width="120px">
      <el-form-item :label="t('dataset.dataSource.form.typeLabel')" required>
        <el-select v-model="form.type" :placeholder="t('dataset.dataSource.form.selectPlaceholder')" :disabled="!!editRow" style="width: 100%">
          <el-option-group v-for="cat in groupedDrivers" :key="cat.category" :label="cat.category">
            <el-option v-for="d in cat.items" :key="d.type" :value="d.type" :label="d.name" :disabled="d.status === 'planned'">
              <span class="ds-opt"><DbIcon :type="d.type" :size="16" /><span>{{ d.name }}</span></span>
              <el-tag v-if="d.status === 'planned'"  type="info" style="margin-left: 8px">{{ t('dataset.dataSource.form.planned') }}</el-tag>
            </el-option>
          </el-option-group>
        </el-select>
      </el-form-item>
      <el-form-item :label="t('dataset.dataSource.name')" required>
        <el-input v-model="form.name" :placeholder="t('dataset.dataSource.form.namePlaceholder')" maxlength="100" />
      </el-form-item>
      <el-form-item :label="t('dataset.dataSource.form.storageMode')">
        <el-radio-group v-model="form.mode" :disabled="isExcelEdit">
          <el-radio value="direct">{{ t('dataset.dataSource.form.modeDirect') }}</el-radio>
          <el-radio value="sync" :disabled="isFileDriver">{{ t('dataset.dataSource.form.modeSync') }}</el-radio>
        </el-radio-group>
        <div v-if="form.mode === 'sync' && !isFileDriver" class="mode-tip">
          {{ t('dataset.dataSource.form.syncTip') }}
        </div>
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
      <!-- provider 的结果文案在 data.message 里，没有信封兜底；用后端补的 messageEn 优先 -->
      <el-alert
        :type="testResult.ok ? 'success' : 'error'"
        :title="localizeApiMessage(testResult.message, testResult.messageEn)"
        show-icon
      />
    </div>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">{{ t('common.actions.cancel') }}</el-button>
      <el-button :loading="testing" :disabled="isExcelEdit" @click="doTest">{{ t('dataset.dataSource.test') }}</el-button>
      <el-button type="primary" :loading="saving" @click="doSave">{{ t('common.actions.save') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { datasourceApi } from '@/api'
import { t, localizeApiMessage } from '@/i18n'
import DbIcon from '@/components/DbIcon.vue'

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
const isFileDriver = computed(() => currentDriver.value?.category === '文件')
const isExcelEdit = computed(() => !!props.editRow && props.editRow.type === 'excel')

watch(() => props.editRow, (row) => {
  if (row) {
    form.value = { name: row.name, type: row.type, config: { ...row.config }, mode: row.mode || 'direct' }
  } else {
    form.value = { name: '', type: '', config: {}, mode: 'direct' }
  }
  testResult.value = null
}, { immediate: true, deep: true })

async function loadDrivers() {
  try { drivers.value = await datasourceApi.drivers() } catch (e) { /* 拦截器已提示 */ }
}

async function doTest() {
  if (!form.value.type) return ElMessage.warning(t('dataset.dataSource.form.typeRequired'))
  testing.value = true
  testResult.value = null
  try {
    const res = await datasourceApi.test({ type: form.value.type, config: form.value.config })
    testResult.value = res
  } finally { testing.value = false }
}

async function doSave() {
  if (!form.value.name.trim()) return ElMessage.warning(t('dataset.dataSource.form.nameRequired'))
  if (!form.value.type) return ElMessage.warning(t('dataset.dataSource.form.typeRequired'))
  saving.value = true
  try {
    if (props.editRow) {
      await datasourceApi.update(props.editRow.id, form.value)
    } else {
      await datasourceApi.create(form.value)
    }
    ElMessage.success(t('dataset.dataSource.saveSuccess'))
    emit('saved')
  } finally { saving.value = false }
}

loadDrivers()
</script>

<style scoped>
.ds-opt {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.mode-tip {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}
</style>
