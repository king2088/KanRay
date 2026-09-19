<template>
  <div class="app-logo" @click="$router.push('/datasources')">
    <img src="/logo.svg?v=3" class="app-logo__icon" alt="KanRay logo" />
    <span v-show="!collapsed" class="app-logo__text">KanRay</span>
  </div>
</template>

<script setup>
defineProps({ collapsed: { type: Boolean, default: false } })
</script>

<style scoped>
.app-logo {
  height: var(--app-header-height);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid var(--app-border-light);
  flex-shrink: 0;
}

.app-logo__icon {
  flex-shrink: 0;
  width: var(--header-icon-size, 20px);
  height: var(--header-icon-size, 20px);
  border-radius: 6px;
  display: block;
}

.app-logo__text {
  font-size: var(--logo-font-size, 16px);
  font-weight: 600;
  color: var(--app-text-primary);
  white-space: nowrap;
}
</style>