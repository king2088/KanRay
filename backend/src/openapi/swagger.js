const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '看板开放 API',
      version: '1.0.0',
      description: '外部客户集成开放 REST API，详见端点说明。',
    },
    servers: [{ url: '/api/open/v1' }],
  },
  apis: [path.join(__dirname, 'openapi.doc.js')],
};

const spec = swaggerJsdoc(options);

module.exports = spec;