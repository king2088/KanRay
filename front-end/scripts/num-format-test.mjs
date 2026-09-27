// 校验 utils/num-format.js 的小数位格式化语义。
//
// 现象：接口 /api/charts/:id/data 返回的指标值是**字符串**（实测 '76.989306'），
// 而散落各处的 fmtNumber 都带一句早退
//   if (typeof n !== 'number') return String(n)
// 于是 toLocaleString 的 maximumFractionDigits: 2 从来没生效过，
// 看板直接把 76.989306 显示出来。
//
// 语义（见 docs/superpowers/specs/2026-09-27-metric-decimals-design.md）：
//   decimals == null   非库指标：最多 2 位、不补零（保持既有行为）
//   decimals 0..10     库指标：固定小数位、不足补零
//   值非数字            返回 '-'
import assert from 'node:assert/strict'
import {
  formatNumber,
  normalizeDecimals,
  LIB_MAX_DECIMALS,
} from '../src/utils/num-format.js'

let passed = 0
function t(name, fn) {
  fn()
  passed++
  console.log('  ok -', name)
}

t('LIB_MAX_DECIMALS 上限为 10', () => {
  assert.equal(LIB_MAX_DECIMALS, 10)
})

t('normalizeDecimals：合法值原样返回', () => {
  assert.equal(normalizeDecimals(0), 0)
  assert.equal(normalizeDecimals(2), 2)
  assert.equal(normalizeDecimals(10), 10)
  assert.equal(normalizeDecimals('3'), 3, '字符串数字应被容忍')
})

t('normalizeDecimals：缺省与非法值一律退回 null（=维持现状）', () => {
  for (const bad of [undefined, null, '', -1, 11, 1.5, 'abc', NaN, Infinity, {}]) {
    assert.equal(normalizeDecimals(bad), null, `${String(bad)} 应归一为 null`)
  }
})

t('回归：字符串数值被强转，最多 2 位终于生效', () => {
  assert.equal(formatNumber('76.989306', null), '76.99')
  assert.equal(formatNumber(76.989306, null), '76.99')
  assert.equal(formatNumber('1234.5678', null), '1,234.57')
})

t('库指标：按 decimals 固定小数位并补零', () => {
  assert.equal(formatNumber('76.989306', 0), '77')
  assert.equal(formatNumber('76.989306', 2), '76.99')
  assert.equal(formatNumber('76.989306', 4), '76.9893')
  assert.equal(formatNumber(77, 2), '77.00', '整数也要补到 2 位')
  assert.equal(formatNumber(0, 0), '0')
  assert.equal(formatNumber(1234.5, 2), '1,234.50')
})

t('非法 decimals 退回现状行为而不是抛错', () => {
  assert.equal(formatNumber('76.989306', 99), '76.99')
  assert.equal(formatNumber('76.989306', -1), '76.99')
  assert.equal(formatNumber('76.989306', 1.5), '76.99')
})

t('非数字值返回 -', () => {
  for (const bad of [null, undefined, '', 'abc', NaN, Infinity]) {
    assert.equal(formatNumber(bad, 2), '-', `${String(bad)} 应显示 -`)
    assert.equal(formatNumber(bad, null), '-', `${String(bad)} 应显示 -`)
  }
})

t('0 是有效数值，不能被当成空值', () => {
  assert.equal(formatNumber(0, 0), '0')
  assert.equal(formatNumber('0', 2), '0.00')
})

console.log(`num-format: ${passed} 项通过`)
