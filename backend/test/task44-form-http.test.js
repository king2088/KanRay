// T6：表单填报表单 全链路（RBAC 创建/发布/内部提交/分享匿名提交/提交管理）
process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { resetDb } = require('./helpers/db');
const authService = require('../src/services/auth.service');
const app = require('../src/app');

function listen() {
  const server = http.createServer(app);
  return new Promise((r) => server.listen(0, () => r(server)));
}
function req(server, { method = 'GET', path, headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const h = { ...headers };
    if (payload) {
      h['Content-Type'] = 'application/json';
      h['Content-Length'] = payload.length;
    }
    const r = http.request({ method, path, host: '127.0.0.1', port: server.address().port, headers: h }, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(chunks); } catch { /* ignore */ }
        resolve({ status: res.statusCode, body: parsed, raw: chunks });
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

const SCHEMA = {
  version: 1,
  fields: [
    { key: 'name', label: '姓名', type: 'text', required: true, span: 1 },
    { key: 'score', label: '评分', type: 'number', span: 1 },
    { key: 'city', label: '城市', type: 'select', span: 1, options: [{ label: '北京', value: 'bj' }, { label: '上海', value: 'sh' }] },
    { key: 'hobby', label: '爱好', type: 'checkbox', span: 1, options: [{ label: '阅读', value: 'read' }, { label: '运动', value: 'sport' }] },
    { key: 'note', label: '说明', type: 'static', content: '请如实填写', span: 2 },
  ],
};

let server, adminToken, viewerToken, editorToken, createdId;

async function login(email, password) {
  return (await authService.login(email, password)).accessToken;
}

test.before(async () => {
  await resetDb();
  adminToken = await login('admin@kanray.local', 'admin123');
  const editor = await authService.register({ email: 'ed@x.com', password: 'Password123!', name: 'Ed', roleCode: 'editor' });
  editorToken = editor.accessToken || (await authService.login('ed@x.com', 'Password123!')).accessToken;
  const viewer = await authService.register({ email: 'vw@x.com', password: 'Password123!', name: 'Vw', roleCode: 'viewer' });
  viewerToken = viewer.accessToken || (await authService.login('vw@x.com', 'Password123!')).accessToken;
  server = await listen();
});
test.after(() => server.close());

const hdr = (t, extra = {}) => ({ authorization: `Bearer ${t}`, ...extra });

test('RBAC：viewer 不能创建表单，editor 可以', async () => {
  let r = await req(server, { method: 'POST', path: '/api/forms', headers: hdr(viewerToken), body: { name: 'V表单' } });
  assert.equal(r.status, 403);
  r = await req(server, { method: 'POST', path: '/api/forms', headers: hdr(adminToken), body: { name: 'V表单', description: 'desc' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.status, 'draft');
  createdId = r.body.data.id;
  assert.equal(r.body.data.name, 'V表单');
});

test('列表：管理员看全部表单，editor 仅本人，viewer 无自建则空', async () => {
  const editorOwned = await req(server, { method: 'POST', path: '/api/forms', headers: hdr(editorToken), body: { name: 'E表单' } });
  assert.equal(editorOwned.status, 200, editorOwned.raw);

  let r = await req(server, { path: '/api/forms', headers: hdr(adminToken) });
  assert.equal(r.status, 200);
  const adminNames = r.body.data.map((f) => f.name);
  assert.ok(adminNames.includes('V表单'), 'admin 应看到自己创建的表单');
  assert.ok(adminNames.includes('E表单'), 'admin 应看到他人创建的表单');

  r = await req(server, { path: '/api/forms', headers: hdr(editorToken) });
  assert.equal(r.status, 200);
  const editorNames = r.body.data.map((f) => f.name);
  assert.ok(editorNames.includes('E表单'), 'editor 应看到自己的表单');
  assert.ok(!editorNames.includes('V表单'), 'editor 不应看到他人表单');

  r = await req(server, { path: '/api/forms', headers: hdr(viewerToken) });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.data, [], 'viewer 无自建表单应为空列表');
});

test('保存 schema 前后行为', async () => {
  let r = await req(server, { method: 'PATCH', path: `/api/forms/${createdId}`, headers: hdr(adminToken), body: { schemaJson: SCHEMA, submitConfig: { allowRepeat: false } } });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.schema.fields.length, 5);
  // 非法 key 被拒
  r = await req(server, { method: 'PATCH', path: `/api/forms/${createdId}`, headers: hdr(adminToken), body: { schemaJson: { ...SCHEMA, fields: [{ key: 'bad.key', label: 'x', type: 'text' }] } } });
  assert.equal(r.status, 400);
});

test('发布：建表并注册数据集', async () => {
  const r = await req(server, { method: 'POST', path: `/api/forms/${createdId}/publish`, headers: hdr(adminToken) });
  assert.equal(r.status, 200, r.raw);
  assert.match(r.body.data.tableName, /^ds_/);
  assert.ok(r.body.data.datasetId > 0);
  assert.equal(r.body.data.status, 'published');
});

test('未发布/未授权表单对象越权：editor 无法管理他人表单', async () => {
  const r = await req(server, { method: 'POST', path: `/api/forms/${createdId}/publish`, headers: hdr(editorToken) });
  assert.equal(r.status, 403);
});

test('viewer 可内部提交（allowRepeat=false 限一次）', async () => {
  const body = { values: { name: '小王', score: 88, city: 'bj', hobby: ['read'] } };
  let r = await req(server, { method: 'POST', path: `/api/forms/${createdId}/submissions`, headers: hdr(viewerToken), body });
  assert.equal(r.status, 200, r.raw);
  assert.equal(r.body.data.id, 1);
  r = await req(server, { method: 'POST', path: `/api/forms/${createdId}/submissions`, headers: hdr(viewerToken), body: { values: { name: '二次', city: 'sh' } } });
  assert.equal(r.status, 400);
  assert.match(r.body.message, /仅可提交一次/);
});

test('viewer 不能查看他人全部提交，只能看自己的；admin 看全部', async () => {
  let r = await req(server, { path: `/api/forms/${createdId}/submissions`, headers: hdr(viewerToken) });
  assert.equal(r.status, 403);
  r = await req(server, { path: `/api/forms/${createdId}/submissions?mine=1`, headers: hdr(viewerToken) });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.length, 1);
  assert.equal(r.body.data[0].name, '小王');
  r = await req(server, { path: `/api/forms/${createdId}/submissions`, headers: hdr(adminToken) });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.length, 1);
  assert.equal(r.body.data[0].submitterEmail, 'vw@x.com');
});

test('分享：创建(带密码) -> 密码错误 401 -> verify 拿 accessToken -> 公开布局 + 匿名提交', async () => {
  let r = await req(server, { method: 'POST', path: `/api/forms/${createdId}/shares`, headers: hdr(adminToken), body: { password: 'abcd1234' } });
  assert.equal(r.status, 200, r.raw);
  const { token, id: shareId } = r.body.data;
  assert.ok(token);
  assert.equal(r.body.data.hasPassword, true);

  r = await req(server, { path: `/api/public/forms/${token}/meta` });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.found, true);
  assert.equal(r.body.data.requiresPassword, true);

  r = await req(server, { method: 'POST', path: `/api/public/forms/${token}/verify`, body: { password: 'wrong!' } });
  assert.equal(r.status, 401);

  r = await req(server, { method: 'POST', path: `/api/public/forms/${token}/verify`, body: { password: 'abcd1234' } });
  assert.equal(r.status, 200, r.raw);
  const accessToken = r.body.data.accessToken;
  assert.ok(accessToken);

  r = await req(server, { path: `/api/public/forms/${token}/form`, headers: hdr(accessToken) });
  assert.equal(r.status, 200, r.raw);
  assert.equal(r.body.data.form.schema.fields.length, 5);
  assert.ok(!('tableName' in r.body.data.form));
  assert.ok(!('passwordHash' in r.body.data.share), '公开接口不得泄漏密码 hash');
  assert.ok(!('password_hash' in r.body.data.share));

  r = await req(server, { method: 'POST', path: `/api/public/forms/${token}/submissions`, headers: hdr(accessToken), body: { values: { name: '匿名者', city: 'sh' } } });
  assert.equal(r.status, 200, r.raw);
  assert.equal(r.body.data.id, 2);

  // 匿名提交不受 allowRepeat=false 限制（第 3 次）
  r = await req(server, { method: 'POST', path: `/api/public/forms/${token}/submissions`, headers: hdr(accessToken), body: { values: { name: '匿名者2', city: 'bj' } } });
  assert.equal(r.status, 200, r.raw);

  // 删除分享
  r = await req(server, { method: 'DELETE', path: `/api/forms/${createdId}/shares/${shareId}`, headers: hdr(adminToken) });
  assert.equal(r.status, 200);
});

test('分享：公开创建(password null) 成功；PATCH 布尔切换与清空密码；列表与公开响应不含密码 hash', async () => {
  // 公开分享创建（前端关掉密码开关时的真实入参）
  let r = await req(server, { method: 'POST', path: `/api/forms/${createdId}/shares`, headers: hdr(adminToken), body: { password: null, expiresAt: null } });
  assert.equal(r.status, 200, r.raw);
  const pub = r.body.data;
  assert.equal(pub.hasPassword, false);
  assert.ok(!('passwordHash' in pub) && !('password_hash' in pub), '创建响应不得含密码 hash');

  // 公开分享免密 verify 直接发 token；/form 可读且脱敏
  r = await req(server, { method: 'POST', path: `/api/public/forms/${pub.token}/verify`, body: {} });
  assert.equal(r.status, 200, r.raw);
  const at = r.body.data.accessToken;
  r = await req(server, { path: `/api/public/forms/${pub.token}/form`, headers: hdr(at) });
  assert.equal(r.status, 200, r.raw);
  assert.ok(!('passwordHash' in r.body.data.share) && !('password_hash' in r.body.data.share));

  // PATCH：布尔 isActive 切换 + password:null 清密
  r = await req(server, { method: 'PATCH', path: `/api/forms/${createdId}/shares/${pub.id}`, headers: hdr(adminToken), body: { isActive: false } });
  assert.equal(r.status, 200, r.raw);
  assert.equal(r.body.data.isActive, 0);
  r = await req(server, { method: 'PATCH', path: `/api/forms/${createdId}/shares/${pub.id}`, headers: hdr(adminToken), body: { password: null, isActive: true } });
  assert.equal(r.status, 200, r.raw);
  assert.equal(r.body.data.hasPassword, false);

  // 管理列表整体脱敏
  r = await req(server, { path: `/api/forms/${createdId}/shares`, headers: hdr(adminToken) });
  assert.equal(r.status, 200);
  assert.ok(r.body.data.length >= 1);
  for (const s of r.body.data) {
    assert.ok(!('passwordHash' in s) && !('password_hash' in s), '列表不得泄漏密码 hash');
    assert.equal(typeof s.hasPassword, 'boolean');
  }
});

test('提交记录可编辑/删除（admin）；删除后行数回减', async () => {
  let r = await req(server, { method: 'PATCH', path: `/api/forms/${createdId}/submissions/1`, headers: hdr(adminToken), body: { values: { score: 99 } } });
  assert.equal(r.status, 200, r.raw);
  r = await req(server, { path: `/api/forms/${createdId}/submissions`, headers: hdr(adminToken) });
  const one = r.body.data.find((x) => x.id === 1);
  assert.equal(one.score, 99);
  r = await req(server, { method: 'DELETE', path: `/api/forms/${createdId}/submissions/1`, headers: hdr(adminToken) });
  assert.equal(r.status, 200);
  r = await req(server, { path: `/api/forms/${createdId}/submissions`, headers: hdr(adminToken) });
  assert.equal(r.body.data.length, 2);
});

test('关闭后拒绝提交；删除表单级联清理', async () => {
  let r = await req(server, { method: 'POST', path: `/api/forms/${createdId}/close`, headers: hdr(adminToken) });
  assert.equal(r.status, 200);
  r = await req(server, { method: 'POST', path: `/api/forms/${createdId}/submissions`, headers: hdr(adminToken), body: { values: { name: 'x', city: 'bj' } } });
  assert.equal(r.status, 400);
  assert.match(r.body.message, /已关闭/);
  r = await req(server, { method: 'DELETE', path: `/api/forms/${createdId}`, headers: hdr(adminToken) });
  assert.equal(r.status, 200);
  r = await req(server, { path: `/api/forms/${createdId}`, headers: hdr(adminToken) });
  assert.equal(r.status, 404);
});