const { hive: hiveDialect } = require('../dialects');
const { makeProvider } = require('./hs2-family');
const { connect } = require('./hs2');

function createProvider(connectImpl) {
  return makeProvider({ dialect: hiveDialect, engine: 'hive', connectImpl: connectImpl || connect });
}

module.exports = createProvider();
module.exports.createProvider = createProvider;