/**
 * 开放 API 文档的英文视图。
 *
 * swagger.js / openapi.doc.js 里每条中文文案旁边都存了 `x-en`（或 `x-en-summary`、
 * `x-en-title`、`x-en-name`），但 OpenAPI 规范本身没有多语言机制，Swagger UI 只会
 * 渲染 `description`/`summary`/`title`——直接挂载原 spec，英文界面下打开文档仍然是中文。
 *
 * 这里按 x-en 系列扩展生成一份纯英文 spec 副本给文档 UI 用；原始 spec 不动，
 * `/api/open/v1/openapi.json` 的对外契约和 task27 系列测试都不受影响。
 */

/** 深拷贝，避免污染 require 缓存里的原 spec */
function clone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

/** 递归把 { description, 'x-en' } 换成英文，并把 x-en 键摘掉 */
function applyDescriptions(node) {
  if (Array.isArray(node)) {
    node.forEach(applyDescriptions);
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node)) {
    if (k !== 'description' && v && typeof v === 'object') applyDescriptions(v);
  }
  if (typeof node.description === 'string' && typeof node['x-en'] === 'string') {
    node.description = node['x-en'];
  }
  delete node['x-en'];
}

/**
 * @param {object} spec 原始 OpenAPI spec
 * @returns {object} 英文 spec 副本
 */
function toEnglishSpec(spec) {
  const out = clone(spec);

  // info：标题 + 描述
  const info = out.info || {};
  if (typeof info['x-en-title'] === 'string') {
    info.title = info['x-en-title'];
    delete info['x-en-title'];
  }
  if (typeof info['x-en'] === 'string') info.description = info['x-en'];

  // 分组标签：名称走 x-en-name，描述走 x-en；名称变了要同步改操作里的 tags 引用
  const renamed = new Map();
  for (const tag of out.tags || []) {
    if (typeof tag['x-en-name'] === 'string') {
      renamed.set(tag.name, tag['x-en-name']);
      tag.name = tag['x-en-name'];
      delete tag['x-en-name'];
    }
  }

  for (const pathItem of Object.values(out.paths || {})) {
    for (const [method, op] of Object.entries(pathItem || {})) {
      if (!op || typeof op !== 'object' || Array.isArray(op)) continue;
      if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)) {
        if (typeof op['x-en-summary'] === 'string') {
          op.summary = op['x-en-summary'];
          delete op['x-en-summary'];
        }
        if (Array.isArray(op.tags)) {
          op.tags = op.tags.map((t) => renamed.get(t) || t);
        }
      }
    }
  }

  // 其余 description（参数、响应、schema、字段）统一按 x-en 替换
  applyDescriptions(out);
  return out;
}

module.exports = { toEnglishSpec };
