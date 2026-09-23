import assert from 'node:assert/strict'
import { rowsToChartData, queryRowsToChartData, buildQueryPayload } from '../src/screen-designer/utils/chartData.ts'

let passed = 0
function t(name, fn) {
  fn()
  passed++
  console.log('  ok -', name)
}

t('单指标单维度映射为 xAxis/series', () => {
  const out = JSON.parse(queryRowsToChartData({
    dimensions: [{ field: 'date', label: '日期', granularity: 'day' }],
    metrics: [{ key: 'm1', kind: 'base', field: 'amount', agg: 'sum', label: '金额(sum)' }],
    rows: [
      { 'dim:date': { label: '日期', value: '2026-01-01' }, 'metric:m1': { label: '金额(sum)', agg: 'sum', value: 100 } },
      { 'dim:date': { label: '日期', value: '2026-01-02' }, 'metric:m1': { label: '金额(sum)', agg: 'sum', value: 250 } },
    ],
  }))
  assert.deepEqual(out.xAxis, ['2026-01-01', '2026-01-02'])
  assert.equal(out.series.length, 1)
  assert.equal(out.series[0].name, '金额(sum)')
  assert.deepEqual(out.series[0].data, [100, 250])
})

t('多指标生成多条 series', () => {
  const out = JSON.parse(queryRowsToChartData({
    dimensions: [{ field: 'date', label: '日期' }],
    metrics: [
      { key: 'm1', kind: 'base', field: 'a', agg: 'sum', label: 'a(sum)' },
      { key: 'm2', kind: 'base', field: 'b', agg: 'avg', label: 'b(avg)' },
    ],
    rows: [{ 'dim:date': { value: 'd1' }, 'metric:m1': { value: 1 }, 'metric:m2': { value: 2 } }],
  }))
  assert.equal(out.series.length, 2)
  assert.equal(out.series[1].name, 'b(avg)')
  assert.deepEqual(out.series[1].data, [2])
})

t('多维度拼接为复合 xAxis', () => {
  const out = JSON.parse(queryRowsToChartData({
    dimensions: [{ field: 'region' }, { field: 'city' }],
    metrics: [{ key: 'm1', field: 'sales', agg: 'sum', label: 'x' }],
    rows: [{ 'dim:region': { value: '华东' }, 'dim:city': { value: '上海' }, 'metric:m1': { value: 30 } }],
  }))
  assert.deepEqual(out.xAxis, ['华东 | 上海'])
})

t('空行返回空结构', () => {
  const out = JSON.parse(queryRowsToChartData({ dimensions: [], metrics: [], rows: [] }))
  assert.deepEqual(out.xAxis, [])
  assert.deepEqual(out.series, [])
})

t('缺失指标值兜底为 0', () => {
  const out = JSON.parse(queryRowsToChartData({
    dimensions: [{ field: 'd' }],
    metrics: [{ key: 'm1', field: 'v', agg: 'sum', label: 'v' }],
    rows: [{ 'dim:d': { value: 'x' }, 'metric:m1': { value: null } }],
  }))
  assert.deepEqual(out.series[0].data, [0])
})

t('buildQueryPayload 输出后端合法 payload', () => {
  const payload = buildQueryPayload({
    dimensions: [{ field: 'date', granularity: 'day' }, { field: '' }, { field: 'region', granularity: undefined }],
    metrics: [{ type: 'base', key: 'm1', field: 'amount', agg: 'sum' }, { field: '' }],
    groupLimit: 15,
    sortBy: 0,
    sortOrder: 'desc',
  })
  assert.deepEqual(payload.dimensions, [{ field: 'date', granularity: 'day' }, { field: 'region', granularity: undefined }])
  assert.deepEqual(payload.metrics, [{ type: 'base', key: 'm1', field: 'amount', agg: 'sum' }])
  assert.equal(payload.groupLimit, 15)
  assert.equal(payload.sortBy, 0)
  assert.equal(payload.sortOrder, 'desc')
})

t('buildQueryPayload 透传 sortBy dim 与 sortOrder asc', () => {
  const payload = buildQueryPayload({
    dimensions: [{ field: 'date' }],
    metrics: [{ type: 'base', key: 'm1', field: 'amount', agg: 'sum' }],
    groupLimit: 20,
    sortBy: 'dim',
    sortOrder: 'asc',
  })
  assert.equal(payload.sortBy, 'dim')
  assert.equal(payload.sortOrder, 'asc')
})

t('buildQueryPayload 空维度/指标/排序缺省', () => {
  const payload = buildQueryPayload({ dimensions: [], metrics: [], groupLimit: 20 })
  assert.deepEqual(payload.dimensions, [])
  assert.deepEqual(payload.metrics, [])
  assert.equal(payload.groupLimit, 20)
  assert.equal(payload.sortBy, undefined)
  assert.equal(payload.sortOrder, undefined)
})

t('rowsToChartData 回归：旧逻辑不变', () => {
  const out = JSON.parse(rowsToChartData(
    [{ category: 'a', sales: 1 }, { category: 'b', sales: 2 }],
    'category', ['sales']
  ))
  assert.deepEqual(out.xAxis, ['a', 'b'])
  assert.deepEqual(out.series[0].data, [1, 2])
})

console.log(`chartData 测试：${passed} 项通过`)
if (passed === 0) process.exit(1)