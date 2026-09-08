/* 浏览器端到端冒烟测试：走完整"上传数据 → 建图 → 排看板 → 筛选联动"流程 */
const { chromium } = require('playwright-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:5173';
const XLSX = 'C:/Users/DELL/Desktop/kanban/backend/test-data/销售数据.xlsx';
const errors = [];

function log(...args) { console.log('[e2e]', ...args); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pickSelect(page, selectLocator, optionIndex) {
  await selectLocator.click();
  await page.waitForSelector('.el-select-dropdown__item:visible', { timeout: 10000 });
  await sleep(200);
  await page.click(`.el-select-dropdown__item:visible >> nth=${optionIndex}`);
  await sleep(300);
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`); });
  page.on('response', async (r) => {
    if (r.status() >= 400) {
      let body = '';
      try { body = (await r.text()).slice(0, 200); } catch (e) { /* ignore */ }
      errors.push(`HTTP ${r.status()} ${r.url().replace(BASE, '')} -> ${body}`);
    }
  });

  // 1. 数据集页
  await page.goto(BASE + '/datasets', { waitUntil: 'networkidle' });
  log('1 title =', await page.title());
  await page.waitForSelector('text=上传数据', { timeout: 10000 });
  await page.waitForSelector('.el-pagination', { timeout: 10000 });
  log('1a 列表分页渲染 =', await page.$$('.el-pagination').then((els) => els.length));

  // 1b. 系统设置抽屉：暗黑模式切换
  await page.click('.header-icon');
  await page.waitForSelector('.el-drawer', { timeout: 10000 });
  await page.click('.el-drawer .el-switch >> nth=0');
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
  log('1c 暗黑模式已开启');
  await page.click('.el-drawer .el-switch >> nth=0');
  await page.waitForFunction(() => !document.documentElement.classList.contains('dark'));
  log('1d 暗黑模式已恢复');
  await page.click('.el-drawer__close-btn');
  await page.waitForSelector('.el-drawer', { state: 'hidden', timeout: 10000 });

  // 2. 上传
  await page.click('text=上传数据');
  await page.waitForSelector('text=将 Excel / CSV 拖到此处', { timeout: 10000 });
  await page.setInputFiles('input[type=file]', XLSX);
  await page.waitForSelector('text=下一步：解析并预览', { timeout: 10000 });
  log('2 文件已选择');
  await page.click('text=下一步：解析并预览');
  await page.waitForSelector('text=确认字段类型', { timeout: 30000 });
  await page.waitForSelector('text=数据预览', { timeout: 10000 });
  log('3 字段预览成功');
  await page.click('button:has-text("创建数据集")');
  await page.waitForSelector('text=创建成功', { timeout: 30000 });
  await page.click('text=去创建图表');
  await page.waitForSelector('text=实时预览', { timeout: 20000 });
  log('4 跳转到图表构建器');

  // 3. 选择数据集（第一下拉）
  await page.waitForSelector('.el-select', { timeout: 10000 });
  const datasetSelect = page.locator('.config-collapse .el-select').first();
  await pickSelect(page, datasetSelect, 0);
  // 等待字段出现
  await page.waitForSelector('.field-chip', { timeout: 10000 });
  log('5 数据集已选择，字段 =', await page.$$eval('.field-chip', (els) => els.map((e) => e.textContent.trim().split('\n')[0])));

  // 4. 添加维度（+ 指标，通过 add-icon 添加空槽再选择字段）
  const addIcons = () => page.$$('.add-icon');
  await (await addIcons())[0].click();   // 维度
  await sleep(400);
  log('6 维度槽已添加');
  const dimSelect = page.locator('.drop-zone >> nth=0').locator('.el-select').first();
  await pickSelect(page, dimSelect, 0);  // 月份

  await (await addIcons())[1].click();   // 指标
  await sleep(400);
  const metricZone = page.locator('.drop-zone >> nth=1');
  const metricSelect = metricZone.locator('.el-select').first();
  await metricSelect.click();
  await page.waitForSelector('.el-select-dropdown__item:visible', { timeout: 10000 });
  await sleep(200);
  await page.click('.el-select-dropdown__item:visible >> nth=2'); // 销售额
  await sleep(200);
  // 聚合方式（第二个下拉）默认 sum，保持
  log('7 维度=月份 指标=销售额');

  // 5. 等待预览
  await sleep(2500);
  const canvasCount = await page.$$('.preview-area canvas').then((els) => els.length);
  log('8 预览 canvas =', canvasCount);

  // 6. 保存图表
  await page.fill('input[placeholder="图表名称"]', '月度销售额柱状图');
  await page.click('text=保存图表');
  await page.waitForSelector('text=图表已保存', { timeout: 20000 });
  log('9 图表已保存');

  // 7. 创建看板
  await page.goto(BASE + '/dashboards', { waitUntil: 'networkidle' });
  await page.fill('input[placeholder="新看板名称"]', '销售概览');
  await page.click('text=新建看板');
  await page.waitForSelector('text=编辑中', { timeout: 20000 });
  log('10 看板编辑器打开');

  // 8a. 右侧图表库面板
  await page.waitForSelector('.chart-library-panel', { timeout: 10000 });
  const panelItems = await page.$$('.chart-palette-item').then((els) => els.length);
  log('10a 图表库面板 items =', panelItems);
  if (panelItems === 0) throw new Error('图表库面板为空');

  // 8. 拖入图表
  const palette = await page.$$('.chart-palette-item');
  if (palette.length === 0) throw new Error('图谱列表为空');
  // HTML5 拖拽用 dispatchEvent
  const src = palette[0];
  const box = await src.boundingBox();
  const gridBox = await page.locator('.grid-body').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(gridBox.x + gridBox.width / 2, gridBox.y + gridBox.height / 2, { steps: 20 });
  await page.mouse.up();
  await sleep(1500);
  const gridCount = await page.$$('.grid-item').then((els) => els.length);
  log('11 拖入后 grid-item =', gridCount);

  // 9. 添加筛选
  await page.click('text=添加筛选');
  await page.waitForSelector('.el-dialog', { timeout: 10000 });
  const dlgSelects = page.locator('.el-dialog .el-select');
  await pickSelect(page, dlgSelects.nth(0), 0); // 数据源
  await sleep(600); // 等字段加载
  await dlgSelects.nth(1).click();
  await page.waitForSelector('.el-select-dropdown__item:visible', { timeout: 10000 });
  await sleep(200);
  await page.click('.el-select-dropdown__item:visible >> nth=1'); // 区域
  await sleep(300);
  await page.fill('.el-dialog input[placeholder="例如：区域"]', '销售区域');
  await page.click('.el-dialog .el-button--primary'); // 确认添加
  await sleep(1500);
  log('12 筛选组件已添加');
  log('   DOM: grid-item =', await page.$$('.grid-item').then((els) => els.length));
  log('   DOM: filter-component =', await page.$$('.filter-component').then((els) => els.length));
  log('   DOM: filter-empty =', await page.$$('.filter-empty').then((els) => els.length));
  log('   DOM: filter select =', await page.$$('.filter-component .el-select').then((els) => els.length));
  log('   DOM: item-body canvas =', await page.$$('.item-body canvas').then((els) => els.length));
  log('   PAGE ERRORS SO FAR =', errors.length ? errors.join(' | ') : '无');

  // 9b. 空间移动：下移第一个组件（冲突自动让位）再还原
  const rowBefore = (await page.locator('.grid-item').nth(0).boundingBox()).y;
  await page.locator('.grid-item').nth(0).locator('.item-actions .act-btn').nth(1).click(); // ArrowDown
  await sleep(400);
  const rowAfter = (await page.locator('.grid-item').nth(0).boundingBox()).y;
  log('12b 下移前 top =', rowBefore.toFixed(0), '| 下移后 top =', rowAfter.toFixed(0));
  if (rowAfter <= rowBefore) throw new Error('空间移动未生效');
  await page.locator('.grid-item').nth(0).locator('.item-actions .act-btn').nth(0).click(); // ArrowUp 还原
  await sleep(400);
  const rowRestored = (await page.locator('.grid-item').nth(0).boundingBox()).y;
  if (rowRestored >= rowAfter) throw new Error('上移还原失败');

  // 9c. 拖拽到底部空白区：卡片应跟手落位到更下方
  const chartItem = page.locator('.grid-item').nth(0);
  const headerBox = await chartItem.locator('.item-header').boundingBox();
  const rootGridBox = await page.locator('.grid-body').first().boundingBox();
  const startRow = (await page.locator('.grid-item').nth(0).boundingBox()).y;
  await page.mouse.move(headerBox.x + headerBox.width / 2, headerBox.y + headerBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(rootGridBox.x + rootGridBox.width / 2, rootGridBox.y + rootGridBox.height - 30, { steps: 30 });
  await page.mouse.up();
  await sleep(600);
  const endRow = (await chartItem.boundingBox()).y;
  log('12c 拖到空白区：top', startRow.toFixed(0), '→', endRow.toFixed(0));
  if (endRow <= startRow) throw new Error('拖到空白区未落位');

  // 9d. 全板无重叠不变式
  const items = await page.$$('.grid-item');
  const boxes = [];
  for (const it of items) boxes.push(await it.boundingBox());
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]; const b = boxes[j];
      const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      if (overlap) throw new Error(`卡片重叠：no${i} 与 no${j}`);
    }
  }
  log('12d 无重叠 =', boxes.length, '张卡片');

  // 9e. 右缘/右下角缩放：选中卡片后拉伸右下角，宽度应增大
  await chartItem.click();
  await sleep(300);
  const wBefore = (await chartItem.boundingBox()).width;
  const seBox = await chartItem.locator('.resize-se').boundingBox();
  await page.mouse.move(seBox.x + seBox.width / 2, seBox.y + seBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(seBox.x + seBox.width / 2 + 130, seBox.y + seBox.height / 2 + 130, { steps: 15 });
  await page.mouse.up();
  await sleep(500);
  const wAfter = (await chartItem.boundingBox()).width;
  log('12e 缩放前宽 =', wBefore, '| 缩放后宽 =', wAfter);
  if (wAfter <= wBefore) throw new Error('边缘缩放未生效');

  // 9f. 添加容器并拖入子卡片（父子嵌套）
  await page.click('text=添加容器');
  await sleep(800);
  const containerBox = await page.locator('.grid-item--container').first().boundingBox();
  log('12f 容器已添加，body =', containerBox ? '有' : '无');
  if (!containerBox) throw new Error('添加容器未生效');
  await page.locator('.grid-item--container').first().click();
  await sleep(300);
  // 容器可能落在可视区外：直接派发与浏览器一致的原生 drop 事件（绕过 Playwright 视口限制）
  const chartRes = await page.evaluate(async () => (await fetch('/api/charts')).json());
  const dropChartId = chartRes.data[0].id;
  await page.evaluate(
    ({ chartId }) => {
      const body = document.querySelector('.grid-item--selected .grid-body');
      if (!body) throw new Error('目标容器 grid-body 不存在');
      const dt = new DataTransfer();
      dt.setData('text/plain', JSON.stringify({ type: 'chart', chartId }));
      body.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    },
    { chartId: dropChartId },
  );
  await sleep(1200);
  const nested = await page.locator('.grid-item--container .grid-item').count();
  log('12g 容器内子卡 =', nested);
  if (nested === 0) throw new Error('拖入容器失败');

  // 9h. 标题隐藏/恢复（第一个根卡片）
  const firstCard = page.locator('.grid-item').nth(0);
  await firstCard.click();
  await sleep(200);
  await firstCard.locator('.item-actions .act-btn').nth(4).click(); // Hide 标题
  await sleep(300);
  const hiddenHeader = await firstCard.locator('.item-header--min').count();
  const hiddenTitle = await firstCard.locator('.item-title').count();
  log('12h 隐藏标题：header-min =', hiddenHeader, '| title =', hiddenTitle);
  if (hiddenHeader !== 1 || hiddenTitle !== 0) throw new Error('隐藏标题未生效');
  await firstCard.locator('.item-header--min .item-actions .act-btn').nth(4).click(); // 恢复标题
  await sleep(300);
  const titleBack = await firstCard.locator('.item-title').count();
  if (titleBack !== 1) throw new Error('恢复标题失败');

  // 9i. 最小高度：设为 35px
  await firstCard.locator('.item-actions .act-btn').nth(3).click(); // 高度下拉
  await page.waitForSelector('.el-dropdown-menu__item:visible', { timeout: 10000 });
  await page.click('text=高 35px');
  await sleep(500);
  const hSmall = (await firstCard.boundingBox()).height;
  log('12i 最小高度 =', hSmall.toFixed(1), 'px');
  if (hSmall > 45) throw new Error('高度未被压缩到 ~35px');
  await firstCard.locator('.item-actions .act-btn').nth(3).click(); // 重新打开高度下拉
  await page.waitForSelector('.el-dropdown-menu__item:visible', { timeout: 10000 });
  await page.click('text=高 300px'); // 再拉回常用高度，避免矮卡影响后续
  await sleep(400);

  // 10. 触发筛选联动（选择区域=华东）
  const filterSel = page.locator('.filter-component .el-select').first();
  await pickSelect(page, filterSel, 0);  // 华东
  await sleep(2000);
  log('13 筛选已应用');

  // 11. 保存并查看
  await page.click('text=保存');
  await page.waitForSelector('text=看板已保存', { timeout: 20000 });
  const m = page.url().match(/dashboards\/(\d+)\/edit/);
  const dashId = m ? m[1] : null;
  log('14 看板已保存 id=', dashId);

  await page.goto(`${BASE}/dashboards/${dashId}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=预览模式', { timeout: 15000 });
  let viewCanvas = 0;
  for (let i = 0; i < 10; i++) {
    sleep(1000);
    viewCanvas = await page.$$('.grid-item canvas').then((els) => els.length);
    if (viewCanvas > 0) break;
  }
  log('15 看板预览 canvas =', viewCanvas);

  // 截图
  await page.screenshot({ path: 'scripts/e2e-dashboard.png', fullPage: true });
  log('16 截图已保存 scripts/e2e-dashboard.png');

  console.log('\n=== 页面错误 ===');
  console.log(errors.length ? errors.join('\n') : '无');

  await browser.close();
  if (errors.length) { process.exit(1); } else { log('SMOKE TEST PASSED'); }
})().catch((e) => {
  console.error('\n=== E2E FAILED ===');
  console.error(e.message);
  console.error('\n=== 页面错误 ===');
  console.error(errors.length ? errors.join('\n') : '无');
  process.exit(1);
});