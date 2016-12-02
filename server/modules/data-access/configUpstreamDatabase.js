/* Copyright (c) Trainline Limited, 2016. All rights reserved. See LICENSE.txt in the project root for license information. */

'use strict';

let config = require('config');
let crossAccount = require('modules/data-access/crossAccount');
let dynamoTableDatabase = require('modules/data-access/dynamoTableDatabase');
let Environment = require('models/Environment');
let fp = require('lodash/fp');
let s3ObjectDatabase = require('modules/data-access/s3ObjectDatabase');

const S3_OBJECT_URL_LBUPSTREAM = config.get('S3_OBJECT_URL_LBUPSTREAM');

let db = dynamoTableDatabase({
  entityDisplayName: 'load balancer upstream',
  logicalTableName: 'ConfigLBUpstream',
  itemSchema: 'ConfigLbUpstream',
});

let s3db = s3ObjectDatabase({
  objectUrl: S3_OBJECT_URL_LBUPSTREAM,
});

let eachAccount = crossAccount.eachAccount;
let ignoreErrors = crossAccount.ignoreErrors;

function accountFor(upstream) {
  return fp.flow(
    fp.get(['value']),
    JSON.parse,
    fp.get(['EnvironmentName']),
    Environment.getAccountNameForEnvironment)(upstream);
}

module.exports = {
  scan: s3db.scan,
  get: key => eachAccount(account => db.get(account, key)).then(fp.flow(ignoreErrors, fp.find(x => x))),
  create: upstream => accountFor(upstream).then(account => db.create(account, upstream)),
  put: upstream => accountFor(upstream).then(account => db.put(account, upstream)),
  delete: (key, version) => eachAccount(account => db.delete(account, key, version)).then(ignoreErrors),
};
