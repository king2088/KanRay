// OpenAPI 描述的国际化守卫。
//
// 中文 description/summary 一律保留（既有中文使用者不受影响），但必须同时给出英文。
// 这里直接遍历 swagger-jsdoc 装配完成后的 spec，而不是扫描源码——源码扫描分不清
// 「注释里的示例文本」和「真正进入 spec 的描述」，遍历 spec 才能保证覆盖到位。
const test = require('node:test');
const assert = require('node:assert/strict');

const CJK = /[\u4e00-\u9fff]/;
const spec = require('../src/openapi/swagger');

const problems = [];
let checked = 0;

function checkEn(value, en, where, problems2) {
  if (typeof en !== 'string' || en.trim() === '') {
    problems2.push(`${where} 缺少英文（${value}）`);
    return;
  }
  if (CJK.test(en)) problems2.push(`${where} 的英文里仍有中文：${en}`);
}

function walk(node, at) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => walk(v, `${at}[${i}]`));
    return;
  }
  if (!node || typeof node !== 'object') return;

  if (typeof node.description === 'string' && CJK.test(node.description)) {
    checked += 1;
    checkEn(node.description, node['x-en'], `${at}.description`, problems);
  }
  if (typeof node.summary === 'string' && CJK.test(node.summary)) {
    checked += 1;
    checkEn(node.summary, node['x-en-summary'], `${at}.summary`, problems);
  }

  for (const [key, value] of Object.entries(node)) {
    walk(value, at ? `${at}.${key}` : key);
  }
}

walk(spec, '');

test('OpenAPI 里的中文 description 都有对应 x-en', () => {
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('守卫本身有效：确实检查到了中文描述', () => {
  // 防止以后有人把中文描述删光导致本文件变成空转
  assert.ok(checked >= 15, `只检查到 ${checked} 条中文描述，疑似遍历失效`);
});

test('info 标题保留中文且给出英文', () => {
  assert.equal(spec.info.title, '看板开放 API');
  assert.equal(spec.info['x-en-title'], 'KanRay Open API');
});

test('tag 名称是标识符，不能因为国际化被改掉', () => {
  // operation 通过 tags: [发现] 引用 tag name，改名会静默丢掉归类
  assert.deepEqual(spec.tags.map((t) => t.name), ['发现', '取数']);
  spec.tags.forEach((tag) => {
    assert.ok(!CJK.test(tag['x-en']), `tag ${tag.name} 的 x-en 含中文`);
  });
});

test('operation 通过 x-en-summary 暴露英文摘要', () => {
  const paths = Object.keys(spec.paths);
  assert.ok(paths.length > 0);
  // aggregate 是 POST，其余是 GET，两种都要覆盖到
  const summaries = paths.map((p) => (spec.paths[p].get || spec.paths[p].post)['x-en-summary']);
  assert.ok(
    summaries.every(Boolean),
    `缺 x-en-summary 的端点：${paths.filter((p, i) => !summaries[i]).join(', ')}`,
  );
  summaries.forEach((s) => assert.ok(!CJK.test(s), `英文摘要含中文：${s}`));
});

// swagger-jsdoc 遇到 YAML 解析错误只会往 stderr 打一段报告，然后**静默丢掉整块**。
// 一条文案里出现 # 或 : 就足以让整个 path 消失，而且不会有任何报错。
// 这里把 path 列表钉死，让「误删一个端点」变成红灯而不是无声的 404。
test('全部 6 个端点都在 spec 里（防止 YAML 报错被静默吞掉）', () => {
  assert.deepEqual(Object.keys(spec.paths).sort(), [
    '/charts',
    '/charts/{id}/data',
    '/dashboards',
    '/dashboards/{id}/export',
    '/datasets',
    '/datasets/{id}/aggregate',
  ]);
});

test('spec 仍可被 swagger-jsdoc 正常解析（未破坏结构）', () => {
  assert.equal(spec.openapi, '3.0.0');
  assert.ok(spec.components.responses.BadRequest['x-en']);
  assert.ok(spec.paths['/charts/{id}/data'].get);
});
