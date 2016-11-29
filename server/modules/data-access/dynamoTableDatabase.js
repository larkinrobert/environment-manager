/* Copyright (c) Trainline Limited, 2016. All rights reserved. See LICENSE.txt in the project root for license information. */

'use strict';

let awsResourceNameProvider = require('modules/awsResourceNameProvider');
let childAccountClient = require('modules/amazon-client/childAccountClient');
let dynamoAudit = require('modules/data-access/dynamoAudit');
let dynamoOptimisticConcurrency = require('modules/data-access/dynamoOptimisticConcurrency');
let dynamoPager = require('modules/data-access/dynamoPager');
let dynamoTableDescription = require('modules/data-access/dynamoTableDescription');
let expr = require('modules/awsDynamo/dynamodbExpression');
let fp = require('lodash/fp');
let schema = require('modules/schema/schema');

let omitAuditMetadata = dynamoAudit.omitAuditMetadata;
let versionMatches = dynamoOptimisticConcurrency.versionMatches;

function dynamodb(accountNumber) {
  if (accountNumber === undefined) {
    return childAccountClient.createDynamoClient();
  } else {
    return childAccountClient.createDynamoClient(`${accountNumber}`);
  }
}

function dynamoTableDatabase(options) {
  if (!options.logicalTableName) {
    throw new Error('The "logicalTableName" property of the "options" argument is required');
  }
  if (!options.itemSchema) {
    throw new Error('The "itemSchema" property of the "options" argument is required');
  }
  const ENTITY_DISPLAY_NAME = options.entityDisplayName || options.logicalTableName;
  const ITEM_SCHEMA = options.itemSchema;
  const TABLE_NAME = awsResourceNameProvider.getTableName(options.logicalTableName);

  function forThisTable(obj) {
    return Object.assign({ TableName: TABLE_NAME }, obj);
  }

  /* Return a memoized description of the DynamoDB table present in the account */
  let describeTable = accountNumber => dynamoTableDescription(TABLE_NAME, accountNumber);

  let getKeyAttributes = fp.get(['Table', 'KeySchema'])();

  /* Use the table description to extract the value of the key from the entity */
  function extractKey(tableDescription, entity) {
    let attrs = fp.flow(getKeyAttributes, fp.map(x => x.AttributeName))(tableDescription);
    return fp.pick(attrs)(entity);
  }

  /* Use the table description to look up the name of the hash key attribute */
  function getHashKeyAttribute(tableDescription) {
    return fp.flow(
      getKeyAttributes,
      fp.find(x => x.KeyType === 'HASH'),
      fp.get(['AttributeName']))(tableDescription);
  }

  let doesNotExist = hashKey => dynamoOptimisticConcurrency.doesNotExist(hashKey);

  /* Validate the entity against a JSON schema */
  function validate(entity) {
    return schema(ITEM_SCHEMA).then(validator => validator.conform(entity));
  }

  function scan(accountNumber) {
    let params = forThisTable();
    return dynamodb(accountNumber)
        .then(dynamo => dynamoPager.promiseAllItems(dynamo.scan(params)))
        .then(items => items.map(omitAuditMetadata));
  }

  function get(accountNumber, key) {
    let params = forThisTable({
      Key: key,
    });
    return dynamodb(accountNumber)
        .then(dynamo => dynamo.get(params).promise())
        .then(result => result.Item)
        .then(omitAuditMetadata);
  }

  function create(accountNumber, entity) {
    let itemToSave = dynamoAudit.withAudit(fp.assign({ version: 0 })(entity));
    return validate(itemToSave).then(() => describeTable(accountNumber)).then((tableDescription) => {
      let key = extractKey(tableDescription, itemToSave);
      let condition = {
        ConditionExpression: doesNotExist(getHashKeyAttribute(tableDescription)),
      };
      let params = Object.assign({}, expr.compile(condition), forThisTable({ Item: itemToSave }));
      function handleError(error) {
        return dynamoOptimisticConcurrency.handleCreateConditionalCheckFailed(ENTITY_DISPLAY_NAME, key, error);
      }
      return dynamodb(accountNumber)
      .then(dynamo => dynamo.put(params).promise().catch(handleError));
    });
  }

  function put(accountNumber, entity) {
    let itemToSave = dynamoOptimisticConcurrency.incrementVersion(dynamoAudit.withAudit(entity));
    return validate(itemToSave).then(() => describeTable(accountNumber)).then((tableDescription) => {
      let key = extractKey(tableDescription, itemToSave);
      let condition = {
        ConditionExpression: ['or', versionMatches(entity), doesNotExist(getHashKeyAttribute(tableDescription))],
      };
      let params = Object.assign({}, expr.compile(condition), forThisTable({ Item: itemToSave }));
      function handleError(error) {
        return dynamoOptimisticConcurrency.handleUpdateConditionalCheckFailed(ENTITY_DISPLAY_NAME, key, error);
      }
      return dynamodb(accountNumber).then(dynamo => dynamo.put(params).promise().catch(handleError));
    });
  }

  function $delete(accountNumber, key, version) {
    return describeTable(accountNumber).then((tableDescription) => {
      let expectedKeyProperties = fp.flow(getKeyAttributes, fp.map(x => x.AttributeName), fp.sortBy(x => x))(tableDescription);
      let actualKeyProperties = fp.flow(fp.keys, fp.sortBy(x => x))(key);
      if (!fp.isEqual(expectedKeyProperties)(actualKeyProperties)) {
        let expected = fp.flow(x => `"${x}"`, fp.join(', '))(expectedKeyProperties);
        return Promise.reject(new Error(`Expected argument "key" to have exactly these properties: ${expected}`));
      }
      let params = (() => {
        if (version === undefined) {
          return forThisTable({ Key: key });
        } else {
          let condition = {
            ConditionExpression: versionMatches(version),
          };
          return Object.assign({}, expr.compile(condition), forThisTable({ Key: key }));
        }
      })();
      function handleError(error) {
        return dynamoOptimisticConcurrency.handleDeleteConditionalCheckFailed(ENTITY_DISPLAY_NAME, key, error);
      }
      return dynamodb(accountNumber).then(dynamo => dynamo.delete(params).promise().catch(handleError));
    });
  }

  return {
    create,
    delete: $delete,
    get,
    put,
    scan,
  };
}

module.exports = dynamoTableDatabase;
