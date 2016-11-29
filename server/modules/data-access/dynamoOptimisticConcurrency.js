/* Copyright (c) Trainline Limited, 2016. All rights reserved. See LICENSE.txt in the project root for license information. */

'use strict';

let fp = require('lodash/fp');

let versionOf = fp.get(['version']);

/**
 * Increment the version of a DynamoDB item.
 */
function incrementVersion(record) {
  let version = versionOf(record) + 1;
  let Audit = fp.assign(fp.get(['Audit'])(record))({ Version: version });
  let result = fp.assign(record)({ version, Audit });
  return result;
}

/**
 * Construct an expression to be transformed to a DynamoDB ConditionExpression http://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.SpecifyingConditions.html
 * by the dynamodbExpression module. For examples, please see dynamodbExpressionTest.
 */
function versionMatches(record) {
  let version = typeof record === 'string' || typeof record === 'number'
    ? record
    : versionOf(record);
  return ['=', ['attr', 'Audit', 'Version'], ['val', version]];
}

/**
 * Construct an expression to be transformed to a DynamoDB ConditionExpression http://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.SpecifyingConditions.html
 * by the dynamodbExpression module. For examples, please see dynamodbExpressionTest.
 */
function doesNotExist(hashKey) {
  return ['attribute_not_exists', ['at', hashKey]];
}

function display(key) {
  return JSON.stringify(key);
}

function handleCreateConditionalCheckFailed(entityDisplayName, key, error) {
  if (error.code === 'ConditionalCheckFailedException') {
    let e = new Error(`Refused to create ${entityDisplayName} ${display(key)} because it would overwrite an existing ${entityDisplayName} with the same key.`);
    e.tags = ['dynamo-db', entityDisplayName, 'create', 'exists'];
    return Promise.reject(e);
  } else {
    return Promise.reject(error);
  }
}

function handleDeleteConditionalCheckFailed(entityDisplayName, key, error) {
  if (error.code === 'ConditionalCheckFailedException') {
    let e = new Error(`Refused to delete ${entityDisplayName} ${display(key)} because it has been modified since you last saw it.`);
    e.tags = ['dynamo-db', entityDisplayName, 'delete', 'optimistic-concurrency'];
    return Promise.reject(e);
  } else {
    return Promise.reject(error);
  }
}

function handleUpdateConditionalCheckFailed(entityDisplayName, key, error) {
  if (error.code === 'ConditionalCheckFailedException') {
    let e = new Error(`Refused to modify ${entityDisplayName} ${display(key)} because your changes would overwrite changes made since you last saw it.`);
    e.tags = ['dynamo-db', entityDisplayName, 'update', 'optimistic-concurrency'];
    return Promise.reject(e);
  } else {
    return Promise.reject(error);
  }
}

module.exports = {
  doesNotExist,
  handleCreateConditionalCheckFailed,
  handleDeleteConditionalCheckFailed,
  handleUpdateConditionalCheckFailed,
  incrementVersion,
  versionMatches,
};
