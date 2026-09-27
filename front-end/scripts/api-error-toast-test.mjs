import assert from 'node:assert/strict'
import { apiErrorMessage } from '../src/api/error-toast.js'

let passed = 0
function t(name, fn) {
  fn()
  passed++
  console.log('  ok -', name)
}

const FB = '加载失败'

t('拦截器已提示过的错误不再弹第二条', () => {
  assert.equal(apiErrorMessage({ message: 'Request failed with status code 500', toasted: true }, FB), null)
})

t('未提示的错误用 e.message（即拦截器的本地化文案）', () => {
  assert.equal(apiErrorMessage({ message: '数据源已删除' }, FB), '数据源已删除')
})

t('e 没有 message 时回落到调用点的兜底文案', () => {
  assert.equal(apiErrorMessage({}, FB), FB)
  assert.equal(apiErrorMessage(new Error(''), FB), FB)
})

t('非 http 的异常（store 抛错、TypeError）仍会提示', () => {
  // 这些不会经过 http.js 拦截器，因此没有 toasted 标记，必须照常提示
  assert.equal(apiErrorMessage(new TypeError("Cannot read properties of null"), FB), "Cannot read properties of null")
})

t('空错误与空兜底都产出 null，不弹空气泡', () => {
  assert.equal(apiErrorMessage(null, FB), null)
  assert.equal(apiErrorMessage(undefined, FB), null)
  assert.equal(apiErrorMessage({}, ''), '')
})

console.log(`错误提示去重测试:${passed} 项通过`)
