// test/helpers/live-mysql.js
// Task 15：live MySQL 同步源。确保 sync_src 库与 sales2 表存在（13306），提供 seed / 计数 / 增量插入。
const mysql = require('mysql2/promise');

const DB = 'sync_src';
const BASE_URL = 'mysql://root:Kanban%40123@127.0.0.1:13306';
const URL = `${BASE_URL}/${DB}`;

async function ensure() {
  const admin = await mysql.createConnection({ uri: `${BASE_URL}/testdb` });
  try {
    await admin.query(`CREATE DATABASE IF NOT EXISTS ${DB}`);
  } finally {
    await admin.end();
  }
  const conn = await mysql.createConnection({ uri: URL });
  await conn.query('CREATE TABLE IF NOT EXISTS sales2 (id INT AUTO_INCREMENT PRIMARY KEY, regionkey INT, name VARCHAR(50), created_at DATETIME)');
  return conn;
}

async function resetTable(conn) {
  await conn.query('DROP TABLE IF EXISTS sales2');
  await conn.query('CREATE TABLE sales2 (id INT AUTO_INCREMENT PRIMARY KEY, regionkey INT, name VARCHAR(50), created_at DATETIME)');
}

async function seed(conn, n = 3) {
  for (let i = 1; i <= n; i++) {
    await conn.execute('INSERT INTO sales2 (regionkey, name, created_at) VALUES (?, ?, NOW())', [i % 5, `sales-${i}`]);
  }
}

async function insertRows(conn, n = 2) {
  for (let i = 1; i <= n; i++) {
    await conn.execute('INSERT INTO sales2 (regionkey, name, created_at) VALUES (?, ?, NOW())', [Math.floor(Math.random() * 10), `inc-${Date.now()}-${i}`]);
  }
}

async function srcCount(conn) {
  const [rows] = await conn.query('SELECT COUNT(*) AS c, MAX(id) AS max_id FROM sales2');
  return { count: rows[0].c, maxId: rows[0].max_id };
}

function datasourceConfig() {
  return { host: '127.0.0.1', port: 13306, database: DB, user: 'root', password: 'Kanban@123' };
}

module.exports = { DB, URL, ensure, resetTable, seed, insertRows, srcCount, datasourceConfig };