process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const providers = require('../src/datasources/providers');

const val = (o, k, i) => { const ks = Object.keys(o); return o[ks[i]]; };

// ── 注册表 ────────────────────────────────────────────────
test('providers registry 含 5 个新 family', () => {
  for (const f of ['db2', 'dameng', 'hive', 'impala', 'maxcompute']) {
    const p = providers.getProvider(f);
    assert.ok(p, `${f} 未注册`);
    for (const fn of ['testConnection', 'listSchemas', 'listTables', 'listColumns', 'runQuery']) {
      assert.equal(typeof p[fn], 'function', `${f}.${fn} missing`);
    }
  }
});

// ── db2（注入 fake ibm_db）────────────────────────────────
test('db2: 连接串 + listSchemas/listTables/listColumns + runQuery 经 FETCH FIRST', async () => {
  const calls = { cs: '', queries: [] };
  const fakeConn = {
    async query(sql, params) { calls.queries.push({ sql, params }); return []; },
    async close() {},
  };
  const fakeDriver = { open: async (cs) => { calls.cs = cs; return fakeConn; } };
  const db2 = require('../src/datasources/providers/db2').createProvider(fakeDriver);

  await db2.listSchemas({ host: 'h', port: 50000, database: 'SAMPLE', user: 'u', password: 'p' });
  assert.ok(calls.cs.includes('DATABASE=SAMPLE'), calls.cs);
  assert.ok(calls.cs.includes('HOSTNAME=h'), calls.cs);
  assert.ok(calls.cs.includes('UID=u'), calls.cs);
  assert.ok(calls.queries[0].sql.startsWith('SELECT SCHEMANAME'), calls.queries[0].sql);

  await db2.listTables({}, 'db2', 'SYSIBM');
  assert.match(calls.queries[1].sql, /SYSCAT\.TABLES/);
  assert.deepEqual(calls.queries[1].params, ['SYSIBM']);

  await db2.listColumns({}, 'db2', 'SYSIBM', 'T1');
  assert.match(calls.queries[2].sql, /SYSCAT\.COLUMNS/);

  await db2.runQuery({}, 'SELECT * FROM t LIMIT 5', []);
  assert.equal(calls.queries[3].sql, 'SELECT * FROM t FETCH FIRST 5 ROWS ONLY');

  await db2.runQuery({}, 'SELECT id FROM t ORDER BY id LIMIT 5 OFFSET 20', []);
  assert.equal(calls.queries[4].sql, 'SELECT id FROM t ORDER BY id OFFSET 20 ROWS FETCH NEXT 5 ROWS ONLY');
});

test('db2: ibm_db 未安装时给出友好错误', async () => {
  const p = require('../src/datasources/providers/db2').createProvider(undefined);
  const r = await p.testConnection({});
  assert.equal(r.ok, false);
  assert.match(r.message, /ibm_db/i);
});

// ── dameng（注入 fake odbc）────────────────────────────────
test('dameng: 连接串 + 元数据查询 + runQuery 经 LIMIT OFFSET', async () => {
  const calls = { cs: '', queries: [] };
  const fakeConn = {
    async query(sql, params) { calls.queries.push({ sql, params }); return { rows: [] }; },
    async close() {},
  };
  const fakeOdbc = { connect: async (cs) => { calls.cs = cs; return fakeConn; } };
  const dm = require('../src/datasources/providers/dameng').createProvider(fakeOdbc);

  await dm.listSchemas({ host: 'h', port: 5236, user: 'SYSDBA', password: 'p' });
  assert.ok(calls.cs.includes('SERVER=h'), calls.cs);
  assert.ok(calls.cs.includes('PORT=5236'), calls.cs);

  await dm.listTables({}, 'dameng', 'SYSDBA');
  await dm.listColumns({}, 'dameng', 'SYSDBA', 'T');
  assert.match(calls.queries[0].sql, /SELECT DISTINCT USERNAME AS NAME FROM ALL_USERS/);
  assert.match(calls.queries[1].sql, /FROM SYSOBJECTS/);
  assert.match(calls.queries[2].sql, /ALL_TAB_COLUMNS/);

  await dm.runQuery({}, 'SELECT * FROM t LIMIT 5', []);
  assert.equal(calls.queries[3].sql, 'SELECT * FROM t LIMIT 5');

  await dm.runQuery({}, 'SELECT id FROM t ORDER BY id LIMIT 5 OFFSET 20', []);
  assert.equal(calls.queries[4].sql, 'SELECT id FROM t ORDER BY id LIMIT 5 OFFSET 20');
});

test('dameng: odbc 未安装时给出友好错误', async () => {
  const p = require('../src/datasources/providers/dameng').createProvider(undefined);
  const r = await p.testConnection({});
  assert.equal(r.ok, false);
  assert.match(r.message, /odbc/i);
});

// ── hive / impala（注入 fake connectImpl）─────────────────
function fakeHs2(script) {
  const calls = { sqls: [] };
  return {
    calls,
    impl: async (cfg) => ({
      async execute(sql) {
        calls.sqls.push(sql);
        if (script[sql]) return script[sql];
        return [];
      },
      async close() {},
    }),
  };
}

const hiveTables = [{ name: 'csv' }, { name: 'orders' }];
const hiveCols = [
  { name: 'id', data_type: 'bigint' },
  { name: 'name', data_type: 'string' },
  { name: '# Partition Information' },
];

test('hive: SHOW DATABASES/TABLES/DESCRIBE 行映射为对象列', async () => {
  const { impl } = fakeHs2({
    'SHOW DATABASES': [{ className: 'default' }, { className: 'mydb' }],
    'SHOW TABLES IN `mydb`': [{ tab_name: 'csv' }],
    'DESCRIBE `mydb`.`csv`': hiveCols,
  });
  const hive = require('../src/datasources/providers/hive').createProvider(impl);

  const schemas = await hive.listSchemas({});
  assert.deepEqual(schemas, [{ name: 'default' }, { name: 'mydb' }]);

  const tables = await hive.listTables({}, 'hive', 'mydb');
  assert.deepEqual(tables, [{ name: 'csv', type: 'table' }]);

  const cols = await hive.listColumns({}, 'hive', 'mydb', 'csv');
  assert.deepEqual(cols.map((c) => c.name), ['id', 'name']);
  assert.ok(cols.every((c) => c.role === 'dimension' || c.role === 'metric'));
  const idCol = cols.find((c) => c.name === 'id');
  assert.equal(idCol.role, 'metric');
});

test('hive: runQuery 插值 ? 并保留 LIMIT；OFFSET 走 ROW_NUMBER', async () => {
  const { impl, calls } = fakeHs2({});
  const hive = require('../src/datasources/providers/hive').createProvider(impl);
  await hive.runQuery({}, 'SELECT * FROM t WHERE x = ? LIMIT 5', ['us-east']);
  assert.equal(calls.sqls[0], "SELECT * FROM t WHERE x = 'us-east' LIMIT 5");
  await hive.runQuery({}, 'SELECT id FROM t ORDER BY id LIMIT 5 OFFSET 20', []);
  assert.match(calls.sqls[1], /ROW_NUMBER\(\)/);
  assert.match(calls.sqls[1], /__rn > 20 AND __rn <= 25/);
});

test('impala: fetch 走 HS2 会话并复用同一映射', async () => {
  const { impl, calls } = fakeHs2({ 'SHOW DATABASES': [{ database: 'db1' }] });
  const impala = require('../src/datasources/providers/impala').createProvider(impl);
  const schemas = await impala.listSchemas({});
  assert.deepEqual(schemas, [{ name: 'db1' }]);
  await impala.runQuery({}, 'SELECT * FROM t LIMIT 3', []);
  assert.equal(calls.sqls[1], 'SELECT * FROM t LIMIT 3');
});

test('hive: 未注入且 hive-driver 可用时默认连接函数存在', async () => {
  const p = require('../src/datasources/providers/hive');
  assert.equal(typeof p.testConnection, 'function');
});

// ── maxcompute（注入 fake fetch）──────────────────────────
function fakeMcFetch(responses) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    const res = typeof responses === 'function' ? responses(url, opts) : responses;
    return { ok: res.ok !== false, status: res.status || 200, text: async () => JSON.stringify(res.body) };
  };
  return { calls, fetchImpl };
}

test('maxcompute: 提交 SQL → 轮询 → result 解析为对象行', async () => {
  let polled = 0;
  const { calls, fetchImpl } = fakeMcFetch((url, opts) => {
    if (opts.method === 'POST' && url.includes('/instances')) return { body: { instanceId: 'i1' } };
    if (url.includes('/instances/i1/result')) return { body: { lines: [['a', 1], ['b', 2]], resultSchema: [{ name: 'n' }, { name: 'v' }] } };
    polled += 1;
    return { body: { status: 'SUCCESS' } };
  });
  const mc = require('../src/datasources/providers/maxcompute').createProvider(fetchImpl);
  const rows = await mc.runQuery({ endpoint: 'http://mc.example/api', access_key_id: 'ak', access_key_secret: 'sk', project: 'p' }, 'SELECT * FROM t LIMIT 5', []);
  assert.deepEqual(rows, [{ n: 'a', v: 1 }, { n: 'b', v: 2 }]);
  const post = calls.find((c) => c.opts.method === 'POST');
  assert.ok(post.url.endsWith('/api/projects/p/instances'), post.url);
  const hdrs = post.opts.headers;
  assert.equal(hdrs.Authorization, `Basic ${Buffer.from('ak:sk').toString('base64')}`);
  assert.deepEqual(JSON.parse(post.opts.body), { action: 'sql', query: 'SELECT * FROM t LIMIT 5' });
  assert.ok(polled >= 1);
});

test('maxcompute: listTables/listColumns 走 SHOW/DESC；失败实例抛出', async () => {
  const { calls, fetchImpl } = fakeMcFetch((url, opts) => {
    if (opts.method === 'POST') return { body: { instanceId: 'i1' } };
    if (url.includes('/result')) return { body: { lines: [['t1'], ['t2']], resultSchema: [{ name: 'name' }] } };
    return { body: { status: 'SUCCESS' } };
  });
  const mc = require('../src/datasources/providers/maxcompute').createProvider(fetchImpl);
  const cfg = { access_key_id: 'a', access_key_secret: 'b', project: 'p' };
  const tables = await mc.listTables(cfg, 'maxcompute', 'p');
  assert.deepEqual(tables.map((t) => t.name), ['t1', 't2']);
  assert.match(calls.find((c) => c.opts.method === 'POST' && JSON.parse(c.opts.body).query.startsWith('SHOW')).opts.body, /SHOW TABLES/);

  const bad = fakeMcFetch((url, opts) => {
    if (opts.method === 'POST') return { body: { instanceId: 'i1' } };
    if (!url.includes('/result')) return { body: { status: 'FAILED', message: 'ODPS-0410011' } };
    return { body: {} };
  });
  const mc2 = require('../src/datasources/providers/maxcompute').createProvider(bad.fetchImpl);
  await assert.rejects(() => mc2.runQuery({ access_key_id: 'a', access_key_secret: 'b', project: 'p' }, 'SELECT 1', []), /ODPS-0410011/);
});

// ── elasticsearch（注入 fake transport）────────────────────
function esReturn(hits) {
  return { hits: { hits: hits.map((s) => ({ _source: s })) } };
}

test('es-rest: runQuery 解析 SELECT/FROM/WHERE/LIMIT/OFFSET/ORDER BY 为 _search', async () => {
  const calls = [];
  const es = require('../src/datasources/providers/elasticsearch').createProvider({
    request: async (cfg, method, path, body) => {
      calls.push({ method, path, body });
      return esReturn([{ a: 1, s: 'x' }]);
    },
  });
  const rows = await es.runQuery({}, 'SELECT * FROM idx ORDER BY a ASC LIMIT 10 OFFSET 20', []);
  assert.deepEqual(rows, [{ a: 1, s: 'x' }]);
  const c = calls[0];
  assert.equal(c.method, 'POST');
  assert.equal(c.path, '/idx/_search');
  assert.equal(c.body.from, 20);
  assert.equal(c.body.size, 10);
  assert.deepEqual(c.body.sort, [{ a: { order: 'asc' } }]);
  assert.deepEqual(c.body.query.bool.filter, [{ match_all: {} }]);
});

test('es-rest: WHERE 等值/IN/LIKE 映射 + 投影字段', async () => {
  const calls = [];
  const es = require('../src/datasources/providers/elasticsearch').createProvider({
    request: async (cfg, method, path, body) => { calls.push(body); return esReturn([{ a: 1 }]); },
  });
  await es.runQuery({}, 'SELECT `a`, `b` FROM logs WHERE `status` = ? AND `level` = ? LIMIT 5', ['ok', 'info']);
  const query = calls[0].query;
  assert.deepEqual(calls[0]._source, ['a', 'b']); // 投影字段过滤
  assert.match(JSON.stringify(query), /"term":\{"status":"ok"\}/);
  assert.match(JSON.stringify(query), /"term":\{"level":"info"\}/);
  assert.equal(calls[0].size, 5);
});

test('es-rest: 聚合查询暂不支持时抛出明确错误', async () => {
  const es = require('../src/datasources/providers/elasticsearch').createProvider({
    request: async () => esReturn([]),
  });
  await assert.rejects(() => es.runQuery({}, 'SELECT a, SUM(b) AS s FROM idx GROUP BY a LIMIT 10', []), /同步/);
});

// ── api-service（本地 HTTP server）────────────────────────
function startApiServer(handler) {
  return new Promise((resolve) => {
    const srv = http.createServer(handler);
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

test('api-service: listColumns/runQuery 读取 JSON 数组并保持数据', async () => {
  const { srv, port } = await startApiServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([{ name: 'x', value: 1 }, { name: 'y', value: 2 }]));
  });
  try {
    const cfg = { url: `http://127.0.0.1:${port}/orders`, method: 'GET', expectedStatus: 200 };
    const ls = await providers.getProvider('http').listColumns(cfg, 'api', null, 'orders');
    assert.deepEqual(ls.map((c) => c.name), ['name', 'value']);
    const rows = await providers.getProvider('http').runQuery(cfg, 'SELECT 1', []);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].name, 'x');
    const ok = await providers.getProvider('http').testConnection(cfg);
    assert.equal(ok.ok, true);
    const schemas = await providers.getProvider('http').listSchemas(cfg);
    assert.equal(schemas.length, 1);
  } finally {
    srv.close();
  }
});