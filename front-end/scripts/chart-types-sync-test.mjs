// 校验 front-end/src/config/chart-types.js 与 backend/src/services/chart.service.js
// 两处手工维护的图表类型白名单集合一致，防止国际化改造中两边漂移。
// 后端为 CommonJS 且依赖 db/better-sqlite3，此处只做源码文本提取，避免加载模块。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CHART_TYPES } from '../src/config/chart-types.js'

const EXPECTED_TOTAL = 53

let passed = 0
function t(name, fn) {
  fn()
  passed++
  console.log('  ok -', name)
}

const backendSrc = readFileSync(
  fileURLToPath(new URL('../../backend/src/services/chart.service.js', import.meta.url)),
  'utf8',
)

const block = backendSrc.match(/const CHART_TYPES = \[([\s\S]*?)\];/)
assert.ok(block, '未能从 chart.service.js 提取 CHART_TYPES 数组字面量')

const backendTypes = [...block[1].matchAll(/'([A-Za-z0-9]+)'/g)].map((m) => m[1])
const frontendTypes = CHART_TYPES.map((c) => c.value)

t('后端字面量提取到 53 项', () => {
  assert.equal(backendTypes.length, EXPECTED_TOTAL, `实际 ${backendTypes.length} 项`)
})

t('前端 CHART_TYPES 为 53 项', () => {
  assert.equal(frontendTypes.length, EXPECTED_TOTAL, `实际 ${frontendTypes.length} 项`)
})

t('前后端集合完全一致', () => {
  const onlyFront = frontendTypes.filter((v) => !backendTypes.includes(v))
  const onlyBack = backendTypes.filter((v) => !frontendTypes.includes(v))
  assert.deepEqual(onlyFront, [], `仅前端存在: ${onlyFront.join(', ')}`)
  assert.deepEqual(onlyBack, [], `仅后端存在: ${onlyBack.join(', ')}`)
})

t('无重复项', () => {
  assert.equal(new Set(frontendTypes).size, frontendTypes.length, '前端存在重复 value')
  assert.equal(new Set(backendTypes).size, backendTypes.length, '后端存在重复项')
})

t('每个图表类型都声明了 category', () => {
  for (const c of CHART_TYPES) assert.ok(c.category, `${c.value} 缺少 category`)
})

console.log(`chartTypes 同步测试：${passed} 项通过`)
