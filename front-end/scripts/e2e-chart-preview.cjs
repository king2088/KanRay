/* ChartList preview smoke: opens preview for 10 known seeded charts, checks render (no error / correct element) */
const { chromium } = require('playwright-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:5173';

const TARGETS = [
  { id: 46, label: '地图', expect: 'echarts' },
  { id: 49, label: '热力图', expect: 'echarts' },
  { id: 51, label: '散点图', expect: 'echarts' },
  { id: 52, label: '气泡图', expect: 'echarts' },
  { id: 57, label: '雷达图', expect: 'echarts' },
  { id: 60, label: '气泡图', expect: 'echarts' },
  { id: 65, label: '散点图', expect: 'echarts' },
  { id: 71, label: '热力图', expect: 'echarts' },
  { id: 72, label: '进度条', expect: 'progress' },
  { id: 69, label: '指标卡', expect: 'stat' },
];

function log(...args) { console.log('[preview-e2e]', ...args); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
let failed = 0;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await page.goto(BASE + '/charts', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForSelector('.el-table', { timeout: 10000 });
  // Ensure full list (50/page)
  await page.locator('.el-pagination__sizes .el-select').click();
  await page.waitForSelector('.el-select-dropdown__item:visible', { timeout: 5000 });
  const opt50 = page.locator('.el-select-dropdown__item:visible').filter({ hasText: '50' });
  if (await opt50.count()) { await opt50.click(); await sleep(1500); }
  const cellCount = await page.locator('.cell-name').count();
  log('rows on page =', cellCount);
  if (cellCount < 20) { log('WARN: pagination size may not have applied'); }

  // id -> name mapping from API (names may contain special chars, match table rows by text)
  const charts = await page.evaluate(async () => {
    const res = await fetch('/api/charts');
    const body = await res.json();
    return body.data || [];
  });
  const nameById = new Map(charts.map((c) => [c.id, c.name]));

  for (const { id, label, expect: exp } of TARGETS) {
    pageErrors.length = 0;
    const name = nameById.get(id);
    const link = page.locator('.cell-name').filter({ hasText: name });
    if (await link.count() === 0) { log(`SKIP ${id} (${name}): row not found`); failed += 1; continue; }
    const row = page.locator('tr').filter({ has: link });
    await row.locator('button', { hasText: '预览' }).click();
    try {
      await page.waitForSelector('.el-dialog', { state: 'visible', timeout: 10000 });
      await sleep(800); // let echarts render / geojson fetch
      // Verify expected element
      let ok = false;
      if (exp === 'stat') ok = await page.locator('.el-dialog .ec-stat-tile').count() > 0;
      else if (exp === 'progress') ok = await page.locator('.el-dialog .ec-progress-tile').count() > 0;
      else {
        ok = await page.locator('.el-dialog .ec-chart').count() > 0;
        if (ok) ok = await page.locator('.el-dialog .ec-chart canvas').count() > 0;
      }

      const hasErr = pageErrors.some((m) => /chart构建失败|TypeError|Cannot read|unmounted|null/i.test(m));
      if (!ok || hasErr) throw new Error(`render check failed (ok=${ok}, errors=${JSON.stringify(pageErrors)})`);
      log(`PASS ${id} [${label}]`);
      passed += 1;
    } catch (e) {
      log(`FAIL ${id} [${label}] ${e.message}`);
      failed += 1;
    }
    // Close dialog
    await page.locator('.el-dialog__headerbtn').click().catch(() => {});
    await sleep(200);
  }

  await browser.close();
  log(`\nRESULT: passed=${passed} failed=${failed} total=${TARGETS.length}`);
  process.exit(failed ? 1 : 0);
})();
