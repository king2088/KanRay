// 文档中英拆分护栏。
// 15 篇用户文档已拆成独立的中文文件与英文文件（英文为 docs/en/* 与 *_README_EN.md）。
// 本脚本防止后续改动把两种语言重新混排，或让结构/链接/术语漂移：
//   1) 英文文件在代码围栏外不得出现中文（围栏内允许：命令、真实日志、目录树注释）
//   2) 中文文件不得混入英文散文（拆分时的典型漏网：源文件里成对的答案只留了英文那半）
//   3) 30 个文件的相对链接与图片必须指向真实文件
//   4) 每个文件都要有语言切换行，且必须指向配对文件的真实路径
//   5) 每对文件标题层级序列一致；英文文件不得使用已废弃的直译功能名
// 判 CJK 前会遮蔽行内代码：反引号里的中文是**不可翻译的字面量**——后端真实返回的错误串
//   （`缺少 API Key`）、真实的 CSV 分节标记（`# 表格名`）、国产数据库产品名（`达梦`）、
//   以及中英角色名对照（`看板编辑者`）。这类内容与 i18n-cjk-scan-test.mjs 的行级豁免同理。
// 语言切换行本身带「中文」二字，是设计的一部分，同样排除。
// 术语以 front-end/src/i18n/locales/en-US/ 为准（见 FORBIDDEN 的注释）。
// Big Screen Design / Big screen designer 刻意不在禁用之列：
// 它们是 bigscreen.list.title 与 bigScreenDesign 的真实取值。
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const REPO = fileURLToPath(new URL('../../', import.meta.url))
const CJK = /[一-鿿]/

const PAIRS = [
  ['README.md', 'README_EN.md'],
  ['backend/README.md', 'backend/README_EN.md'],
  ['front-end/README.md', 'front-end/README_EN.md'],
  ['docs/README.md', 'docs/en/README.md'],
  ['docs/快速开始.md', 'docs/en/quick-start.md'],
  ['docs/01-用户手册.md', 'docs/en/01-user-manual.md'],
  ['docs/02-管理员手册.md', 'docs/en/02-administration-manual.md'],
  ['docs/03-数据源与构建器.md', 'docs/en/03-data-sources-and-builder.md'],
  ['docs/04-开放API集成指南.md', 'docs/en/04-open-api-integration.md'],
  ['docs/05-部署运维手册.md', 'docs/en/05-deployment-and-operations.md'],
  ['docs/06-常见问题FAQ.md', 'docs/en/06-faq.md'],
  ['docs/07-大屏设计器使用手册.md', 'docs/en/07-big-screen-designer.md'],
  ['docs/08-表单中心使用手册.md', 'docs/en/08-forms-manual.md'],
  ['deploy/docker/README.md', 'deploy/docker/README_EN.md'],
  ['deploy/k8s/README.md', 'deploy/k8s/README_EN.md'],
]
const ZH_FILES = PAIRS.map(([zh]) => zh)
const EN_FILES = PAIRS.map(([, en]) => en)

// 拆分源文件里用过的直译功能名，对应 en-US 的真实菜单标签
// layout.js: menu.charts=Charts / menu.dashboards=Dashboards / menu.forms=Forms /
//             menu.admin=Administration；datasource.js 同样以 Data sources / Datasets 为准
const FORBIDDEN = [
  [/Form [Cc]enter/, 'Forms（menu.forms）'],
  [/[Cc]hart center/, 'Charts（menu.charts）'],
  [/Dashboard center/, 'Dashboards（menu.dashboards）'],
  [/System [Mm]anagement/, 'Administration（menu.admin）'],
  // 只拦「设置页」误译成导航路径的写法；layout.js 里 settings.systemSettings 的真实值就叫
  // 'System settings'，全局禁这个词会误伤真实界面文案。
  [/System settings\s*(?:→|->)/, 'Administration（「系统管理」不是设置页）'],
  [/数据看板中心|Data Source Center/, 'Data sources'],
  // 拆分后每篇是单语言文件，导语不得再自称「双语」——否则与「英文文件零中文」自相矛盾。
  // 只拦断言文档结构的说法；产品本身双语（如快捷键面板的 Windows / Mac, bilingual）不在此列。
  [/bilingual (?:document|page|manual|guide)|中英双语对照|中文段落在前|英文段落在后|Chinese paragraph comes first|English counterpart/i,
    '中文/英文各自成文，靠语言切换行互跳'],
]

const read = (f) => readFileSync(join(REPO, f), 'utf8')

// 逐行标记「是否位于代码围栏内」，返回下标集合
function fencedLines(lines) {
  const set = new Set()
  let open = false
  lines.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) { set.add(i); open = !open; return }
    if (open) set.add(i)
  })
  return set
}

function headingLevels(lines) {
  const fenced = fencedLines(lines)
  const out = []
  lines.forEach((l, i) => {
    const m = !fenced.has(i) && l.match(/^(#{1,6})\s+\S/)
    if (m) out.push(m[1].length)
  })
  return out
}

// 遮蔽行内代码与语言切换行：剩下的才是「未翻译的英文文案」
const maskForCJK = (l) =>
  /^(>\s*(中文|English):)/.test(l.trim()) ? '' : l.replace(/`[^`]*`/g, '``')

// ---- 1) 英文文件围栏外零中文（行内代码与切换行除外） ----------------------
const cjkHits = []
for (const f of EN_FILES) {
  const lines = read(f).split('\n')
  const fenced = fencedLines(lines)
  lines.forEach((l, i) => {
    if (!fenced.has(i) && CJK.test(maskForCJK(l))) cjkHits.push(`${f}:${i + 1}  ${l.trim().slice(0, 60)}`)
  })
}
assert.equal(cjkHits.length, 0, `英文文件出现中文（${cjkHits.length} 处）：\n  ${cjkHits.join('\n  ')}`)

// ---- 2) 中文文件不得混入英文散文 -------------------------------------------
// 判据刻意保守：非表格行、非标题、非空行、不含中文、含 >= 6 个英文单词且以句号收尾。
// 表格里的英文列名、代码块、行内标识符都不算散文，不会误报。
const isEnglishProse = (raw) => {
  const t = raw.replace(/`[^`]*`/g, '``').trim()
  if (!t || CJK.test(t)) return false
  if (/^[|>#]/.test(t)) return false
  if (/^!?\[/.test(t)) return false
  if (/^[-*+]\s/.test(t) || /^\d+\.\s/.test(t)) return false
  if (!t.endsWith('.')) return false
  return t.split(/\s+/).filter((w) => /^[A-Za-z][A-Za-z'-]{1,}$/.test(w)).length >= 6
}
const proseHits = []
for (const f of ZH_FILES) {
  const lines = read(f).split('\n')
  const fenced = fencedLines(lines)
  lines.forEach((l, i) => {
    if (!fenced.has(i) && isEnglishProse(l)) proseHits.push(`${f}:${i + 1}  ${l.trim().slice(0, 60)}`)
  })
}
assert.equal(proseHits.length, 0, `中文文件混入英文散文（${proseHits.length} 处）：\n  ${proseHits.join('\n  ')}`)

// ---- 3) 相对链接必须可达 ----------------------------------------------------
const broken = []
for (const f of [...ZH_FILES, ...EN_FILES]) {
  const lines = read(f).split('\n')
  const fenced = fencedLines(lines)
  lines.forEach((l, i) => {
    if (fenced.has(i)) return
    const targets = [
      ...[...l.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]),
      ...[...l.matchAll(/<img\s[^>]*src="([^"]+)"/g)].map((m) => m[1]),
    ]
    for (const raw of targets) {
      const target = raw.trim()
      if (/^(https?:|mailto:|#)/.test(target)) continue
      const bare = target.split('#')[0]
      if (!bare) continue
      const abs = resolve(join(REPO, dirname(f)), bare)
      if (!existsSync(abs)) broken.push(`${f}:${i + 1}  ${target}`)
    }
  })
}
assert.equal(broken.length, 0, `相对链接失效（${broken.length} 处）：\n  ${broken.join('\n  ')}`)

// ---- 4) 语言切换行到位且互指 -----------------------------------------------
for (const [zh, en] of PAIRS) {
  for (const [f, other, label] of [[zh, en, 'English'], [en, zh, '中文']]) {
    const lines = read(f).split('\n')
    const fenced = fencedLines(lines)
    const i = lines.findIndex((l, k) => !fenced.has(k) && l.startsWith(`> ${label}:`))
    assert.ok(i >= 0, `${f} 缺少语言切换行`)
    assert.ok(i < 4, `${f} 的语言切换行应紧跟 H1，实际在第 ${i + 1} 行`)
    const target = (lines[i].match(/\(([^)]+)\)/) || [])[1]
    assert.ok(target, `${f} 的语言切换行没有链接目标`)
    const abs = resolve(join(REPO, dirname(f)), target)
    assert.ok(existsSync(abs), `${f} 的语言切换行指向不存在的文件：${target}`)
    assert.equal(
      abs,
      join(REPO, other),
      `${f} 的语言切换行应指向配对文件 ${other}，实际指向 ${target}`,
    )
  }
}

// ---- 5) 结构对齐 + 术语漂移 -------------------------------------------------
for (const [zh, en] of PAIRS) {
  const a = headingLevels(read(zh).split('\n'))
  const b = headingLevels(read(en).split('\n'))
  assert.deepEqual(
    b,
    a,
    `${en} 的标题层级与 ${zh} 不一致：zh ${a.length} 个 / en ${b.length} 个`,
  )
}
for (const f of EN_FILES) {
  const lines = read(f).split('\n')
  const fenced = fencedLines(lines)
  lines.forEach((l, i) => {
    if (fenced.has(i)) return
    for (const [re, want] of FORBIDDEN) {
      assert.ok(!re.test(l), `${f}:${i + 1} 使用了已废弃的直译功能名，应为「${want}」：${l.trim().slice(0, 60)}`)
    }
  })
}

console.log(`文档中英拆分护栏通过：${PAIRS.length} 对文件 / ${PAIRS.length * 2} 个文件`)
