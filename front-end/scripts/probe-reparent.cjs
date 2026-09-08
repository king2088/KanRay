const { chromium } = require('playwright-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => console.log('[console ' + m.type() + ']', m.text().slice(0, 300)));
  await page.goto(BASE + '/dashboards/20/edit', { waitUntil: 'networkidle' });
  await page.waitForSelector('.grid-item', { timeout: 15000 });
  await sleep(800);

  const dump = (tag) => page.evaluate((t) => {
    const root = [...document.querySelectorAll('.dash-canvas > .grid-board > .grid-body > .grid-item')];
    return {
      tag: t,
      rootCount: root.length,
      rootTitles: root.map((el) => el.querySelector('.item-title')?.textContent),
      containers: document.querySelectorAll('.grid-item--container').length,
      nested: document.querySelectorAll('.grid-item--container .grid-item').length,
      ghost: !!document.querySelector('.drag-ghost'),
    };
  }, tag);

  await page.click('text=添加容器');
  await sleep(900);
  const con = await page.$eval('.grid-item--container:last-of-type', (e) => {
    const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, top: r.top };
  });
  await page.evaluate((top) => {
    const s = document.querySelector('.dash-canvas');
    if (s) s.scrollTop = Math.max(0, top - 240);
  }, con.top);
  await sleep(300);
  const firstHeader = await page.evaluate(() => {
    const hs = [...document.querySelectorAll('.dash-canvas > .grid-board > .grid-body > .grid-item .item-header')];
    const h = hs.find((e) => {
      const r = e.getBoundingClientRect(); return r.y > 40 && r.y < 800;
    }) || hs[0];
    const r = h.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  const con2 = await page.$eval('.grid-item--container:last-of-type', (e) => {
    const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  console.log('起始点 =', JSON.stringify(firstHeader), '容器中心 =', JSON.stringify(con2));
  console.log(JSON.stringify(await dump('drag-before')));

  await page.mouse.move(firstHeader.x, firstHeader.y);
  await page.mouse.down();
  await sleep(150);
  await page.mouse.move(con2.x, con2.y, { steps: 15 });
  await sleep(300);
  console.log('悬停容器时 elementFromPoint =', await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    const board = el?.closest?.('[data-board]');
    return {
      tagName: el?.tagName, cls: el?.className?.toString().slice(0, 60),
      board: board?.getAttribute('data-board'),
      inContainer: !!board?.closest('.grid-item--container'),
    };
  }, [con2.x, con2.y]));
  console.log(JSON.stringify(await dump('drag-hover')));
  await page.mouse.up();
  await sleep(1200);
  console.log(JSON.stringify(await dump('drag-after')));
  await browser.close();
})().catch((e) => { console.error('PROBE ERROR', e); process.exit(1); });