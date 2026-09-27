// i18n 基础设施自检：
// 1) zh-CN / en-US 两个语言的域文件齐备，且与 DOMAINS 一一对应（域清单以文件系统为准，不写死数量）
// 2) 展平后 zh/en 键集合完全一致
// 3) 无空值、无与键名同值的占位符
// 4) pickLocaleText 语言选择与回退行为
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_LOCALE, DOMAINS, SUPPORT_LOCALES } from '../src/i18n/constants.js'
import { flattenMessages } from '../src/i18n/flatten.js'
import { isEnglish, pickLocaleText } from '../src/i18n/locale-util.js'
import { setTranslator, tr } from '../src/i18n/translate.js'

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
    assert.ok(existsSync(path), `缺少 ${locale}/${domain}.js`)
    domainModules[`${locale}/${domain}`] = (await import(`../src/i18n/locales/${locale}/${domain}.js`)).default
  }
}

const domainName = (file) => file.slice(0, -extname(file).length)
const domainsOnDisk = (locale) =>
  readdirSync(fileURLToPath(new URL(`../src/i18n/locales/${locale}/`, import.meta.url)))
    .filter((file) => extname(file) === '.js' && file !== 'index.js')
    .map(domainName)
    .sort()

t('DOMAINS 与各语言目录下的域文件一一对应', () => {
  for (const locale of SUPPORT_LOCALES) {
    const onDisk = domainsOnDisk(locale)
    assert.deepEqual([...DOMAINS].sort(), onDisk, `${locale} 的 DOMAINS 与域文件不一致`)
  }
  assert.equal(new Set(DOMAINS).size, DOMAINS.length, 'DOMAINS 存在重复项')
})

t('每个语言的域文件齐备', () => {
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

t('源码中引用的字面量翻译键都存在', () => {
  // 动态键（'a.b.' + x、变量）不参与校验：键名按 . 分段且每段非空，尾随 . 视为动态前缀。
  const root = fileURLToPath(new URL('../src', import.meta.url))
  const files = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === 'locales') continue
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (['.vue', '.js'].includes(extname(p))) files.push(p)
    }
  }
  walk(root)

  const patterns = [/\b(?:t|tr)\(\s*'([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)'/g, /\blabelKey:\s*'([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)'/g]
  const missing = []
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    for (const re of patterns) {
      for (const m of src.matchAll(re)) {
        const key = m[1]
        if (zhFlat[key] === undefined) missing.push(`${file.replace(root, 'src')}: ${key}`)
        else if (enFlat[key] === undefined) missing.push(`${file.replace(root, 'src')}: ${key} (缺 en-US)`)
      }
    }
  }
  assert.deepEqual([...new Set(missing)].sort(), [], `存在未定义的翻译键:\n${[...new Set(missing)].join('\n')}`)
})

// 动态拼接前缀：这些键在源码里是 `'dataset.metric.kind.' + key` 形式，
// 字面量扫描看不到引用，必须显式声明，否则会被误判为死键。
// 声明的是**前缀**而非全键，避免逐条枚举随节点类型增长。
const DYNAMIC_KEY_PREFIXES = [
  { prefix: 'dataset.metric.kind.', why: "DatasetDetail.vue: t('dataset.metric.kind.' + key)" },
  { prefix: 'dataset.etl.node.', why: 'utils/etl-nodes.js: etlNodeLabel/etlNodeShort 拼 etl.node.<type>.<field>' },
]

// 死键守卫目前只覆盖 dataset 域（计划 4 负责的范围）。
// 其余域存在历史动态拼接键，尚未逐域审计，扩域前需先确认无遗漏。
const DEAD_KEY_SCOPE = 'dataset.'

t('dataset 域词典键都被引用（无死键）', () => {
  const root = fileURLToPath(new URL('../src', import.meta.url))
  const files = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === 'locales') continue
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (['.vue', '.js'].includes(extname(p))) files.push(p)
    }
  }
  walk(root)

  // 三种写法都要覆盖：t('k')、tr('k')，以及 t(cond ? 'k1' : 'k2') 的三元形式
  const patterns = [
    /\b(?:t|tr)\(\s*'([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)'/g,
    /\blabelKey:\s*'([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)'/g,
    /\?\s*'([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)'\s*:\s*'([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)'/g,
  ]
  const used = new Set()
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    for (const re of patterns) {
      for (const m of src.matchAll(re)) {
        used.add(m[1])
        if (m[2]) used.add(m[2])
      }
    }
  }

  const dead = Object.keys(zhFlat).filter(
    (key) =>
      key.startsWith(DEAD_KEY_SCOPE) &&
      !used.has(key) &&
      !DYNAMIC_KEY_PREFIXES.some((d) => key.startsWith(d.prefix)),
  )
  assert.deepEqual(dead.sort(), [], `存在未被引用的词典键:\n${dead.join('\n')}`)
})

t('动态键前缀声明都仍然有效', () => {
  for (const d of DYNAMIC_KEY_PREFIXES) {
    assert.ok(
      Object.keys(zhFlat).some((k) => k.startsWith(d.prefix)),
      `动态键前缀已无对应词典键，请删除声明: ${d.prefix}`,
    )
    // 前缀写错（如少写一段）会让死键从缝隙里漏出去
    assert.ok(
      DYNAMIC_KEY_PREFIXES.every((o) => o.prefix === d.prefix || !d.prefix.startsWith(o.prefix)),
      `动态键前缀互相重叠，请合并: ${d.prefix}`,
    )
  }
})

t('词典源码无重复键（后者会静默覆盖前者）', () => {
  // 解析成 JS 对象后重复键已丢失，只能按源码行检测：每行一个键、缩进表示层级。
  // 同一对象内出现同名键即为覆盖，例如 detail: '详情' 后面又来 detail: { ... }。
  const stripStrings = (line) => line.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""')
  const dups = []
  for (const locale of SUPPORT_LOCALES) {
    for (const domain of DOMAINS) {
      const file = fileURLToPath(new URL(`../src/i18n/locales/${locale}/${domain}.js`, import.meta.url))
      if (!existsSync(file)) continue
      const stack = [new Set()]
      for (const [i, raw] of readFileSync(file, 'utf8').split('\n').entries()) {
        const line = stripStrings(raw)
        const m = raw.match(/^\s*(?:'([^']+)'|([A-Za-z0-9_]+)):/)
        if (m && stack.length) {
          const key = m[1] || m[2]
          if (stack[stack.length - 1].has(key)) dups.push(`${locale}/${domain}.js:${i + 1} ${key}`)
          else stack[stack.length - 1].add(key)
        }
        for (const ch of line) {
          if (ch === '{') stack.push(new Set())
          else if (ch === '}' && stack.length > 1) stack.pop()
        }
      }
    }
  }
  assert.deepEqual(dups, [], `存在被覆盖的重复键:\n${dups.join('\n')}`)
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

t('tr 默认返回中文词典原文', () => {
  setTranslator(null)
  assert.equal(tr('common.settings.language'), '语言')
  assert.equal(tr('common.http.requestFailed'), '请求失败')
})

t('tr 未知键回退为键名本身', () => {
  setTranslator(null)
  assert.equal(tr('common.nope.notExist'), 'common.nope.notExist')
})

t('setTranslator 注入后 tr 使用注入实现', () => {
  setTranslator((key) => `EN:${key}`)
  assert.equal(tr('common.settings.language'), 'EN:common.settings.language')
  setTranslator(null)
  assert.equal(tr('common.settings.language'), '语言', '传 null 应恢复默认翻译器')
})

// 大屏设计器把界面文案搬进了词典，因此「源码里引用的键」必须真实存在。
// 这条断言是为了防住 LeftPanel 曾经的漏网：第 97 个 widget 名为 ASCII 的 'iframe'，
// 中文盘点看不见它，于是词典少一键，界面渲染成空字符串。
const DESIGNER_KEY_REFS = [
  ['screen-designer/components/LeftPanel/LeftPanel.vue', ['nameKey', 'groupKey']],
  ['screen-designer/core/templates/preset.ts', ['nameKey', 'descriptionKey']],
  ['screen-designer/components/CodeEditor/CodeEditDialog.vue', ['nameKey']],
]

const SRC = fileURLToPath(new URL('../src/', import.meta.url))

function collectKeyRefs(relFile, fields) {
  const body = readFileSync(join(SRC, relFile), 'utf8')
  const found = new Set()
  for (const field of fields) {
    const re = new RegExp(`${field}:\\s*'([^']+)'`, 'g')
    for (const m of body.matchAll(re)) found.add(m[1])
  }
  return [...found]
}

t('设计器引用的词典键在两种语言中都存在', () => {
  const missing = []
  for (const [relFile, fields] of DESIGNER_KEY_REFS) {
    for (const key of collectKeyRefs(relFile, fields)) {
      for (const locale of SUPPORT_LOCALES) {
        // 域文件里的键不带 bigscreen. 前缀，前缀由 locales/<locale>/index.js 挂载
        const rel = key.replace(/^bigscreen\./, '')
        let cur = locales[locale].bigscreen
        for (const seg of rel.split('.')) cur = cur?.[seg]
        if (typeof cur !== 'string' || !cur.trim()) missing.push(`${relFile} -> ${key} @${locale}`)
      }
    }
  }
  assert.deepEqual(missing, [], `设计器引用了词典中不存在的键:\n${missing.join('\n')}`)
})

t('左侧面板 widget 数量与词典键数一致（漏一个就报错）', () => {
  const body = readFileSync(join(SRC, 'screen-designer/components/LeftPanel/LeftPanel.vue'), 'utf8')
  // widget 条目形如 { nameKey: '...', type: 'xxx', icon: 'yyy' }
  const widgets = [...body.matchAll(/\{\s*nameKey:\s*'bigscreen\.widget\.[^']+'[^}]*?type:/g)]
  assert.equal(widgets.length, 97, `widget 条目数应为 97，实际 ${widgets.length}（新增 widget 必须同时补词典键）`)
  // widget 段除组件名外，只允许下面这些非组件键存在，用来反向发现陈旧键。
  // 计划 8 起 widget 自身也渲染界面文案（空态提示、倒计时单位等），一并列在这里。
  const EXTRA_WIDGET_KEYS = [
    'configHint',
    'emptyHint',
    'staticTextFallback',
    'customChartTitle',
    'customChartHint',
    'customChartSupport',
    'carouselImageHint',
    'videoHint',
    'staticImageHint',
    'countdownDay',
    'countdownHour',
    'countdownMinute',
    'countdownSecond',
  ]
  const zhWidgetKeys = Object.keys(locales['zh-CN'].bigscreen.widget)
  const enWidgetKeys = Object.keys(locales['en-US'].bigscreen.widget)
  const expected = widgets.length + EXTRA_WIDGET_KEYS.length
  assert.equal(
    zhWidgetKeys.length,
    expected,
    `bigscreen.widget 键数应为 ${widgets.length} 个组件名 + ${EXTRA_WIDGET_KEYS.length} 个辅助键 = ${expected}，实际 ${zhWidgetKeys.length}`,
  )
  assert.deepEqual(zhWidgetKeys, enWidgetKeys, 'widget 段中英文键集合不一致')
  for (const k of EXTRA_WIDGET_KEYS) {
    assert.ok(zhWidgetKeys.includes(k), `widget 段缺少非组件键 ${k}`)
  }
  const stale = zhWidgetKeys.filter((k) => !EXTRA_WIDGET_KEYS.includes(k) && !body.includes(`bigscreen.widget.${k}'`))
  assert.deepEqual(stale, [], `widget 段存在无组件引用的陈旧键: ${stale.join(', ')}`)
  // 不得残留旧的 name: '中文' 形态
  assert.equal(/name:\s*'[\u4e00-\u9fff]/.test(body), false, 'LeftPanel 仍有未迁移的中文 name 字面量')
})

// 内置角色从 seeds.js 提取，数量不写死，只留 4 作提取哨兵：加第 5 个角色时本测试自动跟随。
// 后端是 CommonJS 且依赖 better-sqlite3，只做源码文本提取，与 chart-types-sync-test.mjs 同法。
// code 的字符集与 RoleAdmin.vue 的 /^[a-z0-9_-]{2,32}$/ 对齐：漏掉数字或连字符会让新增角色
// 提取不到，哨兵照样通过，测试静默放行——这正是它要防的失败模式。
// 引号两种都容忍（同 stripStrings）：后端哪天统一改成双引号，当前提取会掉到 0 个 code。
const seedsSrc = readFileSync(
  fileURLToPath(new URL('../../backend/src/seeds.js', import.meta.url)),
  'utf8',
)
const rolesBlock = seedsSrc.match(/const ROLES = \[([\s\S]*?)\];/)
assert.ok(rolesBlock, '未能从 seeds.js 提取 ROLES 数组字面量')
const builtinRoles = [...rolesBlock[1].matchAll(
  /code:\s*(['"])([a-z0-9_-]+)\1,\s*name:\s*(['"])([^'"]*)\3,\s*description:\s*(['"])([^'"]*)\5/g,
)].map((m) => ({ code: m[2], seedName: m[4], seedDesc: m[6] }))
const builtinCodes = builtinRoles.map((r) => r.code)
assert.ok(builtinCodes.length >= 4, `从 seeds.js 只提取到 ${builtinCodes.length} 个角色 code，疑似提取失败`)

t('内置角色在两语词典中都有名称与描述，且键集与 seeds.js 一致', () => {
  for (const locale of SUPPORT_LOCALES) {
    const labels = locales[locale].admin?.role?.builtinLabels
    assert.ok(labels, `${locale} 缺少 admin.role.builtinLabels`)
    for (const { code, seedName, seedDesc } of builtinRoles) {
      const entry = labels[code]
      assert.ok(entry, `${locale} 缺少内置角色 ${code} 的译文`)
      // typeof 承重：两语都写成 `viewer: 'Viewer'` 这类字符串条目时，zh/en 键对齐与
      // 「无空值与空白值」都会放行（flatten 把字符串当叶子），只有这里拦得住。
      for (const field of ['name', 'desc']) {
        assert.equal(typeof entry[field], 'string', `${locale}.${code}.${field} 不是字符串`)
      }
      // 空值不用再查：这些键早已作为 admin.role.builtinLabels.<code>.<field> 落进
      // zhFlat/enFlat，由「无空值与空白值」先行拦截，消息还更精确。
      assert.deepEqual(Object.keys(entry).sort(), ['desc', 'name'], `${locale}.${code} 的字段应恰为 name/desc`)
      // zh-CN 必须与种子逐字节相同：界面改读词典后就不再读库了，
      // 改一次种子文案而漏改词典，届时全绿却显示旧中文。
      if (locale === 'zh-CN') {
        assert.equal(entry.name, seedName, `zh-CN.${code}.name 与 seeds.js 种子文案不一致`)
        assert.equal(entry.desc, seedDesc, `zh-CN.${code}.desc 与 seeds.js 种子文案不一致`)
      }
    }
    assert.deepEqual(
      Object.keys(labels).sort(), [...builtinCodes].sort(),
      `${locale} 的 builtinLabels 键与 seeds.js 的角色 code 不一致`,
    )
  }
})

console.log(`i18n 词典测试：${passed} 项通过`)
