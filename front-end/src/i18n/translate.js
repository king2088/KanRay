// 翻译器注入。
//
// 为什么需要它：`chart-configs.js` / `dataset-type.js` / `catalog.js` 等纯 JS 模块
// 被 node 测试脚本（scripts/*.mjs）直接 import，这些脚本不经 vite，
// 若静态 import vue-i18n 或带 `@/` 别名的模块会直接解析失败。
// 因此约定：纯模块只产出 message key，由本模块在运行时翻译。
//
// 默认翻译器读 zh-CN 纯词典（零 vue 依赖，node 环境安全），
// 浏览器环境由 i18n/index.js 初始化时注入 vue-i18n 的 t，以支持英文界面。
import zhCN from './locales/zh-CN/index.js'
import { flattenMessages } from './flatten.js'

const ZH = flattenMessages(zhCN)

// null / undefined 表示恢复默认（中文词典查表）
let translator = null

export function setTranslator(fn) {
  translator = typeof fn === 'function' ? fn : null
}

// 默认翻译器直接返回 zh-CN 原文，不会经过 vue-i18n 编译，
// 因此命名插值要自己替换，否则会漏出 {name} 占位符。
function interpolate(msg, named) {
  if (typeof msg !== 'string' || !named || typeof named !== 'object') return msg
  return msg.replace(/\{(\w+)\}/g, (m, k) => (named[k] === undefined ? m : String(named[k])))
}

const defaultTranslate = (k, named) => {
  if (typeof k !== 'string' || ZH[k] === undefined) return k
  return named === undefined ? ZH[k] : interpolate(ZH[k], named)
}

export function tr(key, named) {
  const fn = translator || defaultTranslate
  return named === undefined ? fn(key) : fn(key, named)
}

export function resetTranslator() {
  translator = null
}
