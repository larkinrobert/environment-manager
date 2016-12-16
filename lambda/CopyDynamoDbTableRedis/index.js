'use strict';

let AWS = require('aws-sdk');
let fp = require('lodash/fp');
let Redis = require('ioredis');

const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;

let dynamodb = new AWS.DynamoDB();

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

/**
 * Returns a function that extracts the key from a DynamoDB record
 */
let keyAttributesOf = fp.compose(fp.map(a => a.AttributeName), fp.get(['Table', 'KeySchema']));

exports.handler = (event, context, callback) => {
    const DYNAMODB_TABLE_ARN = (() => {
        let t = parseFunctionArn(context.invokedFunctionArn);
        return `arn:aws:dynamodb:${t.region}:${t.account}:table/${DYNAMODB_TABLE_NAME}`;
    })();

    let bumpVersionOfEachItem = (tableDescription) => new Promise((resolve, reject) => {
        function bumpVersion(item) {
            return dynamodb.updateItem({
                TableName: DYNAMODB_TABLE_NAME,
                Key: fp.pick(keyAttributesOf(tableDescription))(item),
                UpdateExpression: 'SET #version = #Audit.#Version + :incr, #Audit.#Version = #Audit.#Version + :incr',
                ExpressionAttributeNames: {
                    '#Audit': 'Audit',
                    '#version': 'version',
                    '#Version': 'Version',
                },
                ExpressionAttributeValues: {
                    ':incr': { N: '1' },
                },
            }).promise();
        }

        let acc = [];
        dynamodb.scan({
            TableName: DYNAMODB_TABLE_NAME,
            AttributesToGet: keyAttributesOf(tableDescription)
        }).eachPage((err, data, done) => {
            if (err) {
                done();
                reject(err);
            }
            else if (data === null) {
                done();
                resolve(acc);
            } else {
                Promise.all(data.Items.map(bumpVersion)).then(done).catch(err => reject(err));
            }
        });
    });

    dynamodb.describeTable({ TableName: DYNAMODB_TABLE_NAME }).promise()
        .then(bumpVersionOfEachItem)
        .then(x => callback(null, x))
        .catch(e => callback(e));
};