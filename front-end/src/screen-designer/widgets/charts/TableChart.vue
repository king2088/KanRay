<!-- 普通表格 (table-normal) - 数据表格组件 -->
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  componentType?: string
  data: any
  style: any
  props: any
}>()

const defaultColumns = [
  { name: '姓名', field: 'name' },
  { name: '部门', field: 'dept' },
  { name: '业绩', field: 'score' },
]

const defaultRows = [
  { name: '张三', dept: '技术部', score: 92 },
  { name: '李四', dept: '市场部', score: 87 },
  { name: '王五', dept: '销售部', score: 95 },
  { name: '赵六', dept: '技术部', score: 88 },
]

const columns = computed(() => props.props?.columns || defaultColumns)
const rows = computed(() => props.props?.rows || defaultRows)
const headerBg = computed(() => props.props?.headerBg || '#16213e')
const rowBg = computed(() => props.props?.rowBg || '#1a1a2e')
const altRowBg = computed(() => props.props?.altRowBg || '#1f1f3a')
const textColor = computed(() => props.props?.textColor || '#e0e0e0')
const borderColor = computed(() => props.props?.borderColor || '#333')
</script>

<template>
  <div class="table-chart">
    <table>
      <thead>
        <tr :style="{ background: headerBg }">
          <th v-for="col in columns" :key="col.field" :style="{ color: textColor, borderBottom: '1px solid ' + borderColor }">
            {{ col.name }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, idx) in rows"
          :key="idx"
          :style="{ background: Number(idx) % 2 === 0 ? rowBg : altRowBg }"
        >
          <td
            v-for="col in columns"
            :key="col.field"
            :style="{ color: textColor, borderBottom: '1px solid ' + borderColor }"
          >
            {{ row[col.field] }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-chart {
  width: 100%;
  height: 100%;
  overflow: auto;
  background: #1a1a2e;
  padding: 12px;
  box-sizing: border-box;
}
.table-chart::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.table-chart::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 3px;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'Microsoft YaHei', sans-serif;
}
th, td {
  padding: 10px 14px;
  text-align: left;
  white-space: nowrap;
  font-size: 14px;
}
th {
  font-weight: 600;
  letter-spacing: 0.5px;
  position: sticky;
  top: 0;
  z-index: 1;
}
tbody tr:hover {
  background: rgba(24, 144, 255, 0.12) !important;
}
</style>
