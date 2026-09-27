<template>
  <el-select
    class="locale-select"
    :model-value="store.locale"
    :aria-label="t('common.settings.language')"
    @update:model-value="onPick"
  >
    <el-option v-for="o in LOCALE_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
  </el-select>
</template>
<script setup>
// 登录/注册页的语言下拉。公开路由不经过 MainLayout，设置抽屉里的语言入口在此不可达，
// 故单独提供。显式置位与落盘都在 store.setLocale 内部完成，本组件无状态。
import { useAppStore } from '@/stores/app'
import { t } from '@/i18n'
import { LOCALE_OPTIONS } from '@/i18n/constants'

const store = useAppStore()
function onPick(v) {
  store.setLocale(v)
}
</script>
<style scoped>
.locale-select { width: 100%; margin-top: 30px; }
</style>
