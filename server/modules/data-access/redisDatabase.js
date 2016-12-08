/* Copyright (c) Trainline Limited, 2016. All rights reserved. See LICENSE.txt in the project root for license information. */

'use strict';

let awsResourceNameProvider = require('modules/awsResourceNameProvider');
let config = require('config');
let dynamoTableDescription = require('modules/data-access/dynamoTableDescription');
let logger = require('modules/logger');
let Redis = require('ioredis');

const EM_REDIS_ADDRESS = config.get('EM_REDIS_ADDRESS');
const EM_REDIS_PORT = config.get('EM_REDIS_PORT');

function connect({ address, port }) {
  return new Promise((resolve, reject) => {
    let client = new Redis(address, port);
    let events = ['close', 'connect', 'end', 'error', 'ready', 'reconnecting'];
    events.forEach((name) => {
      client.on(name, (e) => {
        logger.debug(`${name}: redis ${address}:${port}`);
        if (e) {
          logger.debug(e);
        }
      });
    });
    client.once('ready', () => resolve(client));
    client.on('error', e => logger.error(e));
  });
}

function usingRedisConnection(connectionFactory, operation) {
  return Promise.resolve(connectionFactory())
    .then(redis => Promise.resolve(operation(redis)).then(
      result => redis.quit().then(() => result),
      e => redis.quit().then(() => Promise.reject(e))));
}

function redisDatabase(options) {
  if (!options.logicalTableName) {
    throw new Error('The "logicalTableName" property of the "options" argument is required');
  }
  const TABLE_NAME = awsResourceNameProvider.getTableName(options.logicalTableName);
  let connectDefault = connect.bind(null, { address: EM_REDIS_ADDRESS, port: EM_REDIS_PORT });

  function getAll(accountNumber) {
    return dynamoTableDescription(TABLE_NAME, accountNumber).then((tableDescription) => {
      let tableArn = tableDescription.Table.TableArn;
      return usingRedisConnection(connectDefault, redis => redis.hgetall(tableArn));
    });
  }

  return {
    getAll,
  };
}

module.exports = redisDatabase;
