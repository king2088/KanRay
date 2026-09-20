process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { connect, buildSession, makeAuth } = require('../src/datasources/providers/hs2');

// ── 可注入 fake driver ────────────────────────────────
const rows = [{ id: '1', name: 'a' }];
let captured = {};

const fakeOp = () => ({
  hasMoreRows: () => false,
  fetch: async () => {},
  close: async () => {},
});

const fakeSession = {
  executeStatement: async (sql, opts) => {
    captured.sql = sql;
    captured.opts = opts;
    return fakeOp();
  },
  close: async () => { captured.sessionClosed = true; },
};

class FakeClient {
  constructor(ts, tst) { this.ts = ts; this.tst = tst; }
  async connect(opts, conn, auth) {
    captured.connOpts = opts;
    captured.conn = conn;
    captured.auth = auth;
    return this;
  }
  async openSession(opts) {
    captured.sessionOpts = opts;
    return fakeSession;
  }
  async close() { captured.clientClosed = true; }
}

class FakeHiveUtils {
  constructor() {}
  async waitUntilReady() {}
  async fetchAll() {}
  async getResult() { return { getValue: () => rows }; }
}

const TST = { TProtocolVersion: { HIVE_CLI_SERVICE_PROTOCOL_V10: 'V10' } };

function fakeDriver() {
  return {
    thrift: { TCLIService: 'TS', TCLIService_types: TST },
    HiveClient: FakeClient,
    HiveUtils: FakeHiveUtils,
    connections: {
      TcpConnection: class { marker = 'tcp' },
      HttpConnection: class { marker = 'http' },
    },
    auth: {
      NoSaslAuthentication: class { marker = 'none' },
      PlainTcpAuthentication: class { constructor(o) { this.o = o; } marker = 'plain-tcp' },
      PlainHttpAuthentication: class { constructor(o) { this.o = o; } marker = 'plain-http' },
      KerberosTcpAuthentication: class { constructor(o) { this.o = o; } marker = 'kerb-tcp' },
      KerberosHttpAuthentication: class { constructor(o) { this.o = o; } marker = 'kerb-http' },
      helpers: { MongoKerberosAuthProcess: class { constructor(o) { this.o = o; } } },
    },
  };
}

const reset = () => { captured = {}; };

// ── makeAuth 单元 ────────────────────────────────
test('makeAuth: 默认 none → NoSaslAuthentication', () => {
  const a = makeAuth({}, fakeDriver());
  assert.equal(a.marker, 'none');
});

test('makeAuth: plain + tcp → PlainTcpAuthentication 带用户名密码', () => {
  const a = makeAuth({ auth_type: 'plain', username: 'u', password: 'p' }, fakeDriver());
  assert.equal(a.marker, 'plain-tcp');
  assert.equal(a.o.username, 'u');
  assert.equal(a.o.password, 'p');
});

test('makeAuth: plain + http → PlainHttpAuthentication', () => {
  const a = makeAuth({ auth_type: 'plain', transport: 'http', username: 'u', password: 'p' }, fakeDriver());
  assert.equal(a.marker, 'plain-http');
});

test('makeAuth: kerberos 缺少原生依赖时抛出友好错误', () => {
  // 本机未安装 kerberos 原生模块 → MongoKerberosAuthProcess 分支走真实 require 失败
  const driver = fakeDriver();
  driver.auth.helpers.MongoKerberosAuthProcess = class {
    constructor(o, kerb) { throw new Error('module not found'); }
  };
  assert.throws(() => makeAuth({ auth_type: 'kerberos', host: 'h' }, driver), /kerberos/i);
});

// ── connect/buildSession 集成（注入 fake driver） ────────
test('connect: tcp + none，执行返回对象行数组并正确收尾', async () => { reset();
  const cfg = { host: 'localhost', port: 10000 };
  const session = await connect(cfg, fakeDriver());
  const out = await session.execute('SELECT * FROM t');
  assert.deepEqual(out, rows);
  assert.equal(captured.sql, 'SELECT * FROM t');
  assert.equal(captured.opts.runAsync, true);
  assert.equal(captured.connOpts.host, 'localhost');
  assert.equal(captured.connOpts.port, 10000);
  assert.equal(captured.conn.marker, 'tcp');
  assert.equal(captured.auth.marker, 'none');
  assert.equal(captured.sessionOpts.client_protocol, 'V10');
  await session.close();
  assert.equal(captured.sessionClosed, true);
  assert.equal(captured.clientClosed, true);
});

test('connect: http 传输带 path，plain 认证', async () => { reset();
  const cfg = { host: 'h', port: 10001, transport: 'http', path: '/hive', auth_type: 'plain', username: 'u', password: 'p' };
  const session = await connect(cfg, fakeDriver());
  await session.execute('SELECT 1');
  assert.equal(captured.conn.marker, 'http');
  assert.equal(captured.connOpts.options.path, '/hive');
  assert.equal(captured.auth.marker, 'plain-http');
});