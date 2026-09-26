<template>
  <div class="dash-style-panel">
    <div class="ds-sec">
      <div class="ds-sec-title">{{ t('dashboard.style.cardSpacing') }}</div>
      <div class="ds-row">
        <span class="ds-label">{{ t('dashboard.style.horizontal') }}</span>
        <el-input-number v-model="gap.x" :min="4" :max="96"  controls-position="right" style="width: 96px" />
        <span class="ds-unit">px</span>
      </div>
      <div class="ds-row">
        <span class="ds-label">{{ t('dashboard.style.vertical') }}</span>
        <el-input-number v-model="gap.y" :min="4" :max="96"  controls-position="right" style="width: 96px" />
        <span class="ds-unit">px</span>
      </div>
    </div>

    <div class="ds-sec">
      <div class="ds-sec-title">{{ t('dashboard.style.cardStyle') }}</div>
      <div class="ds-row">
        <span class="ds-label">{{ t('dashboard.style.cardBorder') }}</span>
        <el-switch v-model="cardStyle.border" />
      </div>
      <div class="ds-row ds-row--slider">
        <span class="ds-label">{{ t('dashboard.style.borderRadius') }}</span>
        <el-slider v-model="cardStyle.radius" :min="0" :max="20" :step="1" />
        <span class="ds-val">{{ cardStyle.radius }}px</span>
      </div>
      <div class="ds-row">
        <span class="ds-label">{{ t('dashboard.style.titleVisibility') }}</span>
        <el-switch v-model="cardStyle.showTitle" />
      </div>
      <div class="ds-divider" />
      <div class="ds-row ds-row--slider">
        <span class="ds-label">{{ t('dashboard.style.titleHeight') }}</span>
        <el-slider v-model="cardStyle.titleHeight" :min="24" :max="52" :step="1" />
        <span class="ds-val">{{ cardStyle.titleHeight }}px</span>
      </div>
      <div class="ds-row ds-row--slider">
        <span class="ds-label">{{ t('dashboard.style.titleFontSize') }}</span>
        <el-slider v-model="cardStyle.titleFontSize" :min="12" :max="20" :step="1" />
        <span class="ds-val">{{ cardStyle.titleFontSize }}px</span>
      </div>
      <div class="ds-row">
        <span class="ds-label">{{ t('dashboard.style.titleBottomBorder') }}</span>
        <el-switch v-model="cardStyle.titleUnderline" />
      </div>
    </div>

    <p class="ds-hint">{{ t('dashboard.style.hint') }}</p>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
defineProps({
  gap: { type: Object, required: true },
  cardStyle: { type: Object, required: true },
})
</script>

<style scoped>
.dash-style-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.ds-sec {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ds-sec-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text-primary);
}

.ds-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ds-row--slider {
  gap: 8px;
}

.ds-label {
  width: 72px;
  flex-shrink: 0;
  font-size: 14px;
  color: var(--app-text-primary);
}

.ds-row--slider .el-slider {
  flex: 1;
}

.ds-val {
  width: 34px;
  flex-shrink: 0;
  text-align: right;
  font-size: 12px;
  color: var(--app-text-secondary);
}

.ds-unit {
  font-size: 12px;
  color: var(--app-text-secondary);
}

.ds-divider {
  height: 1px;
  background: var(--app-border-light);
}

.ds-hint {
  margin: 0;
  font-size: 12px;
  color: var(--app-text-secondary);
  line-height: 1.6;
}
</style>