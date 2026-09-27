// 校验 utils/metric-value.js：ECharts 那条路按**指标 key** 取值，而不是按 field。
//
// 现象（实测复现，数据集行 a|76.989306 / a|23.0107 / b|90，库指标 sum(rate) + 内联 avg(rate)）：
//   response.metrics = [ {key:'m0', kind:'base', field:'rate', agg:'sum'},
//                        {key:'m1', kind:'base', field:'rate', agg:'avg'}  ]
//   row.a.rate          = 50.000003   ← avg，m1 把 m0 的值覆盖了
//   row.a['metric:rate']= {avg, 50.000003}  ← 同样被覆盖
//   row.a.m0            = 100.000006  ← sum，唯一键，一直是对的
//   row.a.m1            = 50.000003
//
// 根因在 backend/src/engines/query-engine.js:210-213：每个指标写四个键，
// 其中 row[field] / row['metric:'+field] 这两个是**按字段**的便捷副本，
// 同字段的第二个指标直接盖掉第一个（last-write-wins）。
// DOM 渲染路径（ChartBuilder/ChartTile）按 `metric:<key>` 取值，天然免疫；
// 只有 ECharts 路径按 field 取值，所以只有它画错。
//
// 这里锁的是**行为**（原来只能写源码正则，因为 chart-configs.js 走 @/ 别名没法被 node 直接 import；
// 抽成别名无关的纯函数后终于能真跑）。接线层由 metric-decimals-contract-test.mjs 钉。
import assert from 'node:assert/strict'
import { metricValue } from '../src/utils/metric-value.js'

let passed = 0
function t(name, fn) {
  fn()
  passed++
  console.log('  ok -', name)
}

// 真·API 响应里的一行（见文件头，值与实测一致）
function apiRow() {
  return {
    'dim:grp': { label: 'grp', value: 'a' },
    grp: 'a',
    // ↓ 同字段两个指标：这两个是被覆盖的「便捷副本」，值等于最后写入的 avg
    rate: 50.000003,
    'metric:rate': { label: '内联avg', agg: 'avg', value: 50.000003 },
    // ↓ 唯一键：两个指标各自的真值
    m0: 100.000006,
    'metric:m0': { label: '库指标sum', agg: 'sum', value: 100.000006 },
    m1: 50.000003,
    'metric:m1': { label: '内联avg', agg: 'avg', value: 50.000003 },
  }
}

const LIB_SUM = { key: 'm0', kind: 'base', field: 'rate', agg: 'sum', label: '库指标sum' }
const INLINE_AVG = { key: 'm1', kind: 'base', field: 'rate', agg: 'avg', label: '内联avg' }

t('field 与 key 不同时按 key 取值', () => {
  const row = apiRow()
  assert.notEqual(LIB_SUM.field, LIB_SUM.key, '本用例的前提：base 指标的 field !== key')
  assert.equal(metricValue(row, LIB_SUM), 100.000006)
  // 旧的 r[metric.field] 在这里会返回 50.000003（avg）
  assert.notEqual(metricValue(row, LIB_SUM), row.rate, '仍按 field 取值就是本 bug')
})

t('回归：同字段两个指标必须解析出**不同**的值', () => {
  const row = apiRow()
  const sum = metricValue(row, LIB_SUM)
  const avg = metricValue(row, INLINE_AVG)
  assert.equal(sum, 100.000006, '库指标 sum 应对应 sum 的真值')
  assert.equal(avg, 50.000003, '内联 avg 应对应 avg 的真值')
  assert.notEqual(sum, avg, '两个指标解析出同一个值 = 又退回按 field 取值了')
  // 两个值都得跟结构化副本一致，避免只对其中一种形状生效
  assert.equal(sum, row['metric:m0'].value)
  assert.equal(avg, row['metric:m1'].value)
})

t('base 形状：按 key 取，不受同字段其他指标影响', () => {
  const row = apiRow()
  assert.equal(metricValue(row, { key: 'm0', kind: 'base', field: 'rate', agg: 'sum' }), 100.000006)
  assert.equal(metricValue(row, { key: 'm1', kind: 'base', field: 'rate', agg: 'avg' }), 50.000003)
})

t('expr 形状：field === key，仍能取到值', () => {
  // backend/src/engines/metrics.js:149 —— expr 的 field 被写成 key，所以它从不与别人撞
  const m = { key: 'm2', kind: 'expr', field: 'm2', agg: 'expr', expr: '$m0 + $m1' }
  const row = { ...apiRow(), m2: 150.000009, 'metric:m2': { label: 'expr', agg: 'expr', value: 150.000009 } }
  assert.equal(metricValue(row, m), 150.000009)
})

t('derived 形状：setDerived 只写 row[key]，按 key 取才取得到', () => {
  // backend/src/engines/metrics.js:180 field=key，:229-232 setDerived 写 row[key] 与 row['metric:'+key]
  const m = { key: 'm3', kind: 'derived', field: 'm3', derivedKind: 'share', ref: 'm0' }
  const row = { ...apiRow(), m3: 0.5263158044321326, 'metric:m3': { label: 'share', agg: 'share', value: 0.5263158044321326 } }
  assert.equal(metricValue(row, m), 0.5263158044321326)
  assert.equal(metricValue(row, m), row['metric:m3'].value)
})

t('缺 key / 缺行 / 缺指标：返回 undefined，不抛也不返回 null', () => {
  const row = apiRow()
  assert.equal(metricValue(row, { key: 'nope', kind: 'base', field: 'rate', agg: 'sum' }), undefined)
  assert.equal(metricValue(row, { key: 'm0' }), 100.000006, '有 key 就该取到，不要求 kind/field')
  assert.equal(metricValue(undefined, LIB_SUM), undefined, '行缺失应等同属性访问 undefined')
  assert.equal(metricValue(null, LIB_SUM), undefined)
  assert.equal(metricValue(row, undefined), undefined, '指标缺失应等同属性访问 undefined')
  assert.equal(metricValue(row, null), undefined)
  // 必须是 undefined 而不是 null：EChartRenderer 的地图分支是
  // `Number(r[metric.field]) ?? null` 再 filter(d => d.value !== null && isFinite(d.value))，
  // Number(null) === 0 会把「没有值」的点画成 0，undefined 才能被 filter 掉。
  assert.equal(metricValue({}, LIB_SUM) === null, false, '缺值不能返回 null')
})

t('不做任何数值强转：字符串原样返回', () => {
  // 真实响应里指标值可能是字符串（num-format.js 记录的实测 '76.989306'）。
  // 强转是各调用点自己的事（有的 Number()、有的不转），helper 只负责选对键，
  // 顺带强转会悄悄改掉图表收到的值类型。
  const row = { m0: '76.989306', 'metric:m0': { label: 'x', agg: 'sum', value: '76.989306' } }
  assert.equal(metricValue(row, LIB_SUM), '76.989306')
  assert.equal(typeof metricValue(row, LIB_SUM), 'string')
})

if (passed) console.log(`metric-value: ${passed} 项通过`)
