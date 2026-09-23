<template>
  <el-form
    ref="formRef"
    :model="model"
    :label-width="compact ? '80px' : '100px'"
    :disabled="disabled"
    class="form-renderer"
  >
    <div v-if="description" class="fr-desc">{{ description }}</div>
    <el-row :gutter="24">
      <el-col v-for="field in visibleFields" :key="field.key" :span="field.span === 1 ? 12 : 24">
        <template v-if="field.type === 'static'">
          <div class="fr-static">
            <span v-if="field.label" class="fr-static__label">{{ field.label }}</span>
            <div class="fr-static__content">{{ field.content || field.label }}</div>
          </div>
        </template>
        <el-form-item
          v-else
          :label="field.label"
          :prop="field.key"
          :rules="rulesFor(field)"
          :required="field.required"
        >
          <el-input
            v-if="field.type === 'text' || field.type === 'textarea'"
            v-model="model[field.key]"
            :type="field.type === 'textarea' ? 'textarea' : 'text'"
            :rows="field.type === 'textarea' ? 4 : undefined"
            :placeholder="field.placeholder || `请输入${field.label}`"
            :show-word-limit="false"
          />
          <el-input-number
            v-else-if="field.type === 'number'"
            v-model="model[field.key]"
            :controls="false"
            style="width: 100%"
            :placeholder="field.placeholder || `请输入${field.label}`"
          />
          <el-date-picker
            v-else-if="field.type === 'date'"
            v-model="model[field.key]"
            type="date"
            value-format="YYYY-MM-DD"
            :placeholder="field.placeholder || '选择日期'"
            style="width: 100%"
          />
          <el-select
            v-else-if="field.type === 'select'"
            v-model="model[field.key]"
            :placeholder="field.placeholder || `请选择${field.label}`"
            clearable
            style="width: 100%"
          >
            <el-option v-for="opt in field.options" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
          <el-radio-group v-else-if="field.type === 'radio'" v-model="model[field.key]">
            <el-radio v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label }}</el-radio>
          </el-radio-group>
          <el-checkbox-group v-else-if="field.type === 'checkbox'" v-model="model[field.key]">
            <el-checkbox v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-col>
    </el-row>
  </el-form>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'

const props = defineProps({
  fields: { type: Array, default: () => [] },
  description: { type: String, default: '' },
  autoFill: { type: Object, default: null },
  initialModel: { type: Object, default: null },
  disabled: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
})

const emit = defineEmits(['submit'])

const model = reactive({})
const formRef = ref(null)

function seedModel() {
  for (const f of props.fields) {
    if (f.type === 'static') continue
    if (props.initialModel) {
      const init = props.initialModel[f.key]
      if (init !== undefined && init !== null) {
        if (f.type === 'checkbox') {
          model[f.key] = typeof init === 'string' && init ? init.split(',') : Array.isArray(init) ? init : []
        } else {
          model[f.key] = init
        }
        continue
      }
    }
    if (Array.isArray(model[f.key])) continue
    if (model[f.key] !== undefined) continue
    model[f.key] = f.type === 'checkbox' ? [] : (props.autoFill && props.autoFill[f.key] !== undefined ? props.autoFill[f.key] : '')
  }
}
seedModel()

const visibleFields = computed(() => props.fields.filter((f) => f.type !== 'static' || f.content || f.label))

function rulesFor(field) {
  const rules = []
  if (field.required) {
    rules.push({
      required: true,
      message: `请填写${field.label}`,
      trigger: 'blur',
    })
  }
  rules.push({ validator: (rule, value, cb) => {
      if (field.required && (value == null || value === '' || (Array.isArray(value) && !value.length))) {
        cb(new Error(`请填写${field.label}`))
      } else {
        cb()
      }
    }, trigger: 'change' })
  return rules
}

async function validate() {
  return formRef.value.validate()
}

defineExpose({ validate, resetFields: () => formRef.value.resetFields(), model })
</script>

<style scoped>
.form-renderer {
  text-align: left;
}
.fr-desc {
  color: var(--el-text-color-secondary);
  margin-bottom: 18px;
  white-space: pre-wrap;
}
.fr-static {
  min-height: 32px;
}
.fr-static__label {
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.fr-static__label:empty {
  display: none;
}
.fr-static__content {
  color: var(--el-text-color-secondary);
  white-space: pre-wrap;
}
</style>