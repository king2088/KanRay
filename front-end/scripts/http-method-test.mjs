import assert from 'node:assert/strict'
import { attachMethods } from '../src/api/reqMethods.js'

let passed = 0

function newTarget() {
  const calls = []
  const target = { calls }
  attachMethods(target, (config) => calls.push(config))
  return target
}

async function t(name, fn) {
  await fn()
  passed++
  console.log('  ok -', name)
}

await t('POST 登录：data 保留完整 body', async () => {
  const t2 = newTarget()
  t2.post('/auth/login', { email: 'a@b.c', password: 'abc123' })
  assert.equal(t2.calls.length, 1)
  assert.equal(t2.calls[0].url, '/auth/login')
  assert.equal(t2.calls[0].method, 'post')
  assert.deepEqual(t2.calls[0].data, { email: 'a@b.c', password: 'abc123' }, 'body 不应被当成 config 丢弃')
})

await t('POST + 第三个参数 config：data/config 各自归位', async () => {
  const t2 = newTarget()
  t2.post('/datasets/1/query', { sql: 'select 1' }, { timeout: 120000 })
  assert.equal(t2.calls.length, 1)
  assert.deepEqual(t2.calls[0].data, { sql: 'select 1' })
  assert.equal(t2.calls[0].timeout, 120000)
})

await t('PATCH/PUT 保留 data', async () => {
  const t2 = newTarget()
  t2.patch('/forms/1', { values: { score: 99 } })
  t2.put('/auth/password', { password: 'x' })
  assert.deepEqual(t2.calls[0].data, { values: { score: 99 } })
  assert.deepEqual(t2.calls[1].data, { password: 'x' })
})

await t('GET/DELETE 的第二个参数是 config（params/timeout 透传）', async () => {
  const t2 = newTarget()
  t2.get('/datasets/1', { params: { page: 1 } })
  t2.delete(`/forms/1`)
  assert.equal(t2.calls[0].method, 'get')
  assert.deepEqual(t2.calls[0].params, { page: 1 })
  assert.equal('data' in t2.calls[0], false, 'GET 不应带 data')
  assert.equal(t2.calls[1].method, 'delete')
})

console.log(`http 方法包装测试:${passed} 项通过`)