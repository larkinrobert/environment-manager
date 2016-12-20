'use strict';

let AWS = require('aws-sdk');
let emCrypto = require('./em-crypto');
let Redis = require('ioredis');
let unmarshalItem = require('dynamodb-marshaler').unmarshalItem;

const CRYPTO_KEY_S3_BUCKET = process.env.CRYPTO_KEY_S3_BUCKET;
const CRYPTO_KEY_S3_KEY = process.env.CRYPTO_KEY_S3_KEY;
const REDIS_ADDRESS = process.env.REDIS_ADDRESS;
const REDIS_PORT = process.env.REDIS_PORT;

function getTableARN(streamARN) {
    let match = /^arn:aws:dynamodb:[^:]+:[^:]+:table\/[^\/]+/.exec(streamARN);
    if (match) {
        return match[0];
    } else {
        throw new Error("Expected a DynamoDB stream ARN");
    }
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

function processRecords(redis, records) {
    let s3 = new AWS.S3();
    return s3.getObject({
        Bucket: CRYPTO_KEY_S3_BUCKET,
        Key: CRYPTO_KEY_S3_KEY,
    }).promise.then(s3Obj => {
        let cryptoKey = s3Obj.Body;
        function processRecord(record) {
            let tableARN = getTableARN(record.eventSourceARN);
            let key = JSON.stringify(unmarshalItem(record.dynamodb.Keys));
            let val = () => emCrypto.encrypt(cryptoKey, JSON.stringify(unmarshalItem(record.dynamodb.NewImage)));
            console.log(record.eventName);
            if (record.eventName === 'INSERT') {
                return ['hset', tableARN, key, val()];
            } else if (record.eventName === 'MODIFY') {
                return ['hset', tableARN, key, val()];
            } else if (record.eventName === 'REMOVE') {
                return ['hdel', tableARN, key];
            }
        }
        let instructions = records.map(processRecord);
        console.log(instructions);
        let pipeline = redis.pipeline(instructions);
        return pipeline.exec();
    });
}

function handler(event, context, callback) {
    let connect = () => connectRedis({ address: REDIS_ADDRESS, port: REDIS_PORT });
    usingRedisConnection(connect, redis => processRecords(redis, event.Records))
        .then(x => callback(null, x))
        .catch(e => callback(e));
};

module.exports = {
    handler,
};