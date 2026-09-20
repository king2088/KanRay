const { impala: impalaDialect } = require('../dialects');
const { makeProvider } = require('./hs2-family');
const { connect } = require('./hs2');

function createProvider(connectImpl) {
  return makeProvider({ dialect: impalaDialect, engine: 'impala', connectImpl: connectImpl || connect });
}

module.exports = createProvider();
module.exports.createProvider = createProvider;