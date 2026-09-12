<template>
  <div class="theme-panel">
    <div class="theme-row">
      <span class="theme-label">模式</span>
      <div class="mode-btns">
        <el-button
          size="small"
          :type="mode === 'light' ? 'primary' : 'default'"
          @click="setMode('light')"
        >亮色</el-button>
        <el-button
          size="small"
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

    <div class="theme-row palette-label-row">
      <span class="theme-label">系列色板</span>
    </div>
    <div class="palette-list">
      <div
        v-for="(p, i) in COLOR_PALETTES"
        :key="i"
        class="palette-item"
        :class="{ active: paletteIndex === i }"
        @click="emit('update:palette', i)"
      >
        <div class="palette-swatches">
          <span
            v-for="(c, ci) in p.colors"
            :key="ci"
            class="swatch"
            :style="{ background: c }"
          />
        </div>
        <span class="palette-name">{{ p.name }}</span>
        <el-icon v-if="paletteIndex === i" class="palette-check"><Check /></el-icon>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Check } from '@element-plus/icons-vue'
import { COLOR_PALETTES } from '@/config/color-palettes'

const props = defineProps({
  theme: { type: Object, default: () => ({}) },
  paletteIndex: { type: [Number, String], default: 0 },
})

const emit = defineEmits(['update:theme', 'update:palette'])

const mode = computed(() => props.theme?.mode || 'light')
const background = computed(() => props.theme?.background || '')
const textColor = computed(() => props.theme?.textColor || '')

function setMode(m) {
  emit('update:theme', { ...props.theme, mode: m })
}
function setBackground(v) {
  emit('update:theme', { ...props.theme, background: v })
}
function setTextColor(v) {
  emit('update:theme', { ...props.theme, textColor: v })
}
</script>

<style scoped>
.theme-panel {
  display: flex;
  flex-direction: column;
  gap: 2px;
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
  width: 64px;
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
.palette-label-row {
  padding-top: 8px;
}
.palette-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.palette-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}
.palette-item:hover {
  border-color: var(--el-color-primary, #409eff);
}
.palette-item.active {
  border-color: var(--el-color-primary, #409eff);
  background: var(--el-color-primary-light-9, #ecf5ff);
}
.palette-swatches {
  display: flex;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  border-radius: 3px;
}
.swatch {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
.palette-name {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--app-text-regular, #606266);
}
.palette-check {
  flex-shrink: 0;
  color: var(--el-color-primary, #409eff);
  font-size: 14px;
}
</style>