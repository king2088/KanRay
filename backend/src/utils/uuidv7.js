// src/utils/uuidv7.js
// RFC 9562 UUID version 7：48 位毫秒时间戳 + 版本位 + 74 位随机。
// - 时间有序：前 48 位为 unix ms，B-tree 插入局部性优于随机 UUID v4。
// - 不可枚举：低位全随机，规避连续整数 id 的 IDOR 遍历风险。
// - 进程内单调：同一毫秒内多次调用把时间戳 +1，保证严格递增且不重复
//   （种子/批量插入循环同 ms 内生成也不会撞，时间戳最多超前本次调用数 ms，可忽略）。
const { randomFillSync } = require('crypto');

const HEX_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let lastMs = 0;
const buf = Buffer.allocUnsafe(16);

/** 生成一个 36 位小写 UUIDv7。 */
function uuidv7() {
  let ms = Date.now();
  if (ms <= lastMs) ms = lastMs + 1;
  lastMs = ms;

  randomFillSync(buf, 6, 10);

  buf[0] = Math.floor(ms / 0x10000000000) & 0xff;
  buf[1] = Math.floor(ms / 0x100000000) & 0xff;
  buf[2] = Math.floor(ms / 0x1000000) & 0xff;
  buf[3] = Math.floor(ms / 0x10000) & 0xff;
  buf[4] = Math.floor(ms / 0x100) & 0xff;
  buf[5] = ms & 0xff;

  buf[6] = 0x70 | (buf[6] & 0x0f);
  buf[8] = 0x80 | (buf[8] & 0x3f);

  const hex = buf.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** 校验是否为合法的 36 位小写 UUIDv7（版本位=7、变体位=10x）。 */
function isValidUuid7(v) {
  return typeof v === 'string' && HEX_RE.test(v);
}

module.exports = { uuidv7, isValidUuid7, HEX_RE };
