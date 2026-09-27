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
//   9) metricRenderKey 走后端下发的 renamedKeys 映射（重编号后的最终 key）
//  10) ChartBuilder / ChartTile 的 metricRenderKey 两份副本不漂移
//  11) ECharts 路径（chart-configs.js + EChartRenderer）不再按 metric.field 给行取值：
//      同字段多指标（库指标 sum(rate) + 内联 avg(rate)）曾被画成同一个值（实测 sum 被画成 avg）
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

// ---- metricRenderKey 的重编号映射（renamedKeys） ----
//
// 历史 bug：混合图表（库指标 + 内联指标）里内联那一列渲染成 '-'。后端把「内联 + 库指标」
// 一起重编号成 m0..mN（有意为之，emitRef 按 out.length 分配 key），内联指标的 key 被换掉，
// 而映射当时只在 expandSavedMetrics 内部用完就丢。savedKeys 只管库指标，于是前端拿着
// 配置里的 m2 去找 metric:m2 —— 响应里那列叫 m1（撞上了库指标原来的 m1，纯属巧合）→ 找不到 → '-'。
//
// 这里钉两件事：
//   9) 两个组件的 metricRenderKey 都要走 renamedKeys（库指标仍走 savedKeys，它管不带 key 提交的情况）
//  10) 两个实现保持同逻辑——它们本来就互为副本，历史上已经漂移过一次，
//      「与 ChartBuilder.metricRenderKey 同逻辑」的注释不构成任何保证。
t('metricRenderKey：非库指标走 renamedKeys（配置 key → 最终 key）', () => {
  for (const [name, src] of [['ChartBuilder', builder], ['ChartTile', tile]]) {
    // 归一化可选链：ChartBuilder 写 m.x，ChartTile 写 m?.x，逻辑上等价
    const b = bodyOf(stripComments(src), 'metricRenderKey').replace(/m\?\./g, 'm.')
    // 库指标仍走 savedKeys：不带 key 提交时只有它能定位，不能被 renamedKeys 取代
    assert.match(b, /type === 'saved'/, `${name}.metricRenderKey 应保留库指标的 savedKeys 分支`)
    assert.match(b, /savedKeys[^\]]*\?\.\[m\.metricId\]/, `${name}.metricRenderKey 应查 savedKeys[m.metricId]`)
    assert.match(b, /if \(k\) return k/, `${name}.metricRenderKey 应在命中 savedKeys 时直接返回`)
    // 非库指标：先查 renamedKeys，再退回配置 key
    // （(?:\.value)? 兼容 ChartTile 从 ref 读、ChartBuilder 直接读响应字段这两种写法）
    assert.match(b, /renamedKeys(?:\.value)?\?\.\[m\.key\]/,
      `${name}.metricRenderKey 未查 renamedKeys：后端重编号会改掉内联指标的 key，混合图表内联列会渲染成 '-'`)
    assert.match(b, /\|\|\s*m\.key/,
      `${name}.metricRenderKey 查不到 renamedKeys 时应退回 m.key（响应没带 renamedKeys 的老数据不能整表变 '-'）`)
    assert.match(b, /\|\|\s*m\.field/,
      `${name}.metricRenderKey 应保留 m.field 兜底（无 key 的库指标/按字段取值的旧配置）`)
    // 顺序：savedKeys 命中必须早于 renamedKeys，否则库指标会被 renamedKeys 里同名的配置 key 抢走
    assert.ok(b.indexOf('savedKeys') < b.indexOf('renamedKeys'),
      `${name}.metricRenderKey 里 savedKeys 分支应在 renamedKeys 之前`)
  }
  // ChartBuilder 手上有整个响应，ChartTile 只在 run() 里存了两个 ref —— 两边都要真的存下 renamedKeys
  assert.match(builder, /previewData\.value\?\.renamedKeys/,
    'ChartBuilder 应直接从响应读 renamedKeys')
  assert.ok(/const renamedKeys = ref\({}\)/.test(tile), 'ChartTile 缺少保存 renamedKeys 的 ref')
  assert.ok(/renamedKeys\.value\s*=\s*res\.data\.renamedKeys\s*\|\|\s*\{\}/.test(tile),
    'ChartTile 应在 run() 里把 res.data.renamedKeys 存进 ref（与 savedKeys 同一处）')
  // renamedKeys 必须在 tableCols 构建**之前**赋值：那里调 metricRenderKey 建列，晚一步列名就错
  const run = tile.slice(tile.search(/async function run\(\)/))
  assert.ok(run.indexOf('renamedKeys.value =') < run.indexOf('tableCols.value = []'),
    'ChartTile 的 renamedKeys 必须先于 tableCols 赋值，否则 metricRenderKey 取到空 ref，列名全错')
})

t('metricRenderKey：ChartBuilder 与 ChartTile 保持同逻辑（不漂移）', () => {
  // 两份实现只该在「数据从哪来」上不同（响应字段 vs ref），逻辑必须逐字一致。
  // 归一化掉这两处差异后比函数体：谁改了兜底顺序 / 少了 renamedKeys / 漏了 savedKeys 分支都会红。
  const norm = (src) => bodyOf(stripComments(src), 'metricRenderKey')
    .replace(/previewData\.value\?\.savedKeys\?\./, 'SAVEDKEYS?.')
    .replace(/savedKeys\.value\?\./, 'SAVEDKEYS?.')
    .replace(/previewData\.value\?\.renamedKeys\?\./, 'RENAMEDKEYS?.')
    .replace(/renamedKeys\.value\?\./, 'RENAMEDKEYS?.')
    .replace(/m\?\./g, 'm.')
    .replace(/\s+/g, ' ')
    .trim();
  assert.equal(norm(builder), norm(tile),
    'ChartBuilder.metricRenderKey 与 ChartTile.metricRenderKey 已漂移——两边是同一份逻辑的副本，'
    + '只允许数据来源不同（响应字段 vs ref）')
})

t('ECharts 路径不再按 metric.field 取行值（同字段多指标不再互相覆盖）', () => {
  // 历史 bug：后端 query-engine.js:210-213 给每个指标写四个键，其中
  // row[field] / row['metric:'+field] 是**按字段**的便捷副本，同字段的第二个指标
  // 直接盖掉第一个（last-write-wins）。DOM 路径读 `metric:<key>` 天然免疫，
  // 只有 ECharts 路径按 field 取值——一张图里放「库指标 sum(rate) + 内联 avg(rate)」
  // 时两个系列都画成后写入的那个值（实测 sum 100.000006 被画成 avg 50.000003）。
  //
  // 为什么锁源码而不是行为：取值曾经只存在于 chart-configs.js，而它 import `@/i18n/translate`
  // （别名），普通 node 测试 import 不了，所以只能写正则。抽成 utils/metric-value.js
  // 之后行为由 metric-value-test.mjs 真跑；这里钉的是**接线**——所有取值点都必须过它。
  // 只剩 metricValue 一个取值出口之后，任何一处写回 r[metric.field] 都会红。
  const code = stripComments(configs)
  // 白名单而不是黑名单：改完之后，ECharts 路径里**唯一**该出现的 `.field` 就是维度取值。
  // 所以逐个列出 `<标识符>[?.[i]].field` 出现处的标识符，非维度一律红。
  // （早先用黑名单正则漏掉了 r?.[metrics[i].field] 这种带下标的写法，变异验证时抓到了。）
  const DIM_VARS = new Set(['dim', 'dimX', 'dimY', 'groupDim', 'sourceDim', 'targetDim'])
  const offenders = []
  code.split('\n').forEach((l, i) => {
    // 捕获 `.field` 前的标识符：允许中间夹一个 [..]（metrics[i].field），
    // 也允许可选链的 `?`（metric?.field —— 第一版正则漏了它，变异验证时又抓出来一次）
    for (const m of l.matchAll(/([A-Za-z_$][A-Za-z0-9_$]*)(\s*\[[^\]]*\])?\??\.field/g)) {
      if (!DIM_VARS.has(m[1])) offenders.push(`${i + 1}: ${l.trim()}`)
    }
  })
  assert.equal(offenders.length, 0,
    'chart-configs.js 出现了非维度的 .field 取值（指标值必须走 metricValue(row, metric)）：\n  '
    + offenders.join('\n  '))
  // 表格列的 key 同理：metric:<field> 也会撞，且撞出来的两列指向同一格
  const rcode = stripComments(renderer)
  assert.doesNotMatch(rcode, /`metric:\$\{[^}]*\.field\}`/,
    'EChartRenderer 的表格列 key 仍是 `metric:${m.field}`，同字段两个指标会并成一列')
  // 反向：取值点确实接到了 helper 上（漏接一处 = 该图表仍然画错，且上面那条查不出来）
  assert.match(code, /import \{ metricValue \} from '\.\.\/utils\/metric-value'/,
    'chart-configs.js 未 import utils/metric-value')
  assert.match(rcode, /import \{ metricValue \} from '@\/utils\/metric-value'/,
    'EChartRenderer.vue 未 import utils/metric-value')
  // 26 = 本次改写的调用点个数（K 线图一行里有 4 个，所以必须数**出现次数**而不是行数，
  // 早先按行数写成 23，变异验证把一个调用点换成 undefined 都没红）。
  // 只做下限：以后 legit 地多加调用点不会红；少一个（漏接/被删）才会红。
  assert.ok((code.match(/metricValue\(/g) || []).length >= 26,
    `chart-configs.js 里 metricValue 的调用点少于 26 处（当前 ${(code.match(/metricValue\(/g) || []).length}），可能有取值点漏接`)
  assert.match(rcode, /Number\(metricValue\(r, metric\)\)/,
    'EChartRenderer 的地图分支未走 metricValue')
  // 表格列的 label 兜底仍读 m.label || m.field —— 那是显示名不是行取值，不许被上面那条误伤
  assert.match(rcode, /label: m\.label \|\| m\.field/,
    'EChartRenderer 表格列的 label 兜底（m.label || m.field）被改掉了，它只是显示名')
  // 维度不许跟着改：row[field] 对维度同样是 last-write-wins，但查询层已拒绝重复维度，
  // 那不是这个 bug。顺手「统一」会让维度的行取值也依赖 key，属于超出范围的改动。
  assert.match(code, /r\[`dim:\$\{dim\.field\}`\]/, '维度取值应保持 dim:<field> 形态')
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
