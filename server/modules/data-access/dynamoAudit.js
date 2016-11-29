/* Copyright (c) Trainline Limited, 2016. All rights reserved. See LICENSE.txt in the project root for license information. */

'use strict';

let fp = require('lodash/fp');

/**
 * Set the LastChanged and Version audit metadata properties of the DynamoDB item
 */
function withAudit(record) {
  let audit = fp.assign(fp.get('Audit')(record))({
    LastChanged: new Date().toISOString(),
    Version: fp.get('version')(record),
  });
  return fp.assign(record)({ Audit: audit });
}

module.exports = {
  withAudit,
};
