// 统一 Hive/Impala 的 HS2 Thrift 会话封装（基于 hive-driver）：
// 认证（none/plain/kerberos）+ 传输（tcp/http）+ execute(游标拉全部) + close。
// driverModule 可注入以单测；缺省加载真实 hive-driver。

function loadDriver() {
  try {
    return require('hive-driver');
  } catch (err) {
    const e = new Error('缺少可选依赖 hive-driver，请先安装：npm i hive-driver（Hive/Impala 数据源需要）');
    e.code = 'HIVE_DRIVER_MISSING';
    throw e;
  }
}

function makeKerberosAuth(cfg, driver) {
  let kerberos;
  try {
    kerberos = require('kerberos');
  } catch (err) {
    const e = new Error('Kerberos 认证需要可选原生依赖 kerberos，请先安装并编译：npm i kerberos（hive-driver 使用 mongodb/kerberos）');
    e.code = 'KERBEROS_MISSING';
    e.cause = err;
    throw e;
  }
  const authProcess = new driver.auth.helpers.MongoKerberosAuthProcess(
    { fqdn: cfg.host, service: 'hive' },
    kerberos,
  );
  const opts = { username: cfg.username, password: cfg.password };
  const http = cfg.transport === 'http';
  return http
    ? new driver.auth.KerberosHttpAuthentication(opts, authProcess)
    : new driver.auth.KerberosTcpAuthentication(opts, authProcess);
}

// auth_type: none | plain | kerberos（plain 兼容 LDAP）
function makeAuth(cfg, driver) {
  const authType = String(cfg.auth_type || 'none').toLowerCase();
  const http = cfg.transport === 'http';
  if (authType === 'kerberos') return makeKerberosAuth(cfg, driver);
  if (authType === 'plain' || authType === 'ldap') {
    const opts = { username: cfg.username, password: cfg.password };
    return http
      ? new driver.auth.PlainHttpAuthentication(opts)
      : new driver.auth.PlainTcpAuthentication(opts);
  }
  return new driver.auth.NoSaslAuthentication();
}

function buildSession(client, session, driver) {
  const utils = new driver.HiveUtils(driver.thrift.TCLIService_types);
  return {
    async execute(sql) {
      const op = await session.executeStatement(sql, { runAsync: true });
      await utils.waitUntilReady(op, false, () => {});
      await utils.fetchAll(op);
      const handler = await utils.getResult(op);
      const value = handler && handler.getValue ? handler.getValue() : [];
      try { await op.close(); } catch (err) { /* ignore */ }
      return value || [];
    },
    async close() {
      try { await session.close(); } catch (err) { /* ignore */ }
      try { await client.close(); } catch (err) { /* ignore */ }
    },
  };
}

async function connect(cfg, driverModule) {
  const driver = driverModule || loadDriver();
  const client = new driver.HiveClient(driver.thrift.TCLIService, driver.thrift.TCLIService_types);
  const transport = cfg.transport === 'http' ? new driver.connections.HttpConnection() : new driver.connections.TcpConnection();
  const auth = makeAuth(cfg, driver);
  await client.connect(
    { host: cfg.host, port: cfg.port, options: cfg.path ? { path: cfg.path } : {} },
    transport,
    auth,
  );
  const session = await client.openSession({
    client_protocol: driver.thrift.TCLIService_types.TProtocolVersion.HIVE_CLI_SERVICE_PROTOCOL_V10,
  });
  return buildSession(client, session, driver);
}

module.exports = { connect, buildSession, makeAuth, makeKerberosAuth, loadDriver };