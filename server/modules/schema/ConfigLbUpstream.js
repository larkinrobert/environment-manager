'use strict';

module.exports = {
  id: 'ConfigLbUpstream',
  $schema: 'http://json-schema.org/draft-04/schema#',
  title: 'Load Balancer Upstream Configuration',
  description: 'Load Balancer Upstream Configuration',
  type: 'object',
  allOf: [
    { $ref: 'CommonAuditField' },
    { $ref: '#/definitions/self' },
  ],
  definitions: {
    self: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          pattern: '^/[a-zA-Z0-9_-]+/config$',
        },
        value: {
          type: 'string',
          minLength: 2,
          maxLength: 2000,
        },
      },
      required: ['key', 'Audit', 'value'],
    },
  },
};
