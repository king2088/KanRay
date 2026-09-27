// 指标库 decimals 的接线契约（源码断言）。
//
// 行为层面的语义由 num-format-test.mjs 覆盖；这里锁的是「该接的地方有没有接」：
//   1) ChartBuilder / ChartTile / EChartRenderer 都改用共享 util，不再各留 fmtNumber 副本
//   2) 表格单元格首次接入格式化（原先是裸输出 row[col.key]）
//   3) ChartTile 能解析库指标的渲染 key（savedKeys），否则看板上看不到库指标
//   4) 指标弹窗的 el-input-number 在三个 kind 的 v-if 之外（三种类型都要能配）
//   5) decimals 贯通到 chart-configs 的 _stat/_statTrend/_progress 与环形图中心
//   6) 中英 i18n key 成对存在
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

let passed = 0
function t(name, fn) {
  fn()
  passed++
  console.log('  ok -', name)
}

function read(p) {
  return readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')
}

const builder = read('../src/views/ChartBuilder.vue')
const tile = read('../src/components/dashboard/ChartTile.vue')
const renderer = read('../src/components/charts/EChartRenderer.vue')
const configs = read('../src/config/chart-configs.js')
const datasetView = read('../src/views/DatasetDetail.vue')
const zh = read('../src/i18n/locales/zh-CN/dataset.js')
const en = read('../src/i18n/locales/en-US/dataset.js')

t('三处视图都不再自带 fmtNumber 副本，统一走 utils/num-format', () => {
  for (const [name, src] of [['ChartBuilder', builder], ['ChartTile', tile], ['EChartRenderer', renderer]]) {
    assert.ok(!/function fmtNumber\s*\(/.test(src), `${name}.vue 仍留着本地 fmtNumber，应删除并改用 formatNumber`)
    assert.ok(/from '@\/utils\/num-format'/.test(src), `${name}.vue 未 import utils/num-format`)
    assert.ok(/formatNumber\(/.test(src), `${name}.vue 未调用 formatNumber`)
  }
  assert.ok(!/function fmtNum\s*\(/.test(configs), 'chart-configs.js 仍留着本地 fmtNum，应删除并改用 formatNumber')
  assert.ok(/from '@\/utils\/num-format'|from '\.\.\/utils\/num-format'/.test(configs),
    'chart-configs.js 未 import utils/num-format')
})

t('表格单元格首次接入格式化', () => {
  // 必须带 ?.value：query-engine.js 组装的 row['metric:x'] / row['dim:x'] 是
  // { label, agg, value } 对象，Number({...}) === NaN，漏了 ?.value 整列渲染成 '-'。
  // 旧的 /formatNumber\(row\[col\.key\]/ 同时匹配正确与错误两种写法，抓不到这个坑。
  assert.ok(/formatNumber\(row\[col\.key\]\?\.value/.test(tile),
    'ChartTile 表格单元格应改为 formatNumber(row[col.key]?.value, col.decimals)——漏 ?.value 会让整列变 -')
  assert.ok(!/formatNumber\(row\[col\.key\](?!\?\.value)/.test(tile),
    'ChartTile 的 formatNumber(row[col.key] ...) 漏了 ?.value：单元格是对象，Number() 得 NaN 会整列渲染 -')
  assert.ok(/formatNumber\(row\[`metric:\$\{metricRenderKey\(m\)\}`\]\?\.value/.test(builder),
    'ChartBuilder 表格单元格未接入格式化（或漏了 ?.value）')
})

t('维度列不得被数值格式化', () => {
  // query-engine.js:200 dim 值是原始 DB 值，可能是文本（分类名）或年份。
  // 走 formatNumber 会让文本维度变 '-'、年份 2026 变 '2,026'。
  // ChartBuilder.vue:77 现状就是正确示范：dim 列直接 {{ row[`dim:${d.field}`]?.value }}。
  assert.ok(/row\[`dim:\$\{d\.field\}`\]\?\.value\s*\}\}\s*<\/template>/.test(builder),
    'ChartBuilder 维度列应保持裸 ?.value 输出，不要接 formatNumber')
  assert.ok(!/formatNumber\([^)]*dim:/.test(tile) && !/formatNumber\([^)]*dim:/.test(builder),
    '维度列被接上了 formatNumber：文本维度会渲染成 -，年份会被加千分位')
})

t('ChartTile 能解析库指标的渲染 key', () => {
  assert.ok(/function metricRenderKey\s*\(/.test(tile), 'ChartTile 缺少 metricRenderKey')
  assert.match(tile, /metricRenderKey[\s\S]{0,240}?savedKeys/, 'metricRenderKey 应查 savedKeys')
  assert.ok(!/\$\{`metric:\$\{m\.field\}`\}/.test(tile) && !/\$\{`metric:\$\{metrics\.value\[0\]\??\.field\}`\}/.test(tile),
    'ChartTile 仍有直接用 m.field 拼 key 的取值点，会让库指标变成 metric:undefined')
})

t('指标弹窗的 el-input-number 在三个 kind 的 v-if 之外', () => {
  const i = datasetView.indexOf('v-model="metricForm.decimals"')
  assert.ok(i >= 0, 'DatasetDetail.vue 缺少 decimals 控件')
  const firstVIf = datasetView.search(/v-if="metricForm\.kind === 'base'"/)
  const lastVIf = datasetView.search(/v-else-if="metricForm\.kind === 'expr'"/)
  assert.ok(firstVIf > 0 && lastVIf > 0, '未找到 kind 的 v-if / v-else-if 分支')
  assert.ok(i < firstVIf,
    `decimals 控件必须放在三个 kind 分支之外（当前 idx=${i}, 第一个 v-if=${firstVIf}），否则只有 base 类型能配`)
  assert.ok(/:min="0"/.test(datasetView) && /:max="10"/.test(datasetView), 'decimals 控件应限定 0..10')
  assert.ok(/<el-input-number[^>]*v-model="metricForm\.decimals"/.test(datasetView),
    'decimals 控件应为 el-input-number 且绑定 metricForm.decimals')
  assert.ok(/decimals:\s*0/.test(datasetView), 'emptyMetricForm 应给 decimals 兜底 0')
  assert.ok(/metricForm\.decimals\s*=\s*\{\}/.test(datasetView) === false, 'decimals 走 v-model，不应手动赋值')
})

t('decimals 贯通到 chart-configs 的 stat/趋势/进度与环形图中心', () => {
  for (const field of ['_stat', '_statTrend', '_progress']) {
    assert.ok(new RegExp(`${field}:\\s*\\{[^}]*decimals`).test(configs), `${field} 未透传 decimals`)
  }
  assert.ok(/formatNumber\(total,\s*metric\?\.decimals/.test(configs), '环形图中心 total 未按 metric.decimals 格式化')
})

t('中英 i18n key 成对存在', () => {
  for (const key of ['decimalsLabel', 'decimalsPlaceholder']) {
    assert.ok(new RegExp(`${key}:`).test(zh), `zh-CN/dataset.js 缺少 ${key}`)
    assert.ok(new RegExp(`${key}:`).test(en), `en-US/dataset.js 缺少 ${key}`)
  }
})

console.log(`metric-decimals-contract: ${passed} 项通过`)
