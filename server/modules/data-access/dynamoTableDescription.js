/* Copyright (c) Trainline Limited, 2016. All rights reserved. See LICENSE.txt in the project root for license information. */

'use strict';

let childAccountClient = require('modules/amazon-client/childAccountClient');
let memoize = require('modules/memoize');

function describeTable(tableName, accountNumber) {
  let params = { TableName: tableName };
  return childAccountClient.createLowLevelDynamoClient(accountNumber)
    .then(dynamo => dynamo.describeTable(params).promise());
}

module.exports = memoize(describeTable);
