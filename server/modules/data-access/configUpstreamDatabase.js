/* Copyright (c) Trainline Limited, 2016. All rights reserved. See LICENSE.txt in the project root for license information. */

'use strict';

let config = require('config');
let crossAccount = require('modules/data-access/crossAccount');
let dynamoTableDatabase = require('modules/data-access/dynamoTableDatabase');
let Environment = require('models/Environment');
let fp = require('lodash/fp');
let logger = require('modules/logger');
let redisDatabase = require('modules/data-access/redisDatabase');

let db = dynamoTableDatabase({
  entityDisplayName: 'load balancer upstream',
  logicalTableName: 'ConfigLBUpstream',
  itemSchema: 'ConfigLbUpstream',
});

let cache = (() => {
  try {
    return redisDatabase({
      logicalTableName: 'ConfigLBUpstream',
    });
  } catch (error) {
    logger.error(error);
    return undefined;
  }
})();

let eachAccount = crossAccount.eachAccount;
let ignoreErrors = crossAccount.ignoreErrors;

function accountFor(upstream) {
  return fp.flow(
    fp.get(['value']),
    JSON.parse,
    fp.get(['EnvironmentName']),
    Environment.getAccountNameForEnvironment)(upstream);
}

function scan(account) {
  if (cache) {
    return cache.getAll(account)
      .then((cached) => {
        if (cached.error) {
          return db.scan(account);
        } else {
          return cached;
        }
      });
  } else {
    return db.scan(account);
  }
}

module.exports = {
  scan: () => eachAccount(scan).then(ignoreErrors),
  get: key => eachAccount(account => db.get(account, key)).then(fp.flow(ignoreErrors, fp.find(x => x))),
  create: upstream => accountFor(upstream).then(account => db.create(account, upstream)),
  put: upstream => accountFor(upstream).then(account => db.put(account, upstream)),
  delete: (key, version) => eachAccount(account => db.delete(account, key, version)).then(ignoreErrors),
};
