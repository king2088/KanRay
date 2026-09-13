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
  await page.fill('input[placeholder="you@example.com"]', ADMIN.email)
  await page.fill('input[type="password"]', ADMIN.password)
  await page.click('button.auth-btn, button:has-text("登 录")')
  await page.waitForURL((url) => !new URL(url).pathname.startsWith('/login'), { timeout: 15000 })
}

async function getToken() {
  return page.evaluate(() => localStorage.getItem('kanban_access') || '')
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

  // ---- 1. tab auto-mapping for three definition shapes ----
  for (const c of cases) {
    await runCase(`tab-map ${c.type} → ${c.tabName}`, async () => {
      const dsId = await makeBuilderDataset(`m35-${c.type}-${Date.now()}`, c.def)
      await page.goto(`${BASE}/datasources/1/builder?editDatasetId=${dsId}`)
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
      record(`tab-map ${c.type} → ${c.tabName}`, matched, `active=${active.trim()}`)
    })
  }

  // ---- 2. SQL dark / light screenshots ----
  await runCase('screenshots sql-dark.png + sql-light.png', async () => {
    const dsId = await makeBuilderDataset(`m35-sql-${Date.now()}`, { type: 'sql', sql: 'SELECT * FROM testdb.sales LIMIT 5' })
    await page.goto(`${BASE}/datasources/1/builder?editDatasetId=${dsId}`)
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
    await page.waitForSelector('.vue-flow', { timeout: 10000 })
    record('etl canvas: Vue Flow present', true)
    const count = await page.locator('.etl-node-card').count().catch(() => 0)
    record('etl canvas: custom nodes >= 2', count >= 2, `nodes=${count}`)
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(OUT, 'etl-light.png') })
    const eSize = fs.existsSync(path.join(OUT, 'etl-light.png')) ? fs.statSync(path.join(OUT, 'etl-light.png')).size : 0
    record('screenshot etl-light.png', eSize > 0, `size=${eSize}B`)
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