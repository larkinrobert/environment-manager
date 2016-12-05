'use strict';

let AWS = require('aws-sdk');
let fp = require('lodash/fp');
let Redis = require('ioredis');

const REDIS_ADDRESS = process.env.REDIS_ADDRESS;
const REDIS_PORT = process.env.REDIS_PORT;
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;

let dynamodb = new AWS.DynamoDB();
let documentclient = new AWS.DynamoDB.DocumentClient();

function parseFunctionArn(functionArn) {
    let match = /^arn:aws:lambda:([^:]+):([^:]+):function:/.exec(functionArn);
    if (match !== null && match.length > 2) {
        return {
            account: match[2],
            region: match[1],
        };
    }
    throw new Error('Could not parse invokedFunctionArn');
}

function connectRedis(redis) {
    let address = redis.address;
    let port = redis.port;
    return new Promise((resolve, reject) => {
        let client = new Redis(port, address);
        let events = ['close', 'connect', 'end', 'error', 'ready', 'reconnecting'];
        events.forEach(name => {
            client.on(name, e => {
                console.log(`${name}: redis ${address}:${port}`);
                if (e) {
                    console.log(e);
                }
            });
        });
        client.on('error', err => console.error(err));
        client.once('ready', () => resolve(client));
    });
}

function usingRedisConnection(connectionFactory, operation) {
    return Promise.resolve(connectionFactory())
        .then(redis => operation(redis).then(
            result => redis.quit().then(() => result),
            e => redis.quit().then(() => Promise.reject(e))));
}

function defineCommands(redis) {
    redis.defineCommand('setIfMatch', {
        numberOfKeys: 2, lua: `
local item = redis.call("HGET", KEYS[1], KEYS[2])
if not item then
  redis.call("HSET", KEYS[1], KEYS[2], ARGV[2])
else
  local mine = tostring(cjson.decode(item)["version"])
  local theirs = ARGV[1]
  if mine == theirs then
    redis.call("HSET", KEYS[1], KEYS[2], ARGV[2])
  end
end
` });
}

function processRecords(redis, tableARN, keyOf, records) {
    function processRecord(record) {
        // Identify the keys for this table
        let key = JSON.stringify(keyOf(record));
        let val = JSON.stringify(record);
        return ['hsetnx', tableARN, key, val];
    }
    let instructions = records.map(processRecord);
    console.log(fp.map(fp.take(3))(instructions));
    let pipeline = redis.pipeline(instructions);
    return pipeline.exec();
}

/**
 * Returns a function that extracts the key from a DynamoDB record
 */
function extractKey(tableDescription) {
    let keyAttributeNamesFrom = fp.compose(
        fp.map(a => a.AttributeName),
        fp.get(['Table', 'KeySchema']));
    return fp.pick(keyAttributeNamesFrom(tableDescription));
}

exports.handler = (event, context, callback) => {
    const DYNAMODB_TABLE_ARN = (() => {
        let t = parseFunctionArn(context.invokedFunctionArn);
        return `arn:aws:dynamodb:${t.region}:${t.account}:table/${DYNAMODB_TABLE_NAME}`;
    })();

    let connect = () => connectRedis({ address: REDIS_ADDRESS, port: REDIS_PORT });
    let copyFromDynamoToRedis = (redis, keyOf) => new Promise((resolve, reject) => {
        let acc = [];
        documentclient.scan({ TableName: DYNAMODB_TABLE_NAME }).eachPage((err, data, done) => {
            if (err) {
                done();
                reject(err);
            }
            else if (data === null) {
                done();
                resolve(acc);
            } else {
                processRecords(redis, DYNAMODB_TABLE_ARN, keyOf, data.Items).then(done).catch(err => reject(err));
            }
        });
    });

    dynamodb.describeTable({ TableName: DYNAMODB_TABLE_NAME }).promise()
        .then(tableDescription => usingRedisConnection(connect, redis => copyFromDynamoToRedis(redis, extractKey(tableDescription))))
        .then(x => callback(null, x))
        .catch(e => callback(e));
};