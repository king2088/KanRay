// i18n 基础设施自检：
// 1) zh-CN / en-US 两个语言的域文件齐备，且与 DOMAINS 一一对应（域清单以文件系统为准，不写死数量）
// 2) 展平后 zh/en 键集合完全一致
// 3) 无空值、无与键名同值的占位符
// 4) pickLocaleText 语言选择与回退行为
// 5) 内置角色取值：keyOf 前缀不与词典漂移、回退分支不调用 t
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_LOCALE, DOMAINS, SUPPORT_LOCALES } from '../src/i18n/constants.js'
import { flattenMessages } from '../src/i18n/flatten.js'
import { isEnglish, pickLocaleText } from '../src/i18n/locale-util.js'
import { setTranslator, tr } from '../src/i18n/translate.js'
import { roleDesc, roleName } from '../src/i18n/role-label.js'
import { datasourceTestMessage } from '../src/i18n/datasource-test-message.js'

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
// 先按「无嵌套花括号」切出每个对象字面量，再在对象内逐字段独立取值，三个理由：
//   - 字段顺序无关。整块顺序匹配时，新增的第 5 个角色只要把 name 写在 code 前面就提不出来，
//     哨兵照样通过、循环直接跳过，缺词典也不报——而 Task 2 的 role-label.js 用的是动态键
//     'admin.role.builtinLabels.' + code：字面量键扫描看不穿这种拼接，死键检查又只覆盖 dataset
//     域（DEAD_KEY_SCOPE），两处都不管 admin.role.*，此后没有任何检查兜得住这个静默失败。
//   - \b 前缀挡住 username: 这类把 name: 嵌在键名中间、不该被当字段的写法。
//   - 引号两种都容忍（同 stripStrings）：后端哪天统一改成双引号，当前提取会掉到 0 个 code。
// code 不设字符集白名单，数字、连字符乃至不合规写法都照提不误：白名单外的值会被静默跳过，
// 那正是要消灭的失败模式。合法性由 RoleAdmin.vue 的 /^[a-z0-9_-]{2,32}$/ 在运行时把关。
// 切分本身认不了嵌套花括号与字符串内花括号，漏提取由下面的花括号数断言兜住。
const seedsSrc = readFileSync(
  fileURLToPath(new URL('../../backend/src/seeds.js', import.meta.url)),
  'utf8',
)
const rolesBlock = seedsSrc.match(/const ROLES = \[([\s\S]*?)\];/)
assert.ok(rolesBlock, '未能从 seeds.js 提取 ROLES 数组字面量')
const seedField = (objSrc, key) =>
  objSrc.match(new RegExp(`\\b${key}:\\s*(['"])([\\s\\S]*?)\\1`))?.[2] ?? null
const builtinRoles = [...rolesBlock[1].matchAll(/\{[^{}]*\}/g)]
  .map((o) => ({
    code: seedField(o[0], 'code'),
    seedName: seedField(o[0], 'name'),
    seedDesc: seedField(o[0], 'description'),
  }))
  .filter((r) => r.code !== null)
const builtinCodes = builtinRoles.map((r) => r.code)
assert.ok(builtinCodes.length >= 4, `从 seeds.js 只提取到 ${builtinCodes.length} 个角色 code，疑似提取失败`)

// 兜住切分的两个盲区：条目里出现嵌套 {}（meta: { color: 'red' }），或花括号出现在字符串值里
// （description: '支持 {token} 语法'——双语化种子里很现实），该条目都会被 \{[^{}]*\} 静默丢掉；
// 其他角色够数时 >= 4 哨兵照样通过，测试报成功，而新角色在英文界面显示中文。
// 提取数必须与 '{' 总数相等：每个提取到的角色都独占一个起始花括号，故提取数 <= 花括号数，
// 不等就说明有 '{' 没产出角色。只报两个计数、不推断差值是几条——一个条目同时踩两个盲区时
// 差值会大于 1，报成「N 条未提取」就是精确但错误的数字。
const openBraceCount = (rolesBlock[1].match(/\{/g) || []).length
assert.equal(
  builtinRoles.length, openBraceCount,
  `seeds.js 的 ROLES 花括号数(${openBraceCount}) 与提取到的角色数(${builtinRoles.length}) 不符：有条目未被提取（多半含嵌套花括号，或花括号出现在字符串值里）`,
)

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
      // 这里刻意不用 DEFAULT_LOCALE：种子相等是「中文词典 = 库里的中文」这层关系，
      // en-US 是译文、本就该与种子不同。跟着 DEFAULT_LOCALE 走的话哪天真把默认语言切成
      // en-US，这条断言就会施加到英文上，稳定假失败。
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

// t/te 用可控替身验证回退分支，不依赖真实 vue-i18n 实例。
// fakeTe 只认 admin/viewer 两个已知 code，其余一律当作词典未收录。
const fakeT = (k) => `T:${k}`
const fakeTe = (k) => {
  const m = k.match(/^admin\.role\.builtinLabels\.([a-z0-9_]+)\./)
  return !!m && ['admin', 'viewer'].includes(m[1])
}

t('roleName 命中词典时返回译文', () => {
  const role = { code: 'admin', name: '管理员', is_builtin: true }
  assert.equal(roleName(fakeT, fakeTe, role), 'T:admin.role.builtinLabels.admin.name')
})

t('roleName 未收录时回退数据库名称', () => {
  const role = { code: 'unknown', name: '财务专员', is_builtin: 1 }
  assert.equal(roleName(fakeT, fakeTe, role), '财务专员')
})

t('roleName 缺 name 时兜底 code', () => {
  assert.equal(roleName(fakeT, fakeTe, { code: 'x1', is_builtin: 1 }), 'x1')
  assert.equal(roleName(fakeT, fakeTe, {}), '')
})

t('roleDesc 命中与回退', () => {
  assert.equal(roleDesc(fakeT, fakeTe, { code: 'viewer', name: '查看者', is_builtin: true }),
    'T:admin.role.builtinLabels.viewer.desc')
  // 描述没有 code 兜底：缺就是空串，不把 code 当描述显示
  assert.equal(roleDesc(fakeT, fakeTe, { code: 'c1', name: 'X' }), '')
})

// 前面 4 条里 is_builtin 为假/缺失的用例（unknown / x1 / c1 / {}）同时也让 fakeTe 返回 false，
// 两个条件绑在一起，于是「只对内置角色查词典」这道闸门的实际效果观察不到：删掉 is_builtin
// 或改成 === true，测试照样全绿，而自定义角色只要 code 与内置角色重名就会被翻译。
// 这里把两个条件解耦：code 一律取 fakeTe 认的 admin/viewer（te 恒为 true），
// 只让 is_builtin 变，于是闸门的真假两个分支都被断言到。
t('is_builtin 闸门承重：假值不查词典，真值（含数字 1）才查', () => {
  // 闸门假分支：code 命中词典也必须回退数据库原文。删掉闸门时这 4 条立刻变红。
  assert.equal(roleName(fakeT, fakeTe, { code: 'admin', name: '财务专员' }), '财务专员')
  assert.equal(roleName(fakeT, fakeTe, { code: 'admin', name: '财务专员', is_builtin: false }), '财务专员')
  assert.equal(roleName(fakeT, fakeTe, { code: 'admin', name: '财务专员', is_builtin: 0 }), '财务专员')
  assert.equal(
    roleDesc(fakeT, fakeTe, { code: 'viewer', description: '自定义描述', is_builtin: 0 }),
    '自定义描述',
  )
  // 闸门真分支必须是**真值判断**而非 === true：rolesOf() 的部分路径 is_builtin 是数字 1，
  // 收紧成 === true 会让这些内置角色在英文界面掉回中文。这几条在 === true 下变红。
  assert.equal(
    roleName(fakeT, fakeTe, { code: 'admin', name: '管理员', is_builtin: 1 }),
    'T:admin.role.builtinLabels.admin.name',
  )
  assert.equal(
    roleDesc(fakeT, fakeTe, { code: 'viewer', description: '只读访问', is_builtin: 1 }),
    'T:admin.role.builtinLabels.viewer.desc',
  )
})

// keyOf 的前缀是字面量，本文件 fakeTe 里又独立写了一遍，Task 1 的检查里还有第三份，
// 三处各自漂移时前面的用例全绿（fake 只认 admin/viewer，不读词典），内置角色就静默回退
// 到数据库中文原文——正是这个功能要防的回归。所以这里接真实词典：t/te 直接查 zhFlat/enFlat。
t('roleName/roleDesc 对真实词典命中（keyOf 前缀与词典未漂移）', () => {
  for (const [locale, flat] of [['zh-CN', zhFlat], ['en-US', enFlat]]) {
    const tt = (k) => flat[k] ?? k
    const tte = (k) => k in flat
    for (const code of builtinCodes) {
      // 数据库原文一律用哨兵值：前缀一旦漂移，te 为假就回退成哨兵而非词典值，两种语言都会红。
      // 若沿用真实中文名（'查看者'），zh-CN 的词典值恰好等于它，那一轮就抓不到漂移了。
      assert.equal(
        roleName(tt, tte, { code, name: 'DB-NAME', is_builtin: 1 }),
        flat[`admin.role.builtinLabels.${code}.name`],
        `${locale} 的 ${code} 未命中真实词典：keyOf 前缀可能已与词典漂移`,
      )
      assert.equal(
        roleDesc(tt, tte, { code, description: 'DB-DESC', is_builtin: 1 }),
        flat[`admin.role.builtinLabels.${code}.desc`],
        `${locale} 的 ${code} 未命中真实词典：keyOf 前缀可能已与词典漂移`,
      )
    }
  }
})

// label() 是短路求值：te 为假就不该调 t。index.js 刻意留着 missingWarn: true，
// 一旦改成「判完闸门就无条件 t(...)」，每个未收录的自定义角色都会往控制台刷 missingWarn 噪声，
// 而 fakeT 对任何输入都返回字符串、观察不到调用发生过，所以这里改用计数器钉住。
t('te 为假时不调用 t（避免 missingWarn 噪声）', () => {
  let calls = 0
  const countingT = (k) => { calls++; return `T:${k}` }
  // is_builtin 为真、code 不在 fakeTe 名单内：只有 te 一道条件为假，短路才生效
  roleName(countingT, fakeTe, { code: 'unknown', name: '财务专员', is_builtin: 1 })
  roleDesc(countingT, fakeTe, { code: 'unknown', description: 'x', is_builtin: 1 })
  assert.equal(calls, 0, 'te 为假时仍调用了 t')
  // 反向：命中时必须恰好调一次，否则「短路」也可能退化成从不调用
  calls = 0
  roleName(countingT, fakeTe, { code: 'admin', name: '管理员', is_builtin: 1 })
  roleDesc(countingT, fakeTe, { code: 'viewer', description: '只读访问', is_builtin: 1 })
  assert.equal(calls, 2, 'te 为真时 t 的调用次数不对')
})

// 角色名接入点围栏：界面上出现的角色名/描述必须经 roleName/roleDesc 解析。
// 前面所有断言都只管 role-label.js 这个纯函数本身。字面量键扫描看不穿 keyOf 拼出的动态前缀
// （'admin.role.builtinLabels.' + code，见上面 :354-365），种子测试只保证词典完整、不保证每个
// 渲染点都用了它。于是把某处改回 {{ row.name }} 会静默上线：英文界面下那一处又变回数据库里的
// 中文，没有任何测试失败。这里补上「调用点」这一侧。
//
// 匹配前先四重收窄，因为范围不收就必然误伤：全部 .vue 里有 269 行含 .name（实测），绝大部分与角色无关
// （图表系列名、数据字段名、大屏组件名、用户昵称……）。
//   1) 只有触碰 RBAC 角色的 .vue 进围栏。其中最关键的是 /\.roles\b/：组件拿到角色数据最自然的
//      方式就是 auth.user.roles / props.roles，而这种文件可能零 roleName、无 adminApi——
//      只按 roleName 系判据筛，它会整片绕过围栏（实测：只写 v-for="r in auth.user.roles" +
//      {{ r.name }} 的新组件，12 条判据一条都不匹配、测试全绿）。
//      代价是范围略宽：将来任何带 .roles 的文件都会进围栏，命中后需按豁免登记确认。
//   2) 剥注释：RoleAdmin.vue:146 的注释里就写着 permissions.name。
//   3) 只剥单引号字符串：t('admin.role.name') 是取词典的正确写法，与 row.name 字面同形。
//      刻意不剥双引号——Vue 模板里 "..." 绝大多数是属性值表达式而不是字符串字面量，
//      剥掉它就等于把 :label="row.name" 这类展示位一起藏起来。
//      同样不剥反引号：${...} 里是代码，剥掉等于把违规一起剥掉。
//   4) 挖空 <style> block：CSS 类名 .name 与字段读取无法区分。
const ROLE_FILE_EVIDENCE = [
  /\.roles\b/,
  /from\s*'@\/i18n\/role-label'/,
  /\broleIds\b/,
  /\bis_builtin\b/,
  /\badmin\.role\./,
  /\badmin\.user\.roles\b/,
  /\badminApi\.(?:roles|createRole|updateRole|deleteRole)\b/,
  /\bhasPermission\(\s*'role'/,
  /\broleName\s*\(/,
  /\broleDesc\s*\(/,
  /\broleNameOf\b/,
  /\broleDescOf\b/,
  /\broleByCode\b/,
]

// 已知接入点。判据（ROLE_FILE_EVIDENCE）写错会让围栏扫不到任何文件、测试全绿而角色名照样能
// 绕过，所以用这三个文件当哨兵：任一落空就说明扫描范围本身失效了。
const ROLE_FILES = [
  'components/layout/UserMenu.vue',
  'views/admin/RoleAdmin.vue',
  'views/admin/UserAdmin.vue',
]

// 围栏内合法读原文的整行登记，每行给出原因。这些行显示或传递的确实是数据库原文，翻译了就存不回去。
// match 存整行（trim 后）而不是片段：片段匹配会让 {{ row.name }} 蹭进 row.name 那条豁免，
// 于是把名称列改回违规写法反倒变绿。整行匹配下改动任一行都会让豁免失效，由下面的僵尸检查兜住。
const ROLE_NAME_PASSTHROUGH = [
  {
    file: 'components/layout/UserMenu.vue',
    match: "{{ (auth.user?.name || auth.user?.email || 'U').slice(0, 1).toUpperCase() }}",
    reason:
      '顶栏头像的首字母取自当前用户自己的昵称/邮箱，不是角色名；同一处的角色串走的是 roleName(t, te, r)。',
  },
  {
    file: 'components/layout/UserMenu.vue',
    match: '<span class="user-name">{{ auth.user?.name || auth.user?.email }}</span>',
    reason: '顶栏显示的是当前用户自己的昵称。用户昵称不翻译，更不该经 roleName。',
  },
  {
    file: 'views/admin/RoleAdmin.vue',
    match:
      '<el-form-item :label="t(\'admin.role.nameLabel\')"><el-input v-model="form.name" maxlength="50" /></el-form-item>',
    reason:
      '编辑弹窗的名称输入框绑的是表单模型 form.name，不是角色行；该弹窗只为自定义角色打开，' +
      '这里输入的就是要入库的原文。',
  },
  {
    file: 'views/admin/RoleAdmin.vue',
    match:
      '<el-form-item :label="t(\'admin.role.descLabel\')"><el-input v-model="form.description" maxlength="200" /></el-form-item>',
    reason: '同上，描述输入框绑表单模型 form.description，入库原文，不经 roleDesc。',
  },
  {
    file: 'views/admin/RoleAdmin.vue',
    match:
      "form.value = { code: row.code, name: row.name, description: row.description || '', permissions: [...row.permissions] }",
    reason:
      '编辑弹窗只为自定义角色打开（编辑按钮 :disabled="!isCustom(row)"），灌进表单的必须是库里的原文，' +
      '换成译文就再也存不回去。',
  },
  {
    file: 'views/admin/RoleAdmin.vue',
    match: "if (!form.value.name.trim()) return ElMessage.warning(t('admin.role.nameRequired'))",
    reason: '表单非空校验，校验的是即将提交入库的原文，不是展示文案。',
  },
  {
    file: 'views/admin/RoleAdmin.vue',
    match:
      'await adminApi.updateRole(editingId.value, { name: form.value.name, description: form.value.description, permissions: form.value.permissions })',
    reason: 'updateRole 请求载荷必须传库里的原文，界面译文不该回写数据库。',
  },
  {
    file: 'views/admin/RoleAdmin.vue',
    match:
      'await adminApi.createRole({ code: form.value.code, name: form.value.name, description: form.value.description, permissions: form.value.permissions })',
    reason: 'createRole 请求载荷同理：入库存原文，显示时才经 roleName/roleDesc 解析。',
  },
  {
    file: 'views/admin/UserAdmin.vue',
    match:
      '<el-form-item :label="t(\'admin.user.fieldNickname\')"><el-input v-model="createForm.name" maxlength="50" /></el-form-item>',
    reason: '新建用户弹窗的昵称输入框绑的是用户表单 createForm.name；与角色同名但不是角色名。',
  },
  {
    file: 'views/admin/UserAdmin.vue',
    match: "if (!f.name.trim()) return ElMessage.warning(t('admin.user.nicknameRequired'))",
    reason: '新建用户表单的昵称非空校验，f 是用户表单对象，不是角色。',
  },
  {
    file: 'views/admin/UserAdmin.vue',
    match:
      'await adminApi.createUser({ email: f.email.trim(), name: f.name.trim(), password: f.password, roleIds: f.roleIds })',
    reason:
      'createUser 的 name 是用户昵称，与角色的 name 同名字段却是两回事；载荷里真正的角色是 roleIds。',
  },
]

// 只要求前面有个点，不限定接收者：(row).name、roles[i].name、?.name 这些形态都要能抓到，
// 否则「换个写法绕过」就等于绕过围栏。
const ROLE_FIELD_READ = /\.(?:name|description)\b/
// load 时把库里的中文名冻结成 code→name 映射、渲染期再查表（UserAdmin.vue:164 的注释正是
// 这么警告的）：这类写法在展示位根本不出现 .name，只索引一张名字表，语言切换后表里仍是旧中文。
//
// 两条边界，知情再用——它比看起来窄：
//   - 要求 name/label 不在标识符首位，所以 nameMap[r]、names[r]、labelMap[c] 都不命中，
//     只有 roleNameMap[r]、fieldNames[j] 这种命中。它的真正价值是给「映射构造处那次 .name
//     读取」兜第二道网（那条由 ROLE_FIELD_READ 报），不是枚举所有冻结映射的写法。
//   - 正则大小写不敏感、不区分领域，所以在围栏内的文件里 columnLabels[i]、allLabels[k]
//     也会命中。门控把范围限在 RBAC 角色文件上，这是有意的取舍：宁可多报一次让人确认，
//     也不能让角色名悄悄退回中文。
const ROLE_NAME_LOOKUP = /\b[A-Za-z_$][\w$]*(?:name|label)[A-Za-z_$]*\s*\[/i

// 归一化成「去掉纯格式差异后的形状」，只用于判断某行是不是某条豁免的格式变体：
// 剥单引号、去空白、去纯分组用的花括号、去行尾逗号。命中归一化并不放行——仍然算违规，
// 只是把消息从「你绕过了 roleName」换成「豁免失配」，因为对本来正确的代码说这句话
// 会把人引去改不该改的地方。
const shapeOf = (line) => stripStrings(line).replace(/[\s{}]/g, '').replace(/^[,;]+|[,;]+$/g, '')

// 挖空 <style> block，而不是「从第一个 <style> 起全部截断」：<style> 排在 <script> 之前
// 是合法 SFC 顺序，一刀截会让整个 script 段静默失明（那是漏报而不是误报，同样致命）。
// 只认行首的 <style：顶层 block 都顶格写，而 <style> 作为字符串出现在脚本里时不会在行首
// （CodeEditDialog.vue:469 的示例代码就是这样）。挖空用空格替换，行号不变。
function blankStyleBlocks(src) {
  const chars = src.split('')
  for (const m of src.matchAll(/^[ \t]*<style(?=[\s>])/gm)) {
    const end = src.indexOf('</style', m.index)
    if (end === -1) continue
    for (let i = m.index; i < end + '</style>'.length; i++) if (chars[i] !== '\n') chars[i] = ' '
  }
  return chars.join('')
}

// 剥注释时用空格替换而非删除，保住行号——报错要能指到具体哪一行。
const blankOut = (m) => m.replace(/[^\n]/g, ' ')
const stripComments = (src) =>
  src
    .replace(/<!--[\s\S]*?-->/g, blankOut)
    .replace(/\/\*[\s\S]*?\*\//g, blankOut)
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, head) => head + blankOut(m.slice(head.length)))
// 只剥单引号：i18n 键与 JS 字符串在本仓库一律用单引号，双引号在 Vue 模板里通常是属性值表达式
// （:label="row.name"），剥掉就把真正的展示位藏起来了。转义引号一并容忍。
const stripStrings = (line) => line.replace(/'(?:[^'\\]|\\.)*'/g, "''")

// 收集逻辑与本文件上面两处源码扫描相同，刻意各写一份：复用要改动现有断言的收集代码。
function vueSources() {
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === 'locales') continue
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (extname(p) === '.vue') out.push({ rel: p.replace(SRC, ''), body: readFileSync(p, 'utf8') })
    }
  }
  walk(SRC)
  return out
}

const usedPassthrough = new Set()

t('界面角色名/描述都经 roleName/roleDesc 解析（绕过直取 .name 会失败）', () => {
  const files = vueSources().map((f) => ({ ...f, body: stripComments(f.body) }))
  const gated = files.filter((f) => ROLE_FILE_EVIDENCE.some((re) => re.test(f.body)))
  const outOfScope = ROLE_FILES.filter((rel) => !gated.some((f) => f.rel === rel))

  const hits = []
  for (const { rel, body } of gated) {
    blankStyleBlocks(body).split('\n').forEach((line, i) => {
      const code = line.trim()
      const passthrough = ROLE_NAME_PASSTHROUGH.find((e) => e.file === rel && e.match === code)
      if (passthrough) {
        usedPassthrough.add(passthrough)
        return
      }
      const probe = stripStrings(line)
      const fix = '应在渲染期调用 roleName(t, te, role) / roleDesc(t, te, role)，自定义角色会自动回退数据库原文'
      let why = null
      if (ROLE_FIELD_READ.test(probe)) why = '绕过了 roleName/roleDesc 直取角色字段，英文界面下这里会显示库里的中文'
      else if (ROLE_NAME_LOOKUP.test(probe)) why = '按名字表索引角色名（load 时冻结的 code→name 映射，语言切换后不会刷新）'
      if (!why) return
      const at = `${rel}:${i + 1}`
      // 纯格式改动（加个尾逗号、给单行包一层花括号）会让已登记的合法行整行失配。这时先按「形状」
      // 找回那条豁免：报「你绕过了 roleName」是在指控开发者改了本该正确的地方，而他们要的只是
      // 更新豁免。归一化只换消息、不放行——该红还是红。
      const stale = ROLE_NAME_PASSTHROUGH.find((e) => e.file === rel && shapeOf(e.match) === shapeOf(line))
      hits.push(
        stale
          ? `${at}  这行与已登记的合法原文用法只差格式，ROLE_NAME_PASSTHROUGH 里的豁免已失配\n    ${code}\n    若只是格式改动，请把该行的新文本更新进豁免的 match；若这行确实在直取角色字段，${fix}`
          : `${at}  ${why}\n    ${code}\n    ${fix}`,
      )
    })
  }

  // 范围问题必须和违规行号一起可见。哨兵排在命中之前时，「UserMenu 掉了 roleName 又渲染 r.name」
  // 只会报「判据可能已失效」而把 :9 藏起来——读者被指去调测试的正则，而 bug 刚才是他引入的。
  // 所以这里先抛真正的违规行号（范围失效也作为附注跟在同一条消息后面），hits 为空时再单独报范围。
  const scopeNote = outOfScope.length
    ? `\n（另有已知接入点没落进扫描范围：${outOfScope.join(', ')}。若刚新增了角色渲染点，请改用 roleName/roleDesc，或把新判据加进 ROLE_FILE_EVIDENCE）`
    : ''
  assert.deepEqual(hits, [], `以下位置会让英文界面显示数据库里的中文角色名/描述:\n${hits.join('\n')}${scopeNote}`)
  assert.deepEqual(
    outOfScope,
    [],
    `已知接入点未落进围栏扫描范围（ROLE_FILE_EVIDENCE 判据可能已失效）: ${outOfScope.join(', ')}`,
  )
})

t('角色名原文用法的豁免都写明了原因', () => {
  for (const e of ROLE_NAME_PASSTHROUGH) {
    assert.ok(
      e.reason && e.reason.length >= 20,
      `豁免缺少充分原因（须说明为何这里显示/传递的就是数据库原文）: ${e.file} ${e.match}`,
    )
    assert.ok(e.file && e.match, `豁免缺少文件或整行匹配内容: ${JSON.stringify(e.match)}`)
  }
})

t('角色名原文用法的豁免全部命中（无僵尸配置）', () => {
  for (const e of ROLE_NAME_PASSTHROUGH) {
    assert.ok(usedPassthrough.has(e), `豁免已失效（代码已改动，或该文件已不再落进围栏范围）: ${e.file} ${e.match}`)
  }
})

// ---- 后端文案双字段（message / messageEn）契约 ----
//
// 响应信封带两个字段：message 是中文原文，messageEn 是查表得到的英文译文（见后端
// middleware/response.js 与 i18n/en-messages.js）。界面要显示哪一份由 localizeApiMessage
// 按当前语言二选一；直接 { message: res.message } 会把中文原文塞进英文占位符，渲染成
// 「Connection succeeded: 连接成功」——中英并排。曾真实发生在 DataSourceList.vue 与
// DataSourceDetail.vue 各 2 处，且两处都长得完全一样，code review 不会看出来。
//
// 同样地，公开分享的 3 个 api 模块各自 axios.create()，不经过 http.js 拦截器，
// messageEn 不会被自动取值，得在拦截器里自己调 localizeApiMessage。
//
// 判据只认对象字面量里的 `message: x.message` 形态：这是把后端文案当占位符值的唯一写法。
// 日志上下文里原样传 message 不受此限，需要时登记进 MESSAGE_PASSTHROUGH。
const MESSAGE_PAIR_FILES = [
  'views/DataSourceList.vue',
  'views/DataSourceDetail.vue',
  'api/share.js',
  'api/formShare.js',
  'api/bigScreenShare.js',
]

// 允许多级与 this. 前缀：res.data.message / body.data.message / this.res.message
// 都是同一类漏法，只匹配单层会给出「已经防住了」的假信心。
const RAW_MESSAGE_AS_VALUE = /message:\s*(?:this\.)?[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*(?:\??\.)message\b/

const MESSAGE_PASSTHROUGH = []
const usedMessagePass = new Set()

// .js 也要扫：3 个 share 模块是 .js，且它们正是绕过 http.js 拦截器的那批。
// 跳过 locales（词典值里出现 .message 是数据不是调用）。
function messageSources() {
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === 'locales') continue
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (extname(p) === '.vue' || extname(p) === '.js') {
        out.push({ rel: p.replace(SRC, ''), body: readFileSync(p, 'utf8') })
      }
    }
  }
  walk(SRC)
  return out
}

t('后端文案进界面经 localizeApiMessage 二选一（直取 message 会中英并排）', () => {
  const hits = []
  for (const { rel, body } of messageSources()) {
    blankStyleBlocks(stripComments(body)).split('\n').forEach((line, i) => {
      const probe = stripStrings(line)
      if (!RAW_MESSAGE_AS_VALUE.test(probe)) return
      const code = line.trim()
      const pass = MESSAGE_PASSTHROUGH.find((e) => e.file === rel && e.match === code)
      if (pass) {
        usedMessagePass.add(pass)
        return
      }
      hits.push(
        `${rel}:${i + 1}  把后端 message 当占位符值传给了 t()，英文界面会与中文原文并排\n` +
          `    ${code}\n` +
          '    应改为 localizeApiMessage(res.message, res.messageEn)；兜底文案走 t(\'common.http.*\')，不要硬编码中文',
      )
    })
  }
  assert.deepEqual(hits, [], `以下位置会在英文界面下与中文原文并排显示:\n${hits.join('\n')}`)

  // 哨兵：这 5 个文件是已知接入点。判据写错会让 messageSources() 扫不到它们而全绿，
  // 所以反过来断言它们确实接了 localizeApiMessage——判据失效时这里先红。
  for (const rel of MESSAGE_PAIR_FILES) {
    const f = messageSources().find((x) => x.rel === rel)
    assert.ok(f, `已知接入点不存在，哨兵失效: ${rel}`)
    assert.ok(
      f.body.includes('localizeApiMessage'),
      `${rel} 没有接 localizeApiMessage。若这里确实不再渲染后端文案，请把该文件移出 MESSAGE_PAIR_FILES 并说明原因`,
    )
  }
})

t('后端文案豁免都写明了原因', () => {
  for (const e of MESSAGE_PASSTHROUGH) {
    assert.ok(
      e.reason && e.reason.length >= 20,
      `豁免缺少充分原因（须说明为何这里传递的就是后端中文原文）: ${e.file} ${e.match}`,
    )
    assert.ok(e.file && e.match, `豁免缺少文件或整行匹配内容: ${JSON.stringify(e.match)}`)
  }
})

t('后端文案豁免全部命中（无僵尸配置）', () => {
  for (const e of MESSAGE_PASSTHROUGH) {
    assert.ok(usedMessagePass.has(e), `豁免已失效: ${e.file} ${e.match}`)
  }
})

// 用扁平词典构造一个最小的 locale 感知 t()：查键 + 替换 {message}。
// 不拉 vue-i18n 进来（它要在 vite/浏览器环境初始化），而 datasourceTestMessage 只用到这两件事。
const flatT = (flat) => (key, named) => {
  const msg = flat[key]
  if (msg === undefined) return key
  return msg.replace(/\{(\w+)\}/g, (m, k) => (named?.[k] === undefined ? m : String(named[k])))
}

// 这几条是整串锁死：provider 的「连接成功」曾被拼进带 {message} 的模板，
// 英文界面渲染成「Connection succeeded: Connection successful」、中文界面成「测试成功: 连接成功」——
// 两边都冗余。带信息量的文案（「文件数据源已导入」「集群状态: degraded」）必须原样保留。
const DS_CASES = [
  // [provider 结果文案, ok, 期望整串（英文）, 期望整串（中文）]
  ['Connection successful', true, 'Connection succeeded', '测试成功'],
  ['File data source imported', true, 'Connection succeeded: File data source imported', '测试成功: 文件数据源已导入'],
  ['Cluster status: degraded', false, 'Connection failed: Cluster status: degraded', '测试失败: 集群状态: degraded'],
  ['Auth failed', false, 'Connection failed: Auth failed', '测试失败: Auth failed'],
]

t('连接测试文案：provider 复述结论时不附加详情，带信息量时照常附加', () => {
  const te = flatT(enFlat)
  const tz = flatT(zhFlat)
  // 英文侧用 messageEn 原文，中文侧用 provider 原文
  const zhOf = { 'Connection successful': '连接成功', 'File data source imported': '文件数据源已导入', 'Cluster status: degraded': '集群状态: degraded', 'Auth failed': 'Auth failed' }
  for (const [en, ok, wantEn, wantZh] of DS_CASES) {
    assert.equal(datasourceTestMessage(te, ok, en), wantEn, `英文界面: ok=${ok} ${en}`)
    assert.equal(datasourceTestMessage(tz, ok, zhOf[en]), wantZh, `中文界面: ok=${ok} ${en}`)
  }
})

t('连接测试文案：provider 没给文案时也只给结论，不留空冒号', () => {
  const te = flatT(enFlat)
  assert.equal(datasourceTestMessage(te, true, ''), 'Connection succeeded')
  assert.equal(datasourceTestMessage(te, false, ''), 'Connection failed')
  assert.equal(datasourceTestMessage(te, true, undefined), 'Connection succeeded')
})

// 跨语言混排的原点是「拿中文原文当英文占位符的值」。这里锁住两种语言各自成句、不互相掺杂。
t('连接测试文案：两种语言都不与另一语言混排', () => {
  const te = flatT(enFlat)
  const tz = flatT(zhFlat)
  const cjk = /[\u4e00-\u9fff]/
  for (const [en, ok] of DS_CASES) {
    assert.ok(!cjk.test(datasourceTestMessage(te, ok, en)), `英文界面混入了中文: ok=${ok} ${en}`)
  }
  assert.ok(!/Connection/.test(datasourceTestMessage(tz, true, '连接成功')), '中文界面混入了英文')
})

console.log(`i18n 词典测试：${passed} 项通过`)
