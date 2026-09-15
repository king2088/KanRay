const mysqlFamily = require('./mysql-family');
const pgFamily = require('./pg-family');
const clickhouse = require('./clickhouse');
const mssql = require('./mssql');
const elasticsearch = require('./elasticsearch');
const apiService = require('./api-service');
const oracle = require('./oracle');
const presto = require('./presto');

const MAP = {
  mysql: mysqlFamily,
  pg: pgFamily,
  clickhouse,
  mssql,
  'es-rest': elasticsearch,
  http: apiService,
  oracle,
  presto,
};

function getProvider(family) {
  return MAP[family] || null;
}

module.exports = { getProvider };