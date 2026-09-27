// 架构守卫：指标响应投影（normalizeMetrics 的产物 → /data 响应里的 metrics[]）全仓只能有一份。
//
// 为什么要有这个守卫：投影曾是三份手抄（query-engine.js 一份、sql-data-provider.js 两份），
// 每份各带一张显式白名单，于是「给响应加个字段」要改三处，漏一处就是静默丢字段——decimals
// 就在 SQL 数据集那条路上丢过一次（走 provider 的两份投影都没跟上）。
//
// 判据为什么选「src/ 里带 `derivedKind:` 的文件清单」：
//  - 命名无关。指纹正则（`derivedKind: m.derivedKind`）会把共享实现里的变量名焊死：把
//    projectMetrics 的 lambda 参数从 m 改成 x，指纹就归零，测试报一句与真实原因无关的错。
//    按文件清单判，改名照旧绿，而任何照着现有投影再抄一份的写法都会被抓到——实测用不同
//    变量名（x）抄一份带 derived 分支的，这条立刻变红。
//  - 只认「谁拥有这份投影」，不认「调用了几次」。调用点是出现次数，把 query-engine 的第二条
//    数据出口数进去，只会在合法重构时无端变红。
//
// 这条规则已知的盲区（实测过，别把它当万能守卫）：抄一份却**漏掉 derived 分支**的投影，
// 不含 `derivedKind:`，清单仍是绿的。那种变体只能靠行为测试兜——query-engine 这条路有
// 活着的用例（task50 走真实 aggregate 断言 decimals 到得了响应），实测能抓住；而
// sql-data-provider 的两处调用点没有活路径可跑，离线只能钉住「内联不产键/库指标带键」
// 这类形状，覆盖不到「有人另抄了一份」。
//
// 独立成文件而不并进 task50：task50 讲的是 decimals 这个字段保证了什么，
// 来看「decimals 的契约」的人不该掉进源码 grep 里。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'src');
const metrics = require('../src/engines/metrics');

function walkJs(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJs(p, out);
    else if (entry.name.endsWith('.js')) out.push(p);
  }
  return out;
}

test('指标响应投影只有一份：src/ 里带 derivedKind: 的只有 engines/metrics.js', () => {
  const owners = walkJs(SRC)
    .filter((p) => fs.readFileSync(p, 'utf8').includes('derivedKind:'))
    .map((p) => path.relative(SRC, p).split(path.sep).join('/'))
    .sort();
  assert.deepEqual(owners, ['engines/metrics.js'],
    `投影长出了第二份：${owners.join(' / ')} —— 各自手抄的显式白名单会漏字段`
    + '（decimals 在 SQL 数据集上就这么丢过一次），应改为调用 projectMetrics');
});

test('projectMetrics 已导出，调用方 require 到的确实是函数', () => {
  // 断的是模块对象的形状，不是源码文本：再 require 一次文件、拿正则去匹配 module.exports
  // 之类的做法，导出名一改就会给出与真实后果（require 拿到 undefined）无关的报错。
  assert.equal(typeof metrics.projectMetrics, 'function');
});
