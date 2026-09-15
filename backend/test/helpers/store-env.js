process.env.DB_PATH = `/tmp/kanban-store-${process.pid}.db`;
process.env.DATA_DIR = `/tmp/kanban-store-data-${process.pid}`;
const config = require('../../src/config');
const { createStore } = require('../../src/db/index');

async function runInNew() {
  config.db.type = 'sqlite';
  config.db.sqlitePath = `/tmp/kanban-store-${process.pid}.db`;
  return createStore();
}

module.exports = { runInNew };