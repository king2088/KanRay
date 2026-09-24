// 首行设置 DB_PATH（node:test 每文件独立进程）
process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const formSvc = require('../src/services/form.service');
const submissionSvc = require('../src/services/form-submission.service');
const datasetSvc = require('../src/services/dataset.service');
const { resetDb, adminId } = require('./helpers/db');

let OWNER;

function baseSchema(extraFields = []) {
  return {
    version: 1,
    fields: [
      { key: 'name', label: '姓名', type: 'text', required: true, span: 1 },
      { key: 'age', label: '年龄', type: 'number', required: false, span: 1 },
      { key: 'city', label: '城市', type: 'select', span: 1, options: [{ label: '北京', value: 'bj' }, { label: '上海', value: 'sh' }] },
      { key: 'tags', label: '标签', type: 'checkbox', span: 1, options: [{ label: 'a', value: 'a' }, { label: 'b', value: 'b' }] },
      { key: 'note', label: '说明', type: 'static', content: '请如实填写', span: 2 },
      ...extraFields,
    ],
  };
}

async function makePublished(schema = baseSchema(), opts = {}) {
  const form = await formSvc.createForm({ name: '表单A', description: 'desc', ownerId: opts.ownerId ?? OWNER });
  await formSvc.updateForm(form.id, { schemaJson: schema, submitConfig: opts.submitConfig ?? {} });
  return formSvc.publish(form.id, OWNER, { user: { email: 'owner@x.com' } });
}

beforeEach(async () => {
  await resetDb();
  OWNER = adminId();
});

describe('form.service 生命周期', () => {
  test('createForm 校验名称并返回 draft', async () => {
    await assert.rejects(() => formSvc.createForm({ name: '   ', ownerId: OWNER }), (e) => e.status === 400);
    const f = await formSvc.createForm({ name: '  我的表单  ', ownerId: OWNER });
    assert.equal(f.name, '我的表单');
    assert.equal(f.status, 'draft');
    assert.deepEqual(f.schema, { version: 1, fields: [] });
    assert.equal(f.submitConfig.allowRepeat, true);
    assert.equal(f.tableName, null);
  });

  test('listForms 支持 owner 过滤', async () => {
    await formSvc.createForm({ name: 'A', ownerId: OWNER });
    await formSvc.createForm({ name: 'B', ownerId: OWNER + 1 });
    const mine = await formSvc.listForms('owner_id = ?', [OWNER]);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].name, 'A');
  });

  test('getFormOrThrow 404', async () => {
    await assert.rejects(() => formSvc.getFormOrThrow(9999), (e) => e.status === 404);
  });
});

describe('form.service 发布', () => {
  test('0 个数据字段（仅说明文字）不能发布且不建表', async () => {
    const form = await formSvc.createForm({ name: '仅说明', ownerId: OWNER });
    await formSvc.updateForm(form.id, {
      schemaJson: { version: 1, fields: [{ key: 'note', label: '说明', type: 'static', content: 'x', span: 2 }] },
    });
    await assert.rejects(() => formSvc.publish(form.id, OWNER, { user: {} }), (e) => e.status === 400 && /至少一个数据字段/.test(e.message));
    const f = await formSvc.getForm(form.id);
    assert.equal(f.tableName, null);
  });

  test('首次发布建物理表并注册 source_type=form 数据集', async () => {
    const f = await makePublished();
    assert.match(f.tableName, /^ds_/);
    assert.ok(f.datasetId);
    const cols = (await db.listColumns(f.tableName)).map((c) => c.name);
    assert.ok(cols.includes('id') && cols.includes('submitted_by') && cols.includes('submitted_at'));
    for (const n of ['name', 'age', 'city', 'tags']) assert.ok(cols.includes(n), `缺列 ${n}`);
    assert.ok(!cols.includes('note'), 'static 不入表');
    const ds = await db.prepare('SELECT * FROM datasets WHERE id = ?').get(f.datasetId);
    assert.equal(ds.source_type, 'form');
    assert.equal(ds.owner_id, OWNER);
    const fields = await db.prepare('SELECT name, label, type, position FROM dataset_fields WHERE dataset_id = ? ORDER BY position').all(f.datasetId);
    assert.deepEqual(fields.map((x) => x.name), ['name', 'age', 'city', 'tags']);
    assert.equal(f.status, 'published');
  });

  test('重复发布幂等：不重复建表/注册数据集', async () => {
    const f = await makePublished();
    const again = await formSvc.publish(f.id, OWNER, { user: {} });
    assert.equal(again.tableName, f.tableName);
    assert.equal(again.datasetId, f.datasetId);
    const dsCount = await db.prepare('SELECT COUNT(*) AS c FROM datasets WHERE id = ?').get(f.datasetId);
    assert.equal(dsCount.c, 1);
  });

  test('close 后状态为 closed', async () => {
    const f = await makePublished();
    const closed = await formSvc.close(f.id, OWNER, { user: {} });
    assert.equal(closed.status, 'closed');
  });
});

describe('form.service 更新约束（有提交后）', () => {
  test('允许新增字段：ALTER ADD + 同步 dataset_fields', async () => {
    const f = await makePublished();
    await submissionSvc.insert(f, { name: '张三', city: 'bj' }, OWNER);
    const next = { ...baseSchema(), fields: [...baseSchema().fields, { key: 'email', label: '邮箱', type: 'text', span: 1 }] };
    const updated = await formSvc.updateForm(f.id, { schemaJson: next });
    assert.ok((await db.listColumns(updated.tableName)).map((c) => c.name).includes('email'));
    const fields = await db.prepare('SELECT name FROM dataset_fields WHERE dataset_id = ? ORDER BY position').all(updated.datasetId);
    assert.ok(fields.map((x) => x.name).includes('email'));
    // 保留旧列数据
    const row = await db.prepare(`SELECT name FROM ${JSON.stringify(updated.tableName).replace(/"/g, '')} WHERE id = 1`).get();
    assert.equal(row.name, '张三');
  });

  test('禁止删除字段', async () => {
    const f = await makePublished();
    await submissionSvc.insert(f, { name: 'x', city: 'bj' }, OWNER);
    const next = { ...baseSchema(), fields: baseSchema().fields.filter((x) => x.key !== 'age') };
    await assert.rejects(() => formSvc.updateForm(f.id, { schemaJson: next }), (e) => e.status === 400 && /禁止删除字段/.test(e.message));
  });

  test('禁止修改字段类型', async () => {
    const f = await makePublished();
    await submissionSvc.insert(f, { name: 'x', city: 'bj' }, OWNER);
    const next = { ...baseSchema(), fields: baseSchema().fields.map((x) => (x.key === 'age' ? { ...x, type: 'text' } : x)) };
    await assert.rejects(() => formSvc.updateForm(f.id, { schemaJson: next }), (e) => e.status === 400 && /禁止修改字段类型/.test(e.message));
  });

  test('关闭后仍可改名/加字段（状态变化不影响编辑）', async () => {
    const f = await makePublished();
    await formSvc.close(f.id, OWNER, { user: {} });
    const next = { ...baseSchema(), fields: [...baseSchema().fields, { key: 'extra', label: '补充', type: 'text', span: 1 }] };
    const u = await formSvc.updateForm(f.id, { schemaJson: next });
    assert.ok((await db.listColumns(u.tableName)).map((c) => c.name).includes('extra'));
  });
});

describe('form.service 删除', () => {
  test('删除级联：物理表、数据集、分享、表单本体', async () => {
    const f = await makePublished();
    await submissionSvc.insert(f, { name: 'x', city: 'bj' }, OWNER);
    await db.prepare('INSERT INTO form_shares (form_id, token, password_hash, created_by) VALUES (?, ?, ?, ?)').run(f.id, 'tok123', 'x', OWNER);
    await formSvc.deleteForm(f.id, OWNER, { user: {} });
    assert.equal(await formSvc.getForm(f.id), null);
    dbRow = db.prepare('SELECT COUNT(*) AS c FROM datasets WHERE id = ?').get(f.datasetId);
    assert.equal((dbRow && dbRow.c) || 0, 0);
    assert.ok(!(await db.listTables()).some((n) => n === f.tableName));
    const shareRow = db.prepare('SELECT COUNT(*) AS c FROM form_shares WHERE form_id = ?').get(f.id);
    assert.equal((shareRow && shareRow.c) || 0, 0);
  });
});

describe('form-submission.service 提交', () => {
  test('合法提交入库，static/未知 key 被丢弃，checkbox 以逗号连接', async () => {
    const f = await makePublished();
    const { id } = await submissionSvc.insert(f, { name: '张三', age: 30, city: 'bj', tags: ['a', 'b'], note: 'x', injected: 'evil' }, OWNER);
    const real = (await db.prepare(`SELECT * FROM ${f.tableName} WHERE id = ?`).get(id));
    assert.equal(real.name, '张三');
    assert.equal(real.age, 30);
    assert.equal(real.city, 'bj');
    assert.equal(real.tags, 'a,b');
    assert.equal(real.submitted_by, OWNER);
    assert.ok(real.submitted_at);
  });

  test('必填校验与选项白名单', async () => {
    const f = await makePublished();
    await assert.rejects(() => submissionSvc.insert(f, { city: 'bj' }, OWNER), (e) => e.status === 400 && /必填/.test(e.message));
    await assert.rejects(() => submissionSvc.insert(f, { name: 'x', city: 'tokyo' }, OWNER), (e) => e.status === 400 && /选项不合法/.test(e.message));
    await assert.rejects(() => submissionSvc.insert(f, { name: 'x', tags: ['z'] }, OWNER), (e) => e.status === 400 && /选项不合法/.test(e.message));
  });

  test('日期与数字格式校验', async () => {
    const f = await makePublished(baseSchema([{ key: 'birth', label: '生日', type: 'date', span: 1 }]));
    await assert.rejects(() => submissionSvc.insert(f, { name: 'x', birth: '2024-13-99' }, OWNER), (e) => e.status === 400);
    const { id } = await submissionSvc.insert(f, { name: 'x', birth: '2024-01-02' }, OWNER);
    const row = await db.prepare(`SELECT birth FROM ${f.tableName} WHERE id = ?`).get(id);
    assert.equal(row.birth, '2024-01-02');
  });

  test('allowRepeat=false 仅对登录用户限一次，匿名不限', async () => {
    const f = await makePublished(baseSchema(), { submitConfig: { allowRepeat: false } });
    await submissionSvc.insert(f, { name: 'a', city: 'bj' }, OWNER);
    await assert.rejects(() => submissionSvc.insert(f, { name: 'b', city: 'sh' }, OWNER), (e) => e.status === 400 && /仅可提交一次/.test(e.message));
    await submissionSvc.insert(f, { name: 'c', city: 'sh' }, null); // 匿名不受限
    await submissionSvc.insert(f, { name: 'd', city: 'bj' }, null);
    const c = await db.prepare(`SELECT COUNT(*) AS c FROM ${f.tableName} WHERE submitted_by IS NULL`).get();
    assert.equal(c.c, 2);
  });

  test('allowRepeat=true 登录用户可重复提交', async () => {
    const f = await makePublished(); // 默认 allowRepeat true
    await submissionSvc.insert(f, { name: 'a', city: 'bj' }, OWNER);
    await submissionSvc.insert(f, { name: 'b', city: 'sh' }, OWNER);
    const c = await db.prepare(`SELECT COUNT(*) AS c FROM ${f.tableName} WHERE submitted_by = ?`).get(OWNER);
    assert.equal(c.c, 2);
  });

  test('draft / closed 表单拒绝提交', async () => {
    const form = await formSvc.createForm({ name: '未发布', ownerId: OWNER });
    await assert.rejects(() => submissionSvc.insert(form, { name: 'x' }, OWNER), (e) => e.status === 400);
    const f = await makePublished();
    await formSvc.close(f.id, OWNER, { user: {} });
    const closed = await formSvc.getForm(f.id);
    await assert.rejects(() => submissionSvc.insert(closed, { name: 'x', city: 'bj' }, OWNER), (e) => e.status === 400 && /已关闭/.test(e.message));
  });

  test('插入后 rows 递增、生成连续整数 id', async () => {
    const f = await makePublished();
    const r1 = await submissionSvc.insert(f, { name: 'a', city: 'bj' }, null);
    const r2 = await submissionSvc.insert(f, { name: 'b', city: 'sh' }, null);
    assert.equal(r1.id, 1);
    assert.equal(r2.id, 2);
    const ds = await db.prepare('SELECT row_count FROM datasets WHERE id = ?').get(f.datasetId);
    assert.equal(ds.row_count, 2);
  });

  test('refreshRowCounts 对 form 数据集做本地表懒计数', async () => {
    const f = await makePublished();
    await submissionSvc.insert(f, { name: 'a', city: 'bj' }, null);
    await submissionSvc.insert(f, { name: 'b', city: 'sh' }, null);
    const id = f.datasetId;

    // 模拟行数漂移（如手工改表），懒计算应基于 ds_* 表实际行数重算并返回
    await db.prepare('UPDATE datasets SET row_count = 0 WHERE id = ?').run(id);
    const counts = await datasetSvc.refreshRowCounts([id]);
    assert.deepEqual(counts, { [id]: 2 });
    const ds = await db.prepare('SELECT row_count FROM datasets WHERE id = ?').get(id);
    assert.equal(ds.row_count, 2);

    // 已计过数的（row_count>0）不再重算
    await db.prepare('UPDATE datasets SET row_count = 99 WHERE id = ?').run(id);
    assert.deepEqual(await datasetSvc.refreshRowCounts([id]), {});
    const after = await db.prepare('SELECT row_count FROM datasets WHERE id = ?').get(id);
    assert.equal(after.row_count, 99);
  });

  test('update 更新单条提交；remove 删除并回减行数', async () => {
    const f = await makePublished();
    const { id } = await submissionSvc.insert(f, { name: '张', city: 'bj', age: 1 }, OWNER);
    await submissionSvc.update(f, id, { name: '李四', age: 12 });
    const row = await db.prepare(`SELECT name, age FROM ${f.tableName} WHERE id = ?`).get(id);
    assert.equal(row.name, '李四');
    assert.equal(row.age, 12);
    await submissionSvc.remove(f, id);
    const c = await db.prepare(`SELECT COUNT(*) AS c FROM ${f.tableName}`).get();
    assert.equal(c.c, 0);
    const ds = await db.prepare('SELECT row_count FROM datasets WHERE id = ?').get(f.datasetId);
    assert.equal(ds.row_count, 0);
    await assert.rejects(() => submissionSvc.remove(f, 999), (e) => e.status === 404);
  });

  test('listSubmissions 带邮箱联表；listMySubmissions 仅本人', async () => {
    const f = await makePublished();
    await submissionSvc.insert(f, { name: '张三', city: 'bj' }, OWNER);
    await submissionSvc.insert(f, { name: '匿名', city: 'sh' }, null);
    const all = await formSvc.listSubmissions(f);
    assert.equal(all.length, 2);
    assert.equal(all[0].submitted_by, null); // 最新在前
    const mine = await formSvc.listMySubmissions(f, OWNER);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].name, '张三');
  });
});

describe('form.service fillSchema 精简', () => {
  test('不泄露内部字段（groupId/owner/tableName 等）', async () => {
    const f = await makePublished();
    const s = formSvc.fillSchema(f);
    assert.equal(s.id, f.id);
    assert.equal(s.schema.fields.length, 5);
    assert.equal(s.schema.fields[0].key, 'name');
    assert.ok(!('tableName' in s));
    assert.ok(!('datasetId' in s));
    assert.ok(!('ownerId' in s));
    for (const field of s.schema.fields) {
      if (field.type !== 'static') assert.ok(field.options === undefined || Array.isArray(field.options));
    }
  });
});