// 中文残留校验。
// 1) i18n 内核文件（flatten/locale-util/index）不得含中文文案
// 2) en-US 词典不得含中文
// 3) SCAN_PATHS 由各国际化计划逐步追加已迁移完成的源文件
// 例外：constants.js 的 LOCALE_OPTIONS 用语言母语名（'中文' / 'English'），
//       刻意保留中文，因此不纳入 SCAN_PATHS，改为单独断言其完整性。
// 行级豁免：仅用于「后端下发的枚举值原样比较」这类**不可翻译**的字面量。
//       每条豁免必须写明原因，且代码若已改动（豁免失配）会直接失败，
//       避免留下永不生效的僵尸配置。展示文案一律不允许豁免。
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
  // 计划 4：数据源 / 数据集 / 三种构建器
  'utils/dataset-type.js',
  'utils/etl-nodes.js',
  'views/DataSourceList.vue',
  'views/DataSourceFormDialog.vue',
  'views/DataSourceUploadDialog.vue',
  'views/DataSourceDetail.vue',
  'views/DatasetList.vue',
  'views/DatasetDetail.vue',
  'views/DataSourceBuilder.vue',
  'components/builder',
  // 计划 5：表单域与管理后台
  'views/forms',
  'views/admin',
  'views/open',
  'components/form',
  'utils/form-meta.js',
]

// 行级豁免清单：file + 代码片段 + 原因
const CJK_EXEMPTIONS = [
  {
    file: 'views/DataSourceFormDialog.vue',
    match: "category === '文件'",
    reason:
      "后端 datasources 驱动的 category 枚举值为中文「文件」，此处是与后端返回值的枚举比较而非展示文案；" +
      '计划 9 统一后端枚举后删除本条豁免。',
  },
  {
    file: 'views/forms/FormDesigner.vue',
    match: "const KEY_SEED = '字段'",
    reason:
      'KEY_SEED 是生成表单字段入库列名的种子，keyFor 会剥掉非 ASCII 字符后稳定回退为 field_*；' +
      '它必须与界面语言无关，否则切换语言会改变已落库到后端的列名，属于不可翻译的字面量。',
  },
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

const usedExemptions = new Set()

// 该行是否被声明的豁免覆盖（同一文件 + 行内包含指定代码片段）
function exemptionFor(relFile, line) {
  for (const [i, ex] of CJK_EXEMPTIONS.entries()) {
    if (ex.file === relFile && line.includes(ex.match)) {
      usedExemptions.add(i)
      return ex
    }
  }
  return null
}

function scan(relPath) {
  const abs = join(SRC, relPath)
  const files = statSync(abs).isFile() ? [abs] : walk(abs)
  const hits = []
  for (const file of files) {
    if (!/\.(js|ts|vue)$/.test(file)) continue
    const relFile = relative(SRC, file)
    const body = stripComments(readFileSync(file, 'utf8'))
    body.split('\n').forEach((line, i) => {
      if (!CJK.test(line)) return
      if (exemptionFor(relFile, line)) return
      hits.push(`${relFile}:${i + 1}: ${line.trim()}`)
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

t('行级豁免都写明了原因', () => {
  for (const ex of CJK_EXEMPTIONS) {
    assert.ok(ex.reason && ex.reason.length >= 20, `豁免缺少充分原因: ${ex.file} ${ex.match}`)
    assert.ok(ex.reason.includes('枚举') || ex.reason.includes('后端'), `豁免原因需说明为何不可翻译: ${ex.file}`)
  }
})

t('行级豁免全部命中（无僵尸配置）', () => {
  // 前面所有扫描都已执行过，usedExemptions 记录了实际命中的豁免
  for (const [i, ex] of CJK_EXEMPTIONS.entries()) {
    assert.ok(usedExemptions.has(i), `豁免已失效（代码已改动，请删除）: ${ex.file} ${ex.match}`)
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
