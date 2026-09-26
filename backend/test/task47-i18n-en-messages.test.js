const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { enOf, withMessageEn, MESSAGES, SUCCESS_MESSAGES, MESSAGE_TEMPLATES } = require('../src/i18n');

const SRC = path.join(__dirname, '..', 'src');
const CJK = /[\u4e00-\u9fff]/;

// 收集 src 下所有 .js（跳过 i18n 自身，避免把映射表当成调用点）
function sourceFiles() {
  const out = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith('.js') && !p.includes(`${path.sep}i18n${path.sep}`)) out.push(p);
    }
  })(SRC);
  return out;
}

// 从 src[openIdx]（必须是 '('）开始读到配平的 ')'，返回顶层实参数组
function readArgs(src, openIdx) {
  let i = openIdx + 1;
  let depth = 1;
  let str = null;
  const parts = [];
  let cur = '';
  while (i < src.length) {
    const c = src[i];
    if (str) {
      cur += c;
      if (c === '\\') { cur += src[++i] ?? ''; i += 1; continue; }
      if (c === str) str = null;
      i += 1;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { str = c; cur += c; i += 1; continue; }
    if ('([{'.includes(c)) depth += 1;
    if (')]}'.includes(c)) { depth -= 1; if (depth === 0) { parts.push(cur); return parts; } }
    if (c === ',' && depth === 1) { parts.push(cur); cur = ''; i += 1; continue; }
    cur += c;
    i += 1;
  }
  parts.push(cur);
  return parts;
}

function inventory() {
  const statics = new Map();
  const templates = new Map();
  const successes = new Map();
  for (const file of sourceFiles()) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/new\s+HttpError\s*\(/g)) {
      const msg = (readArgs(src, m.index + m[0].length - 1)[1] || '').trim();
      if (!CJK.test(msg)) continue;
      if (msg[0] === '`') {
        // 去掉源码的反引号（JS 语法，不是消息内容）
        const key = msg.slice(1, -1);
        templates.set(key, (templates.get(key) || 0) + 1);
      } else if (msg[0] === "'" || msg[0] === '"') {
        const key = msg.slice(1, -1);
        statics.set(key, (statics.get(key) || 0) + 1);
      }
    }
    for (const m of src.matchAll(/(?<![.\w$])ok\s*\(/g)) {
      const msg = (readArgs(src, m.index + m[0].length - 1)[2] || '').trim();
      if (!CJK.test(msg)) continue;
      if (msg[0] === "'" || msg[0] === '"') {
        const key = msg.slice(1, -1);
        if (key === 'success') continue;
        successes.set(key, (successes.get(key) || 0) + 1);
      }
    }
    // errorHandler / notFound 里直接赋给 message 的字面量（不经 HttpError/ok）
    for (const m of src.matchAll(/\bmessage\s*[=:]\s*(['"`])([^'"`]*)\1/g)) {
      const key = m[1] === '`' ? m[2] : m[2];
      if (!CJK.test(key)) continue;
      if (m[1] === '`') templates.set(key, (templates.get(key) || 0) + 1);
      else statics.set(key, (statics.get(key) || 0) + 1);
    }
  }
  return { statics, templates, successes };
}

const { statics, templates, successes } = inventory();

// 对象字面量里的重复键会被静默吞掉（后者覆盖前者），因此直接数源码里声明了几行键
function declaredKeys(tableName) {
  const text = fs.readFileSync(path.join(SRC, 'i18n', 'en-messages.js'), 'utf8');
  const start = text.indexOf(`const ${tableName} = {`);
  assert.notEqual(start, -1, `en-messages.js 里找不到 ${tableName}`);
  const open = text.indexOf('{', start);
  let depth = 1;
  let i = open + 1;
  let str = null;
  while (i < text.length && depth > 0) {
    const c = text[i];
    if (str) {
      if (c === '\\') { i += 2; continue; }
      if (c === str) str = null;
      i += 1;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { str = c; i += 1; continue; }
    if (c === '{') depth += 1;
    if (c === '}') depth -= 1;
    i += 1;
  }
  const body = text.slice(open + 1, i - 1);
  // 每个键都独占一行；键是完整的引号字符串（内部可能含冒号），不能按第一个冒号切
  const KEY_LINE = /^((?:'(?:[^'\\]|\\.)*')|(?:"(?:[^"\\]|\\.)*"))\s*:/;
  return body.split('\n')
    .map((line) => line.trim())
    .filter((line) => KEY_LINE.test(line))
    .map((line) => line.match(KEY_LINE)[1]);
}

test('映射表没有重复键（对象字面量会静默吞掉重复项）', () => {
  for (const table of ['MESSAGES', 'SUCCESS_MESSAGES', 'MESSAGE_TEMPLATES']) {
    const keys = declaredKeys(table);
    const seen = new Set();
    const dup = [];
    for (const k of keys) {
      if (seen.has(k)) dup.push(k);
      seen.add(k);
    }
    assert.deepEqual(dup, [], `${table} 有 ${dup.length} 个重复键`);
    assert.equal(keys.length, Object.keys(require('../src/i18n')[table]).length,
      `${table} 源码声明 ${keys.length} 个键，解析后只有 ${Object.keys(require('../src/i18n')[table]).length} 个`);
  }
});

test('全部静态消息都有英文映射', () => {
  const missing = [...statics.keys()].filter((k) => !MESSAGES[k] && !SUCCESS_MESSAGES[k]);
  assert.deepEqual(missing, [], `缺少 ${missing.length} 条静态消息的英文`);
});

test('全部 ok() 成功文案都有英文映射', () => {
  const missing = [...successes.keys()].filter((k) => !SUCCESS_MESSAGES[k]);
  assert.deepEqual(missing, [], `缺少 ${missing.length} 条成功文案的英文`);
});

test('全部插值模板都有英文映射，且只登记在模板表', () => {
  const missing = [...templates.keys()].filter((k) => !MESSAGE_TEMPLATES[k]);
  assert.deepEqual(missing, [], `缺少 ${missing.length} 条插值模板的英文`);
  // 含 ${} 的键若被误放进静态表，运行期永远匹配不上（静态表是整串精确比较）
  const misplaced = [...templates.keys()].filter((k) => MESSAGES[k] || SUCCESS_MESSAGES[k]);
  assert.deepEqual(misplaced, [], `${misplaced.length} 条插值模板被误放进静态表`);
});

test('静态表里不得残留 ${} 模板键', () => {
  const bad = [...Object.keys(MESSAGES), ...Object.keys(SUCCESS_MESSAGES)].filter((k) => k.includes('${'));
  assert.deepEqual(bad, [], `${bad.length} 条含 \${} 的键应放在 MESSAGE_TEMPLATES`);
});

test('映射表里不得有源码已不再使用的孤儿键', () => {
  const used = new Set([...statics.keys(), ...templates.keys(), ...successes.keys()]);
  const orphans = [
    ...Object.keys(MESSAGES).filter((k) => !used.has(k)),
    ...Object.keys(SUCCESS_MESSAGES).filter((k) => !used.has(k)),
    ...Object.keys(MESSAGE_TEMPLATES).filter((k) => !used.has(k)),
  ];
  assert.deepEqual(orphans, [], `${orphans.length} 个键在源码里已无对应调用点: ${orphans.slice(0, 5).join(' / ')}`);
});

test('英文映射不含中文', () => {
  const bad = [];
  for (const [zh, en] of Object.entries({ ...MESSAGES, ...SUCCESS_MESSAGES, ...MESSAGE_TEMPLATES })) {
    if (CJK.test(en)) bad.push(`${zh} -> ${en}`);
  }
  assert.deepEqual(bad, [], `${bad.length} 条英文文案仍含中文`);
});

test('enOf 静态精确匹配', () => {
  assert.equal(enOf('数据源不存在'), 'Data source not found');
  assert.equal(enOf('无权访问该资源'), 'You do not have access to this resource');
  assert.equal(enOf('删除成功'), 'Deleted successfully');
  assert.equal(enOf('连接成功'), 'Connection successful');
});

test('enOf 插值模板按实际值回填', () => {
  assert.equal(enOf('数据集不存在: id=ds_123'), 'Dataset not found: id=ds_123');
  assert.equal(enOf('看板不存在: id=42'), 'Dashboard not found: id=42');
  assert.equal(enOf('「姓名」为必填项'), '"姓名" is required');
  assert.equal(enOf('「age」必须是数字'), '"age" must be a number');
  assert.equal(enOf('数据行数 120000 超过上限 100000'),
    'Row count 120000 exceeds the limit of 100000');
});

test('enOf 未登记消息返回 undefined（不抛错、不返回中文）', () => {
  assert.equal(enOf('某个从未出现过的错误'), undefined);
  assert.equal(enOf(''), undefined);
  assert.equal(enOf(undefined), undefined);
  assert.equal(enOf(null), undefined);
  assert.equal(enOf(123), undefined);
});

test('模板占位符数量在中文与英文之间保持一致', () => {
  const bad = [];
  for (const [zh, en] of Object.entries(MESSAGE_TEMPLATES)) {
    const a = (zh.match(/\$\{[^}]*\}/g) || []).length;
    const b = (en.match(/\$\{[^}]*\}/g) || []).length;
    if (a !== b) bad.push(`${zh} (${a}) -> ${en} (${b})`);
  }
  assert.deepEqual(bad, [], `${bad.length} 条模板占位符数量不一致`);
});

test('源码里每条消息都能查到英文', () => {
  const failed = [];
  for (const zh of statics.keys()) if (!enOf(zh)) failed.push(zh);
  for (const zh of successes.keys()) if (!enOf(zh)) failed.push(zh);
  assert.deepEqual(failed, [], `${failed.length} 条源码消息 enOf 查不到英文`);
});

// provider 的连通性结果把文案放在 data.message，不在响应信封上，
// errorHandler/ok 的查表覆盖不到，必须由 withMessageEn 在出口补。
test('withMessageEn 给 provider 结果补 messageEn', () => {
  const out = withMessageEn({ ok: true, message: '连接成功' });
  assert.equal(out.messageEn, 'Connection successful');
  assert.equal(out.ok, true);
});

test('withMessageEn 处理模板型 provider 文案', () => {
  const out = withMessageEn({ ok: false, message: '集群状态: degraded' });
  assert.equal(out.messageEn, 'Cluster status: degraded');
});

test('withMessageEn 对未收录文案不改对象（省略 messageEn）', () => {
  const input = { ok: false, message: '某个未收录的 provider 文案' };
  assert.deepEqual(withMessageEn(input), input);
  assert.equal('messageEn' in withMessageEn(input), false);
});

test('withMessageEn 不修改入参，也不破坏无 message 的结果', () => {
  const input = { ok: true, message: '连接成功' };
  withMessageEn(input);
  assert.equal('messageEn' in input, false, '不得就地改调用方的对象');
  assert.deepEqual(withMessageEn({ ok: true }), { ok: true });
  assert.equal(withMessageEn(null), null);
});
