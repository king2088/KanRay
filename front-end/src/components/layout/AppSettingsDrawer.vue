<template>
  <el-drawer v-model="visible" title="系统设置" size="320px" append-to-body>
    <div class="settings">
      <p class="settings__label">布局模式</p>
      <div class="settings__layouts">
        <div
          v-for="opt in LAYOUTS"
          :key="opt.value"
          class="layout-option"
          :class="{ 'is-active': store.layout === opt.value }"
          @click="store.setLayout(opt.value)"
        >
          <div class="layout-option__preview">
            <span class="layout-option__bar" />
            <i class="layout-option__menu" :class="`layout-option__menu--${opt.value}`" />
            <span class="layout-option__placeholder" />
          </div>
          <span class="layout-option__name">{{ opt.label }}</span>
        </div>
      </div>

      <p class="settings__label">主题色</p>
      <div class="settings__swatches">
        <div
          v-for="c in COLORS"
          :key="c"
          class="color-swatch"
          :class="{ 'is-active': store.primaryColor === c }"
          :style="{ background: c }"
          @click="store.setPrimaryColor(c)"
        >
          <el-icon v-if="store.primaryColor === c" :size="14" color="#fff"><Check /></el-icon>
        </div>
      </div>

      <p class="settings__label">组件尺寸</p>
      <el-radio-group :model-value="store.size" @change="store.setSize">
        <el-radio-button value="large">大</el-radio-button>
        <el-radio-button value="default">中</el-radio-button>
        <el-radio-button value="small">小</el-radio-button>
      </el-radio-group>

      <p class="settings__label">外观 / 折叠</p>
      <div class="settings__switches">
        <div class="settings__switch-row">
          <span class="settings__switch-text">主题模式</span>
          <el-radio-group :model-value="store.themeMode" @change="store.setThemeMode">
            <el-radio-button value="light">浅色</el-radio-button>
            <el-radio-button value="dark">暗黑</el-radio-button>
            <el-radio-button value="auto">自动</el-radio-button>
          </el-radio-group>
        </div>
        <p class="settings__hint">自动将跟随电脑 / 系统的外观切换</p>
        <div v-if="store.layout === 'vertical'" class="settings__switch-row">
          <span class="settings__switch-text">折叠侧栏</span>
          <el-switch :model-value="store.collapsed" @change="store.toggleCollapsed()" />
        </div>
        <p v-else class="settings__hint">折叠仅适用于垂直布局</p>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'

const LAYOUTS = [
  { value: 'vertical', label: '垂直布局' },
  { value: 'horizontal', label: '水平布局' },
  { value: 'mixed', label: '混合布局' },
]
const COLORS = ['#3fa49a', '#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#9c27b0']

const store = useAppStore()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const props = defineProps({ modelValue: { type: Boolean, default: false } })
const emit = defineEmits(['update:modelValue'])
</script>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings__label {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text-primary);
  margin: 14px 0 8px;
}

.settings__label:first-child {
  margin-top: 0;
}

.settings__layouts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.layout-option {
  border: 1px solid var(--app-border-light);
  border-radius: var(--app-radius);
  padding: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.layout-option:hover {
  background: var(--app-hover);
}
.layout-option.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-light);
}

.layout-option__preview {
  width: 100%;
  height: 44px;
  border: 1px solid var(--app-border-light);
  border-radius: 4px;
  background: var(--app-bg);
  position: relative;
  overflow: hidden;
}

.layout-option__bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 8px;
  background: var(--app-border);
  opacity: 0.35;
  border-bottom: 1px solid var(--app-border-light);
}

.layout-option__menu {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 22px;
  background: var(--app-primary-light);
  border-right: 1px solid var(--app-border-light);
}
.layout-option__menu--vertical {
  left: 0;
  top: 8px;
}
.layout-option__menu--horizontal {
  left: 0;
  right: 0;
  width: auto;
  height: 8px;
  bottom: auto;
}
.layout-option__menu--mixed {
  left: 0;
  top: 8px;
}

.layout-option__placeholder {
  position: absolute;
  top: 12px;
  left: 26px;
  right: 4px;
  bottom: 4px;
  background: var(--app-card);
  border: 1px solid var(--app-border-light);
  border-radius: 2px;
}

.layout-option__name {
  font-size: 12px;
  color: var(--app-text-regular);
}

.settings__swatches {
  display: flex;
  gap: 10px;
}

.color-swatch {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s;
}
.color-swatch:hover {
  transform: scale(1.1);
}

.settings__switches {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings__switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  color: var(--app-text-regular);
}

.settings__hint {
  font-size: 12px;
  color: var(--app-text-secondary);
}
</style>