const { createStore } = require('./db/index');
const schema = require('./db/schema');
const config = require('./config');

const store = createStore();

const db = {
  prepare: (sql) => store.prepare(sql),
  run: (sql, ...params) => store.run(sql, params),
  get: (sql, ...params) => store.get(sql, params),
  all: (sql, ...params) => store.all(sql, params),
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