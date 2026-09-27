// 指标库 decimals 的接线契约（源码断言）。
//
// 行为层面的语义由 num-format-test.mjs 覆盖；这里锁的是「该接的地方有没有接」：
//   1) ChartBuilder / ChartTile / EChartRenderer 都改用共享 util，不再各留 fmtNumber 副本
//   2) 表格单元格首次接入格式化（原先是裸输出 row[col.key]）
//   3) ChartTile 能解析库指标的渲染 key（savedKeys），否则看板上看不到库指标
//   4) 指标弹窗的 el-input-number 在三个 kind 的 v-if 之外（三种类型都要能配）
//   5) decimals 贯通到 chart-configs 的 _stat/_statTrend/_progress 与环形图中心
//   6) 中英 i18n key 成对存在
//   7) DOM 渲染点的 decimals 来自**响应** metrics，而不是图表配置
//      （历史 bug：语法全对、运行时恒 undefined，所有库指标都按「最多 2 位」渲染）
//   8) 看板表头的库指标名也从响应 metrics 兜底（配置里既无 label 也无 field）
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

let passed = 0
const failures = []
// 这个契约测试从 Task 5 起会**故意**红到 Task 8：它要把「哪几处还没接线」一次性列全。
// 所以 t() 必须收集失败而不是抛首个就退出——否则每次都只看到第 1 条，
// Task 6/7/8 的验收标准「确认失败点继续前移」根本无法成立。
function t(name, fn) {
  try {
    fn()
    passed++
    console.log('  ok -', name)
  } catch (e) {
    failures.push({ name, e })
    console.log('  FAIL -', name)
  }
}

function read(p) {
  return readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')
}

// 去掉注释再做「不许出现某写法」的反向断言：源码里大段解释这个坑的注释里
// 必然会出现 `m.decimals` 字面量，不剥掉的话断言会对着注释报错/被注释骗过。
// 排除 `://`（ChartBuilder 的 sectionIcon 里有个 http:// 字符串）。
function stripComments(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(?<![:"'`\\])\/\/.*$/gm, '')
}

// 取 `function name(...) { ... }` 的函数体（按行首 } 收尾，避免正则吃穿相邻函数）
function bodyOf(src, name) {
  const start = src.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'))
  assert.ok(start >= 0, `未找到 ${name}()`)
  const end = src.indexOf('\n}', start)
  assert.ok(end > start, `${name}() 未正常收尾`)
  return src.slice(start, end)
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

t('ChartTile 在 run() 里保存响应中的 savedKeys', () => {
  assert.ok(/savedKeys\.value\s*=/.test(tile), 'ChartTile 未把响应的 savedKeys 存进 ref')
  assert.ok(/res\.data\.savedKeys|data\.value\s*=\s*res\.data/.test(tile), 'run() 里应能取到 res.data.savedKeys')
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

// 这个断言锁的不是「调用点写了 decimals 参数」——那件事上面已经锁了，语法全对也照样
// 可以在运行时取到 undefined。真正的回归是：图表配置里库指标只存 {type,key,metricId}，
// decimals 只随查询响应的 metrics 数组下发；从配置上读永远是 undefined，于是所有库指标
// 都退回「最多 2 位、不补零」（76.99）。源码正则看不见运行时值，只能把「查响应」
// 这件事本身钉死：定义 lookup + 每个渲染点都走它 + 不许再从配置读。
t('DOM 渲染点的 decimals 从响应 metrics 查，不从图表配置读', () => {
  for (const [name, src, resp] of [
    ['ChartBuilder', builder, /previewData\.value\??\.metrics/],
    ['ChartTile', tile, /data\.value\??\.metrics/],
  ]) {
    const code = stripComments(src)
    const i = code.search(/^function metricMetaOf\(/m)
    assert.ok(i >= 0, `${name}.vue 缺少 metricMetaOf()：查响应 metrics 的唯一入口`)
    // lookup 的取值来源要在它附近：响应 metrics 数组，且按渲染 key（savedKeys 展开后的根 key）匹配
    const chain = code.slice(Math.max(0, i - 500), i + 300)
    assert.match(chain, resp, `${name}.metricMetaOf 未查响应里的 metrics 数组`)
    assert.match(chain, /metricRenderKey/, `${name}.metricMetaOf 未按 metricRenderKey(m) 匹配响应的 key`)
    // decimalsOf 必须是纯透传。decimals 的默认值就是 0（falsy），任何真值兜底
    // （`decimals || null` / `decimals ?? 2` / `decimals ? decimals : ...`）都会把
    // 大多数库指标打成非库样式，也违背后端 metrics.js:101-103 定的 `'decimals' in m` 规则。
    const d = bodyOf(code, 'decimalsOf')
    assert.match(d, /metricMetaOf\([^)]*\)\??\.decimals/,
      `${name}.decimalsOf 应直接返回 metricMetaOf(m)?.decimals（查不到时为 undefined = 非库指标）`)
    assert.doesNotMatch(d, /\|\||\?\?|\?[^)]*:/,
      `${name}.decimalsOf 不该对 decimals 做兜底：0 是合法且最常见的取值，判真值会把库指标打成非库样式`)
  }
  // 逐个渲染点钉死：任何一处改回 m?.decimals 都会红（下面的变异验证就靠这条）
  for (const [name, src, sites] of [
    ['ChartBuilder', builder, [
      /formatNumber\(row\[`metric:\$\{metricRenderKey\(m\)\}`\]\?\.value, decimalsOf\(m\)\)/,
      /formatNumber\(calcMultiRing\(m\)\?\.val, decimalsOf\(m\)\)/,
      /decimals: decimalsOf\(m\)/,
    ]],
    ['ChartTile', tile, [
      /formatNumber\(statValue, decimalsOf\(metrics\[0\]\)\)/,
      /formatNumber\(calcMultiRing\(m\)\?\.val, decimalsOf\(m\)\)/,
      /decimals: decimalsOf\(m\)/,
    ]],
  ]) {
    for (const re of sites) assert.match(src, re, `${name} 有一个渲染点没走 decimalsOf()`)
    assert.doesNotMatch(stripComments(src), /m\??\.decimals/,
      `${name} 仍有从图表配置直接读 m?.decimals 的调用点——配置里没有这个字段，运行时恒为 undefined`)
  }
  // 表格单元格的 decimals 来自 tableCols，而 tableCols 那行必须查响应
  assert.match(stripComments(tile), /decimals:\s*decimalsOf\(m\),/,
    'ChartTile 的 tableCols 单元格 decimals 应来自 decimalsOf(m)')
})

t('看板表头：库指标名从响应 metrics 兜底', () => {
  // 库指标在配置里既没有 label 也没有 field（名字存在指标库/响应里），
  // 原来 metricLabel 两级兜底都落空 → 看板表格表头渲染成空串（维度列却正常，
  // 因为维度确有 field）。Editor 早就查了 library.value，所以只有看板空。
  const ml = bodyOf(stripComments(tile), 'metricLabel')
  assert.match(ml, /metricMetaOf\(m\)\??\.label/,
    'ChartTile.metricLabel 未兜底查响应 metrics 的 label——库指标表头会是空串')
  assert.ok(ml.indexOf('m.label') < ml.indexOf('fieldLabelOf'),
    '配置里的 label 仍应优先于字段名')
  assert.ok(ml.indexOf('fieldLabelOf') < ml.indexOf('metricMetaOf'),
    '兜底顺序应为 配置 label > 字段 label > 响应 label，勿打乱既有优先级')
})

if (failures.length) {
  console.log(`\nmetric-decimals-contract: ${passed} 项通过，${failures.length} 项失败\n`)
  for (const { name, e } of failures) {
    console.log(`FAIL: ${name}`)
    console.log(`      ${String(e.message).split('\n').join('\n      ')}\n`)
  }
  process.exit(1)
}

console.log(`metric-decimals-contract: ${passed} 项通过`)
