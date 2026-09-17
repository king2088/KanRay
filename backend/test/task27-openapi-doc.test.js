// T8：Swagger spec（/api/open/v1/openapi.json + /api/open/docs）+ README 权限点数
process.env.DB_PATH = `/tmp/kanban-test-openapi-doc-${process.pid}.db`;
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { resetDb } = require('./helpers/db');
const app = require('../src/app');
const fs = require('fs');
const path = require('path');

function listen() {
  const server = http.createServer(app);
  return new Promise((r) => server.listen(0, () => r(server)));
}
function GET(server, path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ method: 'GET', path, host: '127.0.0.1', port: server.address().port }, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(chunks); } catch { /* ignore */ }
        resolve({ status: res.statusCode, body: parsed, raw: chunks });
      });
    });
    req.on('error', reject); req.end();
  });
}
let server;
test.before(async () => { await resetDb(); server = await listen(); });
test.after(() => server.close());

test('openapi.json 公开返回 3.0 spec，含授权鉴权与六端点', async () => {
  const r = await GET(server, '/api/open/v1/openapi.json');
  assert.equal(r.status, 200);
  const spec = r.body;
  assert.equal(spec.openapi, '3.0.0');
  assert.ok(spec.components.securitySchemes.bearerAuth, '应有 bearerAuth 安全方案');
  const paths = Object.keys(spec.paths || {});
  const expect = ['/charts', '/datasets', '/dashboards', '/charts/{id}/data', '/datasets/{id}/aggregate', '/dashboards/{id}/export'];
  assert.deepEqual(paths.sort(), [...expect].sort(), 'paths 应恰为 6 个数据端点，不得混入根级元数据');
  for (const p of expect) {
    assert.ok(spec.paths[p], `缺少路径 ${p}`);
  }
});

test('swagger UI 可访问（返回 HTML）', async () => {
  const r = await GET(server, '/api/open/docs/');
  assert.equal(r.status, 200);
  assert.match(r.raw, /swagger-ui|<html/i);
});

test('README 权限点数量为 29 且含 apikey:manage 文档', () => {
  const readme = fs.readFileSync(path.join(__dirname, '../../README.md'), 'utf8');
  assert.match(readme, /apikey:manage/, 'README 应提及 apikey:manage 权限点');
  assert.match(readme, /29 个权限点/, 'README 应写明权限点总数 29');
});