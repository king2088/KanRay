<script setup lang="ts">
import './config-common.css'

defineProps<{ component: any }>()
const emit = defineEmits<{ (e: 'updateProps', key: string, value: any): void }>()
</script>

<template>
  <div class="rc-section">
    <div class="rc-section-title">漏斗图</div>
    <el-form label-width="70px" size="default">
      <el-form-item label="排序">
        <el-select :model-value="component.props.sort || 'descending'" @update:model-value="emit('updateProps', 'sort', $event)" class="rc-w100">
          <el-option label="降序" value="descending" />
          <el-option label="升序" value="ascending" />
          <el-option label="无序" value="none" />
        </el-select>
      </el-form-item>
      <el-form-item label="标签">
        <el-switch :model-value="component.props.labelShow !== false" @update:model-value="emit('updateProps', 'labelShow', $event)" />
      </el-form-item>
    </el-form>
  </div>
</template>