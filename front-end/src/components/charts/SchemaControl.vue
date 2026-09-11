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

  <div v-else-if="field.type === 'positionGrid'" class="pos-grid" :title="field.label">
    <table class="pos-grid-table">
      <tr v-for="(rowVal, r) in ROW_VALS" :key="rowVal">
        <td v-for="(colVal, c) in COL_VALS" :key="colVal">
          <button
            type="button"
            class="pos-grid-cell"
            :class="{ 'is-active': isGridActive(r, c) }"
            @click="emit('change', { left: colVal, top: rowVal })"
          >
            <el-icon :size="14"><component :is="GRID_ICONS[r][c]" /></el-icon>
          </button>
        </td>
      </tr>
    </table>
  </div>

  <el-alert v-else title="Unsupported field type" type="warning" :show-icon="false" style="font-size: 12px" />
</template>

<script setup>
import {
  posTopLeft, posTopCenter, posTopRight,
  posMidLeft, posMidCenter, posMidRight,
  posBotLeft, posBotCenter, posBotRight,
} from './control-icons'

const COL_VALS = ['left', 'center', 'right']
const ROW_VALS = ['top', 'middle', 'bottom']
const GRID_ICONS = [
  [posTopLeft, posTopCenter, posTopRight],
  [posMidLeft, posMidCenter, posMidRight],
  [posBotLeft, posBotCenter, posBotRight],
]

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
function isGridActive(r, c) {
  const v = props.value || {}
  return COL_VALS[c] === v.left && ROW_VALS[r] === v.top
}
</script>

<style scoped>
.glyph-btn {
  min-width: 24px;
  padding: 3px 4px;
}
.pos-grid-table {
  border-collapse: separate;
  border-spacing: 2px;
}
.pos-grid-table td {
  padding: 0;
}
.pos-grid-cell {
  width: 26px;
  height: 26px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  color: #6b7280;
}
.pos-grid-cell:hover {
  border-color: var(--el-color-primary, #409eff);
  color: var(--el-color-primary, #409eff);
}
.pos-grid-cell.is-active {
  border-color: var(--el-color-primary, #409eff);
  color: var(--el-color-primary, #409eff);
  background: var(--el-color-primary-light-9, #ecf5ff);
}
</style>
