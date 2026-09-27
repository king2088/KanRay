// 浏览器语言检测与设置持久化决策的回归测试。
// 被测模块必须是零 `@/` 依赖的纯叶子模块，才能在 node 下直接 import（见 locale-detect.js 头部说明）。
import assert from 'node:assert/strict'
import { SUPPORT_LOCALES, DEFAULT_LOCALE, UNKNOWN_LOCALE_FALLBACK } from '../src/i18n/constants.js'
import {
  matchLocale,
  detectInitialLocale,
  resolveStoredLocale,
  buildSettingsPayload,
} from '../src/i18n/locale-detect.js'

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

console.log('i18n 浏览器语言检测测试')

// ---------- 1. 精确匹配 ----------
check('精确匹配 zh-CN / en-US', () => {
  assert.equal(matchLocale(['zh-CN']), 'zh-CN')
  assert.equal(matchLocale(['en-US']), 'en-US')
})
check('精确匹配大小写不敏感', () => {
  assert.equal(matchLocale(['zh-cn']), 'zh-CN')
  assert.equal(matchLocale(['EN-us']), 'en-US')
  assert.equal(matchLocale(['  en-US  ']), 'en-US')
})

// ---------- 2. 主语言标签匹配 ----------
check('zh* 全部归 zh-CN', () => {
  for (const tag of ['zh', 'zh-TW', 'zh-HK', 'zh-Hans', 'zh-Hant-CN', 'zh-SG']) {
    assert.equal(matchLocale([tag]), 'zh-CN', tag)
  }
})
check('en* 全部归 en-US', () => {
  for (const tag of ['en', 'en-GB', 'en-AU', 'en-CA', 'en-GB-oxendict']) {
    assert.equal(matchLocale([tag]), 'en-US', tag)
  }
})

// ---------- 3. 不支持 / 顺序优先 ----------
check('不受支持的语言返回 null', () => {
  assert.equal(matchLocale(['ja']), null)
  assert.equal(matchLocale(['fr-FR']), null)
  assert.equal(matchLocale(['ko', 'de-DE']), null)
})
check('按列表顺序取第一个命中的（跳过不支持的）', () => {
  assert.equal(matchLocale(['ja', 'en-GB']), 'en-US')
  assert.equal(matchLocale(['fr', 'zh-TW', 'de']), 'zh-CN')
  assert.equal(matchLocale(['zh-CN', 'en-US']), 'zh-CN', '首选语言优先')
})

// ---------- 4. 垃圾输入 ----------
check('空值/非字符串/空白项被跳过', () => {
  assert.equal(matchLocale(['', '  ', null, undefined, 0, {}, 'en-US']), 'en-US')
})
check('空数组与非数组返回 null', () => {
  assert.equal(matchLocale([]), null)
  assert.equal(matchLocale(undefined), null)
  assert.equal(matchLocale(null), null)
  assert.equal(matchLocale('en-US'), null, '字符串不应被当作标签数组')
})

// ---------- 5. 两级兜底 ----------
check('检测到但不受支持 → 英文', () => {
  assert.equal(detectInitialLocale({ languages: ['fr-FR'], language: 'fr-FR' }), 'en-US')
  assert.equal(detectInitialLocale({ language: 'ja-JP' }), 'en-US')
})
check('完全拿不到语言信息 → 中文', () => {
  assert.equal(detectInitialLocale({}), DEFAULT_LOCALE)
  assert.equal(detectInitialLocale({ languages: [], language: '' }), DEFAULT_LOCALE)
  assert.equal(detectInitialLocale({ languages: [''], language: '   ' }), DEFAULT_LOCALE)
  assert.equal(detectInitialLocale(null), DEFAULT_LOCALE, 'null = 无 navigator')
})
check('不传参时委派给全局 navigator（node 24 自带 navigator.language）', () => {
  assert.equal(detectInitialLocale(), detectInitialLocale(globalThis.navigator))
  assert.equal(detectInitialLocale(), matchLocale([navigator.language]) || UNKNOWN_LOCALE_FALLBACK)
})
check('languages 优先于 language；languages 空时回退 language', () => {
  assert.equal(detectInitialLocale({ languages: ['en-GB'], language: 'zh-CN' }), 'en-US')
  assert.equal(detectInitialLocale({ languages: ['ja'], language: 'zh-CN' }), 'zh-CN')
  assert.equal(detectInitialLocale({ languages: [], language: 'zh-TW' }), 'zh-CN')
})
check('命中时不受兜底影响', () => {
  assert.equal(detectInitialLocale({ language: 'zh-CN' }), 'zh-CN')
  assert.equal(detectInitialLocale({ languages: ['en-US', 'zh-CN'] }), 'en-US')
})

// ---------- 6. resolveStoredLocale ----------
check('解析出合法 locale', () => {
  assert.equal(resolveStoredLocale('{"locale":"en-US"}'), 'en-US')
  assert.equal(resolveStoredLocale('{"locale":"zh-CN","size":"small"}'), 'zh-CN')
})
check('非法/缺失/畸形一律 null（表示用户未明确选择）', () => {
  assert.equal(resolveStoredLocale('{"locale":"fr-FR"}'), null)
  assert.equal(resolveStoredLocale('{"locale":null}'), null)
  assert.equal(resolveStoredLocale('{"size":"small"}'), null)
  assert.equal(resolveStoredLocale('{"locale":123}'), null)
  assert.equal(resolveStoredLocale('not json'), null)
  assert.equal(resolveStoredLocale('null'), null)
  assert.equal(resolveStoredLocale('[]'), null)
  assert.equal(resolveStoredLocale(''), null)
  assert.equal(resolveStoredLocale(null), null)
  assert.equal(resolveStoredLocale(undefined), null)
})

// ---------- 7. buildSettingsPayload：locale 不落盘是本特性成立的关键 ----------
const STATE = {
  layout: 'horizontal', collapsed: false, themeMode: 'dark',
  primaryColor: '#3fa49a', size: 'large', locale: 'en-US',
}
check('未明确手选时 payload 不含 locale 键', () => {
  const p = buildSettingsPayload(STATE, false)
  assert.ok(!('locale' in p), '自动检测出的 locale 绝不能落盘')
  assert.equal(p.themeMode, 'dark')
  assert.equal(p.size, 'large')
})
check('明确手选时 payload 含 locale 且值一致', () => {
  const p = buildSettingsPayload(STATE, true)
  assert.equal(p.locale, 'en-US')
})
check('其余设置字段不因 locale 开关而丢失', () => {
  for (const include of [true, false]) {
    const p = buildSettingsPayload(STATE, include)
    assert.deepEqual(
      { ...p, ...(include ? {} : { locale: undefined }) },
      { ...STATE, locale: include ? STATE.locale : undefined },
    )
  }
})

// ---------- 8. 不变量 ----------
check('UNKNOWN_LOCALE_FALLBACK 合法且为英文', () => {
  assert.ok(SUPPORT_LOCALES.includes(UNKNOWN_LOCALE_FALLBACK))
  assert.ok(UNKNOWN_LOCALE_FALLBACK.startsWith('en-'))
})
check('matchLocale 的所有返回值都在 SUPPORT_LOCALES 内', () => {
  const probes = ['zh', 'zh-CN', 'zh-TW', 'en', 'en-US', 'en-GB', 'ja', 'fr-FR', 'ko-KR', '', 'x']
  for (const tag of probes) {
    const hit = matchLocale([tag])
    if (hit !== null) assert.ok(SUPPORT_LOCALES.includes(hit), `${tag} → ${hit}`)
  }
})
check('DEFAULT_LOCALE 仍是中文（兜底未被改动）', () => {
  assert.equal(DEFAULT_LOCALE, 'zh-CN')
  assert.notEqual(UNKNOWN_LOCALE_FALLBACK, DEFAULT_LOCALE, '两级兜底必须不同，否则无法区分')
})

console.log(`\n全部通过：${passed} 项`)
