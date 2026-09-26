// seed 脚本输出的国际化守卫。
//
// 规则很简单：凡是**会打印给人看**的调用（ok / console.* / new Error），
// 只要出现了中文，就必须经过 t() 二选一，否则英文模式会漏出中文。
// 反过来，灌进库里的演示数据（表单名、字段标签、电站名、图表名）允许是中文 ——
// 那是「用户自填数据」，不归 i18n 词典管。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CJK = /[\u4e00-\u9fff]/;
const SCRIPTS = ['seed-form-demo.mjs', 'seed-hydro-demo.mjs'];

// 只看这些位置：它们的参数会直接出现在终端输出里
const OUTPUT_CALL = /\b(?:ok|console\.(?:log|error|warn))\s*\(|\bnew Error\s*\(/g;

function outputCallSites(src) {
  const sites = [];
  let m;
  OUTPUT_CALL.lastIndex = 0;
  while ((m = OUTPUT_CALL.exec(src)) !== null) {
    // 从左括号起截到该语句结束（分号/换行），足够覆盖参数里的中文
    const rest = src.slice(m.index);
    const end = rest.search(/[;\n]/);
    sites.push({ line: src.slice(0, m.index).split('\n').length, text: rest.slice(0, end === -1 ? 400 : end) });
  }
  return sites;
}

SCRIPTS.forEach((name) => {
  const file = path.join(__dirname, '..', 'scripts', name);
  const src = fs.readFileSync(file, 'utf8');

  test(`${name}: 有 locale 开关与 t() 助手`, () => {
    assert.match(src, /argVal\('-l'\)\s*\|\|\s*argVal\('--locale'\)/, '缺少 -l/--locale 解析');
    assert.match(src, /const t = \(zh, en\) =>/, '缺少 t() 助手');
  });

  test(`${name}: 会打印的文案不得绕过 t() 直接写中文`, () => {
    const offenders = outputCallSites(src).filter((s) => CJK.test(s.text) && !s.text.includes('t('));
    assert.deepEqual(
      offenders.map((o) => `第 ${o.line} 行: ${o.text.trim().slice(0, 90)}`),
      [],
      '这些输出会漏出中文，请改成 t(中文, English)',
    );
  });
});

test('演示数据保持中文不译（用户自填数据）', () => {
  const form = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'seed-form-demo.mjs'), 'utf8');
  const hydro = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'seed-hydro-demo.mjs'), 'utf8');
  // 表单名 / 电站关键词是灌库内容，被 i18n 误译反而会让演示数据不像真实中文数据
  assert.match(form, /const FORM_NAME = '员工满意度调查';/);
  assert.match(hydro, /const HYDRO_KEYWORDS = \['水电站', '流域发电', '省份装机'\];/);
});

test('守卫本身有效：能抓出绕过 t() 的中文', () => {
  // 拿真实脚本里的中文输出做反例，确认规则不是恒真
  const bad = "console.log('数据预览（前 6 条）:');";
  const site = outputCallSites(bad)[0];
  assert.ok(CJK.test(site.text) && !site.text.includes('t('), '规则对反例应成立');
});

// ---------- 部署脚本 ----------
const DEPLOY_SCRIPTS = [
  'deploy/docker/deploy.sh',
  'deploy/k8s/scripts/build-images.sh',
  'deploy/k8s/scripts/deploy.sh',
];
const REPO = path.join(__dirname, '..', '..');

DEPLOY_SCRIPTS.forEach((rel) => {
  const src = fs.readFileSync(path.join(REPO, rel), 'utf8');

  test(`${rel}: 有 APP_LANG 开关`, () => {
    assert.match(src, /APP_LANG="\$\{APP_LANG:-zh-CN\}"/, '缺少 APP_LANG 默认值');
    assert.match(src, /if \[ "\$APP_LANG" = "en-US" \]/, '缺少 en-US 分支');
    assert.doesNotMatch(src, /^\s*LANG="\$\{LANG/, '不要占用 POSIX 标准变量 LANG');
  });

  test(`${rel}: 不得有裸 echo 中文`, () => {
    // echo 是最常见的漏网之处：加了 t() 却忘了把原来的 echo 换掉
    const bare = src
      .split('\n')
      .map((line, i) => [i + 1, line])
      .filter(([, line]) => /^\s*echo\b/.test(line) && CJK.test(line));
    assert.deepEqual(bare.map(([n]) => `第 ${n} 行`), [], '请改用 t "中文" "English"');
  });
});

test('部署脚本的 t() 助手两个分支都只打印对应语言', () => {
  const src = fs.readFileSync(path.join(REPO, DEPLOY_SCRIPTS[0]), 'utf8');
  assert.match(src, /t\(\) \{ printf '%s\\n' "\$2"; \}/, '英文分支应打印第 2 个参数');
  assert.match(src, /t\(\) \{ printf '%s\\n' "\$1"; \}/, '中文分支应打印第 1 个参数');
});
