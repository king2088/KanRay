// src/utils/pg-types.js
// 统一 node-postgres 的返回类型，与 SQLite/MySQL 应用存储契约保持一致。
// node-postgres 默认把 int8(OID 20) 与 numeric/decimal(1700) 解析为字符串（为保留精度），
// 而本项目期望数值列返回 JS number（SQLite/MySQL 均如此）；否则 PG 下 COUNT/SUM/AVG、
// 数据集整数字段、分享/图表数据都会变成字符串，破坏前端与既有断言。
// 该模块集中注册，应用存储 driver 与 PG 数据源 provider 共用同一份 pg 实例，注册一次即全局生效。
const { types } = require('pg');

const toNumber = (v) => (v == null ? v : Number(v));

// INT8 / BIGINT
types.setTypeParser(20, toNumber);
// NUMERIC / DECIMAL
types.setTypeParser(1700, toNumber);

module.exports = {};
