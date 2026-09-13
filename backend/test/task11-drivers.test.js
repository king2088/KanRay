process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const drivers = require('../src/datasources/drivers');

test('drivers registry has 22 entries', () => {
  assert.equal(drivers.length, 22);
});

test('each driver has required fields', () => {
  for (const d of drivers) {
    assert.ok(d.type, `missing type in ${JSON.stringify(d)}`);
    assert.ok(d.name, `missing name in ${d.type}`);
    assert.ok(d.category, `missing category in ${d.type}`);
    assert.ok(d.family, `missing family in ${d.type}`);
    assert.ok(['tested', 'compatible', 'planned'].includes(d.status), `invalid status in ${d.type}`);
    assert.ok(d.capabilities && typeof d.capabilities.test === 'boolean', `missing capabilities.test in ${d.type}`);
    assert.ok(d.defaultPort > 0 || d.defaultPort === null, `invalid defaultPort in ${d.type}`);
    assert.ok(Array.isArray(d.fields), `missing fields array in ${d.type}`);
  }
});

test('tested drivers have full capabilities', () => {
  const tested = drivers.filter((d) => d.status === 'tested');
  for (const d of tested) {
    assert.equal(d.capabilities.test, true, `${d.type} should support test`);
  }
});

test('planned drivers are disabled (capabilities false)', () => {
  const planned = drivers.filter((d) => d.status === 'planned');
  for (const d of planned) {
    assert.equal(d.capabilities.browse, false, `${d.type} browse should be false`);
    assert.equal(d.capabilities.dataset, false, `${d.type} dataset should be false`);
  }
});

test('field schemas have name, label, type, required', () => {
  for (const d of drivers) {
    for (const f of d.fields) {
      assert.ok(f.name, `missing field name in ${d.type}`);
      assert.ok(f.label, `missing field label in ${d.type}`);
      assert.ok(['text', 'number', 'boolean', 'select', 'password'].includes(f.type), `invalid field type ${f.type} in ${d.type}`);
      assert.equal(typeof f.required, 'boolean', `missing required in ${d.type}.${f.name}`);
    }
  }
});