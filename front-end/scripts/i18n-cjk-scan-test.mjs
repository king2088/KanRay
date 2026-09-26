// 中文残留校验。
// 1) i18n 内核文件（flatten/locale-util/index）不得含中文文案
// 2) en-US 词典不得含中文
// 3) SCAN_PATHS 由各国际化计划逐步追加已迁移完成的源文件
// 例外：constants.js 的 LOCALE_OPTIONS 用语言母语名（'中文' / 'English'），
//       刻意保留中文，因此不纳入 SCAN_PATHS，改为单独断言其完整性。
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'
import { LOCALE_OPTIONS, SUPPORT_LOCALES } from '../src/i18n/constants.js'

const SRC = fileURLToPath(new URL('../src/', import.meta.url))
const CJK = /[一-鿿]/

// 追加式清单：计划 2 起把已迁移的目录加进来
const SCAN_PATHS = [
  'i18n/flatten.js',
  'i18n/locale-util.js',
  'i18n/index.js',
  'i18n/translate.js',
  'components/layout',
  'router/menu.js',
  'views/Login.vue',
  'views/Register.vue',
  // 计划 3：图表与看板域
  'config/chart-configs.js',
  'config/chart-types.js',
  'config/color-palettes.js',
  'utils/chart-utils.js',
  'utils/catalog.js',
  'utils/field-type-label.js',
  'components/charts',
  'components/dashboard',
  'views/ChartList.vue',
  'views/ChartBuilder.vue',
  'views/DashboardList.vue',
  'views/DashboardEditor.vue',
  'views/DashboardView.vue',
  'views/ShareBoardView.vue',
]

let passed = 0
function t(name, fn) {
  fn()
  passed++
  console.log('  ok -', name)
}

function walk(abs) {
  if (!existsSync(abs)) return []
  if (statSync(abs).isFile()) return [abs]
  return readdirSync(abs).flatMap((name) => walk(join(abs, name)))
}

function stripComments(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

function scan(relPath) {
  const abs = join(SRC, relPath)
  const files = statSync(abs).isFile() ? [abs] : walk(abs)
  const hits = []
  for (const file of files) {
    if (!/\.(js|ts|vue)$/.test(file)) continue
    const body = stripComments(readFileSync(file, 'utf8'))
    body.split('\n').forEach((line, i) => {
      if (CJK.test(line)) hits.push(`${relative(SRC, file)}:${i + 1}: ${line.trim()}`)
    })
  }
  return hits
}

t('i18n 内核文件无中文残留', () => {
  for (const p of SCAN_PATHS) {
    const hits = scan(p)
    assert.deepEqual(hits, [], `${p} 含中文:\n${hits.join('\n')}`)
  }
})

t('en-US 词典无中文残留', () => {
  const hits = scan('i18n/locales/en-US')
  assert.deepEqual(hits, [], `en-US 词典含中文:\n${hits.join('\n')}`)
})

t('SCAN_PATHS 中每个路径都存在', () => {
  for (const p of SCAN_PATHS) {
    assert.ok(existsSync(join(SRC, p)), `SCAN_PATHS 路径不存在: ${p}`)
  }
})

t('语言母语名保持母语写法（不翻译）', () => {
  // LOCALE_OPTIONS 是 [{ value, label }] 数组，先转成 value->label 映射再断言
  const labels = Object.fromEntries(LOCALE_OPTIONS.map((o) => [o.value, o.label]))
  assert.equal(labels['zh-CN'], '中文')
  assert.equal(labels['en-US'], 'English')
  assert.deepEqual(Object.keys(labels), SUPPORT_LOCALES)
})

console.log(`i18n 中文残留测试：${passed} 项通过`)
