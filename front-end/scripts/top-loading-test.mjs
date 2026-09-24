import assert from 'node:assert/strict'
import { topLoading } from '../src/utils/top-loading.js'

let passed = 0
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const DELAY = 60
const MARGIN = 25

async function newHarness() {
  topLoading.reset()
  const events = []
  const unsub = topLoading.subscribe((v) => events.push(v))
  return { events, unsub }
}

async function t(name, fn) {
  await fn()
  passed++
  console.log('  ok -', name)
}

assert.equal(topLoading.TOP_LOADING_DELAY, 200, '默认延迟为 200ms')
topLoading.setDelay(DELAY)
console.log('  ok - 默认延迟常量为 200ms')

await t('延迟窗口内不显示,超时后可见', async () => {
  const { events, unsub } = await newHarness()
  try {
    topLoading.start()
    await sleep(DELAY / 2)
    assert.deepEqual(events, [])
    await sleep(DELAY / 2 + MARGIN)
    assert.equal(events.at(-1), true)
  } finally { unsub() }
})

await t('快速完成(done 早于延迟)则不显示', async () => {
  const { events, unsub } = await newHarness()
  try {
    topLoading.start()
    await sleep(MARGIN)
    topLoading.done()
    await sleep(DELAY + MARGIN)
    assert.deepEqual(events, [])
  } finally { unsub() }
})

await t('并发请求:最后一个 done 才隐藏,中途不闪断', async () => {
  const { events, unsub } = await newHarness()
  try {
    topLoading.start()
    topLoading.start()
    await sleep(MARGIN)
    topLoading.done()
    assert.deepEqual(events, [])
    await sleep(DELAY - MARGIN + MARGIN)
    assert.equal(events.at(-1), true, '仍有在途请求应保持可见')
    topLoading.done()
    await sleep(MARGIN)
    assert.equal(events.at(-1), false, '最后一个请求完成后隐藏')
  } finally { unsub() }
})

await t('反复启停循环不残留倒计数', async () => {
  const { events, unsub } = await newHarness()
  try {
    topLoading.start(); await sleep(DELAY + MARGIN)
    topLoading.done(); await sleep(MARGIN)
    assert.equal(events.at(-1), false)
    topLoading.start(); await sleep(DELAY + MARGIN)
    assert.equal(events.at(-1), true, '再次 start 可重新显示')
    topLoading.done(); await sleep(MARGIN)
    assert.equal(events.at(-1), false)
  } finally { unsub() }
})

await t('退订后不再收到事件', async () => {
  const { events, unsub } = await newHarness()
  unsub()
  topLoading.start()
  await sleep(DELAY + MARGIN)
  topLoading.done()
  await sleep(MARGIN)
  assert.deepEqual(events, [])
})

console.log(`topLoading 测试:${passed} 项通过`)