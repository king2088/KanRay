import assert from 'node:assert/strict'
import { datasetTypeLabel, toDatasetOptions } from '../src/utils/dataset-type.js'

let passed = 0
function t(name, fn) {
  fn()
  passed++
  console.log('  ok -', name)
}

t('sql 数据集显示关联数据源类型大写', () => {
  assert.equal(datasetTypeLabel({ source_type: 'sql', db_type: 'mysql' }), 'MYSQL')
  assert.equal(datasetTypeLabel({ source_type: 'sql', db_type: 'postgres' }), 'POSTGRES')
  assert.equal(datasetTypeLabel({ source_type: 'sql', db_type: 'clickhouse' }), 'CLICKHOUSE')
})

t('sqlserver 显示为 MSSQL', () => {
  assert.equal(datasetTypeLabel({ source_type: 'sql', db_type: 'sqlserver' }), 'MSSQL')
})

t('sql 数据集无数据源类型回退为 SQL', () => {
  assert.equal(datasetTypeLabel({ source_type: 'sql', db_type: '' }), 'SQL')
  assert.equal(datasetTypeLabel({ source_type: 'sql' }), 'SQL')
})

t('表单填报数据集显示 表单填报', () => {
  assert.equal(datasetTypeLabel({ source_type: 'form' }), '表单填报')
})

t('excel 数据集显示 Excel', () => {
  assert.equal(datasetTypeLabel({ source_type: 'excel' }), 'Excel')
})

t('未知类型按原值大写兜底', () => {
  assert.equal(datasetTypeLabel({ source_type: 'api' }), 'API')
})

t('空输入返回空串', () => {
  assert.equal(datasetTypeLabel(), '')
  assert.equal(datasetTypeLabel(null), '')
})

t('toDatasetOptions 生成虚拟下拉选项结构', () => {
  const opts = toDatasetOptions([
    { id: 1, name: '销售数据', source_type: 'sql', db_type: 'mysql' },
    { id: 2, name: '满意度调查', source_type: 'form' },
    { id: 3, name: '客户名单', source_type: 'excel' },
  ])
  assert.deepEqual(opts, [
    { value: 1, label: '销售数据 - MYSQL', name: '销售数据', type: 'MYSQL' },
    { value: 2, label: '满意度调查 - 表单填报', name: '满意度调查', type: '表单填报' },
    { value: 3, label: '客户名单 - Excel', name: '客户名单', type: 'Excel' },
  ])
})

t('toDatasetOptions withRowCount 在名称后带行数', () => {
  const [o] = toDatasetOptions([{ id: 7, name: '订单', row_count: 125, source_type: 'sql', db_type: 'mysql' }], { withRowCount: true })
  assert.equal(o.label, '订单 (125 行) - MYSQL')
  assert.equal(o.type, 'MYSQL')
})

t('toDatasetOptions 空输入与无类型数据集', () => {
  assert.deepEqual(toDatasetOptions(null), [])
  assert.deepEqual(toDatasetOptions([]), [])
  const [o] = toDatasetOptions([{ id: 9, name: '原始' }])
  assert.deepEqual(o, { value: 9, label: '原始', name: '原始', type: '' })
})

console.log(`datasetTypeLabel 测试：${passed} 项通过`)