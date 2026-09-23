import assert from 'node:assert/strict'
import {
  KEY_RE, FIELD_TYPES, ENUM_TYPES, TYPE_LABELS, isValidKey,
} from '../src/utils/form-meta.js'

let passed = 0
function t(name, fn) {
  fn()
  passed++
  console.log('  ok -', name)
}

for (const c of 'abc_AbZ9xy'.split('')) {
  t(`KEY_RE 接受合法字符 ${c}`, () => assert.ok(KEY_RE.test(`ok${c}1`.slice(-4))))
}

t('KEY_RE 拒绝纯数字开头', () => assert.ok(!KEY_RE.test('1abc')))
t('KEY_RE 拒绝连字符', () => assert.ok(!KEY_RE.test('a-b')))
t('KEY_RE 拒绝中文', () => assert.ok(!KEY_RE.test('字段a')))
t('KEY_RE 拒绝空串', () => assert.ok(!KEY_RE.test('')))
t('KEY_RE 拒绝空格', () => assert.ok(!KEY_RE.test('a b')))
t('isValidKey 代理到正则', () => {
  assert.equal(isValidKey('fee_name'), true)
  assert.equal(isValidKey('fee-name'), false)
})

t('FIELD_TYPES 包含 8 种控件', () => assert.deepEqual(
  FIELD_TYPES,
  ['text', 'textarea', 'number', 'date', 'select', 'radio', 'checkbox', 'static'],
))
t('ENUM_TYPES 三选型', () => assert.deepEqual(ENUM_TYPES, ['select', 'radio', 'checkbox']))
t('TYPE_LABELS 与 FIELD_TYPES 对齐', () => {
  for (const f of FIELD_TYPES) assert.ok(TYPE_LABELS[f], `缺少 ${f} 的中文标签`)
})

// 字段契约校验：模拟设计器 serialize 的结果，双端(前后端)对齐
function validateFields(fields) {
  const errors = []
  const seen = new Set()
  for (const f of fields) {
    if (!isValidKey(f.key)) errors.push(`${f.label}: key 非法`)
    if (seen.has(f.key)) errors.push(`key 重复 ${f.key}`)
    seen.add(f.key)
    if (!TYPE_LABELS[f.type]) errors.push(`${f.label}: 未知类型 ${f.type}`)
    if (!f.label || !String(f.label).trim()) errors.push('标签为空')
    if (typeof f.span === 'number' && ![1, 2].includes(f.span)) errors.push(`${f.label}: span 非法`)
    if (ENUM_TYPES.includes(f.type) && (!Array.isArray(f.options) || f.options.length === 0)) {
      errors.push(`${f.label}: 选项不能为空`)
    }
  }
  return errors
}

t('合法字段契约通过', () => assert.deepEqual(validateFields([
  { key: 'name', label: '姓名', type: 'text', required: true, span: 1 },
  { key: 'level', label: '满意度', type: 'select', options: [{ label: '满意', value: 'good' }], span: 2 },
  { key: 'memo', label: '说明', type: 'static', content: '一段说明', span: 2 },
]), []))
t('非法字段被拦截(重复key/非法key/空选项)', () => {
  const errs = validateFields([
    { key: 'name', label: 'A', type: 'text' },
    { key: 'name', label: 'B', type: 'text' },
    { key: '1x', label: 'C', type: 'number' },
    { key: 'd', label: 'D', type: 'select', options: [] },
    { key: 'e', label: 'E', type: 'radio', options: [{ label: '', value: '' }] },
  ])
  assert.ok(errs.length >= 3, errs.join(';'))
})

// 提交值归一化：checkbox 在 UI 是数组，后端入库是逗号串，编辑回填需 split
t('checkbox 数组→串→回环还原', () => {
  const enc = (arr) => arr.join(',')
  const dec = (s) => (s ? String(s).split(',') : [])
  assert.equal(enc(['a', 'b']), 'a,b')
  assert.deepEqual(dec('a,b'), ['a', 'b'])
  assert.deepEqual(dec(''), [])
})

console.log(`formMeta 测试：${passed} 项通过`)