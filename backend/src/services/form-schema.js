const { z } = require('zod');

const KEY_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'select', 'radio', 'checkbox', 'static'];
// 需要 options 枚举的控件
const ENUM_TYPES = ['select', 'radio', 'checkbox'];

const optionSchema = z.object({
  label: z.string().min(1).max(100),
  value: z.string().min(1).max(100),
}).strict();

const fieldSchema = z.object({
  key: z.string().regex(KEY_RE, '字段 key 仅允许字母/数字/下划线且不能以数字开头'),
  label: z.string().min(1).max(100),
  type: z.enum(FIELD_TYPES),
  required: z.boolean().default(false),
  placeholder: z.string().max(200).default(''),
  span: z.union([z.literal(1), z.literal(2)]).default(2),
  group: z.string().max(50).nullable().default(null),
  options: z.array(optionSchema).max(100).default([]),
  content: z.string().max(5000).default(''),
}).strict();

const formSchema = z.object({
  version: z.literal(1).default(1),
  fields: z.array(fieldSchema).max(100).default([]),
}).strict();

// schema.fields -> 物理表列定义（static 不入表）
const TYPE_TO_CANON = {
  text: 'string',
  textarea: 'string',
  number: 'number',
  date: 'date',
  select: 'string',
  radio: 'string',
  checkbox: 'string',
};

function dbFieldsOf(schema) {
  return (schema.fields || []).filter((f) => f.type !== 'static').map((f) => ({
    name: f.key,
    label: f.label,
    type: TYPE_TO_CANON[f.type],
  }));
}

// select/radio/checkbox 的合法值列表
function optionsOf(field) {
  return (field.options || []).map((o) => o.value);
}

module.exports = {
  KEY_RE,
  FIELD_TYPES,
  ENUM_TYPES,
  TYPE_TO_CANON,
  fieldSchema,
  formSchema,
  dbFieldsOf,
  optionsOf,
};