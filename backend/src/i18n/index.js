const { MESSAGES, SUCCESS_MESSAGES, MESSAGE_TEMPLATES } = require('./en-messages');

const PLACEHOLDER = /\$\{[^}]*\}/g;

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 中文模板 → { regex, en }。${expr} 统一编成惰性捕获组，表达式内容不参与匹配，
// 因此 `${f.label}` 与 `${label}` 会编译出同一个模式——它们的英文模板也相同。
function compileTemplate(zh, en) {
  const segments = zh.split(/\$\{[^}]*\}/);
  const source = segments.map(escapeRegExp).join('(.+?)');
  return { regex: new RegExp(`^${source}$`), en };
}

let compiled = null;

function compiledTemplates() {
  if (compiled) return compiled;
  compiled = Object.entries(MESSAGE_TEMPLATES).map(([zh, en]) => compileTemplate(zh, en));
  // 字面量越长的模板越具体，先匹配可避免被宽泛模板抢走
  compiled.sort((a, b) => b.regex.source.length - a.regex.source.length);
  return compiled;
}

// 把捕获到的实际值按出现顺序回填到英文模板的 ${...} 位置
function fillTemplate(en, match) {
  let index = 0;
  return en.replace(PLACEHOLDER, () => {
    index += 1;
    return match[index] === undefined ? '' : match[index];
  });
}

/**
 * 取英文文案。查不到返回 undefined，调用方据此省略 messageEn 字段，
 * 由前端回退中文——漏译只影响英文界面可读性，不会丢信息。
 * @param {string} message 中文原文
 * @returns {string|undefined}
 */
function enOf(message) {
  if (typeof message !== 'string' || message === '') return undefined;
  if (MESSAGES[message]) return MESSAGES[message];
  if (SUCCESS_MESSAGES[message]) return SUCCESS_MESSAGES[message];
  for (const item of compiledTemplates()) {
    const match = item.regex.exec(message);
    if (match) return fillTemplate(item.en, match);
  }
  return undefined;
}

module.exports = { enOf, MESSAGES, SUCCESS_MESSAGES, MESSAGE_TEMPLATES };
