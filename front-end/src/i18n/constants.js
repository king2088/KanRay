// 支持的语言。zh-CN 为默认，新增语言需同步补 locales/<locale>/ 下的全部域文件（不含 index.js）。
export const SUPPORT_LOCALES = ['zh-CN', 'en-US']

export const DEFAULT_LOCALE = 'zh-CN'

// 词典域划分，与 locales/<locale>/ 下的域文件一一对应（index.js 为聚合器，不计入）
export const DOMAINS = [
  'common',
  'auth',
  'layout',
  'chart',
  'dashboard',
  'dataset',
  'form',
  'bigscreen',
  'admin',
  'openapi',
]

// 语言切换器选项。label 为语言母语名，按惯例不翻译，故不入词典。
export const LOCALE_OPTIONS = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en-US', label: 'English' },
]
