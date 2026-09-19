const { createStore } = require('./db/index');
const schema = require('./db/schema');
const config = require('./config');

const store = createStore();

// 参数既支持展开 db.run(sql, a, b)，也支持数组 db.run(sql, [a, b])。
// SQLite 驱动内部会把单数组参数归一化，但 PG/MySQL 驱动直接透传参数数组，
// 若不归一化会出现「1 个参数喂给 N 个占位符」的绑定错误（如 lock.js 的租约锁）。
function bindArgs(args) {
  return args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
}

const db = {
  prepare: (sql) => store.prepare(sql),
  run: (sql, ...params) => store.run(sql, bindArgs(params)),
  get: (sql, ...params) => store.get(sql, bindArgs(params)),
  all: (sql, ...params) => store.all(sql, bindArgs(params)),
  exec: (sql) => store.exec(sql),
  execBatch: (sqls) => store.execBatch(sqls),
  transaction: (fn) => store.transaction(fn),
  pragma: (s) => { try { return store.raw ? store.raw.pragma(s) : undefined; } catch (e) { return undefined; } },
  close: () => store.close(),
  dialect: store.dialect,
  type: store.type,
};

// 透传 driver 全部方法（驱动层方法集合一致）
for (const [k, v] of Object.entries(store)) {
  if (typeof v === 'function' && !db[k]) db[k] = v;
}

// 数据集数据表动态建表 + 元数据模式引导
db.ensureDatasetTable = (schemaName, fields, pks) => schema.ensureDatasetTable(store, schemaName, fields, pks);
db.initSchema = () => schema.ensureSchema(store);
db.listTables = () => schema.listTables(store);
db.listColumns = (table) => schema.listColumns(store, table);

// sqlite 阶段同步引导：require 即建表；remote 阶段由 server 启动时 await db.initSchema()
if (store.type === 'sqlite') db.initSchema();

module.exports = db;
module.exports.ensureDatasetTable = db.ensureDatasetTable;
module.exports.initSchema = db.initSchema;