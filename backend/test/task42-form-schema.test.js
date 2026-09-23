// 首行设置 DB_PATH（node:test 每文件独立进程）
process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formSchema, fieldSchema, KEY_RE, dbFieldsOf, optionsOf } = require('../src/services/form-schema');

test('formSchema 通过合法 schema', () => {
  const parsed = formSchema.safeParse({
    version: 1,
    fields: [
      { key: 'f_name', label: '姓名', type: 'text', required: true, span: 2 },
      { key: 'f_age', label: '年龄', type: 'number', required: false, span: 1, group: '基本信息' },
      { key: 'f_city', label: '城市', type: 'select', span: 2, options: [{ label: '北京', value: 'beijing' }, { label: '上海', value: 'shanghai' }] },
    ],
  });
  assert.ok(parsed.success, JSON.stringify(parsed.error?.issues));
  const fields = parsed.data.fields;
  assert.equal(fields.length, 3);
  assert.equal(fields[0].required, true);
  assert.equal(fields[0].placeholder, '');
  assert.equal(fields[0].span, 2);
  assert.equal(fields[1].group, '基本信息');
});

test('非法 key（含点号/以数字开头）被拒绝', () => {
  for (const bad of ['a.b', '9x', '', 'has space', '中文', 'a-b']) {
    const r = formSchema.safeParse({ version: 1, fields: [{ key: bad, label: 'x', type: 'text' }] });
    assert.equal(r.success, false, `key ${JSON.stringify(bad)} 应被拒绝`);
  }
  assert.ok(formSchema.safeParse({ version: 1, fields: [{ key: '_ok1', label: 'x', type: 'text' }] }).success);
});

test('非法类型与未知字段被拒绝（strict）', () => {
  assert.equal(formSchema.safeParse({ version: 1, fields: [{ key: 'a', label: 'x', type: 'unknown' }] }).success, false);
  assert.equal(formSchema.safeParse({ version: 1, fields: [{ key: 'a', label: 'x', type: 'text', extra: 1 }] }).success, false);
});

test('启用枚举类型必须提供合法 options 否则失败', () => {
  assert.equal(formSchema.safeParse({ version: 1, fields: [{ key: 'a', label: 'x', type: 'select', options: [{ label: 'x', value: '' }] }] }).success, false);
  assert.ok(formSchema.safeParse({ version: 1, fields: [{ key: 'a', label: 'x', type: 'select', options: [] }] }).success);
});

test('static 字段不入物理表、其余类型正确映射', () => {
  const schema = formSchema.parse({
    version: 1,
    fields: [
      { key: 'f_t', label: '文本', type: 'text' },
      { key: 'f_ta', label: '多行', type: 'textarea' },
      { key: 'f_n', label: '数字', type: 'number' },
      { key: 'f_d', label: '日期', type: 'date' },
      { key: 'f_s', label: '下拉', type: 'select', options: [{ label: 'a', value: 'a' }] },
      { key: 'f_r', label: '单选', type: 'radio', options: [{ label: 'a', value: 'a' }] },
      { key: 'f_c', label: '多选', type: 'checkbox', options: [{ label: 'a', value: 'a' }] },
      { key: 'f_note', label: '说明', type: 'static' },
    ],
  });
  const cols = dbFieldsOf(schema);
  const names = cols.map((c) => c.name);
  assert.deepEqual(names, ['f_t', 'f_ta', 'f_n', 'f_d', 'f_s', 'f_r', 'f_c']);
  const byName = Object.fromEntries(cols.map((c) => [c.name, c]));
  assert.equal(byName.f_n.type, 'number');
  assert.equal(byName.f_d.type, 'date');
  assert.equal(byName.f_t.type, 'string');
});

test('optionsOf 返回字段合法 value 列表', () => {
  const field = { key: 'f_s', label: 'x', type: 'select', options: [{ label: '北京', value: 'bj' }, { label: '上海', value: 'sh' }] };
  assert.deepEqual(optionsOf(field), ['bj', 'sh']);
  assert.deepEqual(optionsOf({ key: 'a', label: 'x', type: 'text' }), []);
});

test('key 集合唯一性由调用方保证：重复 key 仍可序列化（构造时不去重）', () => {
  const r = formSchema.safeParse({ version: 1, fields: [{ key: 'a', label: 'x', type: 'text' }, { key: 'a', label: 'y', type: 'text' }] });
  assert.equal(r.success, true, '重复 key 由 service 层去重校验，zod 不拦截');
});