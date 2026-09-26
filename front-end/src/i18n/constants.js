// 支持的语言。zh-CN 为默认，新增语言需同步补 locales/<locale>/ 下的 12 个域文件。
export const SUPPORT_LOCALES = ['zh-CN', 'en-US']

export const DEFAULT_LOCALE = 'zh-CN'

// 词典域划分，与 locales/<locale>/ 下的文件名一一对应
export const DOMAINS = [
  'common',
  'auth',
  'layout',
  'chart',
  'datasource',
  'dataset',
  'form',
  'bigscreen',
  'admin',
  'openapi',
  'audit',
  'validation',
]

// 语言切换器选项。label 为语言母语名，按惯例不翻译，故不入词典。
export const LOCALE_OPTIONS = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en-US', label: 'English' },
]
