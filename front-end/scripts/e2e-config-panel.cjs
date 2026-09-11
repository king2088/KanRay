/* ChartBuilder 显示配置 panel E2E: edits title/label/grid/yAxis via the right-side config panel,
   saves, and verifies the config round-trips into the stored chart and still renders. */
const { chromium } = require('playwright-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:5173';

function log(...args) { console.log('[cfg-e2e]', ...args); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
let failed = 0;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  const assert = (ok, name, extra = '') => {
    if (ok) { log(`PASS ${name}`); passed += 1; }
    else { log(`FAIL ${name} ${extra}`); failed += 1; }
  };

  // ---------- pick an editable bar chart ----------
  await page.goto(BASE + '/charts', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForSelector('.el-table', { timeout: 10000 });
  await page.locator('.el-pagination__sizes .el-select').click();
  await page.waitForSelector('.el-select-dropdown__item:visible', { timeout: 5000 });
  const opt50 = page.locator('.el-select-dropdown__item:visible').filter({ hasText: '50' });
  if (await opt50.count()) { await opt50.click(); await sleep(1200); }

  const meta = await page.evaluate(async () => {
    const charts = await (await fetch('/api/charts')).json();
    const ds = await (await fetch('/api/datasets')).json();
    const list = charts.data || [];
    const dsl = new Set((ds.data || []).map((d) => Number(d.id)));
    const bar = list.find((c) => c.chartType === 'bar' && dsl.has(Number(c.datasetId)));
    return { id: bar && bar.id, name: bar && bar.name };
  });
  if (!meta.id) { log('SKIP: no editable bar chart found'); process.exit(0); }
  log('target chart id =', meta.id);

  const row = page.locator('tr').filter({ has: page.locator('.cell-name').filter({ hasText: meta.name }) }).first();
  await row.locator('button', { hasText: '编辑' }).click();
  await page.waitForSelector('.chart-builder', { timeout: 10000 });
  await sleep(800);
  await page.waitForSelector('.chart-config-panel', { timeout: 10000 });

  // helpers scoped to config panel
  const grp = (label) => page.locator('.el-collapse-item')
    .filter({ has: page.locator('.el-collapse-item__header').filter({ hasText: label }) })
    .first();
  async function expand(label) {
    let g = grp(label);
    const content = g.locator('.el-collapse-item__content');
    let visible = await content.isVisible().catch(() => false);
    if (!visible) {
      await g.locator('.el-collapse-item__header').click();
      await content.waitFor({ state: 'visible', timeout: 5000 });
      await sleep(150);
    }
    return g;
  }
  function fieldRow(g, label) {
    return g.getByText(label, { exact: true })
      .first()
      .locator('xpath=ancestor::div[contains(@class,"field-row") or contains(@class,"row-field")][1]');
  }

  // ---------- 标题: text + 文字样式 (fontSize 18, bold) ----------
  const gTitle = await expand('标题');
  await fieldRow(gTitle, '标题文字').locator('input').fill('显示配置E2E标题');
  const titleFontSize = gTitle.locator('.inline-group .el-input-number input').first();
  await titleFontSize.fill('18');
  await titleFontSize.press('Enter');
  const bBtn = gTitle.locator('.inline-group .el-button', { hasText: 'B' }).first();
  const boldAlready = await bBtn.evaluate((el) => el.classList.contains('el-button--primary')).catch(() => false);
  if (!boldAlready) await bBtn.click();
  await sleep(200);

  // ---------- 数据标签: show + 字号 15 ----------
  const gLabel = await expand('数据标签');
  const showRow = fieldRow(gLabel, '显示');
  const sw = showRow.locator('.el-switch');
  const checked0 = await sw.evaluate((el) => el.classList.contains('is-checked')).catch(() => false);
  if (!checked0) await sw.click();
  await sleep(150);
  const labelFontSize = gLabel.locator('.inline-group .el-input-number input').first();
  await labelFontSize.fill('15');
  await labelFontSize.press('Enter');
  await sleep(200);

  // ---------- 绘图区域: 左边距 0 ----------
  const gGrid = await expand('绘图区域');
  const gridLeft = fieldRow(gGrid, '左边距').locator('.el-input-number input');
  await gridLeft.fill('0');
  await gridLeft.press('Enter');
  await sleep(200);

  // ---------- Y轴: 最小值 0 ----------
  const gY = await expand('Y轴');
  const yMin = fieldRow(gY, '最小值').locator('input');
  await yMin.fill('0');
  await yMin.press('Enter');
  await sleep(200);

  // ---------- Y轴: 单位 ----------
  const yUnit = fieldRow(gY, '单位').locator('input');
  await yUnit.fill('件');
  await yUnit.press('Enter');
  await sleep(200);

  // ---------- 图例: 形状 = 菱形 ----------
  const gLeg = await expand('图例');
  await fieldRow(gLeg, '形状').locator('.el-select').click();
  await page.waitForSelector('.el-select-dropdown__item:visible', { timeout: 5000 });
  await page.locator('.el-select-dropdown__item:visible').filter({ hasText: '菱形' }).first().click();
  await sleep(250);

  const legW = fieldRow(gLeg, '宽').locator('.el-input-number input');
  await legW.fill('30');
  await legW.press('Enter');
  await sleep(150);

  const legH = fieldRow(gLeg, '高').locator('.el-input-number input');
  await legH.fill('18');
  await legH.press('Enter');
  await sleep(250);

  // ---------- 缩略轴: 启用（幂等） ----------
  const gZoom = await expand('缩略轴');
  const zsw = fieldRow(gZoom, '启用').locator('.el-switch');
  const zoomOn = await zsw.evaluate((el) => el.classList.contains('is-checked')).catch(() => false);
  if (!zoomOn) await zsw.click();
  await sleep(200);

  // ---------- 提示框: 指示器类型 = 十字准星 ----------
  const gTip = await expand('提示框');
  await gTip.locator('.inline-group', { hasText: '指示器类型' }).locator('.el-select').click();
  await page.waitForSelector('.el-select-dropdown__item:visible', { timeout: 5000 });
  await page.locator('.el-select-dropdown__item:visible').filter({ hasText: '十字准星' }).first().click();
  await sleep(250);

  assert(pageErrors.length === 0, 'no page errors while editing', JSON.stringify(pageErrors));

  // live preview still renders while config changes are applied
  const canvasDuring = await page.locator('.preview-area .ec-chart canvas').count();
  assert(canvasDuring > 0, `preview canvas live after config edits (canvas=${canvasDuring})`);

  // ---------- save ----------
  await page.locator('.tb-right button', { hasText: '保存图表' }).click();
  await sleep(900);
  const msgOk = await page.locator('.el-message--success').count();
  assert(msgOk > 0 || await page.locator('.tb-right button').isEnabled().catch(() => true), 'save button responded', '');

  // ---------- back + verify stored config ----------
  await page.locator('.tb-left .el-button').first().click();
  await page.waitForURL(/\/charts$/, { timeout: 10000 });

  const saved = await page.evaluate(async (id) => {
    const charts = await (await fetch('/api/charts')).json();
    const c = (charts.data || []).find((x) => x.id === id);
    const o = (c && c.config && c.config.options) || {};
    return {
      titleText: o.title && o.title.text,
      titleFontSize: o.title && o.title.textStyle && o.title.textStyle.fontSize,
      titleWeight: o.title && o.title.textStyle && o.title.textStyle.fontWeight,
      labelShow: o.label && o.label.show,
      labelFontSize: o.label && (o.label.textStyle ? o.label.textStyle.fontSize : o.label.fontSize),
      gridLeft: o.grid && o.grid.left,
      yMin: o.yAxis && o.yAxis.min,
      yUnit: o.yAxis && o.yAxis.unit,
      legendIcon: o.legend && o.legend.icon,
      legendW: o.legend && o.legend.itemWidth,
      legendH: o.legend && o.legend.itemHeight,
      axisPtrType: o.tooltip && o.tooltip.axisPointer && o.tooltip.axisPointer.type,
      zoomShow: o.dataZoom && o.dataZoom.show,
    };
  }, meta.id);
  assert(saved.titleText === '显示配置E2E标题', 'saved title.text', JSON.stringify(saved.titleText));
  assert(Number(saved.titleFontSize) === 18, 'saved title.textStyle.fontSize', JSON.stringify(saved.titleFontSize));
  assert(saved.titleWeight === 'bold', 'saved title.textStyle.fontWeight', JSON.stringify(saved.titleWeight));
  assert(saved.labelShow === true, 'saved label.show', JSON.stringify(saved.labelShow));
  assert(Number(saved.labelFontSize) === 15, 'saved label.fontSize', JSON.stringify(saved.labelFontSize));
  assert(Number(saved.gridLeft) === 0, 'saved grid.left=0', JSON.stringify(saved.gridLeft));
  assert(Number(saved.yMin) === 0, 'saved yAxis.min=0', JSON.stringify(saved.yMin));
  assert(saved.yUnit === '件', 'saved yAxis.unit', JSON.stringify(saved.yUnit));
  assert(saved.legendIcon === 'diamond', 'saved legend.icon=diamond', JSON.stringify(saved.legendIcon));
  assert(Number(saved.legendW) === 30, 'saved legend.itemWidth=30', JSON.stringify(saved.legendW));
  assert(Number(saved.legendH) === 18, 'saved legend.itemHeight=18', JSON.stringify(saved.legendH));
  assert(saved.axisPtrType === 'cross', 'saved tooltip.axisPointer.type=cross', JSON.stringify(saved.axisPtrType));
  assert(saved.zoomShow === true, 'saved dataZoom.show', JSON.stringify(saved.zoomShow));

  // ---------- edited chart still renders from saved config ----------
  await page.goto(`${BASE}/charts/${meta.id}/edit`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForSelector('.chart-builder', { timeout: 15000 });
  await sleep(900);
  const canvas = await page.locator('.preview-area .ec-chart canvas').count();
  assert(canvas > 0, 'edited chart re-renders from saved config (canvas)', `canvas=${canvas}`);
  assert(pageErrors.length === 0, 'no page errors at end', JSON.stringify(pageErrors));
  await browser.close();
  log(`\nRESULT: passed=${passed} failed=${failed}`);
  process.exit(failed ? 1 : 0);
})();