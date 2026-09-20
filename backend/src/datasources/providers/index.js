const mysqlFamily = require('./mysql-family');
const pgFamily = require('./pg-family');
const clickhouse = require('./clickhouse');
const mssql = require('./mssql');
const elasticsearch = require('./elasticsearch');
const apiService = require('./api-service');
const oracle = require('./oracle');
const presto = require('./presto');
const db2 = require('./db2');
const dameng = require('./dameng');
const hive = require('./hive');
const impala = require('./impala');
const maxcompute = require('./maxcompute');

const MAP = {
  mysql: mysqlFamily,
  pg: pgFamily,
  clickhouse,
  mssql,
  'es-rest': elasticsearch,
  http: apiService,
  oracle,
  presto,
  db2,
  dameng,
  hive,
  impala,
  maxcompute,
};

function getProvider(family) {
  return MAP[family] || null;
}

module.exports = { getProvider };