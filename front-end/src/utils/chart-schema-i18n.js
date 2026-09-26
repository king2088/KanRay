// 图表 schema 节点文案解析。
//
// chart-configs.js 只产出 message key（labelKey / titleKey / placeholderKey），
// 由组件在渲染时翻译。但符号类选项（如 '+'、'USD'、'日'）本身不是中文，
// codemod 不会为它们生成键，仍保留裸 label / title / placeholder。
// 因此这里统一按「有 key 用 key，否则回退原字面量」解析。
import { t } from '@/i18n'

export const lbl = (node) => (node?.labelKey ? t(node.labelKey) : (node?.label ?? ''))
export const ttl = (node) => (node?.titleKey ? t(node.titleKey) : (node?.title ?? ''))
export const ph = (node) => (node?.placeholderKey ? t(node.placeholderKey) : (node?.placeholder ?? ''))
