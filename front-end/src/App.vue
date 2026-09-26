<template>
  <el-config-provider :size="store.size" :locale="elLocaleOf(store.locale)">
    <TopLoading />
    <router-view />
  </el-config-provider>
</template>

<script setup>
import { useAppStore } from '@/stores/app'
import { elLocaleOf } from '@/i18n'
import TopLoading from '@/components/TopLoading.vue'

const store = useAppStore()
</script>