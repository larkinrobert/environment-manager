/* Copyright (c) Trainline Limited, 2016. All rights reserved. See LICENSE.txt in the project root for license information. */

'use strict';

let crossAccount = require('modules/data-access/crossAccount');
let dynamoTableDatabase = require('modules/data-access/dynamoTableDatabase');
let Environment = require('models/Environment');
let fp = require('lodash/fp');

let db = dynamoTableDatabase({
  entityDisplayName: 'load balancer upstream',
  logicalTableName: 'ConfigLBUpstream',
  itemSchema: 'ConfigLbUpstream',
});

let eachAccount = crossAccount.eachAccount;
let ignoreErrors = crossAccount.ignoreErrors;

function accountFor(upstream) {
  return fp.flow(fp.get(['value']), JSON.parse, fp.get(['EnvironmentName']), Environment.getAccountNameForEnvironment)(upstream);
}

module.exports = {
  scan: () => eachAccount(db.scan).then(fp.flow(ignoreErrors, crossAccount.flatten)),
  get: key => eachAccount(account => db.get(account, key)).then(fp.flow(ignoreErrors, fp.find(x => x))),
  create: upstream => accountFor(upstream).then(account => db.create(account, upstream)),
  put: upstream => accountFor(upstream).then(account => db.put(account, upstream)),
  delete: (key, version) => eachAccount(account => db.delete(account, key, version)).then(ignoreErrors),
};
