<template>
  <el-form label-width="100px" size="small" :inline="false">
    <template v-for="(field, key) in schema" :key="key">
      <el-form-item
        v-if="!field.type || field.type === 'group'"
        :label="field.label"
      >
        <SchemaForm
          v-if="field.children"
          :schema="field.children"
          :model="model[key]"
          @update="onNestedUpdate(key)"
        />
        <el-alert v-else title="Group needs children schema" type="warning" :show-icon="false" style="font-size: 12px" />
      </el-form-item>

      <el-form-item v-else :label="field.label">
        <el-switch
          v-if="field.type === 'switch'"
          v-model="model[key]"
          :disabled="field.disabled"
        />

        <el-input
          v-else-if="field.type === 'input'"
          v-model="model[key]"
          :placeholder="field.placeholder"
          :disabled="field.disabled"
          style="width: 100%"
        />

        <el-input
          v-else-if="field.type === 'textarea'"
          v-model="model[key]"
          :placeholder="field.placeholder"
          :disabled="field.disabled"
          :rows="4"
          style="width: 100%"
        />

        <el-input-number
          v-else-if="field.type === 'number'"
          v-model="model[key]"
          :min="field.min"
          :max="field.max"
          :step="field.step || 1"
          :placeholder="field.placeholder"
          :disabled="field.disabled"
          :controls-position="field.controlsPosition || 'right'"
          style="width: 140px"
        />

        <el-slider
          v-else-if="field.type === 'slider'"
          v-model="model[key]"
          :min="field.min ?? 0"
          :max="field.max ?? 100"
          :step="field.step ?? 1"
          :disabled="field.disabled"
          style="width: 140px"
        />

        <el-select
          v-else-if="field.type === 'select'"
          v-model="model[key]"
          :placeholder="field.placeholder || '请选择'"
          :disabled="field.disabled"
          style="width: 100%"
          clearable
        >
          <el-option
            v-for="opt in field.options || []"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>

        <el-color-picker
          v-else-if="field.type === 'color'"
          v-model="model[key]"
          :disabled="field.disabled"
          predefine
          style="width: 100%"
        />

        <el-alert v-else title="Unsupported field type" type="warning" :show-icon="false" style="font-size: 12px" />
      </el-form-item>
    </template>
  </el-form>
</template>

<script setup>
import { watch } from 'vue'

const props = defineProps({
  schema: { type: Object, required: true },
  model: { type: Object, required: true },
})

const emit = defineEmits(['update'])

function onNestedUpdate(key) {
  return (newVal) => {
    emit('update', { ...props.model, [key]: newVal })
  }
}

watch(() => props.model, (newVal) => {
  emit('update', newVal)
}, { deep: true })
</script>

<style scoped>
.config-form-item {
  margin-bottom: 8px;
}
</style>