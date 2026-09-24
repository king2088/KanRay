<template>
  <el-config-provider :size="store.size">
    <TopLoading />
    <router-view />
  </el-config-provider>
</template>

<script setup>
import { useAppStore } from '@/stores/app'
import TopLoading from '@/components/TopLoading.vue'

const store = useAppStore()
</script>