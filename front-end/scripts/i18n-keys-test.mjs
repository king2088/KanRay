// i18n 基础设施自检：
// 1) zh-CN / en-US 两个语言的 12 个域文件齐备且与 DOMAINS 一一对应
// 2) 展平后 zh/en 键集合完全一致
// 3) 无空值、无与键名同值的占位符
// 4) pickLocaleText 语言选择与回退行为
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { DEFAULT_LOCALE, DOMAINS, SUPPORT_LOCALES } from '../src/i18n/constants.js'
import { flattenMessages } from '../src/i18n/flatten.js'
import { isEnglish, pickLocaleText } from '../src/i18n/locale-util.js'

let passed = 0
function t(name, fn) {
  fn()
  passed++
  console.log('  ok -', name)
}

// 顶层 await 一次性加载，避免在同步的 t() 回调里 await
const locales = {}
const domainModules = {}
for (const locale of SUPPORT_LOCALES) {
  locales[locale] = (await import(`../src/i18n/locales/${locale}/index.js`)).default
  for (const domain of DOMAINS) {
    const path = fileURLToPath(new URL(`../src/i18n/locales/${locale}/${domain}.js`, import.meta.url))
    if (!existsSync(path)) continue
    domainModules[`${locale}/${domain}`] = (await import(`../src/i18n/locales/${locale}/${domain}.js`)).default
  }
}

t('DOMAINS 为 12 个域', () => {
  assert.equal(DOMAINS.length, 12)
  assert.equal(new Set(DOMAINS).size, 12, 'DOMAINS 存在重复项')
})

t('每个语言的 12 个域文件齐备', () => {
  for (const locale of SUPPORT_LOCALES) {
    for (const domain of DOMAINS) {
      const path = fileURLToPath(new URL(`../src/i18n/locales/${locale}/${domain}.js`, import.meta.url))
      assert.ok(existsSync(path), `缺少 ${locale}/${domain}.js`)
    }
  }
})

t('每个域文件导出对象', () => {
  assert.equal(Object.keys(domainModules).length, SUPPORT_LOCALES.length * DOMAINS.length)
  for (const [name, mod] of Object.entries(domainModules)) {
    assert.ok(mod && typeof mod === 'object', `${name} 未导出对象`)
  }
})

t('两个语言词典都有键', () => {
  for (const locale of SUPPORT_LOCALES) {
    const flat = flattenMessages(locales[locale])
    assert.ok(Object.keys(flat).length > 0, `${locale} 词典为空`)
  }
})

const zhFlat = flattenMessages(locales['zh-CN'])
const enFlat = flattenMessages(locales['en-US'])

t('zh/en 键集合完全一致', () => {
  const zhKeys = Object.keys(zhFlat).sort()
  const enKeys = Object.keys(enFlat).sort()
  const onlyZh = zhKeys.filter((k) => !enKeys.includes(k))
  const onlyEn = enKeys.filter((k) => !zhKeys.includes(k))
  assert.deepEqual(onlyZh, [], `仅中文存在: ${onlyZh.join(', ')}`)
  assert.deepEqual(onlyEn, [], `仅英文存在: ${onlyEn.join(', ')}`)
})

t('无空值与空白值', () => {
  for (const [locale, flat] of [['zh-CN', zhFlat], ['en-US', enFlat]]) {
    for (const [key, value] of Object.entries(flat)) {
      assert.ok(typeof value === 'string', `${locale}.${key} 不是字符串`)
      assert.ok(value.trim().length > 0, `${locale}.${key} 为空值`)
    }
  }
})

t('英文词典无中文残留', () => {
  for (const [key, value] of Object.entries(enFlat)) {
    assert.ok(!/[一-鿿]/.test(value), `en-US.${key} 含中文: ${value}`)
  }
})

t('无「值等于键名」的占位符', () => {
  for (const [locale, flat] of [['zh-CN', zhFlat], ['en-US', enFlat]]) {
    for (const [key, value] of Object.entries(flat)) {
      assert.notEqual(value, key, `${locale}.${key} 的值等于键名，疑似未翻译占位`)
    }
  }
})

t('isEnglish 判定', () => {
  assert.equal(isEnglish('en-US'), true)
  assert.equal(isEnglish('zh-CN'), false)
  assert.equal(isEnglish(undefined), false)
})

t('pickLocaleText 中文界面取中文', () => {
  assert.equal(pickLocaleText('zh-CN', '失败', 'Failed'), '失败')
})

t('pickLocaleText 英文界面取英文', () => {
  assert.equal(pickLocaleText('en-US', '失败', 'Failed'), 'Failed')
})

t('pickLocaleText 英文缺失时回退中文', () => {
  assert.equal(pickLocaleText('en-US', '失败', undefined), '失败')
  assert.equal(pickLocaleText('en-US', '失败', ''), '失败')
})

t('pickLocaleText 双缺失返回空串', () => {
  assert.equal(pickLocaleText('en-US', undefined, undefined), '')
  assert.equal(pickLocaleText('zh-CN', undefined, 'Failed'), '')
})

t('DEFAULT_LOCALE 在 SUPPORT_LOCALES 内', () => {
  assert.ok(SUPPORT_LOCALES.includes(DEFAULT_LOCALE))
})

console.log(`i18n 词典测试：${passed} 项通过`)
