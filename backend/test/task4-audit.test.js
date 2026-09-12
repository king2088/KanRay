// 首行设置 DB_PATH
process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDb } = require('./helpers/db');
const audit = require('../src/services/audit.service');

test('log 写入审计表并带 IP', () => {
  resetDb();
  audit.log({ userId: 1, email: 'a@b.c', action: 'login' }, { ip: '10.0.0.1' });
  const row = db.prepare('SELECT * FROM audit_logs').get();
  assert.equal(row.action, 'login');
  assert.equal(row.email, 'a@b.c');
  assert.equal(row.ip, '10.0.0.1');
});

test('list 按创建时间倒序分页', () => {
  resetDb();
  audit.log({ userId: 1, action: 'a' });
  audit.log({ userId: 2, action: 'b' });
  const r = audit.list({ page: 1, pageSize: 1 });
  assert.equal(r.total, 2);
  assert.equal(r.list.length, 1);
  assert.equal(r.list[0].action, 'b');
});