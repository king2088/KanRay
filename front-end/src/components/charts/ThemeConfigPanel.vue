<template>
  <div class="theme-panel">
    <div class="theme-row">
      <span class="theme-label">模式</span>
      <div class="mode-btns">
        <el-button
          
          :type="mode === 'light' ? 'primary' : 'default'"
          @click="setMode('light')"
        >亮色</el-button>
        <el-button
          
          :type="mode === 'dark' ? 'primary' : 'default'"
          @click="setMode('dark')"
        >暗色</el-button>
      </div>
    </div>

    <div class="theme-row">
      <span class="theme-label">背景色</span>
      <el-color-picker :model-value="background" @update:model-value="setBackground" />
      <span class="theme-reset" @click="setBackground('')">重置</span>
    </div>

    <div class="theme-row">
      <span class="theme-label">文字颜色</span>
      <el-color-picker :model-value="textColor" @update:model-value="setTextColor" />
      <span class="theme-reset" @click="setTextColor('')">重置</span>
    </div>

    <div class="theme-row">
      <span class="theme-label">系列色板</span>
      <el-select
        class="theme-palette-select"
        
        :model-value="Number(paletteIndex)"
        @update:model-value="emit('update:palette', $event)"
      >
        <el-option
          v-for="(p, i) in COLOR_PALETTES"
          :key="i"
          :value="i"
          :label="p.name"
        >
          <div class="palette-opt">
            <div class="palette-opt-swatches">
              <span v-for="c in p.colors" :key="c" class="palette-opt-swatch" :style="{ background: c }" />
            </div>
            <span class="palette-opt-name">{{ p.name }}</span>
          </div>
        </el-option>
        <el-option :value="CUSTOM_PALETTE_INDEX" label="自定义">
          <div class="palette-opt">
            <div class="palette-opt-swatches">
              <span v-for="c in customColors" :key="c" class="palette-opt-swatch" :style="{ background: c }" />
            </div>
            <span class="palette-opt-name">自定义</span>
          </div>
        </el-option>
      </el-select>
    </div>

    <div v-if="Number(paletteIndex) === CUSTOM_PALETTE_INDEX" class="custom-palette">
      <div class="custom-palette-grid">
        <el-color-picker
          v-for="(c, i) in customColors"
          :key="i"
          
          :model-value="c"
          @update:model-value="setCustomColor(i, $event)"
        />
      </div>
      <span class="theme-reset" @click="setCustomColors(DEFAULT_PALETTE)">恢复默认</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { COLOR_PALETTES, DEFAULT_PALETTE, CUSTOM_PALETTE_INDEX } from '@/config/color-palettes'

const props = defineProps({
  theme: { type: Object, default: () => ({}) },
  paletteIndex: { type: [Number, String], default: 0 },
  customPalette: { type: Array, default: null },
})

const emit = defineEmits(['update:theme', 'update:palette', 'update:customPalette'])

const mode = computed(() => props.theme?.mode || 'light')
const background = computed(() => props.theme?.background || '')
const textColor = computed(() => props.theme?.textColor || '')
const customColors = computed(() => {
  const p = props.customPalette
  return p && p.length ? p : DEFAULT_PALETTE
})

function setMode(m) {
  emit('update:theme', { ...props.theme, mode: m })
}
function setBackground(v) {
  emit('update:theme', { ...props.theme, background: v })
}
function setTextColor(v) {
  emit('update:theme', { ...props.theme, textColor: v })
}
function setCustomColor(i, v) {
  const next = [...customColors.value]
  next[i] = v
  emit('update:customPalette', next)
}
function setCustomColors(arr) {
  emit('update:customPalette', [...arr])
}
</script>

<style scoped>
.theme-panel {
  display: flex;
  flex-direction: column;
  gap: 2px;
  --theme-label-w: 64px;
}
.theme-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 4px 0;
}
.theme-label {
  flex-shrink: 0;
  width: var(--theme-label-w);
  font-size: 12px;
  color: var(--app-text-secondary, #6b7280);
}
.theme-reset {
  font-size: 12px;
  color: var(--el-color-primary, #409eff);
  cursor: pointer;
}
.mode-btns {
  display: flex;
  gap: 0;
}
.mode-btns :deep(.el-button) {
  border-radius: 0;
}
.mode-btns :deep(.el-button:first-child) {
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
}
.mode-btns :deep(.el-button:last-child) {
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
  margin-left: -1px;
}
.theme-palette-select {
  flex: 1;
  min-width: 0;
}
.palette-opt {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.palette-opt-swatches {
  display: flex;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  border-radius: 3px;
}
.palette-opt-swatch {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}
.palette-opt-name {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--app-text-regular, #606266);
}
.custom-palette {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-left: calc(var(--theme-label-w) + 8px);
}
.custom-palette-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>