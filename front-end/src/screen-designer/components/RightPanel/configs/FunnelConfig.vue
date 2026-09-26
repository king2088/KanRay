<script setup lang="ts">
import './config-common.css'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{ component: any }>()
const emit = defineEmits<{ (e: 'updateProps', key: string, value: any): void }>()
</script>

<template>
  <div class="rc-section">
    <div class="rc-section-title">{{ t('bigscreen.config.funnel.title') }}</div>
    <el-form label-width="70px" size="default">
      <el-form-item :label="t('bigscreen.config.funnel.sort')">
        <el-select :model-value="component.props.sort || 'descending'" @update:model-value="emit('updateProps', 'sort', $event)" class="rc-w100">
          <el-option :label="t('bigscreen.config.common.desc')" value="descending" />
          <el-option :label="t('bigscreen.config.common.asc')" value="ascending" />
          <el-option :label="t('bigscreen.config.common.sortUnordered')" value="none" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('bigscreen.config.funnel.label')">
        <el-switch :model-value="component.props.labelShow !== false" @update:model-value="emit('updateProps', 'labelShow', $event)" />
      </el-form-item>
    </el-form>
  </div>
</template>