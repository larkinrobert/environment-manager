'use strict';

module.exports = {
  id: 'CommonAuditField',
  $schema: 'http://json-schema.org/draft-04/schema#',
  title: 'CommonAuditField',
  description: 'Common Audit Data',
  type: 'object',
  properties: {
    Audit: {
      type: 'object',
      properties: {
        LastChanged: {
          type: 'string',
        },
        TransactionID: {
          type: 'string',
        },
        User: {
          type: 'string',
        },
        Version: {
          type: 'integer',
        },
      },
      required: ['LastChanged', 'TransactionID', 'User', 'Version'],
    },
  },
};
