const dns = require('dns');

// http 数据源服务端请求的 SSRF 防护：
// - 云元数据 / 链路本地段（169.254/16、100.64/10）任何环境都拦截
// - 回环 / RFC1918 私网 / IPv6 ULA+链路本地 由 HTTP_DATASOURCE_BLOCK_PRIVATE 开关控制
//   默认关闭（本地 dev 需指向 localhost/局域网服务时无感），生产可开启

const METADATA_RANGES = [
  { from: 0xa9fe0000, to: 0xa9feffff, name: '链路本地/云元数据' }, // 169.254.0.0/16
  { from: 0x64400000, to: 0x647fffff, name: '运营商级 NAT/云元数据' }, // 100.64.0.0/10
];

const PRIVATE_RANGES = [
  { from: 0x00000000, to: 0x00ffffff, name: '本机' }, // 0.0.0.0/8
  { from: 0x7f000000, to: 0x7fffffff, name: '回环' }, // 127.0.0.0/8
  { from: 0x0a000000, to: 0x0affffff, name: '私网' }, // 10.0.0.0/8
  { from: 0xac100000, to: 0xac1fffff, name: '私网' }, // 172.16.0.0/12
  { from: 0xc0a80000, to: 0xc0a8ffff, name: '私网' }, // 192.168.0.0/16
];

function ipv4Int(ip) {
  const parts = String(ip).split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

function v4Reason(n, blockPrivate) {
  const ranges = [...(blockPrivate ? PRIVATE_RANGES : []), ...METADATA_RANGES];
  for (const r of ranges) {
    if (n >= r.from && n <= r.to) return r.name;
  }
  return null;
}

function v6Reason(ip, blockPrivate) {
  if (ip === '::') return blockPrivate ? '未指定地址' : null;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapped) {
    const n = ipv4Int(mapped[1]);
    return n === null ? null : v4Reason(n, blockPrivate);
  }
  if (ip === '::1') return blockPrivate ? '回环' : null;
  if (!blockPrivate) return null;
  const first = parseInt(ip.toLowerCase().split(':')[0], 16);
  if (Number.isFinite(first)) {
    if (first >= 0xfc00 && first <= 0xfdff) return '唯一本地地址(ULA)'; // fc00::/7
    if (first >= 0xfe80 && first <= 0xfebf) return '链路本地'; // fe80::/10
  }
  return null;
}

// 返回被拦截原因（字符串）或 null（放行）
function blockReason(address, blockPrivate = false) {
  if (!address) return null;
  const n = ipv4Int(address);
  if (n !== null) return v4Reason(n, blockPrivate);
  return v6Reason(address, blockPrivate);
}

// 生成 http.request 的 lookup 钩子：连接阶段校验解析结果，杜绝 DNS rebinding
function createLookup(blockPrivate) {
  return (hostname, options, callback) => {
    dns.lookup(hostname, options, (err, address, family) => {
      if (err) return callback(err);
      const reason = blockReason(address, blockPrivate);
      if (reason) return callback(new Error(`禁止访问数据源目标：${reason} 地址 ${address}`));
      callback(null, address, family);
    });
  };
}

module.exports = { blockReason, createLookup };