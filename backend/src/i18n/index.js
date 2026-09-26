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

/**
 * 给「文案不在响应信封里」的结果对象补 messageEn。
 *
 * provider 的 testConnection 把结果文案放在 data.message（如「连接成功」），
 * errorHandler/ok 只处理信封上的 message，覆盖不到这里。22 个 provider 各自
 * 带一份英文既重复又容易漏改，因此在出口统一补一次。
 * @param {object} result provider 返回的结果
 * @returns {object} 补上 messageEn 的新对象；查不到英文时原样返回
 */
function withMessageEn(result) {
  if (!result || typeof result !== 'object' || typeof result.message !== 'string') return result;
  const en = enOf(result.message);
  return en ? { ...result, messageEn: en } : result;
}

module.exports = { enOf, withMessageEn, MESSAGES, SUCCESS_MESSAGES, MESSAGE_TEMPLATES };
