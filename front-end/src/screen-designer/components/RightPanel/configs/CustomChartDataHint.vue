<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="rc-section">
    <el-alert type="info" :closable="false" class="rc-alert">
      {{ t('bigscreen.config.dataHint.lead') }} <code>data</code> {{ t('bigscreen.config.dataHint.trail') }} <code>data.list</code>、<code>data.values</code>
    </el-alert>
  </div>
</template>

<style scoped>
.rc-alert {
  margin-bottom: 10px;
}
</style>
