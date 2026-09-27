// 校验看板图表卡片(ChartTile.vue)用指标名而不是内部字段别名作标签。
//
// 现象：看板中心的指标显示成 `f_8 (sum)` / `f_7 (avg)`，把内部字段别名和
// 聚合 token 直接暴露给用户。
//
// 根因：图表配置里本来就存了用户命名的 label
// （如 {"field":"f_8","agg":"sum","label":"总营收(元)"}），编辑页 ChartBuilder.vue
// 早就优先取 label，但 ChartTile.vue 的 metricLabel 直接拼 `${m.field} (${m.agg})`，
// tableCols 也直接拿 m.field / d.field 当列头 —— 三处泄漏，且后两处不经过
// metricLabel，只改 metricLabel 会漏掉表格/热力图等类型的列头。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

let passed = 0
function t(name, fn) {
  fn()
  passed++
  console.log('  ok -', name)
}

const tile = readFileSync(
  fileURLToPath(new URL('../src/components/dashboard/ChartTile.vue', import.meta.url)),
  'utf8',
)

// 取 `function name(...) { ... }` 的函数体（按行首 } 收尾，避免正则吃穿相邻函数）
function bodyOf(name) {
  const start = tile.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'))
  assert.ok(start >= 0, `未找到 ${name}()`)
  const end = tile.indexOf('\n}', start)
  assert.ok(end > start, `${name}() 未正常收尾`)
  return tile.slice(start, end)
}

const metricLabel = bodyOf('metricLabel')
const dimLabel = bodyOf('dimLabel')
const fieldLabelOf = bodyOf('fieldLabelOf')
const runBody = bodyOf('run')

await t('metricLabel 优先用配置里的指标名 label', () => {
  assert.match(metricLabel, /m\.label\s*\|\|/, '未优先取 m.label')
  assert.match(metricLabel, /fieldLabelOf\(m\.field\)/, 'label 缺失时未退回数据集字段 label')
})

await t('metricLabel 不再拼接聚合 token(sum/avg)', () => {
  const user = tile.match(/f_8 \(sum\)|f_7 \(avg\)/)
  assert.equal(user, null, '源码里仍留有 f_8 (sum) 形态的拼接')
  assert.doesNotMatch(
    metricLabel,
    /\$\{[^}]*agg[^}]*\}/,
    'metricLabel 仍在模板串里插入 agg，看板不该显示计算口径 token',
  )
})

await t('metricLabel/dimLabel 对空入参安全,不渲染出 undefined', () => {
  assert.match(metricLabel, /if \(!m\) return ''/, 'metricLabel 缺少空值保护')
  assert.match(dimLabel, /if \(!d\) return ''/, 'dimLabel 缺少空值保护')
  assert.match(fieldLabelOf, /if \(!name\) return ''/, 'fieldLabelOf 缺少空值保护')
})

await t('表格列头用显示名,不再直接用 m.field / d.field', () => {
  assert.match(runBody, /label:\s*metricLabel\(m\)/, 'metrics 列头未用 metricLabel')
  assert.match(runBody, /label:\s*dimLabel\(d\)/, 'dimensions 列头未用 dimLabel')
  assert.doesNotMatch(
    runBody,
    /label:\s*[dm]\.field\b/,
    '仍有列头直接渲染原始字段别名',
  )
})

console.log(`看板指标标签测试:${passed} 项通过`)
