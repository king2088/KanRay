import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Expectation note (Task 11 / M3.5): backend `npm test` = 133 pass; frontend `npm run build` = OK.
// CDP checks below should ALL PASS.

const PW_PATH = '/Users/tony/Workspace/kanban/front-end/node_modules/playwright-core/index.mjs'
const { chromium } = await import(pathToFileURL(PW_PATH).href)

const BASE = 'http://localhost:5173'
const API = 'http://127.0.0.1:3001/api'
const OUT = '/tmp/opencode/cdp-m3.5'
const ADMIN = { email: 'admin@kanban.local', password: 'admin123' }

fs.mkdirSync(OUT, { recursive: true })

const results = []
function record(name, ok, extra = '') {
  results.push({ name, ok, extra })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`)
}

async function runCase(name, fn) {
  try {
    await fn()
  } catch (e) {
    record(name, false, `error: ${e.message || e}`)
  }
}

async function launchBrowser() {
  const attempts = [
    { how: 'channel:chrome', fn: () => chromium.launch({ channel: 'chrome', headless: true }) },
    { how: 'default chromium.launch()', fn: () => chromium.launch({ headless: true }) },
  ]
  let lastErr
  for (const a of attempts) {
    try {
      const browser = await a.fn()
      console.log(`[launch] used ${a.how}`)
      return browser
    } catch (e) {
      lastErr = e
      console.warn(`[launch] ${a.how} failed: ${e.message}`)
    }
  }
  throw lastErr
}

let browser = null
let page = null

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await stripOverlay()
  await page.fill('input[placeholder="you@example.com"]', ADMIN.email)
  await page.fill('input[type="password"]', ADMIN.password)
  await page.click('button.auth-btn, button:has-text("登 录")')
  await page.waitForURL((url) => !new URL(url).pathname.startsWith('/login'), { timeout: 15000 })
}

async function getToken() {
  return page.evaluate(() => localStorage.getItem('kanban_access') || '')
}

async function stripOverlay() {
  return page.evaluate(() => document.querySelector('vite-error-overlay')?.remove())
}

async function pageErrorNote() {
  return page.evaluate(() => (window.__pageErrors || []).join('; ')).catch(() => '')
}

async function api(token, p, opts = {}) {
  const headers = { Authorization: `Bearer ${token}` }
  if (opts.body) headers['Content-Type'] = 'application/json'
  const res = await fetch(API + p, { ...opts, headers })
  let body = null
  try {
    body = await res.json()
  } catch (e) {
    body = null
  }
  return { status: res.status, body }
}

async function makeBuilderDataset(name, definition) {
  const token = await getToken()
  const res = await api(token, `/datasources/1/build/save`, {
    method: 'POST',
    body: JSON.stringify({ name, definition }),
  })
  if (res.status === 401) {
    const t2 = await getToken()
    const retry = await api(t2, `/datasources/1/build/save`, {
      method: 'POST',
      body: JSON.stringify({ name, definition }),
    })
    if (retry.status === 401) throw new Error('token refresh still 401')
    res.body = retry.body
    res.status = retry.status
  }
  if (res.body && res.body.data && res.body.data.id) return res.body.data.id
  const flat = res.body && res.body.data ? res.body.data : res.body
  const id = flat ? flat.id : null
  if (id) return id
  throw new Error('build save failed: ' + JSON.stringify(res.body))
}

const cases = [
  { type: 'sql', tabName: '纯 SQL', def: { type: 'sql', sql: 'SELECT 1' } },
  { type: 'builder', tabName: '拖拉拽', def: { type: 'builder', tables: [{ alias: 't0', schema: 'testdb', table: 'sales' }], joins: [], fields: [{ source: 't0', field: 'amount', label: '金额', type: 'number' }], aggregation: null, limit: 100 } },
  { type: 'etl', tabName: 'ETL', def: { type: 'etl', nodes: [{ nodeId: 'n1', nodeType: 'source', alias: 't0', schema: 'testdb', table: 'sales' }, { nodeId: 'n2', nodeType: 'output', sourceNode: 'n1', limit: 100 }] } },
]

let fatal = false
try {
  browser = await launchBrowser()
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on('pageerror', (e) => {
    void page.evaluate((s) => { window.__pageErrors = (window.__pageErrors || []).concat(s) }, String(e)).catch(() => {})
  })

  // login + capture token
  await login(page)
  const tok = await getToken()
  if (!tok) throw new Error('no access token after login')

  // ---- 0. bootstrap datasource id=1 (the FIRST record-able check) ----
  await runCase('bootstrap datasource id=1 (mysql / live testdb)', async () => {
    const list = await api(tok, '/datasources')
    let ds1 = (list.body.data || []).find((d) => d.id === 1)
    if (ds1 && ds1.type !== 'mysql') {
      await api(tok, '/datasources/1', { method: 'DELETE' })
      ds1 = null
    }
    if (!ds1) {
      const created = await api(tok, '/datasources', {
        method: 'POST',
        body: JSON.stringify({ name: 'M3.5 MySQL', type: 'mysql', config: { host: '127.0.0.1', port: 13306, database: 'testdb', user: 'root', password: 'Kanban@123' } }),
      })
      ds1 = created.body.data
    }
    const ok = !!ds1 && ds1.id === 1 && ds1.type === 'mysql'
    record('bootstrap datasource id=1 (mysql / live testdb)', ok, ok ? `id=${ds1.id} type=${ds1.type}` : `got id=${ds1 && ds1.id} type=${ds1 && ds1.type}`)
    if (!ok) fatal = true
  })
  if (fatal) throw new Error('datasource bootstrap failed')

  // ---- 1. tab auto-mapping for three definition shapes ----
  for (const c of cases) {
    await runCase(`tab-map ${c.type} → ${c.tabName}`, async () => {
      const dsId = await makeBuilderDataset(`m35-${c.type}-${Date.now()}`, c.def)
      await page.goto(`${BASE}/datasources/1/builder?editDatasetId=${dsId}`)
      await stripOverlay()
      await page.waitForSelector('.el-tabs__item.is-active', { timeout: 10000 })
      const matched = await page
        .waitForFunction(
          (tab) => (document.querySelector('.el-tabs__item.is-active')?.innerText || '').includes(tab),
          c.tabName,
          { timeout: 10000 }
        )
        .then(() => true)
        .catch(() => false)
      await page.waitForSelector('.builder-page', { timeout: 8000 })
      const active = (await page.locator('.el-tabs__item.is-active').first().innerText().catch(() => '')) || ''
      const pErr = await pageErrorNote()
      record(`tab-map ${c.type} → ${c.tabName}`, matched, `active=${active.trim()}${pErr ? ` pageErrors=${pErr}` : ''}`)
      if (c.type === 'sql') {
        const cmVisible = await page
          .locator('.cm-editor')
          .first()
          .waitFor({ state: 'visible', timeout: 10000 })
          .then(() => true)
          .catch(() => false)
        let contentOk = false
        if (cmVisible) {
          contentOk = await page
            .waitForFunction(
              (sql) => {
                const el = document.querySelector('.cm-content') || document.querySelector('.cm-editor')
                if (!el) return false
                const txt = (el.innerText || el.textContent || '').replace(/\s+/g, ' ')
                return txt.includes(sql)
              },
              c.def.sql,
              { timeout: 10000 }
            )
            .then(() => true)
            .catch(() => false)
        }
        record('sql tab renders CodeMirror', cmVisible && contentOk, cmVisible ? `loaded-sql=${contentOk} sql=${c.def.sql}` : 'no .cm-editor')
      }
    })
  }

  // ---- 2. SQL dark / light screenshots ----
  await runCase('screenshots sql-dark.png + sql-light.png', async () => {
    const dsId = await makeBuilderDataset(`m35-sql-${Date.now()}`, { type: 'sql', sql: 'SELECT * FROM testdb.sales LIMIT 5' })
    await page.goto(`${BASE}/datasources/1/builder?editDatasetId=${dsId}`)
    await stripOverlay()
    await page.waitForSelector('.el-tabs__item.is-active', { timeout: 10000 })
    await page.waitForTimeout(800)
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(OUT, 'sql-dark.png') })
    await page.evaluate(() => document.documentElement.classList.remove('dark'))
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(OUT, 'sql-light.png') })
    const dSize = fs.existsSync(path.join(OUT, 'sql-dark.png')) ? fs.statSync(path.join(OUT, 'sql-dark.png')).size : 0
    const lSize = fs.existsSync(path.join(OUT, 'sql-light.png')) ? fs.statSync(path.join(OUT, 'sql-light.png')).size : 0
    record('screenshots sql-dark.png + sql-light.png', dSize > 0 && lSize > 0, `dark=${dSize}B light=${lSize}B`)
  })

  // ---- 3. ETL canvas (Vue Flow + custom node cards) ----
  await runCase('etl canvas: Vue Flow present', async () => {
    const dsId = await makeBuilderDataset(`m35-etl-${Date.now()}`, cases[2].def)
    await page.goto(`${BASE}/datasources/1/builder?editDatasetId=${dsId}`)
    await stripOverlay()
    await page.waitForSelector('.vue-flow', { timeout: 10000 })
    record('etl canvas: Vue Flow present', true)
    const count = await page.locator('.etl-node-card').count().catch(() => 0)
    record('etl canvas: custom nodes >= 2', count >= 2, `nodes=${count}`)
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(OUT, 'etl-light.png') })
    const eSize = fs.existsSync(path.join(OUT, 'etl-light.png')) ? fs.statSync(path.join(OUT, 'etl-light.png')).size : 0
    record('screenshot etl-light.png', eSize > 0, `size=${eSize}B`)
  })

  // ---- 10. drag builder: tables-only left tree + drop table into mid canvas ----
  await runCase('drag builder: nav list → detail → builder → drag tab', async () => {
    await page.goto(`${BASE}/datasources`)
    await stripOverlay()
    await page.waitForSelector('.el-table__row', { timeout: 10000 })
    const dsList = await api(tok, '/datasources')
    const ds = (dsList.body.data || []).find((x) => x.id === 1)
    if (!ds) throw new Error('datasource id=1 missing from list')
    const dsNameRe = new RegExp('^' + ds.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$')
    await page.locator('.cell-name .el-link').filter({ hasText: dsNameRe }).click()
    await page.waitForURL((url) => /\/datasources\/1$/.test(new URL(url).pathname), { timeout: 10000 })
    await page.getByRole('button', { name: '新建构建' }).first().click()
    await page.waitForURL((url) => /\/datasources\/1\/builder/.test(new URL(url).pathname), { timeout: 10000 })
    await page.waitForSelector('.builder-page', { timeout: 10000 })
    await page.locator('.el-tabs__item', { hasText: '拖拉拽' }).click()
    await page.locator('.schema-tree__node').first().waitFor({ state: 'visible', timeout: 10000 })
    record('drag builder: nav list → detail → builder → drag tab', true, 'path=' + new URL(page.url()).pathname)
  })

  await runCase('drag builder: tables-only left tree (showFields=false)', async () => {
    const salesNode = page.locator('.schema-tree__node').filter({ has: page.getByText('sales', { exact: true }) }).first()
    const salesVisible = await salesNode.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false)
    const openBtns = await page.locator('.schema-tree__actions .el-button', { hasText: '打开' }).count()
    const insertBtns = await page.locator('.schema-tree__actions .el-button', { hasText: '插入' }).count()
    const ok = salesVisible && openBtns === 0 && insertBtns === 0
    record('drag builder: tables-only left tree (showFields=false)', ok, `sales=${salesVisible} 打开=${openBtns} 插入=${insertBtns}`)
    if (!ok) throw new Error('left tree should show tables only')
  })

  await runCase('drag builder: drop sales into mid renders field-card + screenshot', async () => {
    const salesNode = page.locator('.schema-tree__node').filter({ has: page.getByText('sales', { exact: true }) }).first()
    await salesNode.scrollIntoViewIfNeeded()
    const dispatched = await page.evaluate(() => {
      const node = Array.from(document.querySelectorAll('.schema-tree__node')).find((el) => el.getAttribute('draggable') === 'true' && el.querySelector('.schema-tree__label')?.textContent === 'sales')
      const mid = document.querySelector('.drag-builder__mid')
      if (!node || !mid) return 'missing-node-or-mid'
      const dt = new DataTransfer()
      node.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
      mid.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }))
      mid.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
      mid.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
      return 'dispatched'
    })
    if (dispatched !== 'dispatched') throw new Error(`dispatch failed: ${dispatched}`)
    const card = page.locator('.drag-builder__mid .field-card:has-text("testdb.sales")')
    const cardCount = await card.waitFor({ state: 'visible', timeout: 10000 }).then(() => card.count()).catch(() => 0)
    const pErr = await pageErrorNote()
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(OUT, 'drag-drop-in-mid.png') })
    const shot = fs.existsSync(path.join(OUT, 'drag-drop-in-mid.png')) ? fs.statSync(path.join(OUT, 'drag-drop-in-mid.png')).size : 0
    const ok = cardCount >= 1 && !pErr && shot > 0
    record('drag builder: drop sales into mid renders field-card', ok, `cards=${cardCount}${pErr ? ` pageErrors=${pErr}` : ''} shot=${shot}B`)
    if (!ok) throw new Error('field-card did not render after drop')
  })
} catch (e) {
  console.error(`[fatal] ${e.message || e}`)
  fatal = true
} finally {
  if (browser) {
    try {
      await browser.close()
    } catch (e) {
      /* ignore */
    }
  }
}

const failed = results.filter((r) => !r.ok).length
console.log('\n' + (fatal ? 'FATAL' : failed ? `FAILED: ${failed}` : 'ALL CDP CHECKS PASSED'))
process.exit(fatal || failed ? 1 : 0)