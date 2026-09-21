/* M1 越权回归 E2E（CDP）：
   1. 注册 viewer（rbacviewer@x.com / Password123!，幂等）
   2. viewer 登录 → /dashboards 仅见其 owner（空）
   3. viewer GET /api/admin/users → 403
   4. viewer POST /api/charts → 403
   5. UI：viewer 打开 /admin/users → 403 提示 & 无表格（空态兜底）
   6. 管理员登录 → GET /api/charts 全量、GET /api/admin/users 200
   输出 PASSED 则全部通过。 */
const { chromium } = require('playwright-core');

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://localhost:5173';
const API = process.env.API || 'http://localhost:3001';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(...args) { console.log('[rbac-e2e]', ...args); }
let passed = 0;
let failed = 0;
const assert = (ok, name, extra = '') => {
  if (ok) { passed += 1; log('PASS', name); } else { failed += 1; log('FAIL', name, extra); }
};

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const r = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null;
  try { json = await r.json(); } catch (e) { /* ignore */ }
  return { status: r.status, json };
}

async function login(email, password) {
  const r = await api('/api/auth/login', { method: 'POST', body: { email, password } });
  return r.json && r.json.data;
}

(async () => {
  const VIEWER_EMAIL = 'rbacviewer@x.com';
  const VIEWER_PW = 'Password123!';

  // 1. 注册 viewer（幂等：已存在则跳过）
  const reg = await api('/api/auth/register', { method: 'POST', body: { email: VIEWER_EMAIL, password: VIEWER_PW, name: 'RBAC查看者' } });
  assert(reg.status === 200 || reg.status === 409 || (reg.json && /已/.test(reg.json.message || '')), '注册 viewer（或已存在幂等）', `status=${reg.status}`);

  // 2. viewer 登录 → owner 看板为空
  const viewer = await login(VIEWER_EMAIL, VIEWER_PW);
  assert(viewer && viewer.accessToken, 'viewer 登录成功');
  const myDash = await api('/api/dashboards', { token: viewer.accessToken });
  assert(myDash.status === 200 && myDash.json.code === 0, 'viewer GET /api/dashboards 200');
  assert(Array.isArray(myDash.json.data) && myDash.json.data.length === 0, 'viewer 仅见 owner 看板（空）', `n=${myDash.json.data && myDash.json.data.length}`);

  // 3. viewer 越权访问 /api/admin/users → 403
  const admUsers = await api('/api/admin/users', { token: viewer.accessToken });
  assert(admUsers.status === 403, 'viewer GET /api/admin/users 403', `got=${admUsers.status}`);

  // 4. viewer 越权写 /api/charts → 403
  const mkChart = await api('/api/charts', { method: 'POST', token: viewer.accessToken, body: {} });
  assert(mkChart.status === 403, 'viewer POST /api/charts 403', `got=${mkChart.status}`);

  // 6. 管理员登录 → 全量数据 + 管理接口 200
  const admin = await login('admin@kanray.local', 'admin123');
  assert(admin && admin.accessToken, '管理员登录成功');
  const allCharts = await api('/api/charts', { token: admin.accessToken });
  assert(allCharts.status === 200 && allCharts.json.code === 0 && allCharts.json.data.length > 0, '管理员 GET /api/charts 全量', `n=${allCharts.json.data && allCharts.json.data.length}`);
  const admUsersOk = await api('/api/admin/users', { token: admin.accessToken });
  assert(admUsersOk.status === 200 && admUsersOk.json.code === 0, '管理员 GET /api/admin/users 200', `status=${admUsersOk.status}`);

  // 5. UI：viewer 打开 /dashboards（空）与 /admin/users（403 提示 & 无表格）
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(([t, r, u]) => {
    localStorage.setItem('kanban_access', t);
    localStorage.setItem('kanban_refresh', r || '');
    localStorage.setItem('kanban_user', JSON.stringify(u));
  }, [viewer.accessToken, viewer.refreshToken || '', viewer.user]);
  const page = await context.newPage();

  await page.goto(BASE + '/dashboards', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForSelector('.el-table', { timeout: 10000 });
  await sleep(800);
  const dashRows = await page.locator('.el-table__body tr').count();
  assert(dashRows === 0, 'viewer /dashboards 表格无行（owner 隔离）', `rows=${dashRows}`);
  const sideAdmin = await page.locator('.el-sub-menu__title').filter({ hasText: '系统管理' }).count();
  assert(sideAdmin === 0, 'viewer 侧栏无 系统管理', `n=${sideAdmin}`);

  await page.goto(BASE + '/admin/users', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await sleep(1000);
  const errToast = await page.locator('.el-message--error').count();
  const adminTable = await page.locator('.admin-page .el-table').count();
  const emptyState = await page.locator('.el-empty__description').filter({ hasText: '无权限访问该页面' }).count();
  assert(errToast > 0, 'viewer /admin/users 弹出 403 提示', `toast=${errToast}`);
  assert(adminTable === 0, 'viewer /admin/users 无表格', `table=${adminTable}`);
  assert(emptyState === 1, 'viewer /admin/users 显示无权限空态', `empty=${emptyState}`);

  await browser.close();

  log(failed === 0 ? 'PASSED' : 'FAILED', `passed=${passed} failed=${failed}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });