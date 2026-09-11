<template>
  <el-switch
    v-if="field.type === 'switch'"
    :model-value="value"
    @update:model-value="(v) => emit('change', v)"
    :disabled="field.disabled"
  />

  <el-input
    v-else-if="field.type === 'input'"
    :model-value="value"
    @update:model-value="(v) => emit('change', v)"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    style="width: 100%"
  />

  <el-input
    v-else-if="field.type === 'textarea'"
    :model-value="value"
    @update:model-value="(v) => emit('change', v)"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    :rows="4"
    type="textarea"
    style="width: 100%"
  />

  <el-input-number
    v-else-if="field.type === 'number'"
    :model-value="value"
    @update:model-value="(v) => emit('change', v)"
    :min="field.min"
    :max="field.max"
    :step="field.step || 1"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    :controls-position="field.controlsPosition || 'right'"
    :size="compact ? 'small' : undefined"
    :style="fluid ? 'width: 100%' : (compact ? 'width: 86px' : 'width: 140px')"
  />

  <el-slider
    v-else-if="field.type === 'slider'"
    :model-value="value"
    @update:model-value="(v) => emit('change', v)"
    :min="field.min ?? 0"
    :max="field.max ?? 100"
    :step="field.step ?? 1"
    :disabled="field.disabled"
    style="width: 140px"
  />

  <el-select
    v-else-if="field.type === 'select'"
    :model-value="value"
    @update:model-value="(v) => emit('change', v)"
    :placeholder="field.placeholder || '请选择'"
    :disabled="field.disabled"
    :size="compact ? 'small' : undefined"
    :multiple="field.multiple"
    :collapse-tags="field.multiple"
    :clearable="!field.multiple"
    :style="field.selectWidth ? 'width: ' + field.selectWidth + 'px' : 'width: 100%'"
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
    :model-value="value"
    @update:model-value="(v) => emit('change', v)"
    :disabled="field.disabled"
    :size="compact ? 'small' : undefined"
    style="width: 100%"
  />

  <el-button
    v-else-if="field.type === 'toggle'"
    :type="value === field.activeValue ? 'primary' : 'default'"
    size="small"
    @click="toggle"
    :title="field.label"
    style="min-width: 34px; padding: 6px 8px;"
  >
    <span :style="getToggleStyle()">{{ field.icon || field.label }}</span>
  </el-button>

  <el-button-group v-else-if="field.type === 'buttonGroup'">
    <el-button
      v-for="opt in field.options || []"
      :key="opt.value"
      :type="value === opt.value ? 'primary' : 'default'"
      size="small"
      @click="emit('change', opt.value)"
      :title="opt.title || opt.label"
      class="glyph-btn"
    >
      <el-icon v-if="typeof opt.icon === 'object'" :size="14">
        <component :is="opt.icon" />
      </el-icon>
      <span v-else :style="decoStyle(opt.value)" v-html="opt.icon || opt.label"></span>
    </el-button>
  </el-button-group>

  <el-alert v-else title="Unsupported field type" type="warning" :show-icon="false" style="font-size: 12px" />
</template>

<script setup>
const props = defineProps({
  field: { type: Object, required: true },
  value: { type: [String, Number, Boolean, Array, Object], default: undefined },
  compact: { type: Boolean, default: false },
  fluid: { type: Boolean, default: false },
})
const emit = defineEmits(['change'])

function toggle() {
  const next = props.value === props.field.activeValue ? props.field.inactiveValue : props.field.activeValue
  emit('change', next)
}
function getToggleStyle() {
  const v = props.value
  if (props.field.icon === 'B') return v === props.field.activeValue ? { fontWeight: 'bold' } : {}
  if (props.field.icon === 'I') return v === props.field.activeValue ? { fontStyle: 'italic' } : {}
  return {}
}
function decoStyle(val) {
  if (val === 'underline') return { textDecoration: 'underline' }
  if (val === 'line-through') return { textDecoration: 'line-through' }
  return {}
}
</script>

<style scoped>
.glyph-btn {
  min-width: 24px;
  padding: 3px 4px;
}
</style>
