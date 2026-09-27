// 校验水平布局顶部菜单的下拉项能正确高亮当前页（TopMenu.vue + assets/main.css）。
//
// 背景：水平布局的一级菜单含子级时用 el-dropdown 承载二级菜单，`is-active`
// 是模板运行时绑定到 el-dropdown-item 上的。该 li 由 el-dropdown-menu 在
// 浮层里渲染，**不带 scoped 的 data-v-* 属性，也不在任何带 data-v-* 的祖先内**
// （实测：li 的属性只有 class / role / tabindex / aria-disabled）。因此
// <style scoped> 里的任何写法都匹配不到它——`.el-dropdown-menu__item.is-active`
// 会编译成 `...[data-v-x]`，`:deep()` 会编译成 `[data-v-x] .xxx`，
// 两者都不成立，class 挂上了却完全没有视觉变化。
//
// 这里锁住三件事：绑定逻辑正确、样式可达、样式不外泄到其他下拉。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { activeMenuOf } from '../src/router/menu.js'

let passed = 0
function t(name, fn) {
  fn()
  passed++
  console.log('  ok -', name)
}

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const topMenu = read('../src/components/layout/TopMenu.vue')
const mainCss = read('../src/assets/main.css')
const mainJs = read('../src/main.js')

// 供样式使用的下拉钩子类名，必须与模板里挂在 el-dropdown-menu 上的 class 一致
const HOOK = 'top-menu__dropdown'

await t('activeMenuOf 对子菜单返回精确路径,能与 child.path 相等', () => {
  assert.equal(activeMenuOf('/admin/users'), '/admin/users')
  assert.equal(activeMenuOf('/admin/audit'), '/admin/audit')
  assert.equal(activeMenuOf('/open/tokens'), '/open/tokens')
})

await t('模板按 activeMenu === child.path 给下拉项加 is-active', () => {
  assert.match(
    topMenu,
    /<el-dropdown-item[\s\S]*?:class="\{ 'is-active': activeMenu === child\.path \}"/,
    '下拉项未按 child.path 精确匹配 activeMenu',
  )
})

await t('下拉菜单挂上钩子类名,供非 scoped 样式定位', () => {
  assert.match(
    topMenu,
    new RegExp(`<el-dropdown-menu[^>]*class="[^"]*${HOOK}`),
    `el-dropdown-menu 未挂 ${HOOK} 钩子类`,
  )
})

await t('main.css 存在以钩子类为前缀的激活态规则', () => {
  const rule = mainCss.match(
    new RegExp(`\\.${HOOK}[^{]*\\.el-dropdown-menu__item\\.is-active\\s*\\{([^}]*)\\}`),
  )
  assert.ok(rule, `main.css 缺少 ${HOOK} ... .is-active 规则`)
  assert.match(rule[1], /var\(--app-primary\)/, '激活态未使用 --app-primary 设计变量')
  assert.match(rule[1], /var\(--app-primary-light\)/, '激活态未使用 --app-primary-light 背景变量')
  assert.doesNotMatch(
    rule[1],
    /#[0-9a-f]{3,8}\b/i,
    '激活态不应硬编码颜色,须走设计变量(兼容暗色/主题色)',
  )
})

await t('TopMenu.vue 不得在 <style scoped> 里试图样式化下拉项(实测无法命中)', () => {
  const styleBlocks = topMenu.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []
  assert.ok(styleBlocks.length, '未找到 style 块')
  for (const block of styleBlocks) {
    assert.match(block, /^\s*<style(?![^>]*\bnon-scoped\b)[^>]*\bscoped\b/, '样式块应为 scoped')
    assert.doesNotMatch(
      block,
      /el-dropdown-menu__item|el-dropdown-menu\b/,
      'scoped 块无法命中 el-dropdown-menu 渲染的浮层节点,激活样式必须放 main.css',
    )
  }
})

await t('main.css 在 element-plus 样式之后引入,同权重下激活态不被 hover 规则盖掉', () => {
  const epIdx = mainJs.indexOf('element-plus/dist/index.css')
  const cssIdx = mainJs.indexOf('./assets/main.css')
  assert.ok(epIdx >= 0 && cssIdx >= 0, '未能定位 main.js 中的样式引入')
  assert.ok(epIdx < cssIdx, 'main.css 必须在 element-plus 样式之后引入')
})

console.log(`topMenu 激活态测试:${passed} 项通过`)
